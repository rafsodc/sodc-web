import { describe, expect, it } from "vitest";
import { GuestTicketRequestStatus, TicketOrderStatus } from "@dataconnect/admin-generated";
import {
  bookingIdsEqual,
  computeUnpaidBookingCheckoutItems,
  selectLatestActiveBooking,
} from "../bookingCheckout";

describe("bookingCheckout", () => {
  it("matches booking ids regardless of hyphen formatting", () => {
    expect(bookingIdsEqual("10000000-0000-0000-0000-000000000001", "10000000000000000000000000000001")).toBe(true);
  });

  it("selects the latest non-superseded booking", () => {
    const latest = selectLatestActiveBooking([
      {
        id: "booking-1",
        status: "SUBMITTED",
        revisionNumber: 1,
        supersededAt: "2026-01-01T00:00:00Z",
        lines: [],
        guestTicketRequests: [],
      },
      {
        id: "booking-2",
        status: "SUBMITTED",
        revisionNumber: 2,
        supersededAt: null,
        lines: [],
        guestTicketRequests: [],
      },
    ] as never);

    expect(latest?.id).toBe("booking-2");
  });

  it("computes unpaid checkout items for member and guest tickets", () => {
    const items = computeUnpaidBookingCheckoutItems({
      booking: {
        id: "booking-1",
        status: "SUBMITTED",
        revisionNumber: 1,
        supersededAt: null,
        lines: [
          {
            id: "line-1",
            ticketType: { id: "ticket-member", title: "Member", price: 50, audience: "MEMBER" },
          },
          {
            id: "line-2",
            guestDisplayName: "Alex",
            ticketType: { id: "ticket-guest", title: "Guest", price: 25, audience: "GUEST" },
          },
        ],
        guestTicketRequests: [],
      } as never,
      ticketOrders: [],
    });

    expect(items).toEqual([
      expect.objectContaining({ ticketTypeId: "ticket-member", quantity: 1, unitAmountMinor: 5000 }),
      expect.objectContaining({ ticketTypeId: "ticket-guest", quantity: 1, unitAmountMinor: 2500 }),
    ]);
  });

  it("excludes already paid ticket types", () => {
    const items = computeUnpaidBookingCheckoutItems({
      booking: {
        id: "booking-1",
        status: "SUBMITTED",
        revisionNumber: 1,
        supersededAt: null,
        lines: [
          {
            id: "line-1",
            ticketType: { id: "ticket-member", title: "Member", price: 50, audience: "MEMBER" },
          },
          {
            id: "line-2",
            guestDisplayName: "Alex",
            ticketType: { id: "ticket-guest", title: "Guest", price: 25, audience: "GUEST" },
          },
        ],
        guestTicketRequests: [],
      } as never,
      ticketOrders: [
        {
          id: "order-1",
          status: TicketOrderStatus.PAID,
          quantity: 1,
          ticketType: { id: "ticket-member" },
          event: { id: "event-1" },
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({ ticketTypeId: "ticket-guest", quantity: 1 }),
    ]);
  });

  it("matches paid orders to booking ticket types regardless of hyphen formatting", () => {
    const memberIdHyphen = "10000000-0000-0000-0000-000000000001";
    const memberIdHex = "10000000000000000000000000000001";

    const items = computeUnpaidBookingCheckoutItems({
      booking: {
        id: "booking-1",
        status: "SUBMITTED",
        revisionNumber: 1,
        supersededAt: null,
        lines: [
          {
            id: "line-1",
            ticketType: { id: memberIdHyphen, title: "Member", price: 50, audience: "MEMBER" },
          },
          {
            id: "line-2",
            guestDisplayName: "Alex",
            ticketType: { id: "20000000-0000-0000-0000-000000000002", title: "Guest", price: 25, audience: "GUEST" },
          },
        ],
        guestTicketRequests: [],
      } as never,
      ticketOrders: [
        {
          id: "order-1",
          status: TicketOrderStatus.PAID,
          quantity: 1,
          ticketType: { id: memberIdHex },
          event: { id: "event-1" },
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({ ticketTypeId: "20000000-0000-0000-0000-000000000002", quantity: 1 }),
    ]);
  });

  it("includes approved extra guest ticket types", () => {
    const items = computeUnpaidBookingCheckoutItems({
      booking: {
        id: "booking-1",
        status: "SUBMITTED",
        revisionNumber: 1,
        supersededAt: null,
        lines: [
          {
            id: "line-1",
            ticketType: { id: "ticket-member", title: "Member", price: 50, audience: "MEMBER" },
          },
        ],
        guestTicketRequests: [
          {
            id: "gtr-1",
            status: GuestTicketRequestStatus.APPROVED,
            requestedGuestCount: 1,
            guestDisplayName: "Sam",
            guestTicketType: { id: "ticket-guest", title: "Guest", price: 25 },
          },
        ],
      } as never,
      ticketOrders: [],
    });

    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ ticketTypeId: "ticket-guest", quantity: 1 });
  });
});
