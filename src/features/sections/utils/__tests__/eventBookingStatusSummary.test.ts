import { describe, expect, it } from "vitest";
import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  GuestTicketRequestStatus,
  TicketOrderStatus,
} from "@dataconnect/generated";
import {
  getEventBookingNextSteps,
  hasExpiredDraftHold,
  summarizeEventBookingPayment,
  summarizeGuestTicketRequests,
} from "../eventBookingStatusSummary";

const booking = {
  id: "booking-1",
  status: BookingStatus.SUBMITTED,
  revisionNumber: 2,
  lines: [
    {
      id: "line-1",
      ticketType: { id: "ticket-member", title: "Member", price: 50, audience: "MEMBER" },
      guestDisplayName: null,
    },
  ],
  guestTicketRequests: [],
} as never;

describe("summarizeGuestTicketRequests", () => {
  it("counts pending, approved, and rejected requests", () => {
    const summary = summarizeGuestTicketRequests([
      { status: GuestTicketRequestStatus.PENDING },
      { status: GuestTicketRequestStatus.APPROVED },
      { status: GuestTicketRequestStatus.REJECTED },
    ] as never);

    expect(summary).toEqual({
      pendingCount: 1,
      approvedCount: 1,
      rejectedCount: 1,
      hasPending: true,
    });
  });
});

describe("summarizeEventBookingPayment", () => {
  it("returns not started when no orders exist for booked ticket types", () => {
    const summary = summarizeEventBookingPayment({
      booking,
      eventId: "event-1",
      ticketOrders: [],
      adjustments: [],
    });

    expect(summary.kind).toBe("not_started");
    expect(summary.unpaidTicketTypeId).toBe("ticket-member");
  });

  it("returns pending when a matching order is pending payment", () => {
    const summary = summarizeEventBookingPayment({
      booking,
      eventId: "event-1",
      ticketOrders: [
        {
          status: TicketOrderStatus.PENDING,
          event: { id: "event-1" },
          ticketType: { id: "ticket-member" },
        },
      ],
      adjustments: [],
    });

    expect(summary.kind).toBe("pending");
    expect(summary.label).toBe("Pending payment");
  });

  it("returns paid when a matching order is paid", () => {
    const summary = summarizeEventBookingPayment({
      booking,
      eventId: "event-1",
      ticketOrders: [
        {
          status: TicketOrderStatus.PAID,
          event: { id: "event-1" },
          ticketType: { id: "ticket-member" },
        },
      ],
      adjustments: [],
    });

    expect(summary.kind).toBe("paid");
  });

  it("prioritizes pending booking payment adjustments", () => {
    const summary = summarizeEventBookingPayment({
      booking,
      eventId: "event-1",
      ticketOrders: [
        {
          status: TicketOrderStatus.PAID,
          event: { id: "event-1" },
          ticketType: { id: "ticket-member" },
        },
      ],
      adjustments: [{ status: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE }],
    });

    expect(summary.kind).toBe("adjustment_charge");
  });
});

describe("hasExpiredDraftHold", () => {
  it("returns true when only cancelled bookings remain for the event", () => {
    expect(hasExpiredDraftHold([{ status: BookingStatus.CANCELLED }])).toBe(true);
  });

  it("returns false when an active draft or submitted booking exists", () => {
    expect(
      hasExpiredDraftHold([
        { status: BookingStatus.CANCELLED },
        { status: BookingStatus.DRAFT },
      ])
    ).toBe(false);
  });
});

describe("getEventBookingNextSteps", () => {
  it("highlights unpaid and pending guest review states", () => {
    const message = getEventBookingNextSteps({
      bookingStatus: BookingStatus.SUBMITTED,
      paymentSummary: summarizeEventBookingPayment({
        booking,
        eventId: "event-1",
        ticketOrders: [],
        adjustments: [],
      }),
      guestSummary: summarizeGuestTicketRequests([
        { status: GuestTicketRequestStatus.PENDING },
      ] as never),
    });

    expect(message).toMatch(/complete payment/i);
    expect(message).toMatch(/moderator review/i);
  });

  it("mentions expired payment holds for failed payment summaries", () => {
    const message = getEventBookingNextSteps({
      bookingStatus: BookingStatus.SUBMITTED,
      paymentSummary: summarizeEventBookingPayment({
        booking,
        eventId: "event-1",
        ticketOrders: [
          {
            status: TicketOrderStatus.FAILED,
            event: { id: "event-1" },
            ticketType: { id: "ticket-member" },
          },
        ],
        adjustments: [],
      }),
      guestSummary: summarizeGuestTicketRequests([]),
    });

    expect(message).toMatch(/payment hold expired/i);
  });
});
