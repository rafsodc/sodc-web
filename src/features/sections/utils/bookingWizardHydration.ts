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
