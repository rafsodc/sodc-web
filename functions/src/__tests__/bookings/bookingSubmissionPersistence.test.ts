import { describe, expect, it } from "vitest";
import { TicketAudience, TicketOrderStatus } from "@dataconnect/admin-generated";
import { planBookingPlaces } from "../../bookingSubmissionPersistence";

const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
];

function idFactory() {
  let index = 0;
  return () => ids[index++];
}

describe("booking submission place planning", () => {
  it("creates one stable place for every initial attendee", () => {
    const plan = planBookingPlaces({
      createId: idFactory(),
      lines: [
        { ticketTypeId: "member-ticket", audience: TicketAudience.MEMBER, sortOrder: 0 },
        {
          ticketTypeId: "guest-ticket",
          audience: TicketAudience.GUEST,
          sortOrder: 1,
          guestDisplayName: "Guest One",
        },
      ],
    });

    expect(plan.newBookingPlaceIds).toEqual([ids[0], ids[2]]);
    expect(plan.lines.map((line) => line.bookingPlaceId)).toEqual([ids[0], ids[2]]);
    expect(plan.removedBookingPlaceIds).toEqual([]);
  });

  it("reuses places across dietary-only and ordering changes", () => {
    const plan = planBookingPlaces({
      createId: idFactory(),
      previousLines: [
        {
          ticketTypeId: "member-ticket",
          audience: TicketAudience.MEMBER,
          sortOrder: 0,
          dietaryNote: "Old",
          bookingPlaceId: "place-member",
        },
        {
          ticketTypeId: "guest-ticket",
          audience: TicketAudience.GUEST,
          sortOrder: 1,
          guestDisplayName: "Guest One",
          dietaryNote: "Old",
          bookingPlaceId: "place-guest",
        },
      ],
      lines: [
        {
          ticketTypeId: "guest-ticket",
          audience: TicketAudience.GUEST,
          sortOrder: 1,
          guestDisplayName: "  guest   one ",
          dietaryNote: "New",
        },
        {
          ticketTypeId: "member-ticket",
          audience: TicketAudience.MEMBER,
          sortOrder: 0,
          dietaryNote: "New",
        },
      ],
    });

    expect(plan.newBookingPlaceIds).toEqual([]);
    expect(plan.lines.map((line) => line.bookingPlaceId)).toEqual(["place-member", "place-guest"]);
    expect(plan.removedBookingPlaceIds).toEqual([]);
  });

  it("treats an attendee or ticket change as place replacement", () => {
    const plan = planBookingPlaces({
      createId: idFactory(),
      previousLines: [
        {
          ticketTypeId: "guest-ticket",
          audience: TicketAudience.GUEST,
          sortOrder: 1,
          guestDisplayName: "Guest One",
          bookingPlaceId: "old-place",
        },
      ],
      lines: [
        {
          ticketTypeId: "different-ticket",
          audience: TicketAudience.GUEST,
          sortOrder: 1,
          guestDisplayName: "Guest Two",
        },
      ],
    });

    expect(plan.newBookingPlaceIds).toEqual([ids[0]]);
    expect(plan.removedBookingPlaceIds).toEqual(["old-place"]);
  });

  it("flags removal or transfer of a paid place", () => {
    const plan = planBookingPlaces({
      createId: idFactory(),
      previousLines: [
        {
          ticketTypeId: "guest-ticket",
          audience: TicketAudience.GUEST,
          sortOrder: 1,
          guestDisplayName: "Paid Guest",
          bookingPlaceId: "paid-place",
          paymentAllocationStatuses: [TicketOrderStatus.PAID],
        },
      ],
      lines: [],
    });

    expect(plan.removedBookingPlaceIds).toEqual(["paid-place"]);
    expect(plan.paidRemovedBookingPlaceIds).toEqual(["paid-place"]);
  });

  it("allows removal when an allocation has not been paid", () => {
    const plan = planBookingPlaces({
      previousLines: [
        {
          ticketTypeId: "guest-ticket",
          audience: TicketAudience.GUEST,
          sortOrder: 1,
          guestDisplayName: "Unpaid Guest",
          bookingPlaceId: "unpaid-place",
          paymentAllocationStatuses: [TicketOrderStatus.PENDING],
        },
      ],
      lines: [],
    });

    expect(plan.removedBookingPlaceIds).toEqual(["unpaid-place"]);
    expect(plan.paidRemovedBookingPlaceIds).toEqual([]);
  });
});
