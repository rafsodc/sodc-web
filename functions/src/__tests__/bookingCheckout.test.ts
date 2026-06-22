import { describe, expect, it } from "vitest";
import { GuestTicketRequestStatus, TicketOrderStatus } from "@dataconnect/admin-generated";
import {
  bookingIdsEqual,
  computeUnpaidBookingCheckoutItems,
  planCheckoutOrderLines,
  selectLatestActiveBooking,
  stalePendingOrderIds,
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
          createdAt: "2026-04-01T10:00:00Z",
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
          createdAt: "2026-04-01T10:00:00Z",
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

  it("reuses pending ticket orders instead of always creating new ones", () => {
    const lines = planCheckoutOrderLines(
      [
        { ticketTypeId: "ticket-member", quantity: 1, title: "Member", unitAmountMinor: 5000 },
        { ticketTypeId: "ticket-guest", quantity: 2, title: "Guest", unitAmountMinor: 2500 },
      ],
      [
        {
          id: "pending-member",
          status: TicketOrderStatus.PENDING,
          quantity: 1,
          createdAt: "2026-04-01T10:00:00Z",
          ticketType: { id: "ticket-member" },
        },
        {
          id: "pending-guest",
          status: TicketOrderStatus.PENDING,
          quantity: 2,
          createdAt: "2026-04-01T10:00:00Z",
          ticketType: { id: "ticket-guest" },
        },
        {
          id: "stale-pending",
          status: TicketOrderStatus.PENDING,
          quantity: 1,
          createdAt: "2026-04-01T09:00:00Z",
          ticketType: { id: "ticket-member" },
        },
      ] as never
    );

    expect(lines).toEqual([
      expect.objectContaining({ ticketTypeId: "ticket-member", existingOrderId: "pending-member" }),
      expect.objectContaining({ ticketTypeId: "ticket-guest", quantity: 2, existingOrderId: "pending-guest" }),
    ]);
    expect(stalePendingOrderIds(
      [
        {
          id: "pending-member",
          status: TicketOrderStatus.PENDING,
          ticketType: { id: "ticket-member" },
        },
        {
          id: "stale-pending",
          status: TicketOrderStatus.PENDING,
          ticketType: { id: "ticket-member" },
        },
      ] as never,
      ["pending-member"]
    )).toEqual(["stale-pending"]);
  });
});
