import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../../config/firebase";
import type { MembershipStatus } from "@dataconnect/generated";
import { toCanonicalUuid } from "./uuid";

/**
 * Firebase Cloud Functions wrapper utilities
 * All functions are deployed to europe-west2 region
 */

const FUNCTIONS_REGION = "europe-west2";

// ============================================================================
// Admin Functions
// ============================================================================

interface GrantAdminRequest {
  uid: string;
}

interface GrantAdminResponse {
  success: boolean;
  message?: string;
}

/**
 * Grants admin claim to a user
 * @param uid - The UID of the user to grant admin to
 * @returns Promise with the result
 */
export async function grantAdminClaim(
  uid: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
    const grantAdminCallable = httpsCallable<GrantAdminRequest, GrantAdminResponse>(
      functions,
      "grantAdmin"
    );
    
    const result = await grantAdminCallable({ uid });
    return { success: true, message: result.data.message };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to grant admin claim" 
    };
  }
}

interface RevokeAdminRequest {
  uid: string;
}

interface RevokeAdminResponse {
  success: boolean;
  message?: string;
}

/**
 * Revokes admin claim from a user
 * @param uid - The UID of the user to revoke admin from
 * @returns Promise with the result
 */
export async function revokeAdminClaim(
  uid: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
    const revokeAdminCallable = httpsCallable<RevokeAdminRequest, RevokeAdminResponse>(
      functions,
      "revokeAdmin"
    );
    
    const result = await revokeAdminCallable({ uid });
    return { success: true, message: result.data.message };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to revoke admin claim" 
    };
  }
}

// ============================================================================
// User Display Name Functions
// ============================================================================

interface UpdateDisplayNameRequest {
  displayName: string;
}

interface UpdateDisplayNameResponse {
  success: boolean;
  message?: string;
}

/**
 * Updates the current user's display name in Firebase Auth
 * @param displayName - The new display name
 * @returns Promise with the result
 */
export async function updateDisplayName(
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
    const updateDisplayNameCallable = httpsCallable<UpdateDisplayNameRequest, UpdateDisplayNameResponse>(
      functions,
      "updateDisplayName"
    );
    
    const result = await updateDisplayNameCallable({ displayName });
    return { success: result.data.success };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to update display name" 
    };
  }
}

interface UpdateUserDisplayNameRequest {
  userId: string;
  displayName: string;
}

interface UpdateUserDisplayNameResponse {
  success: boolean;
  message?: string;
}

/**
 * Updates a user's display name in Firebase Auth (admin function)
 * @param userId - The user ID to update
 * @param displayName - The new display name
 * @returns Promise with the result
 */
export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
    const updateUserDisplayNameCallable = httpsCallable<UpdateUserDisplayNameRequest, UpdateUserDisplayNameResponse>(
      functions,
      "updateUserDisplayName"
    );
    
    const result = await updateUserDisplayNameCallable({ userId, displayName });
    return { success: result.data.success };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to update user display name" 
    };
  }
}

// ============================================================================
// Membership Status Functions
// ============================================================================

interface UpdateMembershipStatusRequest {
  userId: string;
  newStatus: MembershipStatus;
}

interface UpdateMembershipStatusResponse {
  success: boolean;
  message?: string;
}

/**
 * Updates membership status with server-side validation and enforcement
 * This function validates AND updates the membership status, preventing bypass
 * @param userId - The user ID whose status is being changed
 * @param newStatus - The desired new membership status
 * @returns Promise with the result
 */
export async function updateMembershipStatus(
  userId: string,
  newStatus: MembershipStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
    const updateMembershipStatusCallable = httpsCallable<
      UpdateMembershipStatusRequest,
      UpdateMembershipStatusResponse
    >(functions, "updateMembershipStatus");
    
    const result = await updateMembershipStatusCallable({ userId, newStatus });
    return { success: result.data.success };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to update membership status" 
    };
  }
}

// ============================================================================
// Section members (merged: explicit + inherited by status)
// ============================================================================

export interface GetSectionMembersMergedRequest {
  sectionId: string;
}

export interface GetSectionMembersMergedMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: string;
}

export interface GetSectionMembersMergedResponse {
  members: GetSectionMembersMergedMember[];
}

/**
 * Returns merged section members (explicit + inherited by status). Requires view permission.
 */
export async function getSectionMembersMerged(
  sectionId: string
): Promise<GetSectionMembersMergedResponse> {
  const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
  const callable = httpsCallable<
    GetSectionMembersMergedRequest,
    GetSectionMembersMergedResponse
  >(functions, "getSectionMembersMerged");
  const result = await callable({ sectionId });
  return result.data;
}

// ============================================================================
// Event booking (callable — server rules + idempotency)
// ============================================================================

export interface SubmitEventBookingLine {
  ticketTypeId: string;
  sortOrder: number;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
}

export interface SubmitEventBookingRequest {
  idempotencyKey: string;
  eventId: string;
  lines: SubmitEventBookingLine[];
  bookerDietaryNote?: string | null;
  sitNextToUserIds?: string[];
  accommodationRequested?: boolean;
  accommodationNote?: string | null;
}

export interface SubmitEventBookingResponse {
  bookingId: string;
  status: string;
  idempotentReplay?: boolean;
}

export interface CreateTicketCheckoutSessionRequest {
  ticketTypeId: string;
  quantity?: number;
}

export interface CreateTicketCheckoutSessionResponse {
  url: string;
  orderId: string;
}

/**
 * Submits a booking for an event (validated server-side). Reuse the same idempotency key on retries.
 */
export async function submitEventBooking(
  payload: SubmitEventBookingRequest
): Promise<SubmitEventBookingResponse> {
  const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
  const callable = httpsCallable<SubmitEventBookingRequest, SubmitEventBookingResponse>(
    functions,
    "submitEventBooking"
  );
  const normalized: SubmitEventBookingRequest = {
    idempotencyKey: toCanonicalUuid(payload.idempotencyKey),
    eventId: toCanonicalUuid(payload.eventId),
    lines: payload.lines.map((line) => ({
      ...line,
      ticketTypeId: toCanonicalUuid(line.ticketTypeId),
    })),
    bookerDietaryNote: payload.bookerDietaryNote?.trim() || null,
    sitNextToUserIds: (payload.sitNextToUserIds ?? []).map((id) => id.trim()).filter(Boolean),
    accommodationRequested: payload.accommodationRequested ?? false,
    accommodationNote: payload.accommodationNote?.trim() || null,
  };
  const result = await callable(normalized);
  return result.data;
}

export async function createTicketCheckoutSession(
  payload: CreateTicketCheckoutSessionRequest
): Promise<CreateTicketCheckoutSessionResponse> {
  const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
  const callable = httpsCallable<CreateTicketCheckoutSessionRequest, CreateTicketCheckoutSessionResponse>(
    functions,
    "createTicketCheckoutSession"
  );
  const normalized: CreateTicketCheckoutSessionRequest = {
    ticketTypeId: toCanonicalUuid(payload.ticketTypeId),
    quantity: payload.quantity ?? 1,
  };
  const result = await callable(normalized);
  return result.data;
}

