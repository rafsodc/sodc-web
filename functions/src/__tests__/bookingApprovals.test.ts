import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import {
  BookingApprovalStatus,
  BookingPaymentAdjustmentStatus,
  BookingStatus,
} from "@dataconnect/admin-generated";
import type {
  GetBookingRevisionForApprovalFromCallableData,
} from "@dataconnect/admin-generated";
import { resolveBookingApprovalReview } from "../bookingApprovals";
import type { HydratedBookingRow } from "../bookingQueryHydration";

type Target = NonNullable<GetBookingRevisionForApprovalFromCallableData["booking"]>;
type Revision = HydratedBookingRow;

function target(overrides: Partial<Target> = {}): Target {
  return {
    id: "10000000-0000-4000-8000-000000000002",
    status: BookingStatus.SUBMITTED,
    approvalStatus: BookingApprovalStatus.PENDING,
    approvalReviewedAt: null,
    approvalNote: null,
    revisionGroupId: "20000000-0000-4000-8000-000000000001",
    revisionNumber: 2,
    supersededAt: null,
    clientSubmissionKey: "30000000-0000-4000-8000-000000000001",
    booker: { id: "u1", firstName: "Alex", lastName: "Member", email: "alex@example.com" },
    event: { id: "40000000-0000-4000-8000-000000000001", title: "Dinner", section: { id: "50000000-0000-4000-8000-000000000001", name: "Events" } },
    supersedesBooking: { id: "10000000-0000-4000-8000-000000000001", revisionNumber: 1 },
    lines: [{ id: "line-new", sortOrder: 0, guestDisplayName: null, dietaryNote: null, ticketType: { id: "ticket", title: "Ticket", audience: "MEMBER", price: 30 }, bookingPlace: { id: "place-new", paymentAllocations: [] }, guestUser: null }],
    ...overrides,
  } as unknown as Target;
}

function revision(overrides: Partial<Revision> = {}): Revision {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    status: BookingStatus.SUBMITTED,
    approvalStatus: BookingApprovalStatus.APPROVED,
    revisionGroupId: "20000000-0000-4000-8000-000000000001",
    revisionNumber: 1,
    supersededAt: null,
    lines: [{ id: "line-old", sortOrder: 0, guestDisplayName: null, dietaryNote: null, ticketType: { id: "ticket", title: "Ticket", audience: "MEMBER", price: 20 }, bookingPlace: { id: "place-old", paymentAllocations: [{ id: "allocation-old", allocatedAmountMinor: 2000, refundedAmountMinor: 0, ticketOrderId: "order-old", ticketOrder: { id: "order-old", status: "PAID", stripePaymentIntentId: "pi_old" } }] }, guestUser: null }],
    ...overrides,
  } as unknown as Revision;
}

describe("whole-booking approval review", () => {
  it("selects the active revision and calculates the activation payment delta", () => {
    const result = resolveBookingApprovalReview({
      target: target(),
      revisions: [revision()],
      expectedRevisionNumber: 2,
      decision: BookingApprovalStatus.APPROVED,
    });
    expect(result.activeBooking?.revisionNumber).toBe(1);
    expect(result.paymentDelta).toEqual({
      previousTotalMinor: 2000,
      revisedTotalMinor: 3000,
      deltaAmountMinor: 1000,
      status: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE,
    });
  });

  it("does not activate or calculate a payment delta when changes are requested", () => {
    const result = resolveBookingApprovalReview({
      target: target(),
      revisions: [revision()],
      expectedRevisionNumber: 2,
      decision: BookingApprovalStatus.REJECTED,
    });
    expect(result.activeBooking?.revisionNumber).toBe(1);
    expect(result.paymentDelta).toBeUndefined();
  });

  it.each([
    ["expected revision changed", target(), [revision()], 3],
    ["target was superseded", target({ supersededAt: "2026-08-11T12:00:00Z" }), [revision()], 2],
    ["a newer current revision exists", target(), [revision(), revision({ id: "newer", revisionNumber: 3, approvalStatus: BookingApprovalStatus.PENDING })], 2],
  ])("rejects a stale decision when %s", (_label, reviewTarget, revisions, expectedRevisionNumber) => {
    expect(() => resolveBookingApprovalReview({
      target: reviewTarget as Target,
      revisions: revisions as Revision[],
      expectedRevisionNumber: expectedRevisionNumber as number,
      decision: BookingApprovalStatus.APPROVED,
    })).toThrow(HttpsError);
  });
});
