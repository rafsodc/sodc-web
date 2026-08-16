import { describe, expect, it } from "vitest";
import {
  BookingApprovalStatus,
  BookingStatus,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/generated";
import type { EventBookingAdminRow } from "../../components/sectionEventsManagerTypes";
import {
  activeEventTicketRows,
  attendeePaymentState,
  currentActiveBookings,
  eventTicketRowsCsv,
  type EventAttendeeTicketRow,
  pendingBookingRevisions,
  previousActiveBooking,
  type TicketOrdersById,
} from "../bookingApprovalsAdmin";

function ticketOrdersById(orders: Array<{ id: string; status: TicketOrderStatus }>): TicketOrdersById {
  return new Map(orders.map((order) => [order.id, order]));
}

function booking(overrides: Partial<EventBookingAdminRow> = {}): EventBookingAdminRow {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    status: BookingStatus.SUBMITTED,
    approvalStatus: BookingApprovalStatus.NOT_REQUIRED,
    revisionGroupId: "20000000-0000-4000-8000-000000000001",
    revisionNumber: 1,
    supersededAt: null,
    clientSubmissionKey: null,
    sitNextToUserIds: [],
    accommodationRequested: false,
    accommodationNote: null,
    createdAt: "2026-08-11T10:00:00Z",
    updatedAt: "2026-08-11T10:00:00Z",
    createdBy: "u1",
    updatedBy: "u1",
    booker: { id: "u1", firstName: "Alex", lastName: "Member", email: "alex@example.com" },
    lines: [],
    ...overrides,
  } as EventBookingAdminRow;
}

