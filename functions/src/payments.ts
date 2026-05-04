import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {
  createPaymentWebhookEvent,
  createTicketOrderForCheckout,
  getPaymentWebhookEventByStripeEventId,
  getSectionByIdForCallable,
  getPaymentReconciliationExceptionByOrderAndType,
  getTicketOrderForWebhook,
  getTicketOrdersStripeArtifactsForCallable,
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
  createPaymentReconciliationException,
  updatePaymentReconciliationExceptionById,
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
import { emitPaymentLifecycleNotification } from "./paymentNotifications";
import { classifyStripeWebhookDomain } from "./stripeWebhookRouting";

const stripeSecret = defineSecret("STRIPE_SECRET");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripeWebhookPaymentsSecret = defineSecret("STRIPE_WEBHOOK_SECRET_PAYMENTS");
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
    const status = signal ? PaymentReconciliationExceptionStatus.OPEN : PaymentReconciliationExceptionStatus.RESOLVED;
    const note = signal?.note ?? "Auto-resolved by reconciliation snapshot";
    const existing = await getPaymentReconciliationExceptionByOrderAndType({
      ticketOrderId: args.orderId,
      exceptionType: type,
    });
    const existingRow = existing.data?.paymentReconciliationExceptions?.[0];

    if (existingRow?.id) {
      await updatePaymentReconciliationExceptionById({
        id: existingRow.id,
        status,
        note,
        ownerUserId: null,
        lastAttemptedAt: nowIso,
        resolvedAt: signal ? null : nowIso,
      });
    } else {
      await createPaymentReconciliationException({
        ticketOrderId: args.orderId,
        exceptionType: type,
        status,
        note,
        ownerUserId: null,
        lastAttemptedAt: nowIso,
        resolvedAt: signal ? null : nowIso,
      });
    }
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

async function fetchStripeArtifactsForOrder(args: {
  stripeClient: InstanceType<typeof Stripe>;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId: string;
}): Promise<{ receiptUrl: string | null; hostedInvoiceUrl: string | null; invoicePdfUrl: string | null }> {
  let receiptUrl: string | null = null;
  let hostedInvoiceUrl: string | null = null;
  let invoicePdfUrl: string | null = null;

  if (args.stripeCheckoutSessionId) {
    const session = (await args.stripeClient.checkout.sessions.retrieve(args.stripeCheckoutSessionId, {
      expand: ["invoice", "payment_intent.latest_charge"],
    })) as {
      invoice?: string | { hosted_invoice_url?: string | null; invoice_pdf?: string | null };
      payment_intent?: string | { latest_charge?: string | { receipt_url?: string | null } };
    };
    const invoice = session.invoice && typeof session.invoice !== "string" ? session.invoice : null;
    hostedInvoiceUrl = invoice?.hosted_invoice_url ?? null;
    invoicePdfUrl = invoice?.invoice_pdf ?? null;
    const paymentIntent =
      session.payment_intent && typeof session.payment_intent !== "string" ? session.payment_intent : null;
    const latestCharge =
      paymentIntent?.latest_charge && typeof paymentIntent.latest_charge !== "string"
        ? paymentIntent.latest_charge
        : null;
    receiptUrl = latestCharge?.receipt_url ?? null;
  }

  if (!receiptUrl) {
    const paymentIntent = (await args.stripeClient.paymentIntents.retrieve(args.stripePaymentIntentId, {
      expand: ["latest_charge"],
    })) as { latest_charge?: string | { receipt_url?: string | null } };
    const latestCharge =
      paymentIntent.latest_charge && typeof paymentIntent.latest_charge !== "string"
        ? paymentIntent.latest_charge
        : null;
    receiptUrl = latestCharge?.receipt_url ?? null;
  }

  return {
    receiptUrl,
    hostedInvoiceUrl,
    invoicePdfUrl,
  };
}

export const getMyTicketOrderStripeArtifactsBatch = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret] },
  async (request) => {
    requireEnabled(request);
    const uid = request.auth!.uid;
    const orderIds = Array.isArray(request.data?.orderIds)
      ? request.data.orderIds.map((id: unknown) => validateUUID(String(id), "orderId") as UUIDString)
      : [];
    if (orderIds.length === 0 || orderIds.length > 50) {
      throw new HttpsError("invalid-argument", "orderIds must contain between 1 and 50 ids");
    }
    const result = await getTicketOrdersStripeArtifactsForCallable({ orderIds });
    const orders = result.data?.ticketOrders ?? [];
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    for (const requestedOrderId of orderIds) {
      const order = orderMap.get(requestedOrderId);
      if (!order) {
        continue;
      }
      if (order.user.id !== uid) {
        logger.warn("stripe artifact batch access denied: order ownership mismatch", {
          orderId: requestedOrderId,
          uid,
          orderUserId: order.user.id,
        });
        throw new HttpsError("permission-denied", "You can only view Stripe artifacts for your own orders");
      }
    }

    const stripeClient = requireStripe(stripeSecret.value());
    return {
      artifactsByOrderId: Object.fromEntries(
        await Promise.all(
          orderIds.map(async (orderId: UUIDString) => {
            const order = orderMap.get(orderId);
            if (!order) {
              logger.info("stripe artifacts skipped: order missing from batch result", {
                orderId,
                uid,
              });
              return [
                orderId,
                {
                  receiptUrl: null,
                  hostedInvoiceUrl: null,
                  invoicePdfUrl: null,
                },
              ];
            }
            if (!order.stripePaymentIntentId) {
              return [
                orderId,
                {
                  receiptUrl: null,
                  hostedInvoiceUrl: null,
                  invoicePdfUrl: null,
                },
              ];
            }
            const artifacts = await fetchStripeArtifactsForOrder({
              stripeClient,
              stripeCheckoutSessionId: order.stripeCheckoutSessionId ?? null,
              stripePaymentIntentId: order.stripePaymentIntentId,
            });
            logger.info("stripe artifacts fetched", {
              orderId,
              uid,
              hasReceiptUrl: Boolean(artifacts.receiptUrl),
              hasHostedInvoiceUrl: Boolean(artifacts.hostedInvoiceUrl),
              hasInvoicePdfUrl: Boolean(artifacts.invoicePdfUrl),
            });
            return [orderId, artifacts];
          })
        )
      ),
    };
  }
);

function resolveWebhookSecret(domain: "payments"): string | undefined {
  if (domain === "payments") {
    return stripeWebhookPaymentsSecret.value() || stripeWebhookSecret.value();
  }
  return stripeWebhookSecret.value();
}

async function handleStripeWebhookRequest(args: {
  domain: "payments";
  endpointName: "stripeWebhookPayments" | "stripeWebhook";
  req: { headers: Record<string, unknown>; rawBody: Buffer };
  res: { status: (code: number) => { send: (body: string) => void } };
}): Promise<void> {
  const { req, res, domain, endpointName } = args;
  try {
    const stripeClient = requireStripe(stripeSecret.value());
    const webhookSecret = resolveWebhookSecret(domain);
    if (!webhookSecret) {
      logger.error(`${endpointName} missing webhook secret`, {
        domain,
        expectedSecret: "STRIPE_WEBHOOK_SECRET_PAYMENTS or STRIPE_WEBHOOK_SECRET",
      });
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
    const routedDomain = classifyStripeWebhookDomain(event.type);
    if (routedDomain !== domain) {
      logger.info(`${endpointName} ignored out-of-domain event`, {
        eventType: event.type,
        eventId: event.id,
        domain,
        routedDomain,
      });
      res.status(200).send("Ignored out-of-domain event");
      return;
    }
    const stripeObjectId = stripeObjectIdFromEvent(event);
    const existingWebhookEvent = await getPaymentWebhookEventByStripeEventId({ stripeEventId: event.id });
    if ((existingWebhookEvent.data?.paymentWebhookEvents?.length ?? 0) > 0) {
      logger.info(`${endpointName} duplicate delivery`, {
        eventType: event.type,
        eventId: event.id,
        stripeObjectId,
      });
      res.status(200).send("Duplicate event");
      return;
    }

    const normalized = normalizeStripeEvent(event);
    if (normalized.kind === "ignore") {
      logger.info(`${endpointName} ignored event`, {
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
      logger.info(`${endpointName} missing order metadata`, { eventType: event.type, reason: normalized.reason, eventId: event.id });
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
      logger.info(`${endpointName} order not found`, { eventType: event.type, eventId: event.id, orderId: canonicalOrderId });
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
      logger.info(`${endpointName} dispute side-state (no order status change)`, {
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
      await emitPaymentLifecycleNotification({
        type: "PAYMENT_DISPUTE_UPDATED",
        orderId: canonicalOrderId,
        eventId: order.event.id,
        stripeEventId: event.id,
        status: order.status,
        disputeState: normalized.disputeState ?? dispute.status ?? null,
        occurredAt: new Date().toISOString(),
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
      logger.error(`${endpointName} payment transition without intent`, {
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
      logger.info(`${endpointName} transition skipped`, {
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
    const notificationType =
      intent === "MARK_PAID" ? "PAYMENT_PAID" : intent === "MARK_FAILED" ? "PAYMENT_FAILED" : "PAYMENT_REFUNDED";
    await emitPaymentLifecycleNotification({
      type: notificationType,
      orderId: canonicalOrderId,
      eventId: order.event.id,
      stripeEventId: event.id,
      status: transitionResult.targetStatus,
      occurredAt: new Date().toISOString(),
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
    logger.error(`${endpointName} error`, err);
    res.status(400).send("Webhook error");
  }
}

export const stripeWebhookPayments = onRequest(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret, stripeWebhookPaymentsSecret] },
  async (req, res) => {
    await handleStripeWebhookRequest({ domain: "payments", endpointName: "stripeWebhookPayments", req, res });
  }
);

export const stripeWebhook = onRequest(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret, stripeWebhookPaymentsSecret] },
  async (req, res) => {
    logger.warn("stripeWebhook legacy endpoint invoked", {
      migrationTarget: "stripeWebhookPayments",
    });
    await handleStripeWebhookRequest({ domain: "payments", endpointName: "stripeWebhook", req, res });
  }
);
