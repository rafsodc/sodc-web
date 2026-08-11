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
  currentActiveBookings,
  eventTicketRowsCsv,
  pendingBookingRevisions,
  previousActiveBooking,
} from "../bookingApprovalsAdmin";

function booking(overrides: Partial<EventBookingAdminRow> = {}): EventBookingAdminRow {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    status: BookingStatus.SUBMITTED,
    approvalStatus: BookingApprovalStatus.NOT_REQUIRED,
    revisionGroupId: "20000000-0000-4000-8000-000000000001",
    revisionNumber: 1,
    supersededAt: null,
    clientSubmissionKey: null,
    bookerDietaryNote: null,
    sitNextToUserIds: [],
    accommodationRequested: false,
    accommodationNote: null,
    createdAt: "2026-08-11T10:00:00Z",
    updatedAt: "2026-08-11T10:00:00Z",
    createdBy: "u1",
    updatedBy: "u1",
    booker: { id: "u1", firstName: "Alex", lastName: "Member", email: "alex@example.com" },
    guestTicketRequests: [],
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
      lines: [
        {
          id: "line-member",
          sortOrder: 0,
          dietaryNote: "Vegetarian",
          guestDisplayName: null,
          ticketType: { id: "member", title: "Member ticket", audience: TicketAudience.MEMBER, price: 20 },
          bookingPlace: {
            id: "place-member",
            paymentAllocations: [{
              id: "allocation-member",
              allocatedAmountMinor: 2000,
              refundedAmountMinor: 0,
              ticketOrder: { id: "order-member", status: TicketOrderStatus.PAID },
            }],
          },
        },
        {
          id: "line-guest",
          sortOrder: 1,
          dietaryNote: "No nuts",
          guestDisplayName: "Jamie Guest",
          ticketType: { id: "guest", title: "Guest ticket", audience: TicketAudience.GUEST, price: 10 },
          bookingPlace: { id: "place-guest", paymentAllocations: [] },
        },
      ] as EventBookingAdminRow["lines"],
    });

    const rows = activeEventTicketRows([active]);
    expect(rows).toEqual([
      expect.objectContaining({ attendeeName: "Alex Member", dietaryNote: "Vegetarian", paymentState: "PAID" }),
      expect.objectContaining({ attendeeName: "Jamie Guest", dietaryNote: "No nuts", paymentState: "UNPAID" }),
    ]);
    expect(eventTicketRowsCsv(rows)).toContain("Jamie Guest,GUEST,Guest ticket,No nuts,APPROVED,UNPAID,1");
  });

  it("does not include superseded, rejected, or pending revisions in the active ticket roster", () => {
    expect(activeEventTicketRows([
      booking({ supersededAt: "2026-08-11T11:00:00Z" }),
      booking({ id: "pending", approvalStatus: BookingApprovalStatus.PENDING }),
      booking({ id: "rejected", approvalStatus: BookingApprovalStatus.REJECTED }),
    ])).toEqual([]);
  });
});
