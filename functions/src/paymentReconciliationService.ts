import { HttpsError } from "firebase-functions/v2/https";
import {
  createPaymentReconciliationException,
  getPaymentReconciliationExceptionByOrderAndType,
  getTicketOrderForWebhook,
  markTicketOrderFailedFromWebhook,
  markTicketOrderPaidFromWebhook,
  markTicketOrderRefundedFromWebhook,
  updatePaymentReconciliationExceptionById,
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { validateUUID } from "./helpers";
import {
  extractOrderIdsFromStripeEvent,
  type PaymentTransitionIntent,
} from "./paymentStateMachine";
import {
  paidContextForMultiOrderWebhook,
  runTicketOrderTransition,
} from "./paymentTransitionEngine";
import { evaluateReconciliationSignals } from "./paymentReconciliation";
import { emitPaymentLifecycleNotification } from "./paymentNotifications";
import {
  createGovNotifyTicketOrderLifecycleDispatcher,
  defaultWebhookGovNotifyTicketOrderMailer,
} from "./paymentLifecycleEmailDispatcher";
import { GOV_NOTIFY_PROVIDER } from "./mailer";
import { sendNotificationOnce } from "./notificationDelivery";
import { notifyPaymentOpsReconciliationExceptionOpened } from "./paymentOpsInternalAlerts";
import { APP_BASE_URL, requireStripe, stripeSecret } from "./paymentConfig";

const govNotifyTicketOrderDispatcher = createGovNotifyTicketOrderLifecycleDispatcher({
  getMailer: defaultWebhookGovNotifyTicketOrderMailer,
  appBaseUrl: APP_BASE_URL,
});

const RECONCILIATION_EXCEPTION_TYPES = [
  PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
  PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH,
  PaymentReconciliationExceptionType.ACTIVE_DISPUTE,
] as const;

/** Whether to send the internal ops email when a reconciliation exception is open. */
export function shouldSendReconciliationExceptionOpenedAlert(args: {
  status: PaymentReconciliationExceptionStatus;
  hasSignal: boolean;
  isNewOpen: boolean;
  reopenedFromResolved: boolean;
  exceptionType: PaymentReconciliationExceptionType;
  fromDisputeWebhook: boolean;
}): boolean {
  if (args.status !== PaymentReconciliationExceptionStatus.OPEN || !args.hasSignal) {
    return false;
  }
  if (!args.isNewOpen && !args.reopenedFromResolved) {
    return false;
  }
  if (
    args.exceptionType === PaymentReconciliationExceptionType.ACTIVE_DISPUTE &&
    args.fromDisputeWebhook === true
  ) {
    return false;
  }
  return true;
}
export async function upsertReconciliationSnapshot(args: {
  orderId: UUIDString;
  snapshot: {
    status: TicketOrderStatus;
    totalAmountMinor: number;
    refundedAmountMinor?: number | null;
    stripePaymentIntentId?: string | null;
    disputeStatus?: string | null;
  };
  stripeEventId: string;
  fromDisputeWebhook?: boolean;
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
    const previousStatus = existingRow?.status;

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

    const isNewOpen = !existingRow?.id;
    const reopenedFromResolved =
      !!existingRow?.id && previousStatus === PaymentReconciliationExceptionStatus.RESOLVED;
    if (
      shouldSendReconciliationExceptionOpenedAlert({
        status,
        hasSignal: !!signal,
        isNewOpen,
        reopenedFromResolved,
        exceptionType: type,
        fromDisputeWebhook: args.fromDisputeWebhook === true,
      })
    ) {
      void notifyPaymentOpsReconciliationExceptionOpened({
        orderId: args.orderId,
        exceptionType: type,
        exceptionNote: note,
        stripeEventId: args.stripeEventId,
        appBaseUrl: APP_BASE_URL,
      });
    }
  }
}

export function paidContextFromCheckoutSessionObject(session: {
  id?: string;
  payment_intent?: string | { id?: string } | null;
}): {
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
} {
  return {
    stripeCheckoutSessionId: session.id ?? null,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
  };
}

export async function applyPaymentTransitionToOrders(args: {
  orderIds: UUIDString[];
  intent: PaymentTransitionIntent;
  webhookEventId: string;
  paidContext?: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  };
  refundContext?: {
    stripeRefundId?: string | null;
    refundedAmountMinor?: number | null;
    refundedAt?: string | null;
  };
  recoverFailedCheckoutPayment?: boolean;
  paymentIntentIdFromEvent?: string | null;
  refundAmountFromEvent?: number | null;
}): Promise<{ appliedCount: number; reconciledOrderIds: UUIDString[] }> {
  let appliedCount = 0;
  const reconciledOrderIds: UUIDString[] = [];

  for (const [orderIndex, orderId] of args.orderIds.entries()) {
    const orderRow = await getTicketOrderForWebhook({ id: orderId });
    const currentOrder = orderRow.data?.ticketOrder;
    if (!currentOrder) {
      continue;
    }
    const transitionResult = await runTicketOrderTransition(
      {
        orderId,
        currentStatus: currentOrder.status,
        intent: args.intent,
        webhookEventId: args.webhookEventId,
        recoverFailedCheckoutPayment: args.recoverFailedCheckoutPayment,
        paidContext:
          args.intent === "MARK_PAID" && args.paidContext
            ? paidContextForMultiOrderWebhook(orderIndex, args.paidContext)
            : undefined,
        refundContext: args.refundContext,
      },
      {
        markPaid: markTicketOrderPaidFromWebhook,
        markFailed: markTicketOrderFailedFromWebhook,
        markRefunded: markTicketOrderRefundedFromWebhook,
      }
    );
    if (transitionResult.action !== "applied") {
      continue;
    }
    appliedCount += 1;
    reconciledOrderIds.push(orderId);
    const notificationType =
      args.intent === "MARK_PAID" ? "PAYMENT_PAID" : args.intent === "MARK_FAILED" ? "PAYMENT_FAILED" : "PAYMENT_REFUNDED";
    await emitPaymentLifecycleNotification(
      {
        type: notificationType,
        orderId,
        eventId: currentOrder.event.id,
        stripeEventId: args.webhookEventId,
        status: transitionResult.targetStatus,
        occurredAt: new Date().toISOString(),
      },
      govNotifyTicketOrderDispatcher,
      sendNotificationOnce,
      { userId: currentOrder.user.id, provider: GOV_NOTIFY_PROVIDER }
    );
    await upsertReconciliationSnapshot({
      orderId,
      snapshot: {
        status: transitionResult.targetStatus,
        totalAmountMinor: currentOrder.totalAmountMinor,
        refundedAmountMinor: args.refundAmountFromEvent ?? currentOrder.refundedAmountMinor ?? null,
        stripePaymentIntentId: args.paymentIntentIdFromEvent ?? currentOrder.stripePaymentIntentId ?? null,
        disputeStatus: currentOrder.disputeStatus ?? null,
      },
      stripeEventId: args.webhookEventId,
    });
  }

  return { appliedCount, reconciledOrderIds };
}

