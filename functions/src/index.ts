import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";


setGlobalOptions({ region: "europe-west2", maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

export const grantAdmin = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError("permission-denied", "Admins only");
    }

    const { uid } = request.data;

    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "uid is required and must be a string");
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      logger.info(`Admin claim set for uid=${uid} by caller=${request.auth.uid}`);
      return { success: true, message: `Admin claim set for uid=${uid}` };
    } catch (e: any) {
      logger.error("Error setting custom claim:", e);
      throw new HttpsError("internal", e?.message ?? "Error setting custom claim");
    }
  }
);

export const revokeAdmin = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError("permission-denied", "Admins only");
    }

    const { uid } = request.data;

    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "uid is required and must be a string");
    }

    try {
      // Check how many admins exist
      const listUsersResult = await admin.auth().listUsers();
      const adminUsers = listUsersResult.users.filter((userRecord) => {
        const customClaims = userRecord.customClaims || {};
        return customClaims.admin === true;
      });

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
      logger.info(`Admin claim removed for uid=${uid} by caller=${request.auth.uid}`);
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
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError("permission-denied", "Admins only");
    }

    try {
      // List all users from Firebase Auth
      const listUsersResult = await admin.auth().listUsers();
      
      // Filter users that have admin claim
      const adminUsers = listUsersResult.users
        .map((userRecord) => {
          const customClaims = userRecord.customClaims || {};
          if (customClaims.admin === true) {
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
            };
          }
          return null;
        })
        .filter((user) => user !== null);

      logger.info(`Found ${adminUsers.length} admin users for caller ${request.auth.uid}`);
      return { users: adminUsers };
    } catch (e: any) {
      logger.error("Error listing admin users:", e);
      throw new HttpsError("internal", e?.message ?? "Error listing admin users");
    }
  }
);

export const updateDisplayName = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }

    const { displayName } = request.data;

    if (!displayName || typeof displayName !== "string") {
      throw new HttpsError("invalid-argument", "displayName is required and must be a string");
    }

    try {
      await admin.auth().updateUser(request.auth.uid, {
        displayName: displayName.trim(),
      });

      logger.info(`Display name updated for uid=${request.auth.uid}`);
      return { success: true };
    } catch (e: any) {
      logger.error("Error updating display name:", e);
      throw new HttpsError("internal", e?.message ?? "Error updating display name");
    }
  }
);

export const searchUsers = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError("permission-denied", "Admins only");
    }

    const { searchTerm, page = 1, pageSize = 25 } = request.data;

    if (!searchTerm || typeof searchTerm !== "string" || searchTerm.trim().length === 0) {
      throw new HttpsError("invalid-argument", "searchTerm is required and must be a non-empty string");
    }

    try {
      const searchLower = searchTerm.toLowerCase().trim();
      const listUsersResult = await admin.auth().listUsers();
      
      // Filter users that match email or displayName
      const matchingUsers = listUsersResult.users
        .map((userRecord) => {
          const email = (userRecord.email || "").toLowerCase();
          const displayName = (userRecord.displayName || "").toLowerCase();
          
          if (email.includes(searchLower) || displayName.includes(searchLower)) {
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
          return null;
        })
        .filter((user) => user !== null);

      // Pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedUsers = matchingUsers.slice(startIndex, endIndex);
      const totalPages = Math.ceil(matchingUsers.length / pageSize);

      logger.info(`Found ${matchingUsers.length} users matching "${searchTerm}" for caller ${request.auth.uid}`);
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