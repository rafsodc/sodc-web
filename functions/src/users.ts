import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { requireAuth, requireAdmin, requireString, validateStringLength, MAX_NAME_LENGTH, mapUserRecord, handleFunctionError } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";

/**
 * Updates the display name of the authenticated user
 */
export const updateDisplayName = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAuth(request);
  const displayName = validateStringLength(
    requireString(request.data.displayName, "displayName"),
    "Display name",
    MAX_NAME_LENGTH * 2 // Display name can be "FirstName LastName"
  );

  try {
    await admin.auth().updateUser(request.auth!.uid, { displayName });
    logger.info(`Display name updated for uid=${request.auth!.uid}`);
    return { success: true };
  } catch (e: any) {
    handleFunctionError(e, "updating display name");
  }
  }
);

/**
 * Updates the display name of any user (admin only)
 */
export const updateUserDisplayName = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAdmin(request);
  const userId = requireString(request.data.userId, "userId");
  const displayName = validateStringLength(
    requireString(request.data.displayName, "displayName"),
    "Display name",
    MAX_NAME_LENGTH * 2 // Display name can be "FirstName LastName"
  );

  try {
    await admin.auth().updateUser(userId, { displayName });
    logger.info(`Display name updated for uid=${userId} by admin ${request.auth!.uid}`);
    return { success: true };
  } catch (e: any) {
    handleFunctionError(e, "updating user display name");
  }
  }
);

/**
 * Searches for users by email or display name with pagination (admin only)
 */
export const searchUsers = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
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
    handleFunctionError(e, "searching users");
  }
  }
);

