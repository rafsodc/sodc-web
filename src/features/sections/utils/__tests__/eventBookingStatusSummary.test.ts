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
  buildBookingTicketDisplayRows,
  buildBookingTicketRowsWithPaymentStatus,
  formatBookingTicketDisplayLabel,
  getPayableBookingTicketRows,
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
  it("counts pending, approved, and rejected guest tickets", () => {
    const summary = summarizeGuestTicketRequests([
      { status: GuestTicketRequestStatus.PENDING, requestedGuestCount: 2 },
      { status: GuestTicketRequestStatus.APPROVED, requestedGuestCount: 1 },
      { status: GuestTicketRequestStatus.REJECTED, requestedGuestCount: 1 },
    ] as never);

    expect(summary).toEqual({
      pendingCount: 2,
      approvedCount: 1,
      rejectedCount: 1,
      hasPending: true,
    });
  });
});

describe("buildBookingTicketDisplayRows", () => {
  it("includes approved guest ticket requests alongside booking lines", () => {
    const rows = buildBookingTicketDisplayRows({
      lines: [
        {
          id: "line-1",
          guestDisplayName: null,
          ticketType: { id: "ticket-member", title: "Member standard", price: 50 },
        },
      ],
      guestTicketRequests: [
        {
          id: "gtr-1",
          status: GuestTicketRequestStatus.APPROVED,
          requestedGuestCount: 1,
          guestDisplayName: "Alex Guest",
          guestTicketType: { id: "ticket-guest", title: "Guest standard", price: 25 },
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      ticketTitle: "Guest standard",
      guestName: "Alex Guest",
      source: "approved_guest_request",
    });
  });

  it("includes pending guest ticket requests awaiting approval", () => {
    const rows = buildBookingTicketDisplayRows({
      lines: [
        {
          id: "line-1",
          guestDisplayName: null,
          ticketType: { id: "ticket-member", title: "Member standard", price: 50 },
        },
      ],
      guestTicketRequests: [
        {
          id: "gtr-1",
          status: GuestTicketRequestStatus.PENDING,
          requestedGuestCount: 1,
          guestDisplayName: "Sam Extra",
          guestTicketType: { id: "ticket-guest", title: "Guest standard", price: 25 },
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      ticketTitle: "Guest standard",
      guestName: "Sam Extra",
      source: "pending_guest_request",
    });
    expect(formatBookingTicketDisplayLabel(rows[1])).toBe("Guest standard (Sam Extra) — awaiting approval");
    expect(getPayableBookingTicketRows(rows)).toHaveLength(1);
  });
});

describe("buildBookingTicketRowsWithPaymentStatus", () => {
  it("assigns paid and unpaid status per ticket row", () => {
    const rows = buildBookingTicketRowsWithPaymentStatus({
      booking: {
        lines: [
          {
            id: "line-1",
            guestDisplayName: null,
            ticketType: { id: "ticket-member", title: "Member standard", price: 50 },
          },
          {
            id: "line-2",
            guestDisplayName: "Jamie Guest",
            ticketType: { id: "ticket-guest", title: "Guest standard", price: 25 },
          },
        ],
        guestTicketRequests: [
          {
            id: "gtr-1",
            status: GuestTicketRequestStatus.APPROVED,
            requestedGuestCount: 1,
            guestDisplayName: "Alex Extra",
            guestTicketType: { id: "ticket-guest", title: "Guest standard", price: 25 },
          },
        ],
      },
      eventId: "event-1",
      ticketOrders: [
        {
          status: TicketOrderStatus.PAID,
          quantity: 1,
          event: { id: "event-1" },
          ticketType: { id: "ticket-member" },
        },
        {
          status: TicketOrderStatus.PAID,
          quantity: 1,
          event: { id: "event-1" },
          ticketType: { id: "ticket-guest" },
        },
      ],
    });

    expect(rows.map((row) => ({ guest: row.guestName, paymentStatus: row.paymentStatus }))).toEqual([
      { guest: null, paymentStatus: "paid" },
      { guest: "Jamie Guest", paymentStatus: "paid" },
      { guest: "Alex Extra", paymentStatus: "unpaid" },
    ]);
  });

  it("marks pending guest requests as awaiting approval", () => {
    const rows = buildBookingTicketRowsWithPaymentStatus({
      booking: {
        lines: [
          {
            id: "line-1",
            guestDisplayName: null,
            ticketType: { id: "ticket-member", title: "Member standard", price: 50 },
          },
        ],
        guestTicketRequests: [
          {
            id: "gtr-1",
            status: GuestTicketRequestStatus.PENDING,
            requestedGuestCount: 1,
            guestDisplayName: "Sam Extra",
            guestTicketType: { id: "ticket-guest", title: "Guest standard", price: 25 },
          },
        ],
      },
      eventId: "event-1",
      ticketOrders: [],
    });

    expect(rows[1]?.paymentStatus).toBe("awaiting_approval");
    expect(rows[1]?.paymentStatusLabel).toBe("Awaiting approval");
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

  it("returns partially paid when an approved extra guest shares a ticket type that is already paid once", () => {
    const summary = summarizeEventBookingPayment({
      booking: {
        ...booking,
        lines: [
          ...booking.lines,
          {
            id: "line-2",
            ticketType: { id: "ticket-guest", title: "Guest", price: 25, audience: "GUEST" },
            guestDisplayName: "Jamie Guest",
          },
        ],
        guestTicketRequests: [
          {
            status: GuestTicketRequestStatus.APPROVED,
            requestedGuestCount: 1,
            guestTicketType: { id: "ticket-guest" },
          },
        ],
      },
      eventId: "event-1",
      ticketOrders: [
        {
          status: TicketOrderStatus.PAID,
          quantity: 1,
          event: { id: "event-1" },
          ticketType: { id: "ticket-member" },
        },
        {
          status: TicketOrderStatus.PAID,
          quantity: 1,
          event: { id: "event-1" },
          ticketType: { id: "ticket-guest" },
        },
      ],
      adjustments: [],
    });

    expect(summary.kind).toBe("partial");
    expect(summary.label).toBe("Partially paid");
    expect(summary.unpaidTicketTypeId).toBe("ticket-guest");
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
