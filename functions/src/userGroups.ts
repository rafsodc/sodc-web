import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  registerForSection,
  subscribeToUserGroup as subscribeToUserGroupMutation,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { requireEnabled, validateUUID, handleFunctionError } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { currentAuthorization } from "./currentAuthorization";

/**
 * Subscribes the caller to a user group, enforcing that the group has subscribable: true.
 * Replaces the legacy client-callable SubscribeToUserGroup mutation.
 */
export const subscribeToUserGroup = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    await requireEnabled(request);
    const uid = request.auth!.uid;
    const userGroupId = validateUUID(request.data?.userGroupId, "userGroupId") as UUIDString;

    try {
      await subscribeToUserGroupMutation({ userId: uid, userGroupId, securityVersion: currentAuthorization(request).securityVersion });
      logger.info(`subscribeToUserGroup: uid=${uid} groupId=${userGroupId}`);
      return { success: true };
    } catch (e: unknown) {
      handleSubscriptionError(e, "subscribing to user group", "self-subscription");
    }
  }
);

/**
 * Registers the caller for a section by joining the specified user group,
 * enforcing that the group has subscribable: true.
 * Replaces the legacy client-callable RegisterForSection mutation.
 */
export const registerForSectionCallable = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    await requireEnabled(request);
    const uid = request.auth!.uid;
    const userGroupId = validateUUID(request.data?.userGroupId, "userGroupId") as UUIDString;

    try {
      await registerForSection({ userId: uid, userGroupId, securityVersion: currentAuthorization(request).securityVersion });
      logger.info(`registerForSection: uid=${uid} groupId=${userGroupId}`);
      return { success: true };
    } catch (e: unknown) {
      handleSubscriptionError(e, "registering for section", "self-registration");
    }
  }
);

/** Translate only the transaction's stable refusal markers; never replay a join. */
function handleSubscriptionError(error: unknown, context: string, action: "self-subscription" | "self-registration"): never {
  if (error instanceof HttpsError) throw error;
  const message = String(error);
  if (message.includes("USER_GROUP_NOT_FOUND")) throw new HttpsError("not-found", "User group not found");
  if (message.includes("USER_GROUP_NOT_SUBSCRIBABLE")) throw new HttpsError("permission-denied", `This group does not allow ${action}`);
  if (message.includes("SESSION_VERSION_STALE")) throw new HttpsError("unauthenticated", "Refresh your sign-in session", { code: "SESSION_VERSION_STALE" });
  if (message.includes("ACCESS_REVOKED")) throw new HttpsError("permission-denied", "Account access is unavailable", { code: "ACCESS_REVOKED" });
  return handleFunctionError(error, context);
}
