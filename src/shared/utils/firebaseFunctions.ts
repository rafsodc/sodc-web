import { httpsCallable } from "firebase/functions";
import { functions } from "../../config/firebase";
import type { MembershipStatus } from "@dataconnect/generated";
import { toCanonicalUuid } from "./uuid";

/**
 * Firebase Cloud Functions wrapper utilities
 * All functions are deployed to europe-west2 region
 */

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

interface ListUsersPendingApprovalResponse {
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: MembershipStatus;
    requestedMembershipStatus: MembershipStatus | null;
    isRegular?: boolean | null;
    isReserve?: boolean | null;
    isCivilServant?: boolean | null;
    isIndustry?: boolean | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface UserWithoutDataConnectProfileRow {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  authDisabled: boolean;
  claimEnabled: string;
  claimAdmin: string;
  createdAt: string;
  lastSignInTime: string | null;
}

interface ListUsersWithoutDataConnectProfileResponse {
  users: UserWithoutDataConnectProfileRow[];
}

/**
 * Lists Auth users with enabled claim not true and no Data Connect profile.
 */
export async function listUsersWithoutDataConnectProfile(): Promise<{
  success: boolean;
  users?: UserWithoutDataConnectProfileRow[];
  error?: string;
}> {
  try {
    const callable = httpsCallable<void, ListUsersWithoutDataConnectProfileResponse>(
      functions,
      "listUsersWithoutDataConnectProfile"
    );
    const result = await callable();
    return { success: true, users: result.data.users };
  } catch (error: unknown) {
    const message =
      error && typeof (error as { message?: string }).message === "string"
        ? (error as { message: string }).message
        : "Failed to load users without profile";
    return { success: false, error: message };
  }
}

/**
 * Lists users awaiting admin approval (profile complete, Auth not enabled).
 */
export async function listUsersPendingApproval(): Promise<{
  success: boolean;
  users?: ListUsersPendingApprovalResponse["users"];
  error?: string;
}> {
  try {
    const callable = httpsCallable<void, ListUsersPendingApprovalResponse>(
      functions,
      "listUsersPendingApproval"
    );
    const result = await callable();
    return { success: true, users: result.data.users };
  } catch (error: unknown) {
    const message =
      error && typeof (error as { message?: string }).message === "string"
        ? (error as { message: string }).message
        : "Failed to load pending users";
    return { success: false, error: message };
  }
}

interface SyncPendingUserClaimsResponse {
  success: boolean;
}

/**
 * Sets enabled: false on the current user after profile submission.
 */
export async function syncPendingUserClaims(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const callable = httpsCallable<void, SyncPendingUserClaimsResponse>(
      functions,
      "syncPendingUserClaims"
    );
    const result = await callable();
    return { success: result.data.success };
  } catch (error: unknown) {
    const message =
      error && typeof (error as { message?: string }).message === "string"
        ? (error as { message: string }).message
        : "Failed to sync account status";
    return { success: false, error: message };
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

interface ResignMembershipResponse {
  success: boolean;
  message?: string;
}

/**
 * Resigns the current user's membership (non-restricted status → RESIGNED).
 */
export async function resignMembership(): Promise<{ success: boolean; error?: string }> {
  try {
    const resignMembershipCallable = httpsCallable<
      Record<string, never>,
      ResignMembershipResponse
    >(functions, "resignMembership");

    const result = await resignMembershipCallable({});
    return { success: result.data.success };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to resign membership",
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
  baseBookingId?: string;
  baseRevisionNumber?: number;
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

export interface CreateEventBookingCheckoutSessionRequest {
  eventId: string;
}

export interface CreateEventBookingCheckoutSessionResponse {
  url: string;
  orderIds: string[];
}

export interface GetMyTicketOrderStripeArtifactsResponse {
  receiptUrl: string | null;
}

export interface GetMyTicketOrderStripeArtifactsBatchRequest {
  orderIds: string[];
}

export interface GetMyTicketOrderStripeArtifactsBatchResponse {
  artifactsByOrderId: Record<string, GetMyTicketOrderStripeArtifactsResponse>;
}

/**
 * Submits a booking for an event (validated server-side). Reuse the same idempotency key on retries.
 */
export async function submitEventBooking(
  payload: SubmitEventBookingRequest
): Promise<SubmitEventBookingResponse> {
  const callable = httpsCallable<SubmitEventBookingRequest, SubmitEventBookingResponse>(
    functions,
    "submitEventBooking"
  );
  const normalized: SubmitEventBookingRequest = {
    idempotencyKey: toCanonicalUuid(payload.idempotencyKey),
    eventId: toCanonicalUuid(payload.eventId),
    baseBookingId: payload.baseBookingId ? toCanonicalUuid(payload.baseBookingId) : undefined,
    baseRevisionNumber: payload.baseRevisionNumber,
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

export async function createEventBookingCheckoutSession(
  payload: CreateEventBookingCheckoutSessionRequest
): Promise<CreateEventBookingCheckoutSessionResponse> {
  const callable = httpsCallable<
    CreateEventBookingCheckoutSessionRequest,
    CreateEventBookingCheckoutSessionResponse
  >(functions, "createEventBookingCheckoutSession");
  const result = await callable({
    eventId: toCanonicalUuid(payload.eventId),
  });
  return result.data;
}

export async function getMyTicketOrderStripeArtifactsBatch(
  payload: GetMyTicketOrderStripeArtifactsBatchRequest
): Promise<GetMyTicketOrderStripeArtifactsBatchResponse> {
  const callable = httpsCallable<GetMyTicketOrderStripeArtifactsBatchRequest, GetMyTicketOrderStripeArtifactsBatchResponse>(
    functions,
    "getMyTicketOrderStripeArtifactsBatch"
  );
  const result = await callable({
    orderIds: payload.orderIds.map((orderId) => toCanonicalUuid(orderId)),
  });
  const data = result.data as { result?: GetMyTicketOrderStripeArtifactsBatchResponse } & GetMyTicketOrderStripeArtifactsBatchResponse;
  return data.result ?? data;
}

export interface ReconcileMyCheckoutSessionOrdersRequest {
  orderId: string;
}

export interface ReconcileMyCheckoutSessionOrdersResponse {
  appliedCount: number;
  reconciledOrderIds: string[];
  orderIds: string[];
}

export async function reconcileMyCheckoutSessionOrders(
  payload: ReconcileMyCheckoutSessionOrdersRequest
): Promise<ReconcileMyCheckoutSessionOrdersResponse> {
  const callable = httpsCallable<
    ReconcileMyCheckoutSessionOrdersRequest,
    ReconcileMyCheckoutSessionOrdersResponse
  >(functions, "reconcileMyCheckoutSessionOrders");
  const result = await callable({ orderId: toCanonicalUuid(payload.orderId) });
  const data = result.data as { result?: ReconcileMyCheckoutSessionOrdersResponse } & ReconcileMyCheckoutSessionOrdersResponse;
  return data.result ?? data;
}

// ============================================================================
// Guest ticket requests (callable — server email + validation)
// ============================================================================

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

// ============================================================================
// Email Template Sync
// ============================================================================

export type TemplateSyncStatus = "in_sync" | "drift" | "not_configured" | "fetch_error";

export interface TemplateSyncResult {
  templateKey: string;
  templateUuid?: string;
  notifyEditUrl?: string;
  status: TemplateSyncStatus;
  liveSubject?: string;
  liveBody?: string;
  expectedSubject: string;
  expectedBody: string;
  subjectMatch?: boolean;
  bodyMatch?: boolean;
  errorMessage?: string;
}

export async function getTemplateSyncStatus(): Promise<{ results: TemplateSyncResult[] }> {
  const callable = httpsCallable<void, { results: TemplateSyncResult[] }>(
    functions,
    "getTemplateSyncStatus"
  );
  const result = await callable();
  return result.data;
}

// ============================================================================
// Announcements
// ============================================================================

export interface AnnouncementTemplate {
  id: string;
  name: string;
  updatedAt: string;
  requiredPersonalisation: string[];
}

export async function getAnnouncementTemplates(
  sectionId: string
): Promise<AnnouncementTemplate[]> {
  const callable = httpsCallable<{ sectionId: string }, { templates: AnnouncementTemplate[] }>(
    functions,
    "getAnnouncementTemplates"
  );
  const result = await callable({ sectionId });
  return result.data.templates;
}

export async function previewAnnouncementTemplate(
  templateUuid: string
): Promise<{ html: string; subject: string }> {
  const callable = httpsCallable<{ templateUuid: string }, { html: string; subject: string }>(
    functions,
    "previewAnnouncementTemplate"
  );
  const result = await callable({ templateUuid });
  return result.data;
}

export interface SendAnnouncementResult {
  sendId: string;
  queuedCount: number;
  skippedCount: number;
}

export async function sendSectionAnnouncement(
  sectionId: string,
  templateUuid: string,
  templateName?: string
): Promise<SendAnnouncementResult> {
  const callable = httpsCallable<
    { sectionId: string; templateUuid: string; templateName?: string },
    SendAnnouncementResult
  >(functions, "sendSectionAnnouncement");
  const result = await callable({ sectionId, templateUuid, templateName });
  return result.data;
}

export interface AnnouncementSend {
  id: string;
  templateUuid: string;
  templateName: string | null;
  sectionId: string;
  sentBy: string;
  sentAt: string;
  recipientCount: number;
  skippedCount: number;
  processedCount: number;
}

export interface AnnouncementRecipient {
  id: string;
  sendId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "skipped" | "sent" | "failed";
  skippedReason?: string;
  sentAt?: string;
  failureReason?: string;
}

export async function getAnnouncementSendHistory(
  sectionId: string
): Promise<AnnouncementSend[]> {
  const callable = httpsCallable<{ sectionId: string }, { sends: AnnouncementSend[] }>(
    functions,
    "getAnnouncementSendHistory"
  );
  const result = await callable({ sectionId });
  return result.data.sends;
}

export async function getAnnouncementSendRecipients(
  sendId: string,
  sectionId: string
): Promise<AnnouncementRecipient[]> {
  const callable = httpsCallable<
    { sendId: string; sectionId: string },
    { recipients: AnnouncementRecipient[] }
  >(functions, "getAnnouncementSendRecipients");
  const result = await callable({ sendId, sectionId });
  return result.data.recipients;
}

