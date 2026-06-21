import { describe, expect, it } from "vitest";
import { GuestTicketRequestStatus } from "@dataconnect/admin-generated";
import {
  buildApprovedGuestTicketRequestPool,
  buildPendingGuestTicketRequestPool,
  consumeGuestRequestPoolsForExistingRequests,
  normalizeGuestDisplayName,
  resolveGuestTicketRequestCarryForward,
  resolveGuestTicketRequestSubmission,
} from "../guestTicketRequestCarryForward";

describe("guestTicketRequestCarryForward", () => {
  const approvedRequest = {
    status: GuestTicketRequestStatus.APPROVED,
    requestedGuestCount: 1,
    guestDisplayName: "Alex Extra",
    guestTicketType: { id: "00000000-0000-4000-8000-000000000001" },
    reviewedBy: { id: "moderator-1" },
    reviewedAt: "2026-01-01T12:00:00Z",
    moderatorNote: "Welcome",
  };

  it("normalizes guest display names for matching", () => {
    expect(normalizeGuestDisplayName("  Alex   Extra ")).toBe("alex extra");
  });

  it("builds a pool from approved requests", () => {
    expect(
      buildApprovedGuestTicketRequestPool([
        approvedRequest,
        { ...approvedRequest, status: GuestTicketRequestStatus.PENDING },
        { ...approvedRequest, requestedGuestCount: 2 },
      ])
    ).toHaveLength(3);
  });

  it("carries forward approval when guest name and ticket type are unchanged", () => {
    const pool = buildApprovedGuestTicketRequestPool([approvedRequest]);
    const { decision, remainingPool } = resolveGuestTicketRequestCarryForward({
      approvedPool: pool,
      guestDisplayName: "Alex Extra",
      guestTicketTypeId: "00000000-0000-4000-8000-000000000001",
    });

    expect(decision).toEqual({
      carryForward: true,
      reviewedById: "moderator-1",
      reviewedAt: "2026-01-01T12:00:00Z",
      moderatorNote: "Welcome",
    });
    expect(remainingPool).toHaveLength(0);
  });

  it("matches guest names case-insensitively", () => {
    const pool = buildApprovedGuestTicketRequestPool([approvedRequest]);
    const { decision } = resolveGuestTicketRequestCarryForward({
      approvedPool: pool,
      guestDisplayName: "alex extra",
      guestTicketTypeId: "00000000000040008000000000000001",
    });

    expect(decision.carryForward).toBe(true);
  });

  it("requires re-approval when the guest name changes", () => {
    const pool = buildApprovedGuestTicketRequestPool([approvedRequest]);
    const { decision, remainingPool } = resolveGuestTicketRequestCarryForward({
      approvedPool: pool,
      guestDisplayName: "Jamie Guest",
      guestTicketTypeId: "00000000-0000-4000-8000-000000000001",
    });

    expect(decision).toEqual({ carryForward: false });
    expect(remainingPool).toHaveLength(1);
  });

  it("requires re-approval when the ticket type changes", () => {
    const pool = buildApprovedGuestTicketRequestPool([approvedRequest]);
    const { decision } = resolveGuestTicketRequestCarryForward({
      approvedPool: pool,
      guestDisplayName: "Alex Extra",
      guestTicketTypeId: "00000000-0000-4000-8000-000000000099",
    });

    expect(decision).toEqual({ carryForward: false });
  });

  it("avoids duplicate carry-forward when the revised booking already has approved guests", () => {
    const pool = buildApprovedGuestTicketRequestPool([
      approvedRequest,
      { ...approvedRequest, guestDisplayName: "Jamie Guest" },
    ]);
    const { approvedPool: remainingPool } = consumeGuestRequestPoolsForExistingRequests(pool, [], [
      {
        status: GuestTicketRequestStatus.APPROVED,
        requestedGuestCount: 1,
        guestDisplayName: "Alex Extra",
        guestTicketType: { id: "00000000-0000-4000-8000-000000000001" },
      },
    ]);

    expect(remainingPool).toHaveLength(1);
    expect(remainingPool[0]?.guestDisplayName).toBe("Jamie Guest");
  });

  it("carries forward pending requests without treating them as new submissions", () => {
    const pendingRequest = {
      status: GuestTicketRequestStatus.PENDING,
      requestedGuestCount: 1,
      guestDisplayName: "Sam Pending",
      guestTicketType: { id: "00000000-0000-4000-8000-000000000001" },
    };
    const { decision } = resolveGuestTicketRequestSubmission({
      approvedPool: [],
      pendingPool: buildPendingGuestTicketRequestPool([pendingRequest]),
      guestDisplayName: "Sam Pending",
      guestTicketTypeId: "00000000-0000-4000-8000-000000000001",
    });

    expect(decision).toEqual({ kind: "carry_forward_pending" });
  });
});
