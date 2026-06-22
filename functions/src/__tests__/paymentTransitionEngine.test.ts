import { describe, expect, it, vi } from "vitest";
import { TicketOrderStatus } from "@dataconnect/admin-generated";
import { runTicketOrderTransition, paidContextForMultiOrderWebhook, type TicketOrderTransitionMutations } from "../paymentTransitionEngine";

function buildMutations(): TicketOrderTransitionMutations {
  return {
    markPaid: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markRefunded: vi.fn(async () => undefined),
  };
}

describe("paymentTransitionEngine", () => {
  it("applies legal paid transition and forwards payment metadata", async () => {
    const mutations = buildMutations();
    const result = await runTicketOrderTransition(
      {
        orderId: "00000000-0000-0000-0000-000000000001",
        currentStatus: TicketOrderStatus.PENDING,
        intent: "MARK_PAID",
        webhookEventId: "evt_paid",
        paidContext: {
          stripeCheckoutSessionId: "cs_test_1",
          stripePaymentIntentId: "pi_test_1",
        },
      },
      mutations
    );

    expect(result.action).toBe("applied");
    expect(result.fromStatus).toBe(TicketOrderStatus.PENDING);
    expect(result.targetStatus).toBe(TicketOrderStatus.PAID);
    expect(mutations.markPaid).toHaveBeenCalledWith({
      id: "00000000-0000-0000-0000-000000000001",
      stripeCheckoutSessionId: "cs_test_1",
      stripePaymentIntentId: "pi_test_1",
      webhookEventId: "evt_paid",
    });
  });

  it("returns replay no-op metadata without applying mutation", async () => {
    const mutations = buildMutations();
    const result = await runTicketOrderTransition(
      {
        orderId: "00000000-0000-0000-0000-000000000002",
        currentStatus: TicketOrderStatus.PAID,
        intent: "MARK_PAID",
        webhookEventId: "evt_replay",
      },
      mutations
    );

    expect(result.action).toBe("noop_replay");
    expect(result.reason).toBe("already_in_target_state");
    expect(mutations.markPaid).not.toHaveBeenCalled();
    expect(mutations.markFailed).not.toHaveBeenCalled();
    expect(mutations.markRefunded).not.toHaveBeenCalled();
  });

  it("returns illegal no-op metadata without applying mutation", async () => {
    const mutations = buildMutations();
    const result = await runTicketOrderTransition(
      {
        orderId: "00000000-0000-0000-0000-000000000003",
        currentStatus: TicketOrderStatus.REFUNDED,
        intent: "MARK_FAILED",
        webhookEventId: "evt_illegal",
      },
      mutations
    );

    expect(result.action).toBe("noop_illegal");
    expect(result.reason).toBe("illegal_transition");
    expect(result.fromStatus).toBe(TicketOrderStatus.REFUNDED);
    expect(result.targetStatus).toBe(TicketOrderStatus.FAILED);
    expect(mutations.markPaid).not.toHaveBeenCalled();
    expect(mutations.markFailed).not.toHaveBeenCalled();
    expect(mutations.markRefunded).not.toHaveBeenCalled();
  });

  it("recovers failed checkout orders to paid when checkout succeeded", async () => {
    const mutations = buildMutations();
    const result = await runTicketOrderTransition(
      {
        orderId: "00000000-0000-0000-0000-000000000005",
        currentStatus: TicketOrderStatus.FAILED,
        intent: "MARK_PAID",
        webhookEventId: "evt_recover",
        recoverFailedCheckoutPayment: true,
        paidContext: {
          stripeCheckoutSessionId: null,
          stripePaymentIntentId: "pi_recover",
        },
      },
      mutations
    );

    expect(result.action).toBe("applied");
    expect(mutations.markPaid).toHaveBeenCalledWith({
      id: "00000000-0000-0000-0000-000000000005",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: "pi_recover",
      webhookEventId: "evt_recover",
    });
  });

  it("applies legal refunded transition and forwards refund metadata", async () => {
    const mutations = buildMutations();
    const result = await runTicketOrderTransition(
      {
        orderId: "00000000-0000-0000-0000-000000000004",
        currentStatus: TicketOrderStatus.PAID,
        intent: "MARK_REFUNDED",
        webhookEventId: "evt_refund",
        refundContext: {
          stripeRefundId: "re_123",
          refundedAmountMinor: 1599,
          refundedAt: "2026-04-27T18:00:00.000Z",
        },
      },
      mutations
    );

    expect(result.action).toBe("applied");
    expect(result.targetStatus).toBe(TicketOrderStatus.REFUNDED);
    expect(mutations.markRefunded).toHaveBeenCalledWith({
      id: "00000000-0000-0000-0000-000000000004",
      webhookEventId: "evt_refund",
      stripeRefundId: "re_123",
      refundedAmountMinor: 1599,
      refundedAt: "2026-04-27T18:00:00.000Z",
    });
  });
});

describe("paidContextForMultiOrderWebhook", () => {
  it("stores checkout session id on the first order only", () => {
    const shared = {
      stripeCheckoutSessionId: "cs_test_multi",
      stripePaymentIntentId: "pi_test_multi",
    };
    expect(paidContextForMultiOrderWebhook(0, shared)).toEqual({
      stripeCheckoutSessionId: "cs_test_multi",
      stripePaymentIntentId: "pi_test_multi",
    });
    expect(paidContextForMultiOrderWebhook(1, shared)).toEqual({
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: "pi_test_multi",
    });
  });
});
