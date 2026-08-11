import { TicketAudience, TicketOrderStatus } from "@dataconnect/generated";
import type { GuestDetailRow } from "../hooks/bookingWizardModel";

export interface WizardFormSnapshot {
  memberTicketTypeId: string | null;
  guests: GuestDetailRow[];
  memberDietaryNote: string;
  sitNextToUserIds: string[];
  accommodationRequested: boolean;
}

type BookingRow = {
  lines?: Array<{
    id?: string | null;
    bookingPlace: {
      id: string;
      paymentAllocations?: Array<{ ticketOrder?: { status?: string | null } | null }> | null;
    };
    ticketType?: { id?: string | null; audience?: string | null } | null;
    guestDisplayName?: string | null;
    dietaryNote?: string | null;
  }> | null;
  sitNextToUserIds?: string[] | null;
  accommodationRequested?: boolean | null;
};

function lineIsPaid(line: NonNullable<BookingRow["lines"]>[number]): boolean {
  return (line.bookingPlace.paymentAllocations ?? []).some(
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
      bookingPlaceId: line.bookingPlace.id,
      ticketTypeId: line.ticketType?.id ?? null,
      guestDisplayName: line.guestDisplayName ?? "",
      dietaryNote: line.dietaryNote ?? "",
      paid: lineIsPaid(line),
    }));

  return {
    memberTicketTypeId: memberLine?.ticketType?.id ?? null,
    guests,
    memberDietaryNote: memberLine?.dietaryNote ?? "",
    sitNextToUserIds: booking.sitNextToUserIds ?? [],
    accommodationRequested: booking.accommodationRequested === true,
  };
}
