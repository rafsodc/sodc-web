import { createHash, randomUUID } from "node:crypto";
import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import * as db from "./securityRepository";
import { getUserMembershipStatus } from "@dataconnect/admin-generated";
import { isNonRestrictedStatus, type MembershipStatus } from "./validation";

type SecurityState = NonNullable<db.GetUserSecurityStateData["userSecurityState"]>;
export interface SecurityTransitionInput {
  userId: string; actorId: string; reason: string; operationId?: string;
  membershipStatus?: MembershipStatus; admin?: boolean; authDisabled?: boolean;
  verificationEmail?: string;
  releaseEmailVerification?: boolean;
}
export function securityIntentHash(input: SecurityTransitionInput): string {
  return createHash("sha256").update(JSON.stringify([input.userId, input.actorId, input.reason,
    input.membershipStatus ?? null, input.admin ?? null, input.authDisabled ?? null,
    input.verificationEmail?.trim().toLowerCase() ?? null, input.releaseEmailVerification === true])).digest("hex");
}
function authErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}
async function complete(transition: NonNullable<db.GetSecurityTransitionData["securityTransition"]>) {
  await db.completeSecurityTransition({userId: transition.userId, securityVersion: transition.securityVersion,
    operationId: transition.operationId, membershipStatus: transition.membershipStatus,
    accessReady: transition.desiredEnabled, adminReady: transition.desiredEnabled && transition.desiredAdmin});
}

/** A known external Auth restriction becomes a new DB-first denial; never undo it. */
async function denyObservedIdentity(state: SecurityState, reason: string, verificationEmail = state.verificationEmail ?? null) {
  const input = {userId: state.userId, actorId: "security-reconciliation", reason};
  const operationId = randomUUID();
  await db.beginSecurityTransition({...input, operationId, intentHash: securityIntentHash(input),
    expectedVersion: state.securityVersion, nextVersion: state.securityVersion + 1,
    expectedMembershipStatus: state.user.membershipStatus, membershipStatus: state.user.membershipStatus,
    desiredEnabled: false, desiredAdmin: state.desiredAdmin, verificationEmail});
  await synchronizeUserSecurity(operationId);
}

/** Repair late/stale Auth writes even after the newest database operation became READY. */
async function repairReadyMirror(state: SecurityState) {
  let user;
  try { user = await admin.auth().getUser(state.userId); }
  catch (error) {
    if (authErrorCode(error) === "auth/user-not-found" && state.accessReady) {
      await denyObservedIdentity(state, "AUTH_IDENTITY_DELETED"); return;
    }
    throw error;
  }
  if (state.accessReady && (user.disabled || !user.emailVerified || state.membershipStatus !== state.user.membershipStatus)) {
    await denyObservedIdentity(state, "AUTH_IDENTITY_RESTRICTED", state.verificationEmail ?? (!user.emailVerified ? user.email?.trim().toLowerCase() ?? null : null)); return;
  }
  if (user.customClaims?.securityVersion === state.securityVersion &&
      user.customClaims?.enabled === state.desiredEnabled && user.customClaims?.admin === state.desiredAdmin) return;
  // Auth has no compare-and-set. A race can drift this mirror again; DB authority
  // remains unchanged and the paginated sweep will detect/repair it next time.
  const current = (await db.getUserSecurityState({userId: state.userId})).data.userSecurityState;
  if (!current || current.operationId !== state.operationId || current.securityVersion !== state.securityVersion || current.syncStatus !== "READY") return;
  await admin.auth().setCustomUserClaims(state.userId, {...user.customClaims,
    enabled: current.desiredEnabled, admin: current.desiredAdmin, securityVersion: current.securityVersion});
}

