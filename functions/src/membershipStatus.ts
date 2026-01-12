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

// Status-based access groups (auto-assigned, prefixed with "Status:")
const MEMBERSHIP_STATUS_TO_ACCESS_GROUP: Partial<Record<MembershipStatus, string>> = {
  REGULAR: "Status:Regular",
  RESERVE: "Status:Reserve",
  CIVIL_SERVICE: "Status:Civil Service",
  INDUSTRY: "Status:Industry",
  RETIRED: "Status:Retired",
  // PENDING, RESIGNED, LOST, DECEASED do not have access groups
};

// Status prefix for status-based access groups (used in helper functions)
export const STATUS_PREFIX = "Status:";

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
 * - If new status is restricted: Remove user from ALL access groups
 * - If new status is non-restricted: Remove from previous status-based group, add to new status-based group, preserve manual groups
 * - If transitioning from restricted to non-restricted: Add user to appropriate status-based group
 */
async function updateAccessGroupsForStatusChange(
  userId: string,
  currentStatus: MembershipStatus | null,
  newStatus: MembershipStatus
): Promise<void> {
  try {
    // Import admin SDK mutations dynamically to avoid issues if SDK not regenerated yet
    // Note: This will fail until SDK is regenerated after deploying DataConnect changes
    let adminSdk: any;
    try {
      adminSdk = await import("@dataconnect/admin-generated");
    } catch (error) {
      logger.warn("Admin SDK not available yet - access group management will be skipped. Deploy DataConnect and regenerate SDK.");
      return;
    }
    
    // Check if required functions exist in SDK
    if (!adminSdk.getUserAccessGroupsForAdmin || !adminSdk.getAccessGroupByName || 
        !adminSdk.createAccessGroupAdmin || !adminSdk.addUserToAccessGroupAdmin || !adminSdk.removeUserFromAccessGroupAdmin) {
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
    
    // Get user's current access groups
    const userAccessGroupsResult = await adminSdk.getUserAccessGroupsForAdmin({ userId });
    const currentAccessGroups = userAccessGroupsResult.data?.user?.accessGroups || [];
    
    // Find the previous status-based access group (if any)
    const previousStatusGroup = currentStatus 
      ? MEMBERSHIP_STATUS_TO_ACCESS_GROUP[currentStatus]
      : null;
    
    // Get the new status-based access group name
    const newStatusGroupName = MEMBERSHIP_STATUS_TO_ACCESS_GROUP[newStatus];
    
    if (!newStatusGroupName) {
      logger.warn(`No access group defined for status ${newStatus}`);
      return;
    }
    
    // Remove user from previous status-based access group if it exists and is different
    if (previousStatusGroup && previousStatusGroup !== newStatusGroupName) {
      const previousGroup = currentAccessGroups.find(
        (ag: any) => ag.accessGroup.name === previousStatusGroup
      );
      if (previousGroup) {
        await adminSdk.removeUserFromAccessGroup({
          userId,
          accessGroupId: previousGroup.accessGroup.id,
        });
        logger.info(`Removed user ${userId} from previous status-based group: ${previousStatusGroup}`);
      }
    }
    
    // Get or create the new status-based access group
    const newStatusGroupId = await getOrCreateStatusBasedAccessGroup(
      newStatusGroupName,
      adminSdk,
      now
    );
    
    if (!newStatusGroupId) {
      logger.error(`Failed to get or create access group for status ${newStatus}`);
      return;
    }
    
    // Check if user is already in the new status-based group
    const alreadyInGroup = currentAccessGroups.some(
      (ag: any) => ag.accessGroup.id === newStatusGroupId
    );
    
    if (!alreadyInGroup) {
      // Add user to new status-based access group
      await adminSdk.addUserToAccessGroupAdmin({
        userId,
        accessGroupId: newStatusGroupId,
        now: now.toISOString(),
      });
      logger.info(`Added user ${userId} to status-based group: ${newStatusGroupName}`);
    }
    
  } catch (error: any) {
    logger.error(`Could not update access groups for userId=${userId}:`, error);
    // Don't throw - this is a side effect, we don't want to fail the status update if access group update fails
  }
}

/**
 * Gets or creates a status-based access group
 */
async function getOrCreateStatusBasedAccessGroup(
  groupName: string,
  adminSdk: any,
  now: Date
): Promise<string | null> {
  try {
    // Try to find existing access group
    const result = await adminSdk.getAccessGroupByName({ name: groupName });
    const existingGroup = result.data?.accessGroups?.[0];
    
    if (existingGroup) {
      return existingGroup.id;
    }
    
    // Create new access group if it doesn't exist
    const createResult = await adminSdk.createAccessGroupAdmin({
      name: groupName,
      description: `Auto-assigned access group for ${groupName.replace("Status:", "")} members`,
      now: now.toISOString(),
    });
    
    const newGroupId = createResult.data?.accessGroup_insert?.id;
    if (newGroupId) {
      logger.info(`Created new status-based access group: ${groupName}`);
      return newGroupId;
    }
    
    return null;
  } catch (error: any) {
    logger.error(`Could not get or create access group ${groupName}:`, error);
    return null;
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

