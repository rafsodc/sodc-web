import { describe, expect, it } from "vitest";
import { TicketOrderStatus } from "@dataconnect/generated";
import {
  formatPaymentAmount,
  getBookingAdjustmentSummary,
  getTicketOrderOutcomeMessage,
} from "../myPaymentsDisplay";

describe("myPaymentsDisplay", () => {
  it("formats payment amounts", () => {
    expect(formatPaymentAmount(2500, "gbp")).toBe("25.00 GBP");
  });

  it("describes failed payments in plain language", () => {
    expect(
      getTicketOrderOutcomeMessage({
        status: TicketOrderStatus.FAILED,
        currency: "gbp",
        totalAmountMinor: 2500,
      })
    ).toMatch(/did not go through/i);
  });

  it("describes refunds with amount", () => {
    expect(
      getTicketOrderOutcomeMessage({
        status: TicketOrderStatus.REFUNDED,
        currency: "gbp",
        totalAmountMinor: 2500,
        refundedAmountMinor: 500,
      })
    ).toMatch(/refunded 5\.00 GBP/i);
  });

  it("summarises booking adjustments", () => {
    expect(
      getBookingAdjustmentSummary({
        eventTitle: "Spring Ball",
        revisionNumber: 2,
        deltaAmountMinor: -500,
        status: "PENDING_AUTO_REFUND",
      })
    ).toMatch(/spring ball/i);
    expect(
      getBookingAdjustmentSummary({
        eventTitle: "Spring Ball",
        revisionNumber: 2,
        deltaAmountMinor: -500,
        status: "PENDING_AUTO_REFUND",
      })
    ).toMatch(/refund pending/i);
  });
});