describe("booking approval admin model", () => {
  it("keeps an approved active revision while listing its pending amendment separately", () => {
    const active = booking();
    const pending = booking({
      id: "10000000-0000-4000-8000-000000000002",
      revisionNumber: 2,
      approvalStatus: BookingApprovalStatus.PENDING,
      supersedesBooking: { id: active.id, revisionNumber: 1 },
    });

    expect(pendingBookingRevisions([active, pending])).toEqual([pending]);
    expect(currentActiveBookings([active, pending])).toEqual([active]);
    expect(previousActiveBooking(pending, [active, pending])).toBe(active);
  });

  it("builds one current roster row per attendee with dietary and exact-place payment state", () => {
    const active = booking({
      approvalStatus: BookingApprovalStatus.APPROVED,
      sitNextToUserIds: ["u2"],
      accommodationRequested: true,
      lines: [
        {
          id: "line-member",
          sortOrder: 0,
          dietaryNote: "Vegetarian",
          guestDisplayName: null,
          ticketType: {
            id: "member",
            title: "Member ticket",
            audience: TicketAudience.MEMBER,
            price: 20,
            includesDinner: true,
            includesSymposium: false,
          },
          bookingPlace: {
            id: "place-member",
            paymentAllocations: [{
              id: "allocation-member",
              allocatedAmountMinor: 2000,
              refundedAmountMinor: 0,
              ticketOrderId: "order-member",
            }],
          },
        },
        {
          id: "line-guest",
          sortOrder: 1,
          dietaryNote: "No nuts",
          guestDisplayName: "Jamie Guest",
          ticketType: {
            id: "guest",
            title: "Guest ticket",
            audience: TicketAudience.GUEST,
            price: 10,
            includesDinner: false,
            includesSymposium: true,
          },
          bookingPlace: { id: "place-guest", paymentAllocations: [] },
        },
      ] as EventBookingAdminRow["lines"],
    });

    const rows = activeEventTicketRows(
      [active],
      ticketOrdersById([{ id: "order-member", status: TicketOrderStatus.PAID }]),
      new Map([["u2", "Taylor Member"]])
    );
    expect(rows).toEqual([
      expect.objectContaining({
        attendeeName: "Alex Member",
        includesDinner: true,
        includesSymposium: false,
        accommodationRequested: true,
        seatingPreferences: ["Taylor Member"],
        dietaryNote: "Vegetarian",
        paymentState: "PAID",
      }),
      expect.objectContaining({
        attendeeName: "Jamie Guest",
        includesDinner: false,
        includesSymposium: true,
        accommodationRequested: true,
        seatingPreferences: ["Taylor Member"],
        dietaryNote: "No nuts",
        paymentState: "UNPAID",
      }),
    ]);
    expect(eventTicketRowsCsv(rows)).toContain(
      "Jamie Guest,GUEST,Guest ticket,No,Yes,Yes,Taylor Member,No nuts,APPROVED,UNPAID"
    );
    expect(eventTicketRowsCsv(rows)).not.toContain("Revision");
  });

  it("does not include superseded, rejected, or pending revisions in the active ticket roster", () => {
    expect(activeEventTicketRows(
      [
        booking({ supersededAt: "2026-08-11T11:00:00Z" }),
        booking({ id: "pending", approvalStatus: BookingApprovalStatus.PENDING }),
        booking({ id: "rejected", approvalStatus: BookingApprovalStatus.REJECTED }),
      ],
      ticketOrdersById([])
    )).toEqual([]);
  });

  it.each([
    ["partial settlement", 1000, 0, TicketOrderStatus.PAID, "PARTIALLY_PAID"],
    ["full payment pending", 2000, 0, TicketOrderStatus.PENDING, "PAYMENT_PENDING"],
    ["fully refunded", 2000, 2000, TicketOrderStatus.REFUNDED, "REFUNDED"],
    ["partially refunded", 2000, 500, TicketOrderStatus.PAID, "PARTIALLY_PAID"],
    ["failed payment", 2000, 0, TicketOrderStatus.FAILED, "UNPAID"],
  ])("reports %s precisely", (_label, allocatedAmountMinor, refundedAmountMinor, status, expected) => {
    const line = {
      ticketType: { price: 20 },
      bookingPlace: { paymentAllocations: [{
        ticketOrderId: "order-1",
        allocatedAmountMinor,
        refundedAmountMinor,
      }] },
    } as EventBookingAdminRow["lines"][number];

    expect(attendeePaymentState(line, ticketOrdersById([{ id: "order-1", status }]))).toBe(expected);
  });

  it("reports payment pending when pending allocations cover the remaining balance", () => {
    const line = {
      ticketType: { price: 20 },
      bookingPlace: { paymentAllocations: [
        { ticketOrderId: "paid-order", allocatedAmountMinor: 1500, refundedAmountMinor: 0 },
        { ticketOrderId: "pending-order", allocatedAmountMinor: 500, refundedAmountMinor: 0 },
      ] },
    } as EventBookingAdminRow["lines"][number];

    expect(attendeePaymentState(line, ticketOrdersById([
      { id: "paid-order", status: TicketOrderStatus.PAID },
      { id: "pending-order", status: TicketOrderStatus.PENDING },
    ]))).toBe("PAYMENT_PENDING");
  });

  it("retains partial payment state when pending allocations do not cover the remaining balance", () => {
    const line = {
      ticketType: { price: 20 },
      bookingPlace: { paymentAllocations: [
        { ticketOrderId: "paid-order", allocatedAmountMinor: 1500, refundedAmountMinor: 0 },
        { ticketOrderId: "pending-order", allocatedAmountMinor: 100, refundedAmountMinor: 0 },
      ] },
    } as EventBookingAdminRow["lines"][number];

    expect(attendeePaymentState(line, ticketOrdersById([
      { id: "paid-order", status: TicketOrderStatus.PAID },
      { id: "pending-order", status: TicketOrderStatus.PENDING },
    ]))).toBe("PARTIALLY_PAID");
  });

  it("reports an explicit unknown state when an allocation cannot be joined to its order", () => {
    const line = {
      ticketType: { price: 20 },
      bookingPlace: { paymentAllocations: [{
        ticketOrderId: "missing-order",
        allocatedAmountMinor: 2000,
        refundedAmountMinor: 0,
      }] },
    } as EventBookingAdminRow["lines"][number];

    expect(attendeePaymentState(line, ticketOrdersById([]))).toBe("UNKNOWN");
  });

  it("neutralizes spreadsheet formulas in exported attendee-controlled cells", () => {
    const rows: EventAttendeeTicketRow[] = [
      {
        key: "booking-1:line-1",
        bookingId: "booking-1",
        attendeeName: "=2+2",
        audience: TicketAudience.GUEST,
        ticketType: "+Guest ticket",
        includesDinner: true,
        includesSymposium: false,
        accommodationRequested: true,
        seatingPreferences: ["=Seating name"],
        dietaryNote: '-HYPERLINK("https://example.com","click")',
        approvalStatus: BookingApprovalStatus.APPROVED,
        paymentState: "UNPAID",
      },
      {
        key: "booking-1:line-2",
        bookingId: "booking-1",
        attendeeName: "@SUM(1,1)",
        audience: TicketAudience.GUEST,
        ticketType: "Guest ticket",
        includesDinner: false,
        includesSymposium: true,
        accommodationRequested: false,
        seatingPreferences: [],
        dietaryNote: "No nuts, please",
        approvalStatus: BookingApprovalStatus.APPROVED,
        paymentState: "PAID",
      },
    ];

    expect(eventTicketRowsCsv(rows)).toBe([
      "Attendee,Audience,Ticket,Dinner,Symposium,Accommodation,Seating preferences,Dietary requirements,Approval,Payment",
      "'=2+2,GUEST,'+Guest ticket,Yes,No,Yes,'=Seating name,\"'-HYPERLINK(\"\"https://example.com\"\",\"\"click\"\")\",APPROVED,UNPAID",
      "\"'@SUM(1,1)\",GUEST,Guest ticket,No,Yes,No,,\"No nuts, please\",APPROVED,PAID",
    ].join("\n"));
  });

  it("never exposes an unresolved seating preference UUID", () => {
    const active = booking({
      sitNextToUserIds: ["unresolved-user-id"],
      lines: [{
        id: "line-member",
        sortOrder: 0,
        dietaryNote: null,
        guestDisplayName: null,
        ticketType: {
          id: "member",
          title: "Member ticket",
          audience: TicketAudience.MEMBER,
          price: 0,
          includesDinner: false,
          includesSymposium: false,
        },
        bookingPlace: { id: "place-member", paymentAllocations: [] },
      }] as EventBookingAdminRow["lines"],
    });

    const [row] = activeEventTicketRows([active], ticketOrdersById([]));
    expect(row.seatingPreferences).toEqual(["Unavailable member"]);
    expect(eventTicketRowsCsv([row])).not.toContain("unresolved-user-id");
  });
});
