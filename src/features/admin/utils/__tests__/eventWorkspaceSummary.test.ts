import { BookingApprovalStatus, BookingStatus, MembershipStatus, TicketAudience, TicketOrderStatus } from "@dataconnect/generated";
import { describe, expect, it } from "vitest";
import type { EventBookingAdminRow, TicketOrderAdminRow } from "../../components/sectionEventsManagerTypes";
import type { Guest } from "../../../guests/api";
import { getEventWorkspaceSummary, getSettledEventPayments } from "../eventWorkspaceSummary";

function booking(overrides: Partial<EventBookingAdminRow> = {}): EventBookingAdminRow {
  return { id: "booking", revisionGroupId: "group", revisionNumber: 1, status: BookingStatus.SUBMITTED,
    approvalStatus: BookingApprovalStatus.APPROVED, supersededAt: null, accommodationRequested: false,
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
    booker: { id: "owner", firstName: "Alex", lastName: "Member", email: "alex@example.com", membershipStatus: MembershipStatus.REGULAR },
    lines: [{ id: "line", sortOrder: 0, ticketType: { id: "ticket", title: "Dinner", audience: TicketAudience.MEMBER, price: 50, includesDinner: true, includesSymposium: false },
      bookingPlace: { id: "place", attendanceVersion: 0, attendanceRemoved: false, paymentAllocations: [] } }], ...overrides };
}
function guest(overrides: Partial<Guest> = {}): Guest {
  return { id: "guest", firstName: "Jamie", lastName: "Guest", email: "jamie@example.com", dietaryRequirements: "", ticketTypeId: "ticket", ticketTitle: "Dinner", priceMinor: 2500, includesDinner: true, includesSymposium: false, version: 0, cancelled: false, paymentStatus: "UNPAID", refundedAmountMinor: 0, ...overrides };
}
const orders = new Map([
  ["paid", { id: "paid", status: TicketOrderStatus.PAID }],
  ["pending", { id: "pending", status: TicketOrderStatus.PENDING }],
  ["refunded", { id: "refunded", status: TicketOrderStatus.REFUNDED }],
]);
function allocation(ticketOrderId: string, allocatedAmountMinor: number, refundedAmountMinor = 0) {
  return { id: ticketOrderId, ticketOrderId, allocatedAmountMinor, refundedAmountMinor };
}

describe("event workspace summary", () => {
  it("counts active revisions once while retaining the separate pending amendment", () => {
    const previous = booking();
    previous.lines[0].bookingPlace.paymentAllocations = [allocation("paid", 5000)];
    const amendment = booking({ id: "pending-revision", revisionNumber: 2, approvalStatus: BookingApprovalStatus.PENDING });
    const archived = booking({ id: "old-revision", revisionNumber: 0, supersededAt: "2026-09-01T00:00:00Z" });
    const summary = getEventWorkspaceSummary([archived, previous, amendment], orders);
    expect(summary).toMatchObject({ activeTicketCount: 1, pendingRevisionCount: 1, outstandingTicketCount: 0, outstandingAmountPence: 0, requiredPayments: [] });
  });

  it("uses net settled allocations, includes payment-in-progress and does not count order totals twice", () => {
    const active = booking();
    active.lines[0].bookingPlace.paymentAllocations = [allocation("paid", 3000), allocation("pending", 2000)];
    const summary = getEventWorkspaceSummary([active], orders);
    expect(summary.outstandingAmountPence).toBe(2000);
    expect(summary.requiredPayments).toEqual([expect.objectContaining({ ownerName: "Alex Member", ownerEmail: "alex@example.com", ticketCount: 1, outstandingAmountPence: 2000, paymentPending: true })]);
  });

  it("excludes removed places from current checkout balances without counting a pending amendment", () => {
    const active = booking(); active.lines[0].bookingPlace.attendanceRemoved = true;
    const pending = booking({ id: "pending", revisionNumber: 2, approvalStatus: BookingApprovalStatus.PENDING });
    expect(getEventWorkspaceSummary([active, pending], orders)).toMatchObject({ activeTicketCount: 0, pendingRevisionCount: 1, outstandingTicketCount: 0, outstandingAmountPence: 0, requiredPayments: [] });
    active.lines[0].bookingPlace.paymentAllocations = [allocation("missing", 5000)];
    expect(getEventWorkspaceSummary([active, pending], orders).unknownPaymentTicketCount).toBe(0);
  });

  it("excludes free tickets and never produces a negative outstanding balance", () => {
    const overpaid = booking({ id: "overpaid", revisionGroupId: "overpaid" }); overpaid.lines[0].bookingPlace.paymentAllocations = [allocation("paid", 7500)];
    const free = booking({ id: "free", revisionGroupId: "free" }); free.lines[0].ticketType.price = 0;
    expect(getEventWorkspaceSummary([overpaid, free], orders)).toMatchObject({ activeTicketCount: 2, outstandingAmountPence: 0, outstandingTicketCount: 0 });
  });

  it.each([{ refunded: 1000, expected: 1000 }, { refunded: 5000, expected: 5000 }])("counts the remaining payable amount after a $refunded pence refund on a still-current member ticket", ({ refunded, expected }) => {
    const active = booking();
    active.lines[0].bookingPlace.paymentAllocations = [allocation("refunded", 5000, refunded)];
    expect(getEventWorkspaceSummary([active], orders)).toMatchObject({ activeTicketCount: 1, outstandingTicketCount: 1, outstandingAmountPence: expected });
  });

  it("keeps an unsettled failed order on the full remaining checkout balance", () => {
    const active = booking(); active.lines[0].bookingPlace.paymentAllocations = [allocation("failed", 5000)];
    const failed = new Map([["failed", { id: "failed", status: TicketOrderStatus.FAILED }]]);
    expect(getEventWorkspaceSummary([active], failed)).toMatchObject({ outstandingTicketCount: 1, outstandingAmountPence: 5000 });
  });

  it("adds only current unpaid organiser guests and excludes cancelled and refund records", () => {
    const summary = getEventWorkspaceSummary([], orders, [guest(), guest({ id: "paid", paymentStatus: "PAID" }), guest({ id: "cancelled", cancelled: true }), guest({ id: "refund", paymentStatus: "PARTIALLY_REFUNDED", refundedAmountMinor: 1000 })]);
    expect(summary).toMatchObject({ activeTicketCount: 3, outstandingTicketCount: 1, outstandingAmountPence: 2500 });
    expect(summary.requiredPayments[0]).toMatchObject({ kind: "organiser-guest", ownerName: "Jamie Guest", revisionNumber: null });
  });

  it("flags missing payment records instead of reporting an unknown ticket as unpaid", () => {
    const active = booking(); active.lines[0].bookingPlace.paymentAllocations = [allocation("missing", 5000)];
    expect(getEventWorkspaceSummary([active], orders)).toMatchObject({ unknownPaymentTicketCount: 1, outstandingAmountPence: 0, requiredPayments: [] });
  });
});


