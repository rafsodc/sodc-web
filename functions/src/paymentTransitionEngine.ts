import { TicketOrderStatus } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { evaluateTransition, mapIntentToTargetStatus, type PaymentTransitionIntent } from "./paymentStateMachine";

export interface TicketOrderTransitionRequest {
  orderId: UUIDString;
  currentStatus: TicketOrderStatus;
  currentWebhookEventId?: string | null;
  totalAmountMinor?: number;
  intent: PaymentTransitionIntent;
  webhookEventId: string;
  recoverFailedCheckoutPayment?: boolean;
  paidContext?: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  };
  refundContext?: {
    stripeRefundId?: string | null;
    refundedAmountMinor?: number | null;
    refundedAt?: string | null;
  };
}

export interface TicketOrderTransitionResult {
  action: "applied" | "noop_replay" | "noop_illegal";
  reason: string;
  orderId: UUIDString;
  fromStatus: TicketOrderStatus;
  targetStatus: TicketOrderStatus;
  intent: PaymentTransitionIntent;
}

export interface TicketOrderTransitionMutations {
  markPaid(args: {
    id: UUIDString;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    webhookEventId: string;
  }): Promise<unknown>;
  markFailed(args: {
    id: UUIDString;
    webhookEventId: string;
  }): Promise<unknown>;
  markRefunded(args: {
    id: UUIDString;
    webhookEventId: string;
    stripeRefundId?: string | null;
    refundedAmountMinor?: number | null;
    refundedAt?: string | null;
  }): Promise<unknown>;
  recordPartialRefund(args: {
    id: UUIDString;
    webhookEventId: string;
    stripeRefundId?: string | null;
    refundedAmountMinor: number;
    refundedAt?: string | null;
  }): Promise<unknown>;
}

export function refundTargetStatus(
  totalAmountMinor?: number,
  refundedAmountMinor?: number | null
): TicketOrderStatus {
  return totalAmountMinor != null && refundedAmountMinor != null && refundedAmountMinor < totalAmountMinor
    ? TicketOrderStatus.PAID
    : TicketOrderStatus.REFUNDED;
}

/** One Stripe Checkout session can settle multiple ticket orders; only the first may store the session id. */
export function paidContextForMultiOrderWebhook(
  orderIndex: number,
  paidContext: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  }
): {
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
} {
  return {
    stripeCheckoutSessionId: orderIndex === 0 ? paidContext.stripeCheckoutSessionId ?? null : null,
    stripePaymentIntentId: paidContext.stripePaymentIntentId ?? null,
  };
}

export async function runTicketOrderTransition(
  request: TicketOrderTransitionRequest,
  mutations: TicketOrderTransitionMutations
): Promise<TicketOrderTransitionResult> {
  const targetStatus =
    request.intent === "MARK_REFUNDED"
      ? refundTargetStatus(request.totalAmountMinor, request.refundContext?.refundedAmountMinor)
      : mapIntentToTargetStatus(request.intent);

  if (request.intent === "MARK_REFUNDED" && targetStatus === TicketOrderStatus.PAID) {
    if (request.currentStatus !== TicketOrderStatus.PAID) {
      return {
        action: "noop_illegal",
        reason: "partial_refund_requires_paid_order",
        orderId: request.orderId,
        fromStatus: request.currentStatus,
        targetStatus,
        intent: request.intent,
      };
    }
    if (request.currentWebhookEventId === request.webhookEventId) {
      return {
        action: "noop_replay",
        reason: "partial_refund_already_recorded",
        orderId: request.orderId,
        fromStatus: request.currentStatus,
        targetStatus,
        intent: request.intent,
      };
    }
    await mutations.recordPartialRefund({
      id: request.orderId,
      webhookEventId: request.webhookEventId,
      stripeRefundId: request.refundContext?.stripeRefundId ?? null,
      refundedAmountMinor: request.refundContext?.refundedAmountMinor ?? 0,
      refundedAt: request.refundContext?.refundedAt ?? null,
    });
    return {
      action: "applied",
      reason: "partial_refund_recorded",
      orderId: request.orderId,
      fromStatus: request.currentStatus,
      targetStatus,
      intent: request.intent,
    };
  }
  const decision = evaluateTransition(request.currentStatus, request.intent, {
    recoverFailedCheckoutPayment: request.recoverFailedCheckoutPayment,
  });

  if (decision.action === "apply") {
    if (request.intent === "MARK_PAID") {
      await mutations.markPaid({
        id: request.orderId,
        stripeCheckoutSessionId: request.paidContext?.stripeCheckoutSessionId ?? null,
        stripePaymentIntentId: request.paidContext?.stripePaymentIntentId ?? null,
        webhookEventId: request.webhookEventId,
      });
    } else if (request.intent === "MARK_FAILED") {
      await mutations.markFailed({
        id: request.orderId,
        webhookEventId: request.webhookEventId,
      });
    } else {
      await mutations.markRefunded({
        id: request.orderId,
        webhookEventId: request.webhookEventId,
        stripeRefundId: request.refundContext?.stripeRefundId ?? null,
        refundedAmountMinor: request.refundContext?.refundedAmountMinor ?? null,
        refundedAt: request.refundContext?.refundedAt ?? null,
      });
    }
    return {
      action: "applied",
      reason: decision.reason,
      orderId: request.orderId,
      fromStatus: request.currentStatus,
      targetStatus,
      intent: request.intent,
    };
  }

  return {
    action: decision.action,
    reason: decision.reason,
    orderId: request.orderId,
    fromStatus: request.currentStatus,
    targetStatus,
    intent: request.intent,
  };
}
