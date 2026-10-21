import { currentAuthorization } from "./currentAuthorization";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireEnabled, handleFunctionError } from "./helpers";
import { canUserChangeStatus, canUserResignMembership, type MembershipStatus } from "./validation";
import { FUNCTIONS_REGION } from "./constants";
import {
  getUserMembershipStatus,
} from "@dataconnect/admin-generated";
import { govNotifySecrets } from "./mailer";
import { notifyMembershipStatusEmailIfNeeded } from "./membershipStatusEmailDispatcher";
import { invalidateDcProfileCache } from "./users";
import { enforceRateLimit } from "./rateLimiter";
import { reconcileEnabledClaim } from "./enabledClaimReconciliation";
import { initializeUserSecurityState, transitionUserSecurity, securityRequestAuthority, securityRequestOperationId, type SecurityAuthority } from "./currentAuthorizationTransitions";
import { getUserSecurityState } from "./securityRepository";

const APP_BASE_URL = (() => {
  const url = process.env.APP_BASE_URL || "http://localhost:5173";
  try { new URL(url); } catch { throw new Error(`APP_BASE_URL is not a valid URL: "${url}"`); }
  return url;
})();

/** Sends membership access email when the stored status value changes. */
export async function sendMembershipStatusEmailIfChanged(args: {
  userId: string;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
  appBaseUrl: string;
}): Promise<void> {
  if (args.previousStatus === args.newStatus) {
    return;
  }
  await notifyMembershipStatusEmailIfNeeded({
    userId: args.userId,
    previousStatus: args.previousStatus,
    newStatus: args.newStatus,
    appBaseUrl: args.appBaseUrl,
  });
}

interface MembershipStatusPersistenceDependencies {
  transition?: typeof transitionUserSecurity;
  actorId?: string;
  authority?: SecurityAuthority;
  operationId?: string;
}

/** Profile, denial, version and audit commit atomically before Auth synchronization. */
export async function persistMembershipStatusWithEnabledClaim(
  userId: string,
  membershipStatus: MembershipStatus,
  dependencies: MembershipStatusPersistenceDependencies = {},
): Promise<void> {
  await (dependencies.transition ?? transitionUserSecurity)({ userId, membershipStatus,
    actorId: dependencies.actorId ?? userId, reason: "MEMBERSHIP_STATUS", ...dependencies.authority!, operationId: dependencies.operationId });
  invalidateDcProfileCache();
}

// User groups may include membershipStatuses. Status-based membership is inherited (computed in
// getSectionMembersMerged and in admin UI); users are not written to UserUserGroup for status-only membership.

/**
 * Updates membership status with server-side validation and enforcement.
 * This is the only way users can update membershipStatus - it cannot be done via UpsertUser mutation.
 * Users can only update their own status unless they are an admin.
 */
