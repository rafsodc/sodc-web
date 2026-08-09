import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";
import { toCanonicalUuid } from "../uuid";

export interface SubmitGuestTicketRequestPayload {
  bookingId: string;
  requestedGuestCount: number;
  guestTicketTypeId: string;
  guestDisplayName: string;
  dietaryNote?: string | null;
}

export interface SubmitGuestTicketRequestResponse {
  success: boolean;
  requestId: string;
}

export async function submitGuestTicketRequest(
  payload: SubmitGuestTicketRequestPayload
): Promise<SubmitGuestTicketRequestResponse> {
  const callable = httpsCallable<SubmitGuestTicketRequestPayload, SubmitGuestTicketRequestResponse>(
    functions,
    "submitGuestTicketRequest"
  );
  const result = await callable({
    bookingId: toCanonicalUuid(payload.bookingId),
    requestedGuestCount: payload.requestedGuestCount,
    guestTicketTypeId: toCanonicalUuid(payload.guestTicketTypeId),
    guestDisplayName: payload.guestDisplayName.trim(),
    dietaryNote: payload.dietaryNote?.trim() || null,
  });
  return result.data;
}

/**
 * A GuestTicketRequest row identifies exactly one named guest (see
 * requestedGuestCount on the Data Connect type -- it exists for legacy rows
 * only; every current submission path sends 1). Requesting several guest
 * places means submitting one request per named guest, not a single request
 * with a headcount and one shared name.
 */
export async function submitAdditionalGuestTicketRequests(args: {
  bookingId: string;
  guestTicketTypeId: string;
  idempotencyKey: string;
  guests: { guestDisplayName: string; dietaryNote?: string | null }[];
}): Promise<SubmitGuestTicketRequestResponse[]> {
  const callable = httpsCallable<
    {
      bookingId: string;
      guestTicketTypeId: string;
      idempotencyKey: string;
      guests: { guestDisplayName: string; dietaryNote?: string | null }[];
    },
    { success: boolean; requests: SubmitGuestTicketRequestResponse[] }
  >(functions, "submitAdditionalGuestTicketRequests");
  const result = await callable({
    bookingId: toCanonicalUuid(args.bookingId),
    guestTicketTypeId: toCanonicalUuid(args.guestTicketTypeId),
    idempotencyKey: toCanonicalUuid(args.idempotencyKey),
    guests: args.guests.map((guest) => ({
      guestDisplayName: guest.guestDisplayName.trim(),
      dietaryNote: guest.dietaryNote?.trim() || null,
    })),
  });
  return result.data.requests;
}

export interface ReviewGuestTicketRequestPayload {
  id: string;
  status: "APPROVED" | "REJECTED";
  moderatorNote?: string | null;
}

export interface ReviewGuestTicketRequestResponse {
  success: boolean;
}

export async function reviewGuestTicketRequest(
  payload: ReviewGuestTicketRequestPayload
): Promise<ReviewGuestTicketRequestResponse> {
  const callable = httpsCallable<ReviewGuestTicketRequestPayload, ReviewGuestTicketRequestResponse>(
    functions,
    "reviewGuestTicketRequest"
  );
  const result = await callable({
    id: toCanonicalUuid(payload.id),
    status: payload.status,
    moderatorNote: payload.moderatorNote?.trim() || null,
  });
  return result.data;
}

export async function subscribeToUserGroup(userGroupId: string): Promise<{ success: boolean }> {
  const callable = httpsCallable<{ userGroupId: string }, { success: boolean }>(
    functions,
    "subscribeToUserGroup"
  );
  const result = await callable({ userGroupId: toCanonicalUuid(userGroupId) });
  return result.data;
}

export async function registerForSectionCallable(userGroupId: string): Promise<{ success: boolean }> {
  const callable = httpsCallable<{ userGroupId: string }, { success: boolean }>(
    functions,
    "registerForSectionCallable"
  );
  const result = await callable({ userGroupId: toCanonicalUuid(userGroupId) });
  return result.data;
}