function order(overrides: Partial<TicketOrderAdminRow> = {}): TicketOrderAdminRow {
  return { id: "order", status: TicketOrderStatus.PAID, quantity: 3, totalAmountMinor: 9000, currency: "gbp", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", user: { id: "owner", firstName: "Alex", lastName: "Member", email: "alex@example.com" }, ticketType: { id: "ticket", title: "Dinner" }, ...overrides };
}

describe("settled event payment totals", () => {
  it("uses the already extended order total once and subtracts partial and full refunds", () => {
    const settled = getSettledEventPayments([order(), order({ id: "partial", refundedAmountMinor: 1000 }), order({ id: "refund", status: TicketOrderStatus.REFUNDED, totalAmountMinor: 2500, refundedAmountMinor: 2500 }), order({ id: "pending", status: TicketOrderStatus.PENDING }), order({ id: "failed", status: TicketOrderStatus.FAILED })]);
    expect(settled.bookingOrdersByCurrency).toEqual([{ currency: "GBP", amountMinor: 17000 }]);
  });

  it("withholds booking cash when a refund record lacks the amount needed to reconcile it", () => {
    expect(getSettledEventPayments([order({ status: TicketOrderStatus.REFUNDED, refundedAmountMinor: null })]).bookingOrdersEvidenceIncomplete).toBe(true);
    expect(getSettledEventPayments([order({ stripeRefundId: "refund", refundedAmountMinor: null })]).bookingOrdersEvidenceIncomplete).toBe(true);
  });

  it("keeps currencies separate while normalising their case", () => {
    const settled = getSettledEventPayments([order({ totalAmountMinor: 1000 }), order({ id: "gbp", currency: "GBP", totalAmountMinor: 2000 }), order({ id: "usd", currency: "usd", totalAmountMinor: 6000, refundedAmountMinor: 1000 })]);
    expect(settled.bookingOrdersByCurrency).toEqual([{ currency: "GBP", amountMinor: 3000 }, { currency: "USD", amountMinor: 5000 }]);
  });

  it("keeps known organiser guest settlements separate, including cancelled paid cash and refunds", () => {
    const settled = getSettledEventPayments([order()], [guest({ paymentStatus: "PAID" }), guest({ id: "partial", paymentStatus: "PARTIALLY_REFUNDED", refundedAmountMinor: 1000 }), guest({ id: "refund", paymentStatus: "REFUNDED", refundedAmountMinor: 2500 }), guest({ id: "cancel", paymentStatus: "REFUND_REQUIRED", cancelled: true, priceMinor: 3000, refundedAmountMinor: 500 }), guest({ id: "unpaid" })]);
    expect(settled.organiserGuestAmountPence).toBe(6500);
    expect(settled.bookingOrdersByCurrency).toEqual([{ currency: "GBP", amountMinor: 9000 }]);
  });

  it.each(["REFUND_PENDING", "UNKNOWN"])("withholds organiser guest cash when %s does not prove settled funds in the returned data", (paymentStatus) => {
    expect(getSettledEventPayments([], [guest({ paymentStatus })]).organiserGuestAmountPence).toBeNull();
  });
});
