import { describe, expect, it } from "vitest";
import { TicketOrderStatus } from "@dataconnect/admin-generated";
import {
  evaluateTransition,
  mapIntentToTargetStatus,
  normalizeStripeEvent,
} from "../paymentStateMachine";

function stripeEvent(type: string, metadata: Record<string, string> = {}) {
  return {
    id: "evt_test_1",
    type,
    data: {
      object: {
        metadata,
      },
    },
  };
}

describe("paymentStateMachine", () => {
  it("maps intents to target statuses", () => {
    expect(mapIntentToTargetStatus("MARK_PAID")).toBe(TicketOrderStatus.PAID);
    expect(mapIntentToTargetStatus("MARK_FAILED")).toBe(TicketOrderStatus.FAILED);
    expect(mapIntentToTargetStatus("MARK_REFUNDED")).toBe(TicketOrderStatus.REFUNDED);
  });

  it("allows legal transitions and rejects illegal ones", () => {
    expect(evaluateTransition(TicketOrderStatus.PENDING, "MARK_PAID").action).toBe("apply");
    expect(evaluateTransition(TicketOrderStatus.PENDING, "MARK_FAILED").action).toBe("apply");
    expect(evaluateTransition(TicketOrderStatus.PAID, "MARK_REFUNDED").action).toBe("apply");

    expect(evaluateTransition(TicketOrderStatus.PAID, "MARK_FAILED").action).toBe("noop_illegal");
    expect(evaluateTransition(TicketOrderStatus.REFUNDED, "MARK_PAID").action).toBe("noop_illegal");
  });

  it("treats same-state transitions as replay no-op", () => {
    expect(evaluateTransition(TicketOrderStatus.PAID, "MARK_PAID").action).toBe("noop_replay");
    expect(evaluateTransition(TicketOrderStatus.FAILED, "MARK_FAILED").action).toBe("noop_replay");
  });

  it("normalizes payment transition stripe events", () => {
    const completed = normalizeStripeEvent(stripeEvent("checkout.session.completed", { orderId: "o-1" }));
    expect(completed.kind).toBe("payment_transition");
    expect(completed.intent).toBe("MARK_PAID");
    expect(completed.orderId).toBe("o-1");

    const expired = normalizeStripeEvent(stripeEvent("checkout.session.expired", { orderId: "o-2" }));
    expect(expired.kind).toBe("payment_transition");
    expect(expired.intent).toBe("MARK_FAILED");

    const refunded = normalizeStripeEvent(stripeEvent("charge.refunded", { orderId: "o-3" }));
    expect(refunded.kind).toBe("payment_transition");
    expect(refunded.intent).toBe("MARK_REFUNDED");
  });

  it("normalizes dispute events as side-state hooks", () => {
    const disputeOpened = normalizeStripeEvent(stripeEvent("charge.dispute.created", { orderId: "o-4" }));
    expect(disputeOpened.kind).toBe("dispute_side_state");
    expect(disputeOpened.disputeState).toBe("DISPUTE_OPEN");

    const disputeClosed = normalizeStripeEvent(stripeEvent("charge.dispute.closed", { orderId: "o-5" }));
    expect(disputeClosed.kind).toBe("dispute_side_state");
    expect(disputeClosed.disputeState).toBe("DISPUTE_CLOSED");
  });

  it("marks unsupported events as ignore", () => {
    const ignored = normalizeStripeEvent(stripeEvent("payment_intent.succeeded", { orderId: "o-6" }));
    expect(ignored.kind).toBe("ignore");
  });
});
