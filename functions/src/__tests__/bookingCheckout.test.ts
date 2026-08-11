import { describe, expect, it } from "vitest";
import {
  BookingApprovalStatus,
  BookingStatus,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import {
  bookingIdsEqual,
  bookingIsFullyPaid,
  computeUnpaidBookingCheckoutItems,
  planCheckoutOrderLines,
  planBookingAllocationRefunds,
  selectLatestPaymentEligibleBooking,
  stalePendingOrderIds,
} from "../bookingCheckout";

function booking(args: {
  id?: string;
  revisionNumber?: number;
  approvalStatus?: BookingApprovalStatus;
  supersededAt?: string | null;
  places?: Array<{ id: string; ticketTypeId?: string; price?: number; statuses?: TicketOrderStatus[] }>;
}) {
  return {
    id: args.id ?? "booking-1",
    status: BookingStatus.SUBMITTED,
    approvalStatus: args.approvalStatus ?? BookingApprovalStatus.NOT_REQUIRED,
    revisionGroupId: "revision-group",
    revisionNumber: args.revisionNumber ?? 1,
    supersededAt: args.supersededAt ?? null,
    lines: (args.places ?? []).map((place, index) => ({
      id: `line-${index}`,
      bookingPlace: {
        id: place.id,
        paymentAllocations: (place.statuses ?? []).map((status, allocationIndex) => ({
          id: `allocation-${index}-${allocationIndex}`,
          allocatedAmountMinor: Math.round((place.price ?? 50) * 100),
          refundedAmountMinor: 0,
          stripeRefundId: null,
          createdAt: `2026-08-01T10:00:0${allocationIndex}Z`,
          ticketOrder: { id: `order-${index}-${allocationIndex}`, status, stripePaymentIntentId: "pi_test" },
        })),
      },
      sortOrder: index,
      ticketType: {
        id: place.ticketTypeId ?? "ticket-member",
        title: "Ticket",
        price: place.price ?? 50,
        audience: "MEMBER",
      },
    })),
  } as any;
}

describe("bookingCheckout", () => {
  it("matches booking ids regardless of hyphen formatting", () => {
    expect(bookingIdsEqual("10000000-0000-0000-0000-000000000001", "10000000000000000000000000000001")).toBe(true);
  });

  it("selects only the latest active revision whose approval permits payment", () => {
    const selected = selectLatestPaymentEligibleBooking([
      booking({ id: "approved", revisionNumber: 2, approvalStatus: BookingApprovalStatus.APPROVED }),
      booking({ id: "pending", revisionNumber: 3, approvalStatus: BookingApprovalStatus.PENDING }),
      booking({ id: "old", revisionNumber: 1, supersededAt: "2026-01-01T00:00:00Z" }),
    ]);
    expect(selected?.id).toBe("approved");
  });

  it("keeps the latest eligible revision when an older eligible revision follows it", () => {
    const selected = selectLatestPaymentEligibleBooking([
      booking({ id: "latest", revisionNumber: 2 }),
      booking({ id: "older", revisionNumber: 1 }),
    ]);

    expect(selected?.id).toBe("latest");
  });

  it.each([BookingApprovalStatus.PENDING, BookingApprovalStatus.REJECTED])(
    "rejects a sole %s revision from checkout eligibility",
    (approvalStatus) => {
      expect(selectLatestPaymentEligibleBooking([booking({ approvalStatus })])).toBeNull();
    }
  );

  it("derives unpaid items from exact stable places, including same-type guests", () => {
    const current = booking({
      places: [
        { id: "place-paid", statuses: [TicketOrderStatus.PAID] },
        { id: "place-guest-a", ticketTypeId: "ticket-guest", price: 25 },
        { id: "place-guest-b", ticketTypeId: "ticket-guest", price: 25 },
      ],
    });
    expect(computeUnpaidBookingCheckoutItems(current).map((item) => item.bookingPlaceId)).toEqual([
      "place-guest-a",
      "place-guest-b",
    ]);
    expect(bookingIsFullyPaid(current)).toBe(false);
  });

  it("charges only a positive revision delta already paid against the same place", () => {
    const revised = booking({ places: [{ id: "place-a", price: 60, statuses: [TicketOrderStatus.PAID] }] });
    const allocation = revised.lines[0]!.bookingPlace!.paymentAllocations[0]!;
    allocation.allocatedAmountMinor = 5000;
    expect(computeUnpaidBookingCheckoutItems(revised)).toEqual([
      expect.objectContaining({ bookingPlaceId: "place-a", unitAmountMinor: 1000 }),
    ]);
    expect(bookingIsFullyPaid(revised)).toBe(false);
  });

  it("plans a negative revision delta against the exact paid place allocation", () => {
    const revised = booking({ places: [{ id: "place-a", price: 40, statuses: [TicketOrderStatus.PAID] }] });
    const allocation = revised.lines[0]!.bookingPlace!.paymentAllocations[0]!;
    allocation.allocatedAmountMinor = 5000;
    expect(planBookingAllocationRefunds(revised)).toEqual([{
      allocationId: allocation.id,
      ticketOrderId: allocation.ticketOrder.id,
      stripePaymentIntentId: "pi_test",
      amountMinor: 1000,
      resultingRefundedAmountMinor: 1000,
    }]);
  });

  it("refunds the newest allocation first", () => {
    const revised = booking({
      places: [{
        id: "place-a",
        price: 40,
        statuses: [TicketOrderStatus.PAID, TicketOrderStatus.PAID],
      }],
    });
    const [older, newer] = revised.lines[0]!.bookingPlace!.paymentAllocations;
    older!.allocatedAmountMinor = 2500;
    newer!.allocatedAmountMinor = 2500;

    expect(planBookingAllocationRefunds(revised)).toEqual([{
      allocationId: newer!.id,
      ticketOrderId: newer!.ticketOrder.id,
      stripePaymentIntentId: "pi_test",
      amountMinor: 1000,
      resultingRefundedAmountMinor: 1000,
    }]);
  });

  it("reuses a pending order only when its exact allocations and price still match", () => {
    const items = computeUnpaidBookingCheckoutItems(booking({
      places: [
        { id: "place-a", ticketTypeId: "ticket-guest", price: 25 },
        { id: "place-b", ticketTypeId: "ticket-guest", price: 25 },
        { id: "place-c", ticketTypeId: "ticket-guest", price: 25 },
      ],
    }));
    const lines = planCheckoutOrderLines(items, [
      {
        id: "pending-exact",
        status: TicketOrderStatus.PENDING,
        quantity: 2,
        unitAmountMinor: 2500,
        totalAmountMinor: 5000,
        createdAt: "2026-08-01T10:00:00Z",
        ticketType: { id: "ticket-guest" },
        paymentAllocations: [
          { id: "a1", allocatedAmountMinor: 2500, bookingPlace: { id: "place-a" } },
          { id: "a2", allocatedAmountMinor: 2500, bookingPlace: { id: "place-b" } },
        ],
      },
    ] as never);
    expect(lines).toEqual([
      expect.objectContaining({ existingOrderId: "pending-exact", bookingPlaceIds: ["place-a", "place-b"] }),
      expect.objectContaining({ existingOrderId: null, bookingPlaceIds: ["place-c"] }),
    ]);
  });

  it("does not reuse stale, unallocated, mismatched-price, or zero-value pending orders", () => {
    const items = computeUnpaidBookingCheckoutItems(booking({ places: [{ id: "place-a", price: 25 }] }));
    const orders = [
      { id: "unallocated", status: TicketOrderStatus.PENDING, quantity: 1, unitAmountMinor: 2500, ticketType: { id: "ticket-member" }, paymentAllocations: [] },
      { id: "wrong-price", status: TicketOrderStatus.PENDING, quantity: 1, unitAmountMinor: 2400, ticketType: { id: "ticket-member" }, paymentAllocations: [{ bookingPlace: { id: "place-a" } }] },
      { id: "free-pending", status: TicketOrderStatus.PENDING, quantity: 1, unitAmountMinor: 0, ticketType: { id: "ticket-member" }, paymentAllocations: [{ bookingPlace: { id: "place-a" } }] },
    ] as never;
    expect(planCheckoutOrderLines(items, orders)).toEqual([
      expect.objectContaining({ existingOrderId: null, bookingPlaceIds: ["place-a"] }),
    ]);
    expect(stalePendingOrderIds(orders, [])).toEqual(["unallocated", "wrong-price", "free-pending"]);
  });

  it("recognises a booking only when every exact place has a paid allocation", () => {
    expect(bookingIsFullyPaid(booking({ places: [
      { id: "place-a", statuses: [TicketOrderStatus.FAILED, TicketOrderStatus.PAID] },
      { id: "place-b", statuses: [TicketOrderStatus.PAID] },
    ] }))).toBe(true);
  });
});
