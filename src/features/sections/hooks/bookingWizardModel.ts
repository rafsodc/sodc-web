import type { GuestTicketRequestStatus } from "@dataconnect/generated";

export type WizardMode = "full" | "additionalGuests";

export type GuestDetailFields = {
  guestDisplayName: string;
  dietaryNote: string;
};

export type ExtraGuestDetailRow = GuestDetailFields & {
  guestRequestStatus?: GuestTicketRequestStatus | string | null;
};

export interface BookingSubmissionLine {
  ticketTypeId: string;
  sortOrder: number;
  guestUserId: string | null;
  guestDisplayName: string | null;
  dietaryNote: string | null;
}

export const EMPTY_GUEST_DETAIL: GuestDetailFields = {
  guestDisplayName: "",
  dietaryNote: "",
};

export const BOOKING_STEPS = [
  "Your ticket",
  "Guest",
  "Review",
  "Pay",
  "Confirmation",
] as const;

export const ADDITIONAL_GUEST_STEPS = ["Extra guests", "Guest", "Review"] as const;

export function resizeExtraGuestDetails(
  previous: ExtraGuestDetailRow[],
  count: number,
  mode: WizardMode
): ExtraGuestDetailRow[] {
  if (mode === "full" && previous.length === count) return previous;
  const next = previous.slice(0, count);
  while (next.length < count) next.push({ ...EMPTY_GUEST_DETAIL });
  return next;
}

export function guestCountValidationError(args: {
  mode: WizardMode;
  extraGuestRequestCount: number;
  totalGuestCount: number;
  hasGuestTicketTypes: boolean;
}): string | null {
  if (args.mode === "additionalGuests") {
    return args.extraGuestRequestCount < 1
      ? "Enter how many extra guest tickets you need."
      : null;
  }
  if (args.totalGuestCount > 0 && !args.hasGuestTicketTypes) {
    return "Guest tickets are not available for this event.";
  }
  return null;
}

export function guestDetailsValidationError(args: {
  mode: WizardMode;
  includeGuest: boolean;
  guestTicketTypeId: string | null;
  guestDisplayName: string;
  extraGuestRequestCount: number;
  extraGuestTicketTypeId: string | null;
  extraGuestDetails: ExtraGuestDetailRow[];
}): string | null {
  if (args.mode === "full" && args.includeGuest) {
    if (!args.guestTicketTypeId) return "Choose a guest ticket type.";
    if (!args.guestDisplayName.trim()) return "Enter a name for your guest.";
  }
  if (args.extraGuestRequestCount < 1) return null;
  if (!args.extraGuestTicketTypeId) {
    return args.mode === "additionalGuests"
      ? "Choose a guest ticket type."
      : "Choose a ticket type for additional guests.";
  }
  for (let index = 0; index < args.extraGuestRequestCount; index += 1) {
    if (!args.extraGuestDetails[index]?.guestDisplayName.trim()) {
      return args.extraGuestRequestCount === 1
        ? "Enter a name for the additional guest."
        : `Enter a name for additional guest ${index + 1}.`;
    }
  }
  return null;
}

export function buildBookingSubmissionLines(args: {
  memberTicketTypeId: string;
  includeGuest: boolean;
  guestTicketTypeId: string | null;
  guestDisplayName: string;
  guestDietaryNote: string;
}): BookingSubmissionLine[] {
  const lines: BookingSubmissionLine[] = [
    {
      ticketTypeId: args.memberTicketTypeId,
      sortOrder: 0,
      guestUserId: null,
      guestDisplayName: null,
      dietaryNote: null,
    },
  ];
  if (args.includeGuest && args.guestTicketTypeId) {
    lines.push({
      ticketTypeId: args.guestTicketTypeId,
      sortOrder: 1,
      guestUserId: null,
      guestDisplayName: args.guestDisplayName.trim(),
      dietaryNote: args.guestDietaryNote.trim() || null,
    });
  }
  return lines;
}

export function extractCallableErrorCode(error: unknown): string | undefined {
  const callableError = error as {
    details?: { code?: string };
    customData?: { code?: string };
  };
  return callableError?.details?.code ?? callableError?.customData?.code;
}
