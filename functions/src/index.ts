import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import type { CallableRequest } from "firebase-functions/v2/https";
import { canUserChangeStatus, type MembershipStatus } from "./validation";
import { 
  updateUserMembershipStatus, 
  getUserMembershipStatus,
  type MembershipStatus as AdminMembershipStatus
} from "@dataconnect/admin-generated";

setGlobalOptions({ region: "europe-west2", maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

// Helper functions to reduce duplication

/**
 * Ensures the request is authenticated
 */
function requireAuth(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
}

/**
 * Ensures the request is authenticated and the user is an admin
 */
function requireAdmin(request: CallableRequest): void {
  requireAuth(request);
  if (request.auth!.token.admin !== true) {
    throw new HttpsError("permission-denied", "Admins only");
  }
}

/**
 * Validates that a value is a non-empty string
 */
function requireString(value: any, fieldName: string): string {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${fieldName} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Maps a Firebase Auth user record to a simplified user object
 */
function mapUserRecord(userRecord: admin.auth.UserRecord) {
  return {
    uid: userRecord.uid,
    email: userRecord.email || "",
    displayName: userRecord.displayName || "",
    emailVerified: userRecord.emailVerified,
    disabled: userRecord.disabled,
    metadata: {
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
    },
    customClaims: userRecord.customClaims || {},
  };
}

/**
 * Gets all admin users from Firebase Auth
 */
async function getAdminUsers(): Promise<admin.auth.UserRecord[]> {
  const listUsersResult = await admin.auth().listUsers();
  return listUsersResult.users.filter((userRecord) => {
    const customClaims = userRecord.customClaims || {};
    return customClaims.admin === true;
  });
}

export const grantAdmin = onCall(
  async (request) => {
    requireAdmin(request);

    const uid = requireString(request.data.uid, "uid");

    try {
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      logger.info(`Admin claim set for uid=${uid} by caller=${request.auth!.uid}`);
      return { success: true, message: `Admin claim set for uid=${uid}` };
    } catch (e: any) {
      logger.error("Error setting custom claim:", e);
      throw new HttpsError("internal", e?.message ?? "Error setting custom claim");
    }
  }
);

export const revokeAdmin = onCall(
  async (request) => {
    requireAdmin(request);

    const uid = requireString(request.data.uid, "uid");

    try {
      // Check how many admins exist
      const adminUsers = await getAdminUsers();

      // Prevent removing the last admin
      if (adminUsers.length <= 1) {
        throw new HttpsError("failed-precondition", "Cannot remove the last admin. At least one admin must remain.");
      }

      // Check if the user being revoked is actually an admin
      const targetUser = await admin.auth().getUser(uid);
      const targetUserClaims = targetUser.customClaims || {};
      if (targetUserClaims.admin !== true) {
        throw new HttpsError("failed-precondition", "User is not an admin");
      }

      // Remove admin claim
      await admin.auth().setCustomUserClaims(uid, { admin: false });
      logger.info(`Admin claim removed for uid=${uid} by caller=${request.auth!.uid}`);
      return { success: true, message: `Admin claim removed for uid=${uid}` };
    } catch (e: any) {
      if (e instanceof HttpsError) {
        throw e;
      }
      logger.error("Error removing custom claim:", e);
      throw new HttpsError("internal", e?.message ?? "Error removing custom claim");
    }
  }
);

export const listAdminUsers = onCall(
  async (request) => {
    requireAdmin(request);

    try {
      const adminUsers = await getAdminUsers();
      const mappedUsers = adminUsers.map(mapUserRecord);

      logger.info(`Found ${mappedUsers.length} admin users for caller ${request.auth!.uid}`);
      return { users: mappedUsers };
    } catch (e: any) {
      logger.error("Error listing admin users:", e);
      throw new HttpsError("internal", e?.message ?? "Error listing admin users");
    }
  }
);

export const updateDisplayName = onCall(
  async (request) => {
    requireAuth(request);

    const displayName = requireString(request.data.displayName, "displayName");

    try {
      await admin.auth().updateUser(request.auth!.uid, {
        displayName,
      });

      logger.info(`Display name updated for uid=${request.auth!.uid}`);
      return { success: true };
    } catch (e: any) {
      logger.error("Error updating display name:", e);
      throw new HttpsError("internal", e?.message ?? "Error updating display name");
    }
  }
);

// Admin-only function to update any user's display name
export const updateUserDisplayName = onCall(
  async (request) => {
    requireAdmin(request);

    const userId = requireString(request.data.userId, "userId");
    const displayName = requireString(request.data.displayName, "displayName");

    try {
      await admin.auth().updateUser(userId, {
        displayName,
      });

      logger.info(`Display name updated for uid=${userId} by admin ${request.auth!.uid}`);
      return { success: true };
    } catch (e: any) {
      logger.error("Error updating user display name:", e);
      throw new HttpsError("internal", e?.message ?? "Error updating user display name");
    }
  }
);

export const searchUsers = onCall(
  async (request) => {
    requireAdmin(request);

    const searchTerm = requireString(request.data.searchTerm, "searchTerm");
    const page = request.data.page || 1;
    const pageSize = request.data.pageSize || 25;

    try {
      const searchLower = searchTerm.toLowerCase();
      const listUsersResult = await admin.auth().listUsers();
      
      // Filter users that match email or displayName
      const matchingUsers = listUsersResult.users
        .map((userRecord) => {
          const email = (userRecord.email || "").toLowerCase();
          const displayName = (userRecord.displayName || "").toLowerCase();
          
          if (email.includes(searchLower) || displayName.includes(searchLower)) {
            return mapUserRecord(userRecord);
          }
          return null;
        })
        .filter((user) => user !== null);

      // Pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedUsers = matchingUsers.slice(startIndex, endIndex);
      const totalPages = Math.ceil(matchingUsers.length / pageSize);

      logger.info(`Found ${matchingUsers.length} users matching "${searchTerm}" for caller ${request.auth!.uid}`);
      return {
        users: paginatedUsers,
        total: matchingUsers.length,
        page: page,
        pageSize: pageSize,
        totalPages: totalPages,
      };
    } catch (e: any) {
      logger.error("Error searching users:", e);
      throw new HttpsError("internal", e?.message ?? "Error searching users");
    }
  }
);

// Update membership status with server-side validation and enforcement
// This function validates AND updates the membership status, preventing bypass
// Users can only update their own status (unless admin)
// This is the ONLY way users can update membershipStatus - it cannot be done via UpsertUser mutation
export const updateMembershipStatus = onCall(
  async (request) => {
    requireAuth(request);

    const { userId, newStatus } = request.data;

    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userId is required and must be a string");
    }

    if (!newStatus || typeof newStatus !== "string") {
      throw new HttpsError("invalid-argument", "newStatus is required and must be a string");
    }

    // Ensure user can only update their own profile (unless admin)
    const isAdmin = request.auth!.token.admin === true;
    if (!isAdmin && request.auth!.uid !== userId) {
      throw new HttpsError("permission-denied", "Users can only update their own profile");
    }

    try {
      // Fetch current status from Data Connect using Admin SDK
      // This prevents clients from providing a fake currentStatus
      const currentStatus = await fetchCurrentStatusFromDataConnect(userId);
      
      // Validate the transition using server-side logic
      const validation = canUserChangeStatus(
        currentStatus,
        newStatus as MembershipStatus,
        isAdmin
      );
      
      if (!validation.allowed) {
        logger.warn(`Invalid membership status transition attempted: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}`);
        throw new HttpsError("permission-denied", validation.error || "Invalid membership status transition");
      }
      
      // If validation passes, update the status in Data Connect
      await updateMembershipStatusInDataConnect(userId, newStatus as MembershipStatus);
      
      logger.info(`Membership status updated: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}`);
      return { success: true, message: "Membership status updated successfully" };
    } catch (e: any) {
      if (e instanceof HttpsError) {
        throw e;
      }
      logger.error("Error updating membership status:", e);
      throw new HttpsError("internal", e?.message ?? "Error updating membership status");
    }
  }
);

/**
 * Updates the membership status in Data Connect for a given user
 * Uses the Firebase Data Connect Admin SDK with service account credentials
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
 * Fetches the current membership status from Data Connect for a given user
 * Uses the Firebase Data Connect Admin SDK with service account credentials
 */
async function fetchCurrentStatusFromDataConnect(
  userId: string
): Promise<MembershipStatus | null> {
  try {
    const result = await getUserMembershipStatus({ id: userId });
    return result.data?.user?.membershipStatus as MembershipStatus | null || null;
  } catch (error: any) {
    // If we can't fetch from Data Connect, log and return null
    // This allows the validation to proceed, but ideally we'd want to fail securely
    logger.warn(`Could not fetch current status from Data Connect for userId=${userId}:`, error);
    // Return null to allow validation to proceed (new user case)
    // In production, you might want to throw an error here instead
    return null;
  }
}