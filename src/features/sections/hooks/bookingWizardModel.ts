export interface GuestDetailRow {
  bookingLineId?: string | null;
  bookingPlaceId?: string | null;
  ticketTypeId: string | null;
  guestDisplayName: string;
  dietaryNote: string;
  paid: boolean;
}

export type ExtraGuestDetailRow = GuestDetailRow;
export type GuestDetailFields = GuestDetailRow;

export interface BookingSubmissionLine {
  ticketTypeId: string;
  sortOrder: number;
  guestUserId: string | null;
  guestDisplayName: string | null;
  dietaryNote: string | null;
}

export const EMPTY_GUEST_DETAIL: GuestDetailRow = {
  ticketTypeId: null,
  guestDisplayName: "",
  dietaryNote: "",
  paid: false,
};

export const BOOKING_STEPS = ["Your details", "Guests", "Review and submit"] as const;

export function resizeGuestDetails(
  previous: GuestDetailRow[],
  count: number,
  defaultTicketTypeId: string | null
): GuestDetailRow[] {
  const next = previous.slice(0, count);
  while (next.length < count) {
    next.push({ ...EMPTY_GUEST_DETAIL, ticketTypeId: defaultTicketTypeId });
  }
  return next;
}

export function guestDetailsValidationError(args: {
  guests: GuestDetailRow[];
  hasGuestTicketTypes: boolean;
}): string | null {
  if (args.guests.length > 0 && !args.hasGuestTicketTypes) {
    return "Guest tickets are not available for this event.";
  }
  for (let index = 0; index < args.guests.length; index += 1) {
    const guest = args.guests[index]!;
    if (!guest.ticketTypeId) return `Choose a ticket type for guest ${index + 1}.`;
    if (!guest.guestDisplayName.trim()) return `Enter a name for guest ${index + 1}.`;
  }
  return null;
}

export function buildBookingSubmissionLines(args: {
  memberTicketTypeId: string;
  memberDietaryNote: string;
  guests: GuestDetailRow[];
}): BookingSubmissionLine[] {
  return [
    {
      ticketTypeId: args.memberTicketTypeId,
      sortOrder: 0,
      guestUserId: null,
      guestDisplayName: null,
      dietaryNote: args.memberDietaryNote.trim() || null,
    },
    ...args.guests.map((guest, index) => ({
      ticketTypeId: guest.ticketTypeId as string,
      sortOrder: index + 1,
      guestUserId: null,
      guestDisplayName: guest.guestDisplayName.trim(),
      dietaryNote: guest.dietaryNote.trim() || null,
    })),
  ];
}
