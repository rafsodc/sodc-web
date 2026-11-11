import * as admin from "firebase-admin";
import { getDataConnect } from "firebase-admin/data-connect";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { inventoryAccountDeletion, redactSnapshots } from "./accountDeletion";
import { deleteMyInactiveAccountMutation, redactMyAccountSnapshotMutation } from "./accountDeletionDatabase";
import { accountErasureState, startAccountErasure, cancelErasureTasks, drainAccountCommunications, completeAccountErasure } from "./accountErasureState";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, requireString } from "./helpers";
import { securityRequestAuthority, securityRequestOperationId, transitionUserSecurity } from "./currentAuthorizationTransitions";
import { getUserSecurityState, getSecurityTransition } from "./securityRepository";
import { enforceRateLimit } from "./rateLimiter";

const db = () => getDataConnect({connector: "api", serviceId: "sodc-web-service", location: FUNCTIONS_REGION});
const reviewMessage = "This account needs an administrator's help to delete. Please contact the club administrator.";

function requireRecentDeletionAuthentication(request: CallableRequest): void {
  const authTime = request.auth?.token.auth_time;
  const now = Date.now() / 1000;
  if (typeof authTime !== "number" || !Number.isFinite(authTime) || authTime > now || now - authTime > 300) {
    throw new HttpsError("failed-precondition", "Please sign in again before deleting your account.", {code: "RECENT_LOGIN_REQUIRED"});
  }
}

async function assertStartingIdentity(uid: string, email: string, version: number): Promise<boolean> {
  const user = await admin.auth().getUser(uid);
  if (user.disabled || !user.emailVerified || user.email?.trim().toLowerCase() !== email.toLowerCase() ||
      user.customClaims?.enabled !== true || user.customClaims?.securityVersion !== version) {
    throw new HttpsError("failed-precondition", "Your account changed. Sign in again before deleting your account.", {code: "ACCOUNT_CHANGED"});
  }
  const state = (await getUserSecurityState({userId: uid})).data.userSecurityState;
  if (!state || state.securityVersion !== version || state.syncStatus !== "READY" || !state.accessReady) {
    throw new HttpsError("failed-precondition", "Your account changed. Sign in again before deleting your account.", {code: "ACCOUNT_CHANGED"});
  }
  return user.customClaims?.admin !== true && !state.desiredAdmin && !state.adminReady;
}

// Access was deliberately revoked by this request. Authority now comes only
// from its exact committed SELF deletion intent, checked again by each SQL write.
async function assertDeletionHold(uid: string, email: string, operationId: string, actorVersion: number, targetVersion?: number) {
  const [stateResult, intentResult, user] = await Promise.all([
    getUserSecurityState({userId: uid}), getSecurityTransition({operationId}), admin.auth().getUser(uid),
  ]);
  const state = stateResult.data.userSecurityState;
  const intent = intentResult.data.securityTransition;
  if (!state || !intent || state.operationId !== operationId || state.securityVersion !== intent.securityVersion ||
      (targetVersion !== undefined && state.securityVersion !== targetVersion) || state.syncStatus !== "READY" ||
      state.desiredEnabled || state.accessReady || state.desiredAdmin || state.adminReady ||
      state.membershipStatus !== "RESIGNED" || state.user.membershipStatus !== "RESIGNED" ||
      intent.userId !== uid || intent.actorId !== uid || intent.actorKind !== "SELF" || intent.actorSecurityVersion !== actorVersion ||
      intent.reason !== "ACCOUNT_DELETION" || intent.authDisabled !== true || intent.syncStatus !== "READY" ||
      intent.desiredAdmin || intent.desiredEnabled || intent.membershipStatus !== "RESIGNED" ||
      !user.disabled || !user.emailVerified || user.customClaims?.admin === true || user.customClaims?.enabled !== false ||
      user.customClaims?.securityVersion !== state.securityVersion || user.email?.trim().toLowerCase() !== email.toLowerCase()) {
    throw new Error("SELF_ERASURE_AUTHORITY_CHANGED");
  }
  return state.securityVersion;
}

// Explicit limits make first deployment reviewable without quota-dependent defaults.
const selfDeletionOptions = {region: FUNCTIONS_REGION, timeoutSeconds: 540, memory: "256MiB", cpu: 1,
  concurrency: 80, minInstances: 0, maxInstances: 20, ingressSettings: "ALLOW_ALL"} as const;

