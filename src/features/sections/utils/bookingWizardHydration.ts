import { idsEqual } from "../../../shared/utils/uuid";
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
      paymentAllocations?: Array<{ ticketOrderId?: string | null }> | null;
    };
    ticketType?: { id?: string | null; audience?: string | null } | null;
    guestDisplayName?: string | null;
    dietaryNote?: string | null;
  }> | null;
  sitNextToUserIds?: string[] | null;
  accommodationRequested?: boolean | null;
};

type BookingTicketOrder = {
  id: string;
  status?: string | null;
};

function lineIsPaid(
  line: NonNullable<BookingRow["lines"]>[number],
  paidTicketOrderIds: ReadonlySet<string>
): boolean {
  return (line.bookingPlace.paymentAllocations ?? []).some(
    (allocation) => allocation.ticketOrderId != null && paidTicketOrderIds.has(allocation.ticketOrderId)
  );
}

export function hydrateFormFromExistingBooking(
  booking: BookingRow,
  ticketOrders: BookingTicketOrder[] = []
): WizardFormSnapshot {
  const paidTicketOrderIds = new Set(
    ticketOrders
      .filter((order) => order.status === TicketOrderStatus.PAID)
      .map((order) => order.id)
  );
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
      paid: lineIsPaid(line, paidTicketOrderIds),
    }));

  return {
    memberTicketTypeId: memberLine?.ticketType?.id ?? null,
    guests,
    memberDietaryNote: memberLine?.dietaryNote ?? "",
    sitNextToUserIds: booking.sitNextToUserIds ?? [],
    accommodationRequested: booking.accommodationRequested === true,
  };
}

/** Compare the submitted payload, ignoring server-assigned line/place IDs and
 * payment flags. A retry may have changed before its first successful commit. */
export function bookingFormMatchesSavedSnapshot(form: WizardFormSnapshot, saved: WizardFormSnapshot): boolean {
  const seats = (ids: string[]) => JSON.stringify(ids.map(id => id.trim()).filter(Boolean).sort());
  return idsEqual(form.memberTicketTypeId, saved.memberTicketTypeId) &&
    form.memberDietaryNote.trim() === saved.memberDietaryNote.trim() &&
    form.accommodationRequested === saved.accommodationRequested &&
    seats(form.sitNextToUserIds) === seats(saved.sitNextToUserIds) &&
    form.guests.length === saved.guests.length && form.guests.every((guest, index) => {
      const persisted = saved.guests[index];
      return idsEqual(guest.ticketTypeId, persisted.ticketTypeId) &&
        guest.guestDisplayName.trim() === persisted.guestDisplayName.trim() &&
        guest.dietaryNote.trim() === persisted.dietaryNote.trim();
    });
}
