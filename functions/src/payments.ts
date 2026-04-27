import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {
  createPaymentWebhookEvent,
  createTicketOrderForCheckout,
  getPaymentWebhookEventByStripeEventId,
  getSectionByIdForCallable,
  getTicketOrderForWebhook,
  getTicketTypeForCheckout,
  getUserForCheckout,
  getUserUserGroupsForAdmin,
  markTicketOrderFailedFromWebhook,
  markTicketOrderPaidFromWebhook,
  markTicketOrderRefundedFromWebhook,
  upsertTicketOrderDisputeFromWebhook,
  updateUserStripeCustomerId,
  PaymentWebhookEventOutcome,
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
  TicketAudience,
  TicketOrderStatus,
  upsertPaymentReconciliationException,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { requireEnabled, validateUUID } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { userMatchesUserGroup, userHasBookerPurpose } from "./bookingRules";
import Stripe from "stripe";
import {
  isSupportedStripeEventType,
  normalizeStripeEvent,
} from "./paymentStateMachine";
import { runTicketOrderTransition } from "./paymentTransitionEngine";
import { evaluateReconciliationSignals } from "./paymentReconciliation";

const stripeSecret = defineSecret("STRIPE_SECRET");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const CHECKOUT_CURRENCY = "gbp";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

function requireStripe(secretValue: string | undefined): InstanceType<typeof Stripe> {
  if (!secretValue) {
    throw new HttpsError("failed-precondition", "Stripe is not configured on the server");
  }
  return new Stripe(secretValue);
}

function ensureBookingWindow(start: string, end: string): void {
  const now = Date.now();
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || now < s || now > e) {
    throw new HttpsError("failed-precondition", "Ticket sales are not open for this event");
  }
}

function toMinorUnits(price: number): number {
  return Math.round(price * 100);
}

function stripeObjectIdFromEvent(event: { data: { object: unknown } }): string | null {
  const obj = event.data.object as { id?: unknown };
  return typeof obj.id === "string" ? obj.id : null;
}

function isoTimestampFromStripeEpochSeconds(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

async function appendWebhookLedgerEvent(args: {
  stripeEventId: string;
  eventType: string;
  outcome: PaymentWebhookEventOutcome;
  reason: string;
  ticketOrderId?: UUIDString;
  stripeObjectId?: string | null;
  livemode: boolean;
}): Promise<void> {
  await createPaymentWebhookEvent({
    stripeEventId: args.stripeEventId,
    eventType: args.eventType,
    outcome: args.outcome,
    reason: args.reason,
    ticketOrderId: args.ticketOrderId ?? null,
    stripeObjectId: args.stripeObjectId ?? null,
    livemode: args.livemode,
  });
}

const RECONCILIATION_EXCEPTION_TYPES = [
  PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
  PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH,
  PaymentReconciliationExceptionType.ACTIVE_DISPUTE,
] as const;

async function upsertReconciliationSnapshot(args: {
  orderId: UUIDString;
  snapshot: {
    status: TicketOrderStatus;
    totalAmountMinor: number;
    refundedAmountMinor?: number | null;
    stripePaymentIntentId?: string | null;
    disputeStatus?: string | null;
  };
}): Promise<void> {
  const signals = evaluateReconciliationSignals(args.snapshot);
  const signalMap = new Map(signals.map((signal) => [signal.type, signal]));
  const nowIso = new Date().toISOString();

  for (const type of RECONCILIATION_EXCEPTION_TYPES) {
    const signal = signalMap.get(type);
    await upsertPaymentReconciliationException({
      ticketOrderId: args.orderId,
      exceptionType: type,
      status: signal ? PaymentReconciliationExceptionStatus.OPEN : PaymentReconciliationExceptionStatus.RESOLVED,
      note: signal?.note ?? "Auto-resolved by reconciliation snapshot",
      ownerUserId: null,
      lastAttemptedAt: nowIso,
      resolvedAt: signal ? null : nowIso,
    });
  }
}

export const createTicketCheckoutSession = onCall({ region: FUNCTIONS_REGION, secrets: [stripeSecret] }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  const quantity = Number(request.data?.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new HttpsError("invalid-argument", "quantity must be an integer between 1 and 10");
  }
  const ticketTypeId = validateUUID(String(request.data?.ticketTypeId), "ticketTypeId") as UUIDString;

  const dcUser = await getUserForCheckout({ userId: uid });
  const user = dcUser.data?.user;
  if (!user) throw new HttpsError("failed-precondition", "User profile is required");

  const ttResult = await getTicketTypeForCheckout({ ticketTypeId });
  const ticketType = ttResult.data?.ticketType;
  if (!ticketType) throw new HttpsError("not-found", "Ticket type not found");
  if (ticketType.audience !== TicketAudience.MEMBER) {
    throw new HttpsError("failed-precondition", "Only member tickets are supported in Checkout v1");
  }
  ensureBookingWindow(ticketType.event.bookingStartDateTime, ticketType.event.bookingEndDateTime);

  const section = await getSectionByIdForCallable({ id: ticketType.event.section.id as UUIDString });
  const sectionData = section.data?.section;
  if (!sectionData) throw new HttpsError("not-found", "Section not found");
  const userGroups = await getUserUserGroupsForAdmin({ userId: uid });
  const explicitGroupIds = new Set((userGroups.data?.user?.userGroups ?? []).map((x) => validateUUID(x.userGroup.id)));
  const membershipStatus = user.membershipStatus;
  if (
    !userHasBookerPurpose(
      (sectionData.purposeLinks ?? []).map((l) => ({
        purposes: l.purposes ?? [],
        userGroup: { id: validateUUID(l.userGroup.id), membershipStatuses: l.userGroup.membershipStatuses ?? null },
      })),
      explicitGroupIds,
      membershipStatus
    )
  ) {
    throw new HttpsError("permission-denied", "You are not eligible to purchase this ticket");
  }
  if (
    !userMatchesUserGroup(
      membershipStatus,
      { id: validateUUID(ticketType.userGroup.id), membershipStatuses: ticketType.userGroup.membershipStatuses ?? null },
      explicitGroupIds
    )
  ) {
    throw new HttpsError("permission-denied", "You are not eligible for this ticket type");
  }

  const stripeClient = requireStripe(stripeSecret.value());
  let customerId = user.stripeCustomerId ?? null;
  if (!customerId) {
    const created = await stripeClient.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      metadata: { firebaseUid: uid },
    });
    customerId = created.id;
    await updateUserStripeCustomerId({ userId: uid, stripeCustomerId: customerId });
  }

  const unitAmountMinor = toMinorUnits(ticketType.price);
  const totalAmountMinor = unitAmountMinor * quantity;
  const order = await createTicketOrderForCheckout({
    userId: uid,
    eventId: ticketType.event.id as UUIDString,
    ticketTypeId: ticketType.id as UUIDString,
    quantity,
    unitAmountMinor,
    totalAmountMinor,
    currency: CHECKOUT_CURRENCY,
  });
  const orderId = order.data?.ticketOrder_insert?.id;
  if (!orderId) throw new HttpsError("internal", "Failed to create ticket order");

  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer: customerId ?? undefined,
    success_url: `${APP_BASE_URL}/?checkout=success&orderId=${orderId}`,
    cancel_url: `${APP_BASE_URL}/?checkout=cancel&orderId=${orderId}`,
    line_items: [
      {
        quantity,
        price_data: {
          currency: CHECKOUT_CURRENCY,
          unit_amount: unitAmountMinor,
          product_data: {
            name: ticketType.title,
            description: `Event: ${ticketType.event.title}`,
          },
        },
      },
    ],
    metadata: {
      firebaseUid: uid,
      ticketTypeId: ticketType.id,
      eventId: ticketType.event.id,
      orderId,
    },
  });

  if (!session.url) throw new HttpsError("internal", "Failed to create Stripe Checkout session");
  return { url: session.url, orderId };
});

