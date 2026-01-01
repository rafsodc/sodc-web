import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import type { CallableRequest } from "firebase-functions/v2/https";

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