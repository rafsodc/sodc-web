import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { requireAuth, handleFunctionError } from "./helpers";
import { canUserChangeStatus, isNonRestrictedStatus, type MembershipStatus } from "./validation";
import { FUNCTIONS_REGION } from "./constants";
import { 
  updateUserMembershipStatus, 
  getUserMembershipStatus,
  type MembershipStatus as AdminMembershipStatus
} from "@dataconnect/admin-generated";

// No longer using automatic status-based groups
// Access groups now include membershipStatuses array. Status-based membership is inherited (computed in
// getSectionMembersMerged and in admin UI); users are not written to UserAccessGroup for status-only membership.

/**
 * Updates membership status with server-side validation and enforcement.
 * This is the only way users can update membershipStatus - it cannot be done via UpsertUser mutation.
 * Users can only update their own status unless they are an admin.
 */
export const updateMembershipStatus = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAuth(request);

  const { userId, newStatus } = request.data;

  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "userId is required and must be a string");
  }

  if (!newStatus || typeof newStatus !== "string") {
    throw new HttpsError("invalid-argument", "newStatus is required and must be a string");
  }

  const isAdmin = request.auth!.token.admin === true;
  if (!isAdmin && request.auth!.uid !== userId) {
    throw new HttpsError("permission-denied", "Users can only update their own profile");
  }

  try {
    // Check if target user is an admin
    const targetUser = await admin.auth().getUser(userId);
    const targetUserIsAdmin = targetUser.customClaims?.admin === true;
    
    const currentStatus = await fetchCurrentStatusFromDataConnect(userId);
    
    const validation = canUserChangeStatus(
      currentStatus,
      newStatus as MembershipStatus,
      isAdmin,
      targetUserIsAdmin
    );
    
    if (!validation.allowed) {
      logger.warn(`Invalid membership status transition attempted: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}, targetIsAdmin=${targetUserIsAdmin}`);
      throw new HttpsError("permission-denied", validation.error || "Invalid membership status transition");
    }
    
    await updateMembershipStatusInDataConnect(userId, newStatus as MembershipStatus);
    
    // Automatically update the enabled claim based on membership status
    await updateEnabledClaim(userId, newStatus as MembershipStatus);
    
    // Access group membership by status is computed at read time (admin UI and getSectionMembersMerged)
    // — we do not write UserAccessGroup rows when status changes.
    
    logger.info(`Membership status updated: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}`);
    return { success: true, message: "Membership status updated successfully" };
  } catch (e: any) {
    handleFunctionError(e, "updating membership status");
  }
  }
);

/**
 * Updates the membership status in Data Connect using the Admin SDK
 */
async function updateMembershipStatusInDataConnect(
  userId: string,
  membershipStatus: MembershipStatus
): Promise<void> {
  try {
    await updateUserMembershipStatus({
      userId,
      membershipStatus: membershipStatus as AdminMembershipStatus
    });
    logger.info(`Successfully updated membership status for userId=${userId} to ${membershipStatus}`);
  } catch (error: any) {
    logger.error(`Could not update membership status in Data Connect for userId=${userId}:`, error);
    throw error;
  }
}

/**
 * Fetches the current membership status from Data Connect using the Admin SDK
 */
async function fetchCurrentStatusFromDataConnect(
  userId: string
): Promise<MembershipStatus | null> {
  try {
    const result = await getUserMembershipStatus({ id: userId });
    return result.data?.user?.membershipStatus as MembershipStatus | null || null;
  } catch (error: any) {
    logger.warn(`Could not fetch current status from Data Connect for userId=${userId}:`, error);
    return null;
  }
}

/**
 * Updates the enabled claim based on membership status
 * - enabled: true for non-restricted statuses (REGULAR, RETIRED, RESERVE, INDUSTRY, CIVIL_SERVICE)
 * - enabled: false for restricted statuses (PENDING, RESIGNED, LOST, DECEASED)
 * - enabled: always true for admins (admins cannot have restricted statuses)
 * Preserves existing claims (like admin) when updating
 */
async function updateEnabledClaim(
  userId: string,
  membershipStatus: MembershipStatus
): Promise<void> {
  try {
    // Get current user to preserve existing claims
    const userRecord = await admin.auth().getUser(userId);
    const currentClaims = userRecord.customClaims || {};
    const isAdmin = currentClaims.admin === true;
    
    // Determine if account should be enabled based on membership status
    // Admins must always be enabled (they cannot have restricted statuses)
    const shouldBeEnabled = isAdmin ? true : isNonRestrictedStatus(membershipStatus);
    
    // Update claims, preserving existing ones
    const updatedClaims = {
      ...currentClaims,
      enabled: shouldBeEnabled,
    };
    
    await admin.auth().setCustomUserClaims(userId, updatedClaims);
    logger.info(`Updated enabled claim for userId=${userId}: enabled=${shouldBeEnabled} (status=${membershipStatus}, admin=${isAdmin})`);
  } catch (error: any) {
    logger.error(`Could not update enabled claim for userId=${userId}:`, error);
    // Don't throw - this is a side effect, we don't want to fail the status update if claim update fails
  }
}
