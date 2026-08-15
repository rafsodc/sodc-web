import { describe, expect, it } from "vitest";
import { BookingApprovalStatus, BookingStatus } from "@dataconnect/admin-generated";
import { bookingReplayMatchesRequest } from "../../bookings";

const eventId = "10000000-0000-4000-8000-000000000001";
const ticketTypeId = "20000000-0000-4000-8000-000000000001";
const otherTicketTypeId = "20000000-0000-4000-8000-000000000002";

const replay = {
  id: "30000000-0000-4000-8000-000000000001",
  status: BookingStatus.SUBMITTED,
  approvalStatus: BookingApprovalStatus.NOT_REQUIRED,
  clientSubmissionKey: "40000000-0000-4000-8000-000000000001",
  sitNextToUserIds: ["user-b", "user-a"],
  accommodationRequested: false,
  accommodationNote: null,
  lines: [{
    sortOrder: 0,
    guestDisplayName: null,
    dietaryNote: "Vegetarian",
    ticketType: { id: ticketTypeId },
  }],
} as never;

const request = {
  idempotencyKey: "40000000-0000-4000-8000-000000000001",
  eventId,
  baseBookingId: undefined,
  baseRevisionNumber: undefined,
  lines: [{
    ticketTypeId,
    sortOrder: 0,
    guestUserId: null,
    guestDisplayName: null,
    dietaryNote: "Vegetarian",
  }],
  sitNextToUserIds: ["user-a", "user-b"],
  accommodationRequested: false,
  accommodationNote: null,
};

describe("booking submission replay semantics", () => {
  it("accepts the same normalized booking semantics", () => {
    expect(bookingReplayMatchesRequest(replay, request)).toBe(true);
  });

  it("rejects reuse of a key for different booking details", () => {
    expect(bookingReplayMatchesRequest(replay, {
      ...request,
      lines: [{ ...request.lines[0]!, dietaryNote: "Vegan" }],
    })).toBe(false);
  });

  it("rejects a changed ticket type", () => {
    expect(bookingReplayMatchesRequest(replay, {
      ...request,
      lines: [{ ...request.lines[0]!, ticketTypeId: otherTicketTypeId }],
    })).toBe(false);
  });

  it("rejects changed sit-next-to preferences", () => {
    expect(bookingReplayMatchesRequest(replay, {
      ...request,
      sitNextToUserIds: ["user-a", "user-c"],
    })).toBe(false);
  });

  it("rejects a changed accommodation note when accommodation is requested", () => {
    const accommodationReplay = {
      id: "30000000-0000-4000-8000-000000000001",
      status: BookingStatus.SUBMITTED,
      approvalStatus: BookingApprovalStatus.NOT_REQUIRED,
      clientSubmissionKey: "40000000-0000-4000-8000-000000000001",
      sitNextToUserIds: ["user-b", "user-a"],
      accommodationRequested: true,
      accommodationNote: "Ground-floor room",
      lines: [{
        sortOrder: 0,
        guestDisplayName: null,
        dietaryNote: "Vegetarian",
        ticketType: { id: ticketTypeId },
      }],
    } as never;
    expect(bookingReplayMatchesRequest(accommodationReplay, {
      ...request,
      accommodationRequested: true,
      accommodationNote: "Near the lift",
    })).toBe(false);
  });
});