export async function reconcilePaidCheckoutSessionOrders(args: {
  uid: string;
  anchorOrderId: UUIDString;
  webhookEventId: string;
}): Promise<{ appliedCount: number; reconciledOrderIds: UUIDString[]; orderIds: UUIDString[] }> {
  const orderRow = await getTicketOrderForWebhook({ id: args.anchorOrderId });
  const anchorOrder = orderRow.data?.ticketOrder;
  if (!anchorOrder || anchorOrder.user.id !== args.uid) {
    throw new HttpsError("not-found", "Order not found");
  }

  const stripeClient = requireStripe(stripeSecret.value());
  let session: Awaited<ReturnType<typeof stripeClient.checkout.sessions.retrieve>> | null = null;

  if (anchorOrder.stripeCheckoutSessionId) {
    session = await stripeClient.checkout.sessions.retrieve(anchorOrder.stripeCheckoutSessionId);
  } else if (anchorOrder.stripePaymentIntentId) {
    const paymentIntent = await stripeClient.paymentIntents.retrieve(anchorOrder.stripePaymentIntentId);
    const sessionId =
      typeof paymentIntent.metadata?.checkoutSessionId === "string"
        ? paymentIntent.metadata.checkoutSessionId
        : null;
    if (sessionId) {
      session = await stripeClient.checkout.sessions.retrieve(sessionId);
    }
  }

  if (!session?.id) {
    throw new HttpsError("failed-precondition", "Unable to resolve checkout session for this order");
  }
  if (session.payment_status !== "paid") {
    throw new HttpsError("failed-precondition", "Checkout session is not paid");
  }

  const orderIds = extractOrderIdsFromStripeEvent({
    type: "checkout.session.completed",
    data: { object: session },
  }).map((id) => validateUUID(id, "orderId") as UUIDString);
  if (orderIds.length === 0) {
    throw new HttpsError("failed-precondition", "Checkout session is missing order metadata");
  }

  for (const orderId of orderIds) {
    const sibling = await getTicketOrderForWebhook({ id: orderId });
    const siblingOrder = sibling.data?.ticketOrder;
    if (!siblingOrder || siblingOrder.user.id !== args.uid) {
      throw new HttpsError("permission-denied", "Checkout session includes an order you do not own");
    }
  }

  const paidContext = paidContextFromCheckoutSessionObject(session);
  const { appliedCount, reconciledOrderIds } = await applyPaymentTransitionToOrders({
    orderIds,
    intent: "MARK_PAID",
    webhookEventId: args.webhookEventId,
    paidContext,
    recoverFailedCheckoutPayment: true,
    paymentIntentIdFromEvent: paidContext.stripePaymentIntentId,
  });

  return { appliedCount, reconciledOrderIds, orderIds };
}
