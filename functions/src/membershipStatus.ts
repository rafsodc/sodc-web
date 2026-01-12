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
// Access groups now include membershipStatuses array that automatically includes users with those statuses

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
    
    // Automatically manage access groups based on membership status
    await updateAccessGroupsForStatusChange(userId, currentStatus, newStatus as MembershipStatus);
    
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

/**
 * Updates access groups for a user when their membership status changes
 * - If new status is restricted: Remove user from ALL access groups (status-based and manual)
 * - If new status is non-restricted:
 *   - Remove user from groups that include oldStatus in their membershipStatuses
 *   - Add user to groups that include newStatus in their membershipStatuses
 *   - Preserve manually assigned groups (groups where user is assigned but status is not in membershipStatuses)
 */
async function updateAccessGroupsForStatusChange(
  userId: string,
  currentStatus: MembershipStatus | null,
  newStatus: MembershipStatus
): Promise<void> {
  try {
    // Import admin SDK mutations dynamically to avoid issues if SDK not regenerated yet
    let adminSdk: any;
    try {
      adminSdk = await import("@dataconnect/admin-generated");
    } catch (error) {
      logger.warn("Admin SDK not available yet - access group management will be skipped. Deploy DataConnect and regenerate SDK.");
      return;
    }
    
    // Check if required functions exist in SDK
    if (!adminSdk.getUserAccessGroupsForAdmin || !adminSdk.getAllAccessGroupsWithStatuses ||
        !adminSdk.addUserToAccessGroupAdmin || !adminSdk.removeUserFromAccessGroupAdmin) {
      logger.warn("Access group mutations not available in SDK yet - access group management will be skipped. Deploy DataConnect and regenerate SDK.");
      return;
    }
    
    const now = new Date();
    
    // If new status is restricted, remove user from ALL access groups
    if (!isNonRestrictedStatus(newStatus)) {
      await removeUserFromAllAccessGroups(userId, adminSdk);
      logger.info(`Removed user ${userId} from all access groups (status changed to restricted: ${newStatus})`);
      return;
    }
    
    // Get all access groups with their membership statuses
    const allGroupsResult = await adminSdk.getAllAccessGroupsWithStatuses({});
    const allGroups = allGroupsResult.data?.accessGroups || [];
    
    // Get user's current access groups
    const userAccessGroupsResult = await adminSdk.getUserAccessGroupsForAdmin({ userId });
    const currentUserGroups = userAccessGroupsResult.data?.user?.accessGroups || [];
    const currentUserGroupIds = new Set(currentUserGroups.map((ug: any) => ug.accessGroup.id));
    
    // Find groups that include oldStatus in their membershipStatuses
    const groupsToRemoveFrom: string[] = [];
    if (currentStatus && isNonRestrictedStatus(currentStatus)) {
      for (const group of allGroups) {
        if (group.membershipStatuses && group.membershipStatuses.includes(currentStatus)) {
          // Only remove if user is currently in this group
          if (currentUserGroupIds.has(group.id)) {
            groupsToRemoveFrom.push(group.id);
          }
        }
      }
    }
    
    // Find groups that include newStatus in their membershipStatuses
    const groupsToAddTo: string[] = [];
    for (const group of allGroups) {
      if (group.membershipStatuses && group.membershipStatuses.includes(newStatus)) {
        // Only add if user is not already in this group
        if (!currentUserGroupIds.has(group.id)) {
          groupsToAddTo.push(group.id);
        }
      }
    }
    
    // Remove user from groups that no longer match their status
    for (const groupId of groupsToRemoveFrom) {
      try {
        await adminSdk.removeUserFromAccessGroupAdmin({
          userId,
          accessGroupId: groupId,
        });
        logger.info(`Removed user ${userId} from access group ${groupId} (status changed from ${currentStatus})`);
      } catch (error: any) {
        logger.error(`Failed to remove user ${userId} from group ${groupId}:`, error);
      }
    }
    
    // Add user to groups that match their new status
    for (const groupId of groupsToAddTo) {
      try {
        await adminSdk.addUserToAccessGroupAdmin({
          userId,
          accessGroupId: groupId,
          now: now.toISOString(),
        });
        logger.info(`Added user ${userId} to access group ${groupId} (status changed to ${newStatus})`);
      } catch (error: any) {
        logger.error(`Failed to add user ${userId} to group ${groupId}:`, error);
      }
    }
    
    // Note: Manually assigned groups (where user is assigned but status is not in membershipStatuses)
    // are preserved automatically - we only remove/add based on status inclusion
    
  } catch (error: any) {
    logger.error(`Could not update access groups for userId=${userId}:`, error);
    // Don't throw - this is a side effect, we don't want to fail the status update if access group update fails
  }
}

/**
 * Removes user from all access groups
 */
async function removeUserFromAllAccessGroups(
  userId: string,
  adminSdk: any
): Promise<void> {
  try {
    const userAccessGroupsResult = await adminSdk.getUserAccessGroupsForAdmin({ userId });
    const accessGroups = userAccessGroupsResult.data?.user?.accessGroups || [];
    
    // Remove user from each access group
    for (const userAccessGroup of accessGroups) {
      await adminSdk.removeUserFromAccessGroupAdmin({
        userId,
        accessGroupId: userAccessGroup.accessGroup.id,
      });
    }
    
    logger.info(`Removed user ${userId} from ${accessGroups.length} access groups`);
  } catch (error: any) {
    logger.error(`Could not remove user ${userId} from all access groups:`, error);
    throw error;
  }
}

