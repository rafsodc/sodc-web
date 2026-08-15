import { describe, expect, it } from "vitest";
import {
  PaymentReconciliationExceptionType,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import { evaluateReconciliationSignals } from "../../paymentReconciliation";

describe("paymentReconciliation", () => {
  it("flags missing payment intent for paid orders", () => {
    const signals = evaluateReconciliationSignals({
      status: TicketOrderStatus.PAID,
      totalAmountMinor: 1200,
      stripePaymentIntentId: null,
    });

    expect(signals.some((s) => s.type === PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT)).toBe(true);
  });

  it("flags refund amount mismatches", () => {
    const signals = evaluateReconciliationSignals({
      status: TicketOrderStatus.REFUNDED,
      totalAmountMinor: 5000,
      refundedAmountMinor: 3000,
    });

    expect(signals.some((s) => s.type === PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH)).toBe(true);
  });

  it("flags refunded orders that have no recorded refund amount", () => {
    const signals = evaluateReconciliationSignals({
      status: TicketOrderStatus.REFUNDED,
      totalAmountMinor: 5000,
    });

    expect(signals).toContainEqual(expect.objectContaining({
      type: PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH,
      note: "Refunded order is missing refundedAmountMinor",
    }));
  });

  it("accepts a partial allocation refund while the order remains paid", () => {
    const signals = evaluateReconciliationSignals({
      status: TicketOrderStatus.PAID,
      totalAmountMinor: 5000,
      refundedAmountMinor: 1000,
      allocationRefundedAmountMinor: 1000,
      stripePaymentIntentId: "pi_1",
    });

    expect(signals.some((s) => s.type === PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH)).toBe(false);
  });

  it("flags disagreement between Stripe and allocation-level refund totals", () => {
    const signals = evaluateReconciliationSignals({
      status: TicketOrderStatus.PAID,
      totalAmountMinor: 5000,
      refundedAmountMinor: 1000,
      allocationRefundedAmountMinor: 500,
      stripePaymentIntentId: "pi_1",
    });

    expect(signals.some((s) => s.type === PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH)).toBe(true);
  });

  it("flags active disputes but not closed disputes", () => {
    const activeSignals = evaluateReconciliationSignals({
      status: TicketOrderStatus.PAID,
      totalAmountMinor: 5000,
      stripePaymentIntentId: "pi_1",
      disputeStatus: "warning_needs_response",
    });
    const closedSignals = evaluateReconciliationSignals({
      status: TicketOrderStatus.PAID,
      totalAmountMinor: 5000,
      stripePaymentIntentId: "pi_1",
      disputeStatus: "closed",
    });

    expect(activeSignals.some((s) => s.type === PaymentReconciliationExceptionType.ACTIVE_DISPUTE)).toBe(true);
    expect(closedSignals.some((s) => s.type === PaymentReconciliationExceptionType.ACTIVE_DISPUTE)).toBe(false);
  });
});