export const updateMembershipStatus = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request) => {
  await requireEnabled(request);
  await enforceRateLimit("updateMembershipStatus", request.auth!.uid);

  const { userId, newStatus } = request.data;

  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "userId is required and must be a string");
  }

  if (!newStatus || typeof newStatus !== "string") {
    throw new HttpsError("invalid-argument", "newStatus is required and must be a string");
  }

  const isAdmin = currentAuthorization(request).isAdmin;
  const callerEnabled = currentAuthorization(request).enabled;
  if (!isAdmin && request.auth!.uid !== userId) {
    throw new HttpsError("permission-denied", "Users can only update their own profile");
  }

  try {
    // Check if target user is an admin
    let targetState = (await getUserSecurityState({userId})).data.userSecurityState;
    if (!targetState && isAdmin) {
      const profile = await fetchCurrentStatusFromDataConnect(userId);
      if (profile === "PENDING") {
        await initializeUserSecurityState({userId, actorId: request.auth!.uid, reason: "INITIAL_APPROVAL", ...securityRequestAuthority(request), operationId: securityRequestOperationId(request) + ":init"});
        targetState = (await getUserSecurityState({userId})).data.userSecurityState;
      }
    }
    const targetUserIsAdmin = targetState?.desiredAdmin === true;
    
    const currentStatus = await fetchCurrentStatusFromDataConnect(userId);

    // Re-submitting the stored status is the supported admin recovery path for
    // Auth/Data Connect claim drift. It is intentionally allowed even when the
    // target retains an admin claim with a restricted membership status.
    if (isAdmin && currentStatus === newStatus) {
      const reconciliation = await reconcileEnabledClaim(
        userId,
        currentStatus as MembershipStatus,
        request.auth!.uid,
        {authority: securityRequestAuthority(request), operationId: securityRequestOperationId(request), reason: "MEMBERSHIP_STATUS", membershipStatus: currentStatus as MembershipStatus}
      );
      logger.info("Reconciled enabled claim from unchanged membership status", {
        userId,
        membershipStatus: currentStatus,
        enabled: reconciliation.enabled,
        updated: reconciliation.updated,
        callerId: request.auth!.uid,
      });
      return {
        success: true,
        message: reconciliation.updated
          ? "Account access claim reconciled successfully"
          : "Account access claim already matched membership status",
      };
    }
    
    const validation = canUserChangeStatus(
      currentStatus,
      newStatus as MembershipStatus,
      isAdmin,
      targetUserIsAdmin,
      callerEnabled
    );
    
    if (!validation.allowed) {
      logger.warn(`Invalid membership status transition attempted: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}, targetIsAdmin=${targetUserIsAdmin}`);
      throw new HttpsError(
        "permission-denied",
        validation.error || "Invalid membership status transition",
        validation.code ? { code: validation.code } : undefined
      );
    }
    
    await persistMembershipStatusWithEnabledClaim(
      userId,
      newStatus as MembershipStatus, { actorId: request.auth!.uid, authority: securityRequestAuthority(request, isAdmin ? "ADMIN" : "SELF"), operationId: securityRequestOperationId(request) }
    );
    
    // Access group membership by status is computed at read time (admin UI and getSectionMembersMerged)
    // — we do not write UserAccessGroup rows when status changes.

    await sendMembershipStatusEmailIfChanged({
      userId,
      previousStatus: currentStatus,
      newStatus: newStatus as MembershipStatus,
      appBaseUrl: APP_BASE_URL,
    });

    logger.info(`Membership status updated: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}`);
    return { success: true, message: "Membership status updated successfully" };
  } catch (e: any) {
    handleFunctionError(e, "updating membership status");
  }
  }
);

/**
 * Self-service resignation: transitions the caller from a non-restricted status to RESIGNED.
 */
export const resignMembership = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request) => {
    await requireEnabled(request);
    await enforceRateLimit("resignMembership", request.auth!.uid);

    const userId = request.auth!.uid;
    const callerEnabled = currentAuthorization(request).enabled;

    try {
      const targetState = (await getUserSecurityState({userId})).data.userSecurityState;
      const targetUserIsAdmin = targetState?.desiredAdmin === true;
      const currentStatus = await fetchCurrentStatusFromDataConnect(userId);
      const newStatus = "RESIGNED" as MembershipStatus;

      const validation = canUserResignMembership(
        currentStatus,
        targetUserIsAdmin,
        callerEnabled
      );

      if (!validation.allowed) {
        logger.warn(
          `Resign membership rejected: userId=${userId}, current=${currentStatus || "unknown"}, targetIsAdmin=${targetUserIsAdmin}`
        );
        throw new HttpsError(
          "permission-denied",
          validation.error || "Cannot resign membership",
          validation.code ? { code: validation.code } : undefined
        );
      }

      await persistMembershipStatusWithEnabledClaim(userId, newStatus, {authority: securityRequestAuthority(request, "SELF"), operationId: securityRequestOperationId(request)});

      await sendMembershipStatusEmailIfChanged({
        userId,
        previousStatus: currentStatus,
        newStatus,
        appBaseUrl: APP_BASE_URL,
      });

      logger.info(`Membership resigned: userId=${userId}, previous=${currentStatus || "unknown"}`);
      return { success: true, message: "Membership resigned successfully" };
    } catch (e: any) {
      handleFunctionError(e, "resigning membership");
    }
  }
);

/**
 * Fetches the current membership status from Data Connect using the Admin SDK
 */
async function fetchCurrentStatusFromDataConnect(
  userId: string
): Promise<MembershipStatus | null> {
  try {
    const result = await getUserMembershipStatus({ id: userId });
    const status = result.data?.user?.membershipStatus;
    if (status === undefined || status === null) {
      return null;
    }
    return status as MembershipStatus;
  } catch (error: unknown) {
    logger.error(`Could not fetch current status from Data Connect for userId=${userId}:`, error);
    throw new HttpsError(
      "internal",
      "Could not verify membership status"
    );
  }
}
