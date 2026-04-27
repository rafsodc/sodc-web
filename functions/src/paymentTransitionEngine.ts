import { TicketOrderStatus } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { evaluateTransition, mapIntentToTargetStatus, type PaymentTransitionIntent } from "./paymentStateMachine";

export interface TicketOrderTransitionRequest {
  orderId: UUIDString;
  currentStatus: TicketOrderStatus;
  intent: PaymentTransitionIntent;
  webhookEventId: string;
  paidContext?: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
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
  }): Promise<unknown>;
}

export async function runTicketOrderTransition(
  request: TicketOrderTransitionRequest,
  mutations: TicketOrderTransitionMutations
): Promise<TicketOrderTransitionResult> {
  const targetStatus = mapIntentToTargetStatus(request.intent);
  const decision = evaluateTransition(request.currentStatus, request.intent);

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
