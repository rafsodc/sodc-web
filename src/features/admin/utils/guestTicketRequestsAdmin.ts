import type { ListGuestTicketRequestsForAdminData } from "@dataconnect/generated";
import type { GuestTicketRequestWithBooking } from "../components/sectionEventsManagerTypes";

type AdminGuestRequestBooking = NonNullable<
  NonNullable<ListGuestTicketRequestsForAdminData["event"]>["bookings"][number]
>;

export function bookingRevisionGroupKey(booking: {
  id: string;
  revisionGroupId?: string | null;
  booker?: { id: string } | null;
}): string {
  return booking.revisionGroupId ?? booking.booker?.id ?? booking.id;
}

export function isModerationEligibleBooking(booking: { status: string }): boolean {
  return booking.status === "SUBMITTED" || booking.status === "CONFIRMED";
}

/** Keep only the current revision for each booking lineage (handles legacy rows missing supersededAt). */
export function selectLatestBookingRevisionPerGroup(
  bookings: AdminGuestRequestBooking[]
): AdminGuestRequestBooking[] {
  const bestByGroup = new Map<string, AdminGuestRequestBooking>();

  for (const booking of bookings) {
    if (!isModerationEligibleBooking(booking)) {
      continue;
    }
    const groupKey = bookingRevisionGroupKey(booking);
    const existing = bestByGroup.get(groupKey);
    if (!existing || booking.revisionNumber > existing.revisionNumber) {
      bestByGroup.set(groupKey, booking);
      continue;
    }
    if (
      booking.revisionNumber === existing.revisionNumber &&
      booking.supersededAt == null &&
      existing.supersededAt != null
    ) {
      bestByGroup.set(groupKey, booking);
    }
  }

  return Array.from(bestByGroup.values());
}

export function flattenGuestTicketRequestsFromLatestBookings(
  bookings: AdminGuestRequestBooking[]
): GuestTicketRequestWithBooking[] {
  return selectLatestBookingRevisionPerGroup(bookings).flatMap((booking) =>
    (booking.guestTicketRequests ?? []).map((request) => ({
      ...request,
      bookingId: booking.id,
      bookingStatus: booking.status,
      bookingRevisionNumber: booking.revisionNumber,
      supersedesBookingId: booking.supersedesBooking?.id ?? null,
      supersedesRevisionNumber: booking.supersedesBooking?.revisionNumber ?? null,
      booker: booking.booker,
    }))
  );
}
