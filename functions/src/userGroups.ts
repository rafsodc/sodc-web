import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  getUserGroupById,
  registerForSection,
  subscribeToUserGroup as subscribeToUserGroupMutation,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { requireEnabled, validateUUID, handleFunctionError } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";

/**
 * Subscribes the caller to a user group, enforcing that the group has subscribable: true.
 * Replaces the legacy client-callable SubscribeToUserGroup mutation.
 */
export const subscribeToUserGroup = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    requireEnabled(request);
    const uid = request.auth!.uid;
    const userGroupId = validateUUID(request.data?.userGroupId, "userGroupId") as UUIDString;

    try {
      const result = await getUserGroupById({ id: userGroupId });
      const group = result.data?.userGroup;
      if (!group) {
        throw new HttpsError("not-found", "User group not found");
      }
      if (group.subscribable !== true) {
        throw new HttpsError("permission-denied", "This group does not allow self-subscription");
      }

      await subscribeToUserGroupMutation({ userGroupId });
      logger.info(`subscribeToUserGroup: uid=${uid} groupId=${userGroupId}`);
      return { success: true };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e, "subscribing to user group");
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
    requireEnabled(request);
    const uid = request.auth!.uid;
    const userGroupId = validateUUID(request.data?.userGroupId, "userGroupId") as UUIDString;

    try {
      const result = await getUserGroupById({ id: userGroupId });
      const group = result.data?.userGroup;
      if (!group) {
        throw new HttpsError("not-found", "User group not found");
      }
      if (group.subscribable !== true) {
        throw new HttpsError("permission-denied", "This group does not allow self-registration");
      }

      await registerForSection({ userGroupId });
      logger.info(`registerForSection: uid=${uid} groupId=${userGroupId}`);
      return { success: true };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e, "registering for section");
    }
  }
);