export const stripeWebhook = onRequest({ region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret] }, async (req, res) => {
  try {
    const stripeClient = requireStripe(stripeSecret.value());
    const webhookSecret = stripeWebhookSecret.value();
    if (!webhookSecret) {
      logger.error("Missing STRIPE_WEBHOOK_SECRET");
      res.status(500).send("Webhook secret not configured");
      return;
    }
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      res.status(400).send("Missing stripe-signature");
      return;
    }

    const event = stripeClient.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    const supportedEventType = isSupportedStripeEventType(event.type);
    const stripeObjectId = stripeObjectIdFromEvent(event);
    const existingWebhookEvent = await getPaymentWebhookEventByStripeEventId({ stripeEventId: event.id });
    if ((existingWebhookEvent.data?.paymentWebhookEvents?.length ?? 0) > 0) {
      logger.info("stripeWebhook duplicate delivery", {
        eventType: event.type,
        eventId: event.id,
        stripeObjectId,
      });
      res.status(200).send("Duplicate event");
      return;
    }

    const normalized = normalizeStripeEvent(event);
    if (normalized.kind === "ignore") {
      logger.info("stripeWebhook ignored event", {
        eventType: event.type,
        eventId: event.id,
        supportedEventType,
        reason: normalized.reason,
      });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: normalized.reason,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("Ignored event");
      return;
    }
    if (!normalized.orderId) {
      logger.info("stripeWebhook missing order metadata", { eventType: event.type, reason: normalized.reason, eventId: event.id });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "missing_order_metadata",
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("No order metadata");
      return;
    }

    const canonicalOrderId = validateUUID(normalized.orderId, "orderId") as UUIDString;
    const existing = await getTicketOrderForWebhook({ id: canonicalOrderId });
    const order = existing.data?.ticketOrder;
    if (!order) {
      logger.info("stripeWebhook order not found", { eventType: event.type, eventId: event.id, orderId: canonicalOrderId });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "order_not_found",
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("Order not found");
      return;
    }

    if (normalized.kind === "dispute_side_state") {
      const dispute = event.data.object as {
        id?: string;
        status?: string;
        reason?: string;
        amount?: number;
      };
      const eventTimestamp = isoTimestampFromStripeEpochSeconds((event as { created?: unknown }).created);
      await upsertTicketOrderDisputeFromWebhook({
        id: canonicalOrderId,
        webhookEventId: event.id,
        stripeDisputeId: dispute.id ?? null,
        disputeStatus: dispute.status ?? normalized.disputeState ?? null,
        disputeReason: dispute.reason ?? null,
        disputeAmountMinor: typeof dispute.amount === "number" ? dispute.amount : null,
        disputeOpenedAt: normalized.disputeState === "DISPUTE_OPEN" ? eventTimestamp : null,
        disputeUpdatedAt: eventTimestamp,
        disputeClosedAt: normalized.disputeState === "DISPUTE_CLOSED" ? eventTimestamp : null,
      });
      logger.info("stripeWebhook dispute side-state (no order status change)", {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
        disputeState: normalized.disputeState,
      });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.PROCESSED,
        reason: `dispute_side_state:${normalized.disputeState ?? "UNKNOWN"}`,
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      await upsertReconciliationSnapshot({
        orderId: canonicalOrderId,
        snapshot: {
          status: order.status,
          totalAmountMinor: order.totalAmountMinor,
          refundedAmountMinor: order.refundedAmountMinor ?? null,
          stripePaymentIntentId: order.stripePaymentIntentId ?? null,
          disputeStatus: dispute.status ?? normalized.disputeState ?? null,
        },
      });
      res.status(200).send("Dispute side-state acknowledged");
      return;
    }

    const intent = normalized.intent;
    if (!intent) {
      logger.error("stripeWebhook payment transition without intent", {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
      });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.FAILED,
        reason: "missing_transition_intent",
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("Missing transition intent");
      return;
    }
    const transitionResult = await runTicketOrderTransition(
      {
        orderId: canonicalOrderId,
        currentStatus: order.status,
        intent,
        webhookEventId: event.id,
        paidContext:
          intent === "MARK_PAID"
            ? (() => {
                const session = event.data.object as {
                  id?: string;
                  payment_intent?: string | { id?: string };
                };
                return {
                  stripeCheckoutSessionId: session.id ?? null,
                  stripePaymentIntentId:
                    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
                };
              })()
            : undefined,
        refundContext:
          intent === "MARK_REFUNDED"
            ? (() => {
                const charge = event.data.object as {
                  id?: string;
                  amount_refunded?: number;
                  refunds?: { data?: Array<{ id?: string }> };
                };
                const latestRefundId = charge.refunds?.data?.[0]?.id ?? null;
                return {
                  stripeRefundId: latestRefundId,
                  refundedAmountMinor: typeof charge.amount_refunded === "number" ? charge.amount_refunded : null,
                  refundedAt: isoTimestampFromStripeEpochSeconds((event as { created?: unknown }).created),
                };
              })()
            : undefined,
      },
      {
        markPaid: markTicketOrderPaidFromWebhook,
        markFailed: markTicketOrderFailedFromWebhook,
        markRefunded: markTicketOrderRefundedFromWebhook,
      }
    );
    if (transitionResult.action !== "applied") {
      logger.info("stripeWebhook transition skipped", {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
        fromStatus: transitionResult.fromStatus,
        targetStatus: transitionResult.targetStatus,
        decision: transitionResult.action,
        reason: transitionResult.reason,
        intent: transitionResult.intent,
      });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: `transition_${transitionResult.action}:${transitionResult.reason}:${transitionResult.fromStatus}->${transitionResult.targetStatus}:${transitionResult.intent}`,
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send(transitionResult.action === "noop_replay" ? "Already processed" : "Illegal transition skipped");
      return;
    }
    await appendWebhookLedgerEvent({
      stripeEventId: event.id,
      eventType: event.type,
      outcome: PaymentWebhookEventOutcome.PROCESSED,
      reason: `transition_applied:${transitionResult.reason}:${transitionResult.fromStatus}->${transitionResult.targetStatus}:${transitionResult.intent}`,
      ticketOrderId: canonicalOrderId,
      stripeObjectId,
      livemode: event.livemode,
    });
    const nextStatus = transitionResult.action === "applied" ? transitionResult.targetStatus : order.status;
    const paymentIntentIdFromEvent =
      intent === "MARK_PAID"
        ? (() => {
            const session = event.data.object as { payment_intent?: string | { id?: string } };
            return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
          })()
        : null;
    const refundAmountFromEvent =
      intent === "MARK_REFUNDED"
        ? (() => {
            const charge = event.data.object as { amount_refunded?: number };
            return typeof charge.amount_refunded === "number" ? charge.amount_refunded : null;
          })()
        : null;
    await upsertReconciliationSnapshot({
      orderId: canonicalOrderId,
      snapshot: {
        status: nextStatus,
        totalAmountMinor: order.totalAmountMinor,
        refundedAmountMinor: refundAmountFromEvent ?? order.refundedAmountMinor ?? null,
        stripePaymentIntentId: paymentIntentIdFromEvent ?? order.stripePaymentIntentId ?? null,
        disputeStatus: order.disputeStatus ?? null,
      },
    });
    res.status(200).send("ok");
  } catch (err) {
    logger.error("stripeWebhook error", err);
    res.status(400).send("Webhook error");
  }
});
