import { describe, expect, it } from "vitest";
import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  TicketOrderStatus,
} from "@dataconnect/generated";
import {
  buildBookingTicketDisplayRows,
  buildBookingTicketRowsWithPaymentStatus,
  formatBookingTicketDisplayLabel,
  getPayableBookingTicketRows,
  hasExpiredDraftHold,
  summarizeEventBookingPayment,
} from "../eventBookingStatusSummary";

const eventId = "10000000-0000-4000-8000-000000000001";
const memberTicketId = "20000000-0000-4000-8000-000000000001";
const guestTicketId = "20000000-0000-4000-8000-000000000002";

const booking = {
  status: BookingStatus.SUBMITTED,
  approvalStatus: "APPROVED",
  revisionNumber: 1,
  lines: [
    { id: "member-line", guestDisplayName: null, ticketType: { id: memberTicketId, title: "Member ticket", price: 20 } },
    { id: "guest-line", guestDisplayName: "Jamie Guest", ticketType: { id: guestTicketId, title: "Guest ticket", price: 10 } },
  ],
};

describe("buildBookingTicketDisplayRows", () => {
  it("uses booking lines as the only attendee source", () => {
    const rows = buildBookingTicketDisplayRows(booking);

    expect(rows).toEqual([
      expect.objectContaining({ id: "member-line", ticketTitle: "Member ticket", source: "line" }),
      expect.objectContaining({ id: "guest-line", guestName: "Jamie Guest", source: "line" }),
    ]);
    expect(getPayableBookingTicketRows(rows)).toEqual(rows);
    expect(formatBookingTicketDisplayLabel(rows[1]!)).toBe("Guest ticket (Jamie Guest)");
  });
});

describe("buildBookingTicketRowsWithPaymentStatus", () => {
  it("assigns paid and unpaid status to complete-booking lines", () => {
    const rows = buildBookingTicketRowsWithPaymentStatus({
      booking,
      eventId,
      ticketOrders: [{
        status: TicketOrderStatus.PAID,
        quantity: 1,
        event: { id: eventId },
        ticketType: { id: memberTicketId },
      }],
    });

    expect(rows).toEqual([
      expect.objectContaining({ id: "member-line", paymentStatus: "paid" }),
      expect.objectContaining({ id: "guest-line", paymentStatus: "unpaid" }),
    ]);
  });
});

describe("summarizeEventBookingPayment", () => {
  it("reports not started, pending, and fully paid states from all booking lines", () => {
    const none = summarizeEventBookingPayment({ booking, eventId, ticketOrders: [], adjustments: [] });
    expect(none.kind).toBe("not_started");
    expect(none.unpaidTicketTypeId).toBe(memberTicketId);

    const pending = summarizeEventBookingPayment({
      booking,
      eventId,
      ticketOrders: [{ status: TicketOrderStatus.PENDING, quantity: 1, event: { id: eventId }, ticketType: { id: memberTicketId } }],
      adjustments: [],
    });
    expect(pending.kind).toBe("pending");

    const paid = summarizeEventBookingPayment({
      booking,
      eventId,
      ticketOrders: [
        { status: TicketOrderStatus.PAID, quantity: 1, event: { id: eventId }, ticketType: { id: memberTicketId } },
        { status: TicketOrderStatus.PAID, quantity: 1, event: { id: eventId }, ticketType: { id: guestTicketId } },
      ],
      adjustments: [],
    });
    expect(paid.kind).toBe("paid");
  });

  it("prioritizes an active payment adjustment", () => {
    const summary = summarizeEventBookingPayment({
      booking,
      eventId,
      ticketOrders: [],
      adjustments: [{ status: BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND }],
    });
    expect(summary.kind).toBe("adjustment_refund");
  });

  it("keeps checkout available for an additional-payment adjustment", () => {
    const summary = summarizeEventBookingPayment({
      booking,
      eventId,
      ticketOrders: [{
        status: TicketOrderStatus.PAID,
        quantity: 1,
        event: { id: eventId },
        ticketType: { id: memberTicketId },
      }],
      adjustments: [{ status: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE }],
    });

    expect(summary.kind).toBe("not_started");
    expect(summary.unpaidTicketTypeId).toBe(guestTicketId);
  });
});

describe("hasExpiredDraftHold", () => {
  it("requires cancelled bookings without any active booking", () => {
    expect(hasExpiredDraftHold([{ status: BookingStatus.CANCELLED }])).toBe(true);
    expect(hasExpiredDraftHold([{ status: BookingStatus.CANCELLED }, { status: BookingStatus.SUBMITTED }])).toBe(false);
  });
});
