import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { transitionUserSecurity, securityRequestAuthority, securityRequestOperationId } from "./currentAuthorizationTransitions";
import { requireAdmin, requireString, getAdminUsers, mapUserRecord, handleFunctionError } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { enforceRateLimit } from "./rateLimiter";

/**
 * Grants admin claim to a user
 * Ensures the user does not have a restricted membership status
 */
export const grantAdmin = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  await requireAdmin(request);
  await enforceRateLimit("grantAdmin", request.auth!.uid);
  const uid = requireString(request.data.uid, "uid");

  try {
    await transitionUserSecurity({ userId: uid, actorId: request.auth!.uid, admin: true, reason: "GRANT_ADMIN", ...securityRequestAuthority(request), operationId: securityRequestOperationId(request) });
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
  await requireAdmin(request);
  await enforceRateLimit("revokeAdmin", request.auth!.uid);
  const uid = requireString(request.data.uid, "uid");

  try {
    await transitionUserSecurity({ userId: uid, actorId: request.auth!.uid, admin: false, reason: "REVOKE_ADMIN", ...securityRequestAuthority(request), operationId: securityRequestOperationId(request) });
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
  await requireAdmin(request);
  await enforceRateLimit("listAdminUsers", request.auth!.uid);

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
