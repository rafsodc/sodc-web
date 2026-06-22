import { TicketAudience, GuestTicketRequestStatus } from "@dataconnect/generated";
import { guestTicketRequestsForBookingEdit, guestTicketRequestCount } from "./eventBookingStatusSummary";

// Shape that the wizard's form state is initialised from when an existing booking is loaded.
export interface WizardFormSnapshot {
  memberTicketTypeId: string | null;
  totalGuestCount: number;
  totalGuestCountInput: string;
  guestTicketTypeId: string | null;
  guestDisplayName: string;
  guestDietaryNote: string;
  extraGuestTicketTypeId: string | null;
  extraGuestDetails: Array<{
    guestDisplayName: string;
    dietaryNote: string;
    guestRequestStatus?: GuestTicketRequestStatus | string | null;
  }>;
  bookerDietaryNote: string;
  sitNextToUserIds: string[];
  accommodationRequested: boolean;
}

type BookingRow = {
  lines?: Array<{
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

export function hydrateFormFromExistingBooking(booking: BookingRow): WizardFormSnapshot {
  const memberLine = (booking.lines ?? []).find(
    (line) => line.ticketType?.audience === TicketAudience.MEMBER
  );
  const guestLine = (booking.lines ?? []).find(
    (line) => line.ticketType?.audience === TicketAudience.GUEST
  );
  const editableGuestRequests = guestTicketRequestsForBookingEdit(
    (booking.guestTicketRequests ?? []).map((request) => ({
      ...request,
      requestedGuestCount: request.requestedGuestCount ?? undefined,
      guestTicketType: request.guestTicketType?.id ? { id: request.guestTicketType.id } : null,
    }))
  );

  const guestLines =
    editableGuestRequests.reduce((sum, request) => sum + guestTicketRequestCount(request), 0) +
    (guestLine ? 1 : 0);

  const includedGuestCount = guestLine ? 1 : 0;
  const extraCount = Math.max(0, guestLines - includedGuestCount);

  const flattenedExtraGuests: WizardFormSnapshot["extraGuestDetails"] = [];
  for (const request of editableGuestRequests) {
    for (let i = 0; i < guestTicketRequestCount(request); i++) {
      flattenedExtraGuests.push({
        guestDisplayName: request.guestDisplayName ?? "",
        dietaryNote: request.dietaryNote ?? "",
        guestRequestStatus: request.status,
      });
    }
  }

  const firstGuestRequest = editableGuestRequests[0];

  return {
    memberTicketTypeId: memberLine?.ticketType?.id ?? null,
    totalGuestCount: guestLines,
    totalGuestCountInput: String(guestLines),
    guestTicketTypeId: guestLine?.ticketType?.id ?? null,
    guestDisplayName: guestLine?.guestDisplayName ?? "",
    guestDietaryNote: guestLine?.dietaryNote ?? "",
    extraGuestTicketTypeId: firstGuestRequest?.guestTicketType?.id ?? null,
    extraGuestDetails: Array.from({ length: extraCount }, (_, index) =>
      flattenedExtraGuests[index] ?? { guestDisplayName: "", dietaryNote: "" }
    ),
    bookerDietaryNote: booking.bookerDietaryNote ?? "",
    sitNextToUserIds: booking.sitNextToUserIds ?? [],
    accommodationRequested: booking.accommodationRequested === true,
  };
}
