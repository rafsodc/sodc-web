import { GuestTicketRequestStatus, TicketAudience, TicketOrderStatus } from "@dataconnect/generated";
import type { GuestDetailRow } from "../hooks/bookingWizardModel";

export interface WizardFormSnapshot {
  memberTicketTypeId: string | null;
  guests: GuestDetailRow[];
  bookerDietaryNote: string;
  sitNextToUserIds: string[];
  accommodationRequested: boolean;
}

type BookingRow = {
  lines?: Array<{
    id?: string | null;
    bookingPlace?: {
      id?: string | null;
      paymentAllocations?: Array<{ ticketOrder?: { status?: string | null } | null }> | null;
    } | null;
    ticketType?: { id?: string | null; audience?: string | null } | null;
    guestDisplayName?: string | null;
    dietaryNote?: string | null;
  }> | null;
  guestTicketRequests?: Array<{
    status: GuestTicketRequestStatus | string;
    requestedGuestCount?: number | null;
    guestDisplayName?: string | null;
    dietaryNote?: string | null;
    guestTicketType?: { id?: string | null } | null;
  }> | null;
  bookerDietaryNote?: string | null;
  sitNextToUserIds?: string[] | null;
  accommodationRequested?: boolean | null;
};

function lineIsPaid(line: NonNullable<BookingRow["lines"]>[number]): boolean {
  return (line.bookingPlace?.paymentAllocations ?? []).some(
    (allocation) => allocation.ticketOrder?.status === TicketOrderStatus.PAID
  );
}

export function hydrateFormFromExistingBooking(booking: BookingRow): WizardFormSnapshot {
  const memberLine = (booking.lines ?? []).find(
    (line) => line.ticketType?.audience === TicketAudience.MEMBER
  );
  const guests: GuestDetailRow[] = (booking.lines ?? [])
    .filter((line) => line.ticketType?.audience === TicketAudience.GUEST)
    .map((line) => ({
      bookingLineId: line.id ?? null,
      bookingPlaceId: line.bookingPlace?.id ?? null,
      ticketTypeId: line.ticketType?.id ?? null,
      guestDisplayName: line.guestDisplayName ?? "",
      dietaryNote: line.dietaryNote ?? "",
      paid: lineIsPaid(line),
    }));

  // Keep pre-redesign rows editable until issue #548 removes the compatibility model.
  for (const request of booking.guestTicketRequests ?? []) {
    if (request.status === GuestTicketRequestStatus.REJECTED) continue;
    const count = Math.max(1, request.requestedGuestCount ?? 1);
    for (let index = 0; index < count; index += 1) {
      guests.push({
        ticketTypeId: request.guestTicketType?.id ?? null,
        guestDisplayName: request.guestDisplayName ?? "",
        dietaryNote: request.dietaryNote ?? "",
        paid: request.status === GuestTicketRequestStatus.APPROVED,
      });
    }
  }

  return {
    memberTicketTypeId: memberLine?.ticketType?.id ?? null,
    guests,
    bookerDietaryNote: memberLine?.dietaryNote ?? booking.bookerDietaryNote ?? "",
    sitNextToUserIds: booking.sitNextToUserIds ?? [],
    accommodationRequested: booking.accommodationRequested === true,
  };
}
