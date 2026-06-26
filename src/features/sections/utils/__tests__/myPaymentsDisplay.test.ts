import { describe, expect, it } from "vitest";
import { TicketOrderStatus } from "@dataconnect/generated";
import {
  formatPaymentAmount,
  getBookingAdjustmentSummary,
  getTicketOrderOutcomeMessage,
  groupTicketOrdersForDisplay,
  isSupersededFailedTicketOrder,
} from "../myPaymentsDisplay";

describe("myPaymentsDisplay", () => {
  it("formats payment amounts", () => {
    expect(formatPaymentAmount(2500, "gbp")).toBe("£25.00");
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
    ).toMatch(/refunded £5\.00/i);
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

  it("hides failed orders superseded by a later paid order for the same ticket type", () => {
    const ticketTypeId = "10000000-0000-0000-0000-000000000001";
    const eventId = "20000000-0000-0000-0000-000000000002";
    const orders = [
      {
        id: "order-failed",
        status: TicketOrderStatus.FAILED,
        quantity: 1,
        totalAmountMinor: 2500,
        currency: "gbp",
        updatedAt: "2026-04-01T11:00:00Z",
        ticketType: { id: ticketTypeId, title: "Member ticket" },
        event: { id: eventId, title: "Spring Ball" },
      },
      {
        id: "order-paid",
        status: TicketOrderStatus.PAID,
        quantity: 1,
        totalAmountMinor: 2500,
        currency: "gbp",
        updatedAt: "2026-04-01T12:00:00Z",
        stripePaymentIntentId: "pi_123",
        ticketType: { id: ticketTypeId, title: "Member ticket" },
        event: { id: eventId, title: "Spring Ball" },
      },
    ];

    expect(isSupersededFailedTicketOrder(orders[0], orders)).toBe(true);
    expect(groupTicketOrdersForDisplay(orders)).toHaveLength(1);
    expect(groupTicketOrdersForDisplay(orders)[0].status).toBe(TicketOrderStatus.PAID);
  });

  it("groups paid ticket orders from the same checkout session", () => {
    const groups = groupTicketOrdersForDisplay([
      {
        id: "order-member",
        status: TicketOrderStatus.PAID,
        quantity: 1,
        totalAmountMinor: 5000,
        currency: "gbp",
        updatedAt: "2026-04-01T12:00:00Z",
        stripeCheckoutSessionId: "cs_test",
        stripePaymentIntentId: "pi_test",
        ticketType: { id: "ticket-member", title: "Member ticket" },
        event: { id: "event-1", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z" },
      },
      {
        id: "order-guest",
        status: TicketOrderStatus.PAID,
        quantity: 2,
        totalAmountMinor: 5000,
        currency: "gbp",
        updatedAt: "2026-04-01T12:00:00Z",
        stripeCheckoutSessionId: "cs_test",
        stripePaymentIntentId: "pi_test",
        ticketType: { id: "ticket-guest", title: "Guest ticket" },
        event: { id: "event-1", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z" },
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].ticketSummary).toMatch(/member ticket/i);
    expect(groups[0].ticketSummary).toMatch(/guest ticket × 2/i);
    expect(groups[0].totalAmountMinor).toBe(10000);
    expect(groups[0].receiptOrderId).toBe("order-member");
  });
});
