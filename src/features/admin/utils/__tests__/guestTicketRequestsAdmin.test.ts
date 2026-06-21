import { describe, expect, it } from "vitest";
import { GuestTicketRequestStatus, TicketAudience } from "@dataconnect/generated";
import {
  bookingRevisionGroupKey,
  flattenGuestTicketRequestsFromLatestBookings,
  selectLatestBookingRevisionPerGroup,
} from "../guestTicketRequestsAdmin";

const booker = { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" } as never;

function guestRequest(id: string, guestDisplayName: string) {
  return {
    id,
    status: GuestTicketRequestStatus.PENDING,
    requestedGuestCount: 1,
    guestDisplayName,
    dietaryNote: null,
    moderatorNote: null,
    createdAt: "2026-01-01T00:00:00Z",
    reviewedAt: null,
    guestTicketType: { id: "tt-1", title: "Guest", audience: TicketAudience.GUEST, price: 10 },
  } as never;
}

describe("guestTicketRequestsAdmin", () => {
  it("groups bookings by revisionGroupId", () => {
    expect(
      bookingRevisionGroupKey({
        id: "b-1",
        revisionGroupId: "group-1",
        booker: { id: "u-1" },
      })
    ).toBe("group-1");
  });

  it("excludes superseded booking revisions when both lack supersededAt (legacy data)", () => {
    const requests = flattenGuestTicketRequestsFromLatestBookings([
      {
        id: "booking-old",
        status: "SUBMITTED",
        revisionNumber: 1,
        revisionGroupId: "group-1",
        supersededAt: null,
        booker,
        guestTicketRequests: [guestRequest("req-old", "Superseded Guest")],
      } as never,
      {
        id: "booking-new",
        status: "SUBMITTED",
        revisionNumber: 2,
        revisionGroupId: "group-1",
        supersededAt: null,
        supersedesBooking: { id: "booking-old", revisionNumber: 1 },
        booker,
        guestTicketRequests: [guestRequest("req-new", "Current Guest")],
      } as never,
    ]);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.id).toBe("req-new");
    expect(requests[0]?.bookingId).toBe("booking-new");
    expect(requests[0]?.bookingRevisionNumber).toBe(2);
  });

  it("keeps one latest revision per booker when multiple lineages exist", () => {
    const latest = selectLatestBookingRevisionPerGroup([
      {
        id: "b-a1",
        status: "SUBMITTED",
        revisionNumber: 1,
        revisionGroupId: "group-a",
        booker: { id: "u-a" } as never,
        guestTicketRequests: [],
      } as never,
      {
        id: "b-a2",
        status: "SUBMITTED",
        revisionNumber: 3,
        revisionGroupId: "group-a",
        booker: { id: "u-a" } as never,
        guestTicketRequests: [],
      } as never,
      {
        id: "b-b1",
        status: "SUBMITTED",
        revisionNumber: 2,
        revisionGroupId: "group-b",
        booker: { id: "u-b" } as never,
        guestTicketRequests: [],
      } as never,
    ]);

    expect(latest.map((booking) => booking.id).sort()).toEqual(["b-a2", "b-b1"]);
  });

  it("ignores draft and cancelled bookings", () => {
    const latest = selectLatestBookingRevisionPerGroup([
      {
        id: "booking-draft",
        status: "DRAFT",
        revisionNumber: 9,
        revisionGroupId: "group-1",
        booker,
        guestTicketRequests: [guestRequest("req-draft", "Draft Guest")],
      } as never,
      {
        id: "booking-submitted",
        status: "SUBMITTED",
        revisionNumber: 2,
        revisionGroupId: "group-1",
        booker,
        guestTicketRequests: [guestRequest("req-live", "Live Guest")],
      } as never,
    ]);

    expect(latest).toHaveLength(1);
    expect(latest[0]?.id).toBe("booking-submitted");
  });
});
