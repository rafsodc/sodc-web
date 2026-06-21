import { TicketOrderStatus } from "@dataconnect/admin-generated";

interface StripeEventLike {
  type: string;
  data: {
    object: unknown;
  };
}

export type PaymentTransitionIntent = "MARK_PAID" | "MARK_FAILED" | "MARK_REFUNDED";
export type DisputeSideState = "DISPUTE_OPEN" | "DISPUTE_UPDATED" | "DISPUTE_CLOSED";

export interface StripeEventNormalization {
  kind: "payment_transition" | "dispute_side_state" | "ignore";
  intent?: PaymentTransitionIntent;
  disputeState?: DisputeSideState;
  orderId?: string;
  orderIds?: string[];
  reason: string;
}

export interface TransitionDecision {
  action: "apply" | "noop_replay" | "noop_illegal";
  reason: string;
}

export const SUPPORTED_STRIPE_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
]);

const LEGAL_TRANSITIONS: Record<TicketOrderStatus, ReadonlySet<TicketOrderStatus>> = {
  [TicketOrderStatus.PENDING]: new Set([TicketOrderStatus.PAID, TicketOrderStatus.FAILED]),
  [TicketOrderStatus.PAID]: new Set([TicketOrderStatus.REFUNDED]),
  [TicketOrderStatus.FAILED]: new Set(),
  [TicketOrderStatus.REFUNDED]: new Set(),
};

function extractMetadataOrderId(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const metadata = (obj as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const orderId = (metadata as { orderId?: unknown }).orderId;
  return typeof orderId === "string" && orderId.trim() ? orderId.trim() : null;
}

function extractMetadataOrderIds(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  const metadata = (obj as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return [];
  const rawOrderIds = (metadata as { orderIds?: unknown }).orderIds;
  if (typeof rawOrderIds === "string" && rawOrderIds.trim()) {
    return rawOrderIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  const orderId = extractMetadataOrderId(obj);
  return orderId ? [orderId] : [];
}

export function extractOrderIdsFromStripeEvent(event: StripeEventLike): string[] {
  return extractMetadataOrderIds(event.data.object);
}

export function isSupportedStripeEventType(eventType: string): boolean {
  return SUPPORTED_STRIPE_EVENT_TYPES.has(eventType);
}

export function normalizeStripeEvent(event: StripeEventLike): StripeEventNormalization {
  const orderIds = extractOrderIdsFromStripeEvent(event);
  const orderId = orderIds[0];
  if (!isSupportedStripeEventType(event.type)) {
    return { kind: "ignore", reason: "unsupported_event_type" };
  }
  switch (event.type) {
    case "checkout.session.completed":
      return {
        kind: "payment_transition",
        intent: "MARK_PAID",
        orderId,
        orderIds,
        reason: "checkout_completed",
      };
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      return {
        kind: "payment_transition",
        intent: "MARK_FAILED",
        orderId,
        orderIds,
        reason: "checkout_failed_or_expired",
      };
    case "charge.refunded":
      return {
        kind: "payment_transition",
        intent: "MARK_REFUNDED",
        orderId,
        orderIds,
        reason: "charge_refunded",
      };
    case "charge.dispute.created":
      return { kind: "dispute_side_state", disputeState: "DISPUTE_OPEN", orderId, orderIds, reason: "dispute_created" };
    case "charge.dispute.updated":
      return { kind: "dispute_side_state", disputeState: "DISPUTE_UPDATED", orderId, orderIds, reason: "dispute_updated" };
    case "charge.dispute.closed":
      return { kind: "dispute_side_state", disputeState: "DISPUTE_CLOSED", orderId, orderIds, reason: "dispute_closed" };
    default:
      // Defensive fallback if a supported-event list and switch ever drift.
      return { kind: "ignore", reason: "unmapped_supported_event_type" };
  }
}

export function mapIntentToTargetStatus(intent: PaymentTransitionIntent): TicketOrderStatus {
  switch (intent) {
    case "MARK_PAID":
      return TicketOrderStatus.PAID;
    case "MARK_FAILED":
      return TicketOrderStatus.FAILED;
    case "MARK_REFUNDED":
      return TicketOrderStatus.REFUNDED;
  }
}

export interface TransitionEvaluationOptions {
  /** Allows FAILED -> PAID when a combined checkout succeeded but an earlier attempt left stale orders. */
  recoverFailedCheckoutPayment?: boolean;
}

export function evaluateTransition(
  current: TicketOrderStatus,
  intent: PaymentTransitionIntent,
  options?: TransitionEvaluationOptions
): TransitionDecision {
  const target = mapIntentToTargetStatus(intent);
  if (current === target) {
    return { action: "noop_replay", reason: "already_in_target_state" };
  }
  if (
    options?.recoverFailedCheckoutPayment &&
    intent === "MARK_PAID" &&
    current === TicketOrderStatus.FAILED
  ) {
    return { action: "apply", reason: "checkout_recovery_from_failed" };
  }
  if (LEGAL_TRANSITIONS[current].has(target)) {
    return { action: "apply", reason: "legal_transition" };
  }
  return { action: "noop_illegal", reason: "illegal_transition" };
}