export const deleteMyAccount = onCall(selfDeletionOptions, async request => {
  let erasureWriteStarted = false;
  let operationIdForLog: string | undefined;
  try {
    await requireEnabled(request);
    await enforceRateLimit("deleteMyAccount", request.auth!.uid);
    // There is deliberately no caller-selected target or retention override.
    if (request.data?.uid !== undefined || request.data?.noRetention !== undefined) {
      throw new HttpsError("invalid-argument", "Only your own account can be deleted.");
    }
    const uid = request.auth!.uid;
    const email = requireString(request.data?.email, "email");
    const operationId = securityRequestOperationId(request);
    operationIdForLog = operationId;
    const actorVersion = securityRequestAuthority(request, "SELF").actorSecurityVersion!;
    const apply = request.data?.apply === true;
    if (apply) {
      requireRecentDeletionAuthentication(request);
      if (request.data?.confirmMembershipEnd !== true) {
        throw new HttpsError("invalid-argument", "Confirm that deleting your account ends your membership.");
      }
    }
    const allowedIdentity = await assertStartingIdentity(uid, email, actorVersion);
    const markers = await accountErasureState(uid);
    if (!allowedIdentity || markers.length) {
      if (!apply) return {eligible: false};
      throw new HttpsError("failed-precondition", reviewMessage, {code: "ACCOUNT_REVIEW_REQUIRED"});
    }
    const plan = await inventoryAccountDeletion(uid, email, operationId);
    const eligible = plan.profile && plan.state && Object.keys(plan.blockers).length === 0;
    if (!apply) return {eligible};
    if (!eligible) throw new HttpsError("failed-precondition", reviewMessage, {code: "ACCOUNT_REVIEW_REQUIRED"});
    requireRecentDeletionAuthentication(request);

    // From this point, an uncertain write may already have created suppression.
    // Only the preflight above can promise that this request did not start erasure.
    erasureWriteStarted = true;
    const marker = await startAccountErasure(uid, plan.emails);
    await cancelErasureTasks(plan.taskIds);
    await assertStartingIdentity(uid, email, actorVersion).then(allowed => {if (!allowed) throw new Error("SELF_ERASURE_IDENTITY_CHANGED");});
    await transitionUserSecurity({userId: uid, actorId: uid, actorKind: "SELF", actorSecurityVersion: actorVersion,
      reason: "ACCOUNT_DELETION", operationId, membershipStatus: "RESIGNED", admin: false, authDisabled: true});
    const targetVersion = await assertDeletionHold(uid, email, operationId, actorVersion);
    await admin.auth().revokeRefreshTokens(uid);
    await drainAccountCommunications(marker.startedAt);
    const assertHold = () => assertDeletionHold(uid, email, operationId, actorVersion, targetVersion);
    await assertHold();
    const fresh = await inventoryAccountDeletion(uid, email, operationId, undefined, plan.hashes, plan.emails);
    if (!fresh.profile || !fresh.state || Object.keys(fresh.blockers).length || fresh.activeDeliveryUntil > Date.now()) {
      throw new Error("SELF_ERASURE_REVIEW_REQUIRED");
    }
    await startAccountErasure(uid, fresh.emails);
    await cancelErasureTasks(fresh.taskIds);
    await redactSnapshots(fresh.snapshots, uid, email, uid, actorVersion,
      {assert: assertHold, mutation: redactMyAccountSnapshotMutation, operationId, targetVersion});
    await assertHold();
    const result = await db().executeGraphql(deleteMyInactiveAccountMutation, {variables: {
      uid, email: fresh.profileEmail ?? email, operationId, actorId: uid, actorVersion, targetVersion, emailHashes: [...fresh.hashes],
    }});
    if (!result.data) throw new Error("DATABASE_DELETE_FAILED");
    const remaining = await inventoryAccountDeletion(uid, email, operationId, undefined, fresh.hashes, fresh.emails);
    if (remaining.records || Object.keys(remaining.blockers).length) throw new Error("DATABASE_VERIFICATION_FAILED");
    const finalAuth = await admin.auth().getUser(uid);
    if (!finalAuth.disabled || !finalAuth.emailVerified || finalAuth.customClaims?.admin === true || finalAuth.customClaims?.enabled !== false ||
        finalAuth.customClaims?.securityVersion !== targetVersion || finalAuth.email?.trim().toLowerCase() !== email.toLowerCase()) throw new Error("AUTH_CHANGED");
    await admin.auth().deleteUser(uid);
    await admin.auth().getUser(uid).then(() => {throw new Error("AUTH_VERIFICATION_FAILED");}, (error: unknown) => {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "auth/user-not-found") throw error;
    });
    await completeAccountErasure(uid);
    logger.info("Self-service account deletion completed", {operationId});
    return {deleted: true};
  } catch (error) {
    if (!erasureWriteStarted) {
      if (error instanceof HttpsError) {
        const details = error.details !== null && typeof error.details === "object" && !Array.isArray(error.details) ? error.details : {};
        throw new HttpsError(error.code, error.message, {...details, deletionStatus: "NOT_STARTED"});
      }
      throw new HttpsError("unavailable", "Account checks could not be completed. Please try again or contact an administrator.",
        {deletionStatus: "NOT_STARTED"});
    }
    logger.error("Self-service account deletion incomplete", {operationId: operationIdForLog});
    throw new HttpsError("failed-precondition", "Deletion did not complete. Your membership has ended or your account may be disabled. Please contact the club administrator to finish deleting it.",
      {code: "ACCOUNT_DELETION_INCOMPLETE"});
  }
});