/** Resume durable intent; only the matching version can make authority ready. */
export async function synchronizeUserSecurity(operationId: string): Promise<void> {
  const transition = (await db.getSecurityTransition({operationId})).data.securityTransition;
  if (!transition || transition.syncStatus === "SUPERSEDED") return;
  const state = (await db.getUserSecurityState({userId: transition.userId})).data.userSecurityState;
  if (!state || state.operationId !== operationId || state.securityVersion !== transition.securityVersion) {
    if (transition.syncStatus === "PENDING") await db.supersedeSecurityTransition({operationId});
    return;
  }
  if (transition.syncStatus === "READY") { await repairReadyMirror(state); return; }
  try {
    let user;
    try { user = await admin.auth().getUser(transition.userId); }
    catch (error) {
      if (!transition.desiredEnabled && authErrorCode(error) === "auth/user-not-found") {await complete(transition); return;}
      throw error;
    }
    if (transition.authDisabled !== null && transition.authDisabled !== undefined) {
      user = await admin.auth().updateUser(transition.userId, {disabled: transition.authDisabled});
    }
    if (transition.desiredEnabled && (user.disabled || !user.emailVerified)) throw new Error("SECURITY_IDENTITY_NOT_READY");
    await admin.auth().setCustomUserClaims(transition.userId, {...user.customClaims,
      enabled: transition.desiredEnabled, admin: transition.desiredAdmin, securityVersion: transition.securityVersion});
    if (!transition.desiredEnabled) await admin.auth().revokeRefreshTokens(transition.userId);
    const verified = await admin.auth().getUser(transition.userId);
    if (verified.customClaims?.securityVersion !== transition.securityVersion ||
        verified.customClaims?.enabled !== transition.desiredEnabled || verified.customClaims?.admin !== transition.desiredAdmin ||
        (transition.desiredEnabled && (verified.disabled || !verified.emailVerified))) throw new Error("SECURITY_MIRROR_NOT_READY");
    await complete(transition);
  } catch (error) {
    await db.recordSecuritySynchronizationFailure({operationId, errorCode: "AUTH_SYNCHRONIZATION_FAILED"});
    throw error;
  }
}

/** Explicit migration/bootstrap only; request guards never initialize a missing record. */
export async function initializeUserSecurityState(input: {
  userId: string; actorId: string; reason: string; allowAdminBootstrap?: boolean;
}): Promise<void> {
  const existing = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
  if (existing) {await synchronizeUserSecurity(existing.operationId); return;}
  const [user, profile] = await Promise.all([admin.auth().getUser(input.userId), getUserMembershipStatus({id: input.userId})]);
  const membershipStatus = profile.data.user?.membershipStatus;
  if (!membershipStatus) throw new HttpsError("failed-precondition", "A membership profile is required");
  const desiredAdmin = input.allowAdminBootstrap === true && user.customClaims?.admin === true;
  const desiredEnabled = isNonRestrictedStatus(membershipStatus) && !user.disabled && user.emailVerified;
  const verificationEmail = !user.emailVerified ? user.email?.trim().toLowerCase() ?? null : null;
  const operationId = randomUUID();
  await db.initializeUserSecurityState({...input, operationId, membershipStatus, desiredAdmin, desiredEnabled, verificationEmail,
    intentHash: securityIntentHash({...input, admin: desiredAdmin, membershipStatus, verificationEmail: verificationEmail ?? undefined})});
  await synchronizeUserSecurity(operationId);
}

/** Shared #653/#654 boundary: denial/version/profile/audit commit before Auth. */
export async function transitionUserSecurity(input: SecurityTransitionInput): Promise<void> {
  const operationId = input.operationId ?? randomUUID();
  const intentHash = securityIntentHash(input);
  const previous = (await db.getSecurityTransition({operationId})).data.securityTransition;
  if (previous) {
    if (previous.userId !== input.userId || previous.intentHash !== intentHash) throw new HttpsError("failed-precondition", "Security operation reference already used");
    await synchronizeUserSecurity(operationId); return;
  }
  const state = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
  if (!state) throw new HttpsError("failed-precondition", "Current authorization must be initialized by an operator");
  const user = await admin.auth().getUser(input.userId);
  const membershipStatus = input.membershipStatus ?? state.user.membershipStatus;
  const desiredAdmin = input.admin ?? state.desiredAdmin;
  let verificationEmail = input.verificationEmail?.trim().toLowerCase() ?? state.verificationEmail ?? null;
  if (input.releaseEmailVerification) {
    if (!verificationEmail || !user.emailVerified || user.email?.trim().toLowerCase() !== verificationEmail) {
      throw new HttpsError("failed-precondition", "The intended new email address must be verified");
    }
    verificationEmail = null;
  }
  const disabled = input.authDisabled ?? user.disabled;
  const desiredEnabled = isNonRestrictedStatus(membershipStatus) && !disabled && user.emailVerified && !verificationEmail;
  if (input.admin === true && !desiredEnabled) throw new HttpsError("failed-precondition", "Only an active verified member can be an administrator");
  await db.beginSecurityTransition({userId: input.userId, expectedVersion: state.securityVersion,
    nextVersion: state.securityVersion + 1, expectedMembershipStatus: state.user.membershipStatus,
    membershipStatus: membershipStatus as db.MembershipStatus, desiredEnabled, desiredAdmin, authDisabled: input.authDisabled ?? null,
    verificationEmail, intentHash, operationId, actorId: input.actorId, reason: input.reason});
  await synchronizeUserSecurity(operationId);
}
