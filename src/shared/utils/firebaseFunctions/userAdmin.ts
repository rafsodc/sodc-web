import { httpsCallable } from "firebase/functions";
import type { MembershipStatus } from "@dataconnect/generated";
import { functions } from "../../../config/firebase";
import { extractDomainErrorCode, reportError } from "../../errors";

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
  } catch (error: unknown) {
    reportError("callable.grant-admin", error);
    return {
      success: false,
      error: "Administrator access could not be granted. Please try again."
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
  } catch (error: unknown) {
    reportError("callable.revoke-admin", error);
    return {
      success: false,
      error: "Administrator access could not be revoked. Please try again."
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
  } catch (error: unknown) {
    reportError("callable.update-display-name", error);
    return {
      success: false,
      error: "The display name could not be updated. Please try again."
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
  } catch (error: unknown) {
    reportError("callable.update-user-display-name", error, { userId });
    return {
      success: false,
      error: "The display name could not be updated. Please try again."
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
    reportError("callable.list-users-without-profile", error);
    return { success: false, error: "Users without profiles could not be loaded. Please try again." };
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
    reportError("callable.list-pending-users", error);
    return { success: false, error: "Pending users could not be loaded. Please try again." };
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
    reportError("callable.sync-pending-user-claims", error);
    return { success: false, error: "The account status could not be synchronised. Please try again." };
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
): Promise<{ success: boolean; error?: string; domainCode?: string }> {
  try {
    const updateMembershipStatusCallable = httpsCallable<
      UpdateMembershipStatusRequest,
      UpdateMembershipStatusResponse
    >(functions, "updateMembershipStatus");

    const result = await updateMembershipStatusCallable({ userId, newStatus });
    return { success: result.data.success };
  } catch (error: unknown) {
    reportError("callable.update-membership-status", error, { userId, newStatus });
    return {
      success: false,
      error: "The membership status could not be updated. Please try again.",
      domainCode: extractDomainErrorCode(error),
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
export async function resignMembership(): Promise<{
  success: boolean;
  error?: string;
  domainCode?: string;
}> {
  try {
    const resignMembershipCallable = httpsCallable<
      Record<string, never>,
      ResignMembershipResponse
    >(functions, "resignMembership");

    const result = await resignMembershipCallable({});
    return { success: result.data.success };
  } catch (error: unknown) {
    reportError("callable.resign-membership", error);
    return {
      success: false,
      error: "The membership could not be resigned. Please try again.",
      domainCode: extractDomainErrorCode(error),
    };
  }
}
