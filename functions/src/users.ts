import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { requireAuth, requireAdmin, requireString, mapUserRecord } from "./helpers";

/**
 * Updates the display name of the authenticated user
 */
export const updateDisplayName = onCall(async (request) => {
  requireAuth(request);
  const displayName = requireString(request.data.displayName, "displayName");

  try {
    await admin.auth().updateUser(request.auth!.uid, { displayName });
    logger.info(`Display name updated for uid=${request.auth!.uid}`);
    return { success: true };
  } catch (e: any) {
    logger.error("Error updating display name:", e);
    throw new HttpsError("internal", e?.message ?? "Error updating display name");
  }
});

/**
 * Updates the display name of any user (admin only)
 */
export const updateUserDisplayName = onCall(async (request) => {
  requireAdmin(request);
  const userId = requireString(request.data.userId, "userId");
  const displayName = requireString(request.data.displayName, "displayName");

  try {
    await admin.auth().updateUser(userId, { displayName });
    logger.info(`Display name updated for uid=${userId} by admin ${request.auth!.uid}`);
    return { success: true };
  } catch (e: any) {
    logger.error("Error updating user display name:", e);
    throw new HttpsError("internal", e?.message ?? "Error updating user display name");
  }
});

/**
 * Searches for users by email or display name with pagination (admin only)
 */
export const searchUsers = onCall(async (request) => {
  requireAdmin(request);
  const searchTerm = requireString(request.data.searchTerm, "searchTerm");
  const page = request.data.page || 1;
  const pageSize = request.data.pageSize || 25;

  try {
    const searchLower = searchTerm.toLowerCase();
    const listUsersResult = await admin.auth().listUsers();
    
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
});

