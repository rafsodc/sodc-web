import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  createPaymentWebhookEvent,
  getPaymentWebhookEventByStripeEventId,
  getTicketOrderForWebhook,
  upsertTicketOrderDisputeFromWebhook,
  PaymentWebhookEventOutcome,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import Stripe from "stripe";
import { validateUUID } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import {
  isSupportedStripeEventType,
  normalizeStripeEvent,
} from "./paymentStateMachine";
import { classifyStripeWebhookDomain } from "./stripeWebhookRouting";
import { govNotifyApiKey } from "./mailer";
import { notifyPaymentOpsDisputeSideState } from "./paymentOpsInternalAlerts";
import {
  APP_BASE_URL,
  requireStripe,
  stripeSecret,
  stripeWebhookPaymentsSecret,
  stripeWebhookSecret,
} from "./paymentConfig";
import {
  applyPaymentTransitionToOrders,
  paidContextFromCheckoutSessionObject,
  upsertReconciliationSnapshot,
} from "./paymentReconciliationService";

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

function webhookSecretCandidates(endpointName: "stripeWebhookPayments" | "stripeWebhook"): string[] {
  const payments = stripeWebhookPaymentsSecret.value();
  const legacy = stripeWebhookSecret.value();
  const candidates = endpointName === "stripeWebhookPayments" ? [payments, legacy] : [legacy, payments];
  return candidates.filter((value): value is string => Boolean(value));
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
    const candidates = webhookSecretCandidates(endpointName);
    if (candidates.length === 0) {
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

    let event: ReturnType<InstanceType<typeof Stripe>["webhooks"]["constructEvent"]> | null = null;
    let matchedSecretIndex = -1;
    let constructEventError: unknown = null;
    for (let i = 0; i < candidates.length; i += 1) {
      try {
        event = stripeClient.webhooks.constructEvent(req.rawBody, signature, candidates[i]);
        matchedSecretIndex = i;
        break;
      } catch (err) {
        constructEventError = err;
      }
    }
    if (!event) {
      throw constructEventError ?? new Error("Unable to verify webhook signature");
    }
    if (matchedSecretIndex > 0) {
      logger.warn(`${endpointName} verified with fallback webhook secret`, {
        domain,
        fallbackIndex: matchedSecretIndex,
      });
    }
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
    const normalized = normalizeStripeEvent(event);
    const existingWebhookEvent = await getPaymentWebhookEventByStripeEventId({ stripeEventId: event.id });
    if ((existingWebhookEvent.data?.paymentWebhookEvents?.length ?? 0) > 0) {
      if (event.type === "checkout.session.completed" && normalized.orderIds?.length) {
        const paidContext = paidContextFromCheckoutSessionObject(
          event.data.object as { id?: string; payment_intent?: string | { id?: string } }
        );
        const duplicateOrderIds = normalized.orderIds.map((id) => validateUUID(id, "orderId") as UUIDString);
        const { appliedCount: duplicateAppliedCount } = await applyPaymentTransitionToOrders({
          orderIds: duplicateOrderIds,
          intent: "MARK_PAID",
          webhookEventId: `${event.id}:reconcile`,
          paidContext,
          recoverFailedCheckoutPayment: true,
          paymentIntentIdFromEvent: paidContext.stripePaymentIntentId,
        });
        logger.info(`${endpointName} duplicate delivery reconciliation`, {
          eventType: event.type,
          eventId: event.id,
          stripeObjectId,
          duplicateAppliedCount,
        });
      } else {
        logger.info(`${endpointName} duplicate delivery`, {
          eventType: event.type,
          eventId: event.id,
          stripeObjectId,
        });
      }
      res.status(200).send("Duplicate event");
      return;
    }

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
    if (!normalized.orderIds?.length) {
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

    const orderIds = (normalized.orderIds ?? []).map((id) => validateUUID(id, "orderId") as UUIDString);
    const canonicalOrderId = orderIds[0];
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
        disputeStripeStatus: dispute.status ?? null,
        disputeReason: dispute.reason ?? null,
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
        stripeEventId: event.id,
        fromDisputeWebhook: true,
      });
      await notifyPaymentOpsDisputeSideState({
        orderId: canonicalOrderId,
        stripeEventId: event.id,
        stripeEventType: event.type,
        disputeStripeStatus: dispute.status ?? "",
        disputeReason: dispute.reason ?? "",
        disputeLocalState: normalized.disputeState ?? "",
        stripeDisputeId: dispute.id ?? "",
        appBaseUrl: APP_BASE_URL,
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

    const paidContext =
      intent === "MARK_PAID"
        ? paidContextFromCheckoutSessionObject(
            event.data.object as { id?: string; payment_intent?: string | { id?: string } }
          )
        : undefined;
    const refundContext =
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
        : undefined;

    const paymentIntentIdFromEvent =
      intent === "MARK_PAID"
        ? paidContext?.stripePaymentIntentId ?? null
        : null;
    const refundAmountFromEvent =
      intent === "MARK_REFUNDED"
        ? (() => {
            const charge = event.data.object as { amount_refunded?: number };
            return typeof charge.amount_refunded === "number" ? charge.amount_refunded : null;
          })()
        : null;

    const { appliedCount } = await applyPaymentTransitionToOrders({
      orderIds,
      intent,
      webhookEventId: event.id,
      paidContext,
      refundContext,
      recoverFailedCheckoutPayment: intent === "MARK_PAID" && event.type === "checkout.session.completed",
      paymentIntentIdFromEvent,
      refundAmountFromEvent,
    });

    if (appliedCount === 0) {
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "transition_noop_for_all_orders",
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("No transitions applied");
      return;
    }

    await appendWebhookLedgerEvent({
      stripeEventId: event.id,
      eventType: event.type,
      outcome: PaymentWebhookEventOutcome.PROCESSED,
      reason: `transition_applied:${intent}:${appliedCount}_orders`,
      ticketOrderId: canonicalOrderId,
      stripeObjectId,
      livemode: event.livemode,
    });
    res.status(200).send("ok");
  } catch (err) {
    logger.error(`${endpointName} error`, err);
    res.status(400).send("Webhook error");
  }
}

export const stripeWebhookPayments = onRequest(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret, stripeWebhookPaymentsSecret, govNotifyApiKey] },
  async (req, res) => {
    await handleStripeWebhookRequest({ domain: "payments", endpointName: "stripeWebhookPayments", req, res });
  }
);
export const stripeWebhook = onRequest(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret, stripeWebhookPaymentsSecret, govNotifyApiKey] },
  async (req, res) => {
    logger.warn("stripeWebhook legacy endpoint invoked", {
      migrationTarget: "stripeWebhookPayments",
    });
    await handleStripeWebhookRequest({ domain: "payments", endpointName: "stripeWebhook", req, res });
  }
);
