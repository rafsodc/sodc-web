import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { requireAdmin, requireString, getAdminUsers, mapUserRecord, handleFunctionError } from "./helpers";
import { getUserMembershipStatus } from "@dataconnect/admin-generated";
import { isRestrictedStatus, type MembershipStatus } from "./validation";
import { FUNCTIONS_REGION } from "./constants";

/**
 * Grants admin claim to a user
 * Ensures the user does not have a restricted membership status
 */
export const grantAdmin = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAdmin(request);
  const uid = requireString(request.data.uid, "uid");

  try {
    // Check if user has a restricted membership status
    const membershipStatusResult = await getUserMembershipStatus({ id: uid });
    const membershipStatus = membershipStatusResult.data?.user?.membershipStatus as MembershipStatus | null;
    
    if (membershipStatus && isRestrictedStatus(membershipStatus)) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot grant admin status to user with restricted membership status: ${membershipStatus}. Please update the user's membership status to a non-restricted status first.`
      );
    }

    // Get current user to preserve existing claims
    const userRecord = await admin.auth().getUser(uid);
    const currentClaims = userRecord.customClaims || {};
    
    // Update claims, ensuring enabled is true for admins
    const updatedClaims = {
      ...currentClaims,
      admin: true,
      enabled: true, // Admins must always be enabled
    };
    
    await admin.auth().setCustomUserClaims(uid, updatedClaims);
    logger.info(`Admin claim set for uid=${uid} by caller=${request.auth!.uid}`);
    return { success: true, message: `Admin claim set for uid=${uid}` };
  } catch (e: any) {
    handleFunctionError(e, "setting custom claim");
  }
  }
);

/**
 * Revokes admin claim from a user, ensuring at least one admin remains
 */
export const revokeAdmin = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAdmin(request);
  const uid = requireString(request.data.uid, "uid");

  try {
    const adminUsers = await getAdminUsers();

    if (adminUsers.length <= 1) {
      throw new HttpsError("failed-precondition", "Cannot remove the last admin. At least one admin must remain.");
    }

    const targetUser = await admin.auth().getUser(uid);
    const targetUserClaims = targetUser.customClaims || {};
    if (targetUserClaims.admin !== true) {
      throw new HttpsError("failed-precondition", "User is not an admin");
    }

    await admin.auth().setCustomUserClaims(uid, { admin: false });
    logger.info(`Admin claim removed for uid=${uid} by caller=${request.auth!.uid}`);
    return { success: true, message: `Admin claim removed for uid=${uid}` };
  } catch (e: any) {
    handleFunctionError(e, "removing custom claim");
  }
  }
);

/**
 * Lists all users with admin claim
 */
export const listAdminUsers = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAdmin(request);

  try {
    const adminUsers = await getAdminUsers();
    const mappedUsers = adminUsers.map(mapUserRecord);
    logger.info(`Found ${mappedUsers.length} admin users for caller ${request.auth!.uid}`);
    return { users: mappedUsers };
  } catch (e: any) {
    handleFunctionError(e, "listing admin users");
  }
  }
);

