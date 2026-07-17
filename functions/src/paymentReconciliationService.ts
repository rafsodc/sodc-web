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

export interface ReconciliationSnapshotDependencies {
  getException: typeof getPaymentReconciliationExceptionByOrderAndType;
  createException: typeof createPaymentReconciliationException;
  updateException: typeof updatePaymentReconciliationExceptionById;
  notifyExceptionOpened: typeof notifyPaymentOpsReconciliationExceptionOpened;
  now: () => string;
}

const defaultReconciliationSnapshotDependencies: ReconciliationSnapshotDependencies = {
  getException: getPaymentReconciliationExceptionByOrderAndType,
  createException: createPaymentReconciliationException,
  updateException: updatePaymentReconciliationExceptionById,
  notifyExceptionOpened: notifyPaymentOpsReconciliationExceptionOpened,
  now: () => new Date().toISOString(),
};

export async function upsertReconciliationSnapshot(
  args: {
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
  },
  dependencies: ReconciliationSnapshotDependencies =
    defaultReconciliationSnapshotDependencies
): Promise<void> {
  const signals = evaluateReconciliationSignals(args.snapshot);
  const signalMap = new Map(signals.map((signal) => [signal.type, signal]));
  const nowIso = dependencies.now();
  const pendingAlerts: Array<
    Parameters<typeof notifyPaymentOpsReconciliationExceptionOpened>[0]
  > = [];

  for (const type of RECONCILIATION_EXCEPTION_TYPES) {
    const signal = signalMap.get(type);
    const status = signal ? PaymentReconciliationExceptionStatus.OPEN : PaymentReconciliationExceptionStatus.RESOLVED;
    const note = signal?.note ?? "Auto-resolved by reconciliation snapshot";
    const existing = await dependencies.getException({
      ticketOrderId: args.orderId,
      exceptionType: type,
    });
    const existingRow = existing.data?.paymentReconciliationExceptions?.[0];
    const previousStatus = existingRow?.status;

    if (existingRow?.id) {
      await dependencies.updateException({
        id: existingRow.id,
        status,
        note,
        ownerUserId: null,
        lastAttemptedAt: nowIso,
        resolvedAt: signal ? null : nowIso,
      });
    } else {
      await dependencies.createException({
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
      pendingAlerts.push({
        orderId: args.orderId,
        exceptionType: type,
        exceptionNote: note,
        stripeEventId: args.stripeEventId,
        appBaseUrl: APP_BASE_URL,
      });
    }
  }

  for (const alert of pendingAlerts) {
    await dependencies.notifyExceptionOpened(alert);
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

export interface PaymentTransitionOrchestrationDependencies {
  getOrder: typeof getTicketOrderForWebhook;
  runTransition: typeof runTicketOrderTransition;
  emitNotification: typeof emitPaymentLifecycleNotification;
  upsertSnapshot: typeof upsertReconciliationSnapshot;
  now: () => string;
}

const defaultPaymentTransitionDependencies: PaymentTransitionOrchestrationDependencies = {
  getOrder: getTicketOrderForWebhook,
  runTransition: runTicketOrderTransition,
  emitNotification: emitPaymentLifecycleNotification,
  upsertSnapshot: upsertReconciliationSnapshot,
  now: () => new Date().toISOString(),
};

export async function applyPaymentTransitionToOrders(
  args: {
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
  },
  dependencies: PaymentTransitionOrchestrationDependencies =
    defaultPaymentTransitionDependencies
): Promise<{ appliedCount: number; reconciledOrderIds: UUIDString[] }> {
  let appliedCount = 0;
  const reconciledOrderIds: UUIDString[] = [];

  for (const [orderIndex, orderId] of args.orderIds.entries()) {
    const orderRow = await dependencies.getOrder({ id: orderId });
    const currentOrder = orderRow.data?.ticketOrder;
    if (!currentOrder) {
      continue;
    }
    const transitionResult = await dependencies.runTransition(
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
    await dependencies.emitNotification(
      {
        type: notificationType,
        orderId,
        eventId: currentOrder.event.id,
        stripeEventId: args.webhookEventId,
        status: transitionResult.targetStatus,
        occurredAt: dependencies.now(),
      },
      govNotifyTicketOrderDispatcher,
      sendNotificationOnce,
      { userId: currentOrder.user.id, provider: GOV_NOTIFY_PROVIDER }
    );
    await dependencies.upsertSnapshot({
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

export interface PaidCheckoutReconciliationDependencies {
  getOrder: typeof getTicketOrderForWebhook;
  getStripe: () => ReturnType<typeof requireStripe>;
  applyTransitions: typeof applyPaymentTransitionToOrders;
}

const defaultPaidCheckoutReconciliationDependencies: PaidCheckoutReconciliationDependencies = {
  getOrder: getTicketOrderForWebhook,
  getStripe: () => requireStripe(stripeSecret.value()),
  applyTransitions: applyPaymentTransitionToOrders,
};

export async function reconcilePaidCheckoutSessionOrders(
  args: {
    uid: string;
    anchorOrderId: UUIDString;
    webhookEventId: string;
  },
  dependencies: PaidCheckoutReconciliationDependencies =
    defaultPaidCheckoutReconciliationDependencies
): Promise<{
  appliedCount: number;
  reconciledOrderIds: UUIDString[];
  orderIds: UUIDString[];
}> {
  const orderRow = await dependencies.getOrder({ id: args.anchorOrderId });
  const anchorOrder = orderRow.data?.ticketOrder;
  if (!anchorOrder || anchorOrder.user.id !== args.uid) {
    throw new HttpsError("not-found", "Order not found");
  }

  const stripeClient = dependencies.getStripe();
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
    const sibling = await dependencies.getOrder({ id: orderId });
    const siblingOrder = sibling.data?.ticketOrder;
    if (!siblingOrder || siblingOrder.user.id !== args.uid) {
      throw new HttpsError("permission-denied", "Checkout session includes an order you do not own");
    }
  }

  const paidContext = paidContextFromCheckoutSessionObject(session);
  const { appliedCount, reconciledOrderIds } = await dependencies.applyTransitions({
    orderIds,
    intent: "MARK_PAID",
    webhookEventId: args.webhookEventId,
    paidContext,
    recoverFailedCheckoutPayment: true,
    paymentIntentIdFromEvent: paidContext.stripePaymentIntentId,
  });

  return { appliedCount, reconciledOrderIds, orderIds };
}
