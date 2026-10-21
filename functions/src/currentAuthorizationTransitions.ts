import { createHash, randomUUID } from "node:crypto";
import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import * as db from "./securityRepository";
import { getUserMembershipStatus } from "@dataconnect/admin-generated";
import { isNonRestrictedStatus, type MembershipStatus } from "./validation";

type SecurityState = NonNullable<db.GetUserSecurityStateData["userSecurityState"]>;
type Transition = NonNullable<db.GetSecurityTransitionData["securityTransition"]>;
type Control = NonNullable<db.GetAdminSafetyControlData["adminSafetyControl"]>;
export interface SecurityAuthority { actorKind: "ADMIN" | "SELF" | "SELF_VERIFICATION" | "OPERATOR" | "DRIFT"; actorSecurityVersion?: number }
export interface SecurityTransitionInput extends SecurityAuthority {
  userId: string; actorId: string; reason: string; operationId?: string;
  membershipStatus?: MembershipStatus; admin?: boolean; authDisabled?: boolean;
  verificationEmail?: string; releaseEmailVerification?: boolean; expectedEmail?: string; reviewToken?: string; repairOnly?: boolean;
}
const MAX_ATTEMPTS = 4;
export function securityIntentHash(input: SecurityTransitionInput): string {
  return createHash("sha256").update(JSON.stringify([input.userId, input.actorId, input.actorKind, input.reason,
    input.membershipStatus ?? null, input.admin ?? null, input.authDisabled ?? null,
    input.verificationEmail?.trim().toLowerCase() ?? null, input.releaseEmailVerification === true, input.expectedEmail?.trim().toLowerCase() ?? null, input.reviewToken ?? null, input.repairOnly === true])).digest("hex");
}
export function securityRequestOperationId(request: CallableRequest): string {
  const value = request.data?.operationId;
  if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{16,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Refresh the page and retry this action with a security operation reference.");
  }
  return value;
}
export function securityRequestAuthority(request: CallableRequest, actorKind: SecurityAuthority["actorKind"] = "ADMIN"): SecurityAuthority {
  const version = request.auth?.token.securityVersion;
  if (!Number.isSafeInteger(version)) throw new HttpsError("unauthenticated", "Refresh your sign-in session.");
  return {actorKind, actorSecurityVersion: version as number};
}
function authErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}
function conflict(error: unknown): boolean {return /ADMIN_CONTROL_CONFLICT|SECURITY_STATE_CONFLICT|SECURITY_PROFILE_CONFLICT|ALREADY_EXISTS|already exists|duplicate key/.test(String(error));}
function mapped(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  const text = String(error);
  for (const code of ["LAST_ADMIN_REQUIRED", "ADMIN_SAFETY_RECOVERY_REQUIRED", "SECURITY_ACTOR_REVOKED", "ADMIN_RESTRICTED_STATUS", "SECURITY_OPERATION_CONFLICT"]) {
    if (text.includes(code)) throw new HttpsError(code === "SECURITY_ACTOR_REVOKED" ? "permission-denied" : "failed-precondition",
      code === "LAST_ADMIN_REQUIRED" ? "Another verified administrator must be ready before this change. Grant and verify a second administrator first." : "Current administrator safety checks refused this change.", {code});
  }
  throw error;
}
async function control(): Promise<Control> {
  const row = (await db.getAdminSafetyControl()).data.adminSafetyControl;
  if (!row) throw new HttpsError("failed-precondition", "Administrator safety must be initialized by an operator.", {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"});
  return row;
}
async function replay(input: SecurityTransitionInput, operationId: string): Promise<boolean> {
  const previous = (await db.getSecurityTransition({operationId})).data.securityTransition;
  if (!previous) return false;
  if (previous.userId !== input.userId || previous.intentHash !== securityIntentHash(input)) {
    throw new HttpsError("failed-precondition", "Security operation reference already used for another intent.", {code: "SECURITY_OPERATION_CONFLICT"});
  }
  assertNotSuperseded(previous.syncStatus);
  await synchronizeRequestedOperation(operationId);
  return true;
}
function assertNotSuperseded(status: string) {
  if (status === "SUPERSEDED") throw new HttpsError("failed-precondition", "This security operation was superseded. Reopen the account and start a new action.", {code: "SECURITY_OPERATION_CONFLICT"});
}
async function synchronizeRequestedOperation(operationId: string): Promise<void> {
  await synchronizeUserSecurity(operationId);
  // Recovery itself can discover newer ownership. Scheduler synchronization
  // stays quiet, while callers must not report an obsolete intent as successful.
  const outcome = (await db.getSecurityTransition({operationId})).data.securityTransition;
  if (outcome) assertNotSuperseded(outcome.syncStatus);
}

async function complete(transition: Transition) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = (await db.getSecurityTransition({operationId: transition.operationId})).data.securityTransition;
    if (current?.syncStatus === "READY") return;
    try {
      const snapshot = await control();
      await db.completeSecurityTransition({expectedControlVersion: snapshot.version, userId: transition.userId, securityVersion: transition.securityVersion,
        operationId: transition.operationId, membershipStatus: transition.membershipStatus,
        accessReady: transition.desiredEnabled, adminReady: transition.desiredEnabled && transition.desiredAdmin});
      return;
    } catch (error) {
      // An uncertain commit may already have completed; never increment twice.
      const recorded = (await db.getSecurityTransition({operationId: transition.operationId})).data.securityTransition;
      if (recorded?.syncStatus === "READY") return;
      if (!conflict(error) || attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
}

/** External restrictions are already effective: correct the count even at zero; never restore them. */
async function denyObservedIdentity(state: SecurityState, reason: string, verificationEmail = state.verificationEmail ?? null) {
  const operationId = randomUUID();
  const input: SecurityTransitionInput = {userId: state.userId, actorId: "security-reconciliation", actorKind: "DRIFT", reason};
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const latest = (await db.getUserSecurityState({userId: state.userId})).data.userSecurityState;
    if (!latest || latest.securityVersion !== state.securityVersion || (!latest.accessReady && !latest.adminReady)) return;
    try {
      const snapshot = await control();
      await db.beginSecurityTransition({...input, actorKind: input.actorKind as db.SecurityActorKind, actorSecurityVersion: null, operationId, intentHash: securityIntentHash(input),
        expectedControlVersion: snapshot.version, expectedVersion: state.securityVersion, nextVersion: state.securityVersion + 1,
        expectedMembershipStatus: state.user.membershipStatus, membershipStatus: state.user.membershipStatus,
        desiredEnabled: false, desiredAdmin: state.desiredAdmin, authDisabled: null, verificationEmail});
      await synchronizeUserSecurity(operationId); return;
    } catch (error) {
      if (await replay(input, operationId)) return;
      if (!conflict(error) || attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
}

/** Repair a current READY mirror without temporarily removing a healthy sole administrator. */
async function repairReadyMirror(state: SecurityState) {
  let user;
  try { user = await admin.auth().getUser(state.userId); }
  catch (error) {
    if (authErrorCode(error) === "auth/user-not-found" && (state.accessReady || state.adminReady)) {await denyObservedIdentity(state, "AUTH_IDENTITY_DELETED"); return;}
    throw error;
  }
  if ((state.accessReady || state.adminReady) && ((state.adminReady && (!state.accessReady || !state.desiredEnabled || !state.desiredAdmin || Boolean(state.verificationEmail))) || user.disabled || !user.emailVerified || state.membershipStatus !== state.user.membershipStatus || !isNonRestrictedStatus(state.user.membershipStatus as MembershipStatus))) {
    await denyObservedIdentity(state, "AUTH_IDENTITY_RESTRICTED", state.verificationEmail ?? (!user.emailVerified ? user.email?.trim().toLowerCase() ?? null : null)); return;
  }
  if (user.customClaims?.securityVersion === state.securityVersion && user.customClaims?.enabled === state.desiredEnabled && user.customClaims?.admin === state.desiredAdmin) return;
  const current = (await db.getUserSecurityState({userId: state.userId})).data.userSecurityState;
  if (!current || current.operationId !== state.operationId || current.securityVersion !== state.securityVersion || current.syncStatus !== "READY") return;
  await admin.auth().setCustomUserClaims(state.userId, {...user.customClaims, enabled: current.desiredEnabled, admin: current.desiredAdmin, securityVersion: current.securityVersion});
}

/** Fresh Auth/profile evidence, bound to the control revision used by the caller's transaction. */
async function verifiedRoster(snapshot: Control, checkCount = true): Promise<void> {
  const rows = (await db.listReadyAdministrators()).data.userSecurityStates;
  if (rows.length >= 1001 || (checkCount && rows.length !== snapshot.readyAdminCount)) throw new HttpsError("failed-precondition", "Administrator roster requires operator audit.", {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"});
  for (const row of rows) {
    if (!row.accessReady || row.syncStatus !== "READY" || !row.desiredEnabled || !row.desiredAdmin || row.verificationEmail || row.membershipStatus !== row.user.membershipStatus || !isNonRestrictedStatus(row.user.membershipStatus as MembershipStatus)) {
      if (row.accessReady || row.adminReady) await denyObservedIdentity(row, "ADMIN_ROSTER_PROFILE_DRIFT");
      throw new HttpsError("failed-precondition", "Administrator roster requires operator recovery.", {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"});
    }
    let identity;
    try {identity = await admin.auth().getUser(row.userId);}
    catch (error) {
      if (authErrorCode(error) !== "auth/user-not-found") throw new HttpsError("unavailable", "Remaining administrators could not be verified.");
      await denyObservedIdentity(row, "AUTH_IDENTITY_DELETED");
      throw new HttpsError("failed-precondition", "An administrator identity requires operator recovery.", {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"});
    }
    if (identity.disabled || !identity.emailVerified) {
      await denyObservedIdentity(row, "AUTH_IDENTITY_RESTRICTED", !identity.emailVerified ? identity.email?.trim().toLowerCase() ?? null : row.verificationEmail);
      throw new HttpsError("failed-precondition", "An administrator identity requires operator recovery.", {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"});
    }
    if (identity.customClaims?.securityVersion !== row.securityVersion || identity.customClaims?.enabled !== true || identity.customClaims?.admin !== true) {
      await repairReadyMirror(row);
      const verified = await admin.auth().getUser(row.userId);
      if (verified.customClaims?.securityVersion !== row.securityVersion || verified.customClaims?.enabled !== true || verified.customClaims?.admin !== true || verified.disabled || !verified.emailVerified) {
        throw new HttpsError("unavailable", "Remaining administrator synchronization is unresolved.");
      }
    }
  }
}

/** Completion follows an immutable, already-authorized intent, even after its original actor is revoked. */
export async function synchronizeUserSecurity(operationId: string): Promise<void> {
  const transition = (await db.getSecurityTransition({operationId})).data.securityTransition;
  if (!transition || transition.syncStatus === "SUPERSEDED") return;
  const state = (await db.getUserSecurityState({userId: transition.userId})).data.userSecurityState;
  if (transition.noOp) {if (state?.securityVersion === transition.securityVersion) await repairReadyMirror(state); return;}
  if (!state || state.operationId !== operationId || state.securityVersion !== transition.securityVersion) {
    if (transition.syncStatus === "PENDING") await db.supersedeSecurityTransition({operationId});
    return;
  }
  if (transition.syncStatus === "READY") {await repairReadyMirror(state); return;}
  try {
    let user;
    try {user = await admin.auth().getUser(transition.userId);}
    catch (error) {if (!transition.desiredEnabled && authErrorCode(error) === "auth/user-not-found") {await complete(transition); return;} throw error;}
    if (transition.authDisabled !== null && transition.authDisabled !== undefined) user = await admin.auth().updateUser(transition.userId, {disabled: transition.authDisabled});
    if (transition.desiredEnabled && (user.disabled || !user.emailVerified)) throw new Error("SECURITY_IDENTITY_NOT_READY");
    await admin.auth().setCustomUserClaims(transition.userId, {...user.customClaims, enabled: transition.desiredEnabled, admin: transition.desiredAdmin, securityVersion: transition.securityVersion});
    if (!transition.desiredEnabled) await admin.auth().revokeRefreshTokens(transition.userId);
    const verified = await admin.auth().getUser(transition.userId);
    if (verified.customClaims?.securityVersion !== transition.securityVersion || verified.customClaims?.enabled !== transition.desiredEnabled || verified.customClaims?.admin !== transition.desiredAdmin || (transition.desiredEnabled && (verified.disabled || !verified.emailVerified))) throw new Error("SECURITY_MIRROR_NOT_READY");
    await complete(transition);
  } catch (error) {await db.recordSecuritySynchronizationFailure({operationId, errorCode: "AUTH_SYNCHRONIZATION_FAILED"}); throw error;}
}

/** Verified sign-in repairs only existing READY authority; it never creates a no-op intent. */
export async function reconcileVerifiedEmailSecurity(input: {userId: string; email: string; operationId: string; actorSecurityVersion?: number}): Promise<void> {
  const state = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
  if (!state) return;
  if (state.syncStatus === "READY" && state.accessReady && state.desiredEnabled && state.adminReady === state.desiredAdmin &&
      !state.verificationEmail && state.membershipStatus === state.user.membershipStatus && isNonRestrictedStatus(state.user.membershipStatus as MembershipStatus)) {
    // Fresh Auth/profile checks and mirror repair are bound to the current READY
    // intent, independent of the admin singleton and of stale token claims.
    await synchronizeUserSecurity(state.operationId);
    return;
  }
  const intent: SecurityTransitionInput & {operationId: string} = {userId: input.userId, actorId: input.userId,
    actorKind: "SELF_VERIFICATION", actorSecurityVersion: input.actorSecurityVersion, operationId: input.operationId,
    reason: "VERIFIED_EMAIL_RECONCILIATION", releaseEmailVerification: true};
  if (await replay(intent, input.operationId)) return;
  if (state.syncStatus === "READY" && state.membershipStatus === state.user.membershipStatus && state.verificationEmail === input.email) {
    if (!Number.isSafeInteger(input.actorSecurityVersion)) throw new HttpsError("unauthenticated", "Refresh your sign-in session.");
    await transitionUserSecurity(intent);
  }
}

export interface InitializeSecurityInput extends SecurityAuthority {userId: string; actorId: string; reason: string; operationId?: string; allowAdminBootstrap?: boolean}
/** Explicit migration/initial approval only; missing authority never grants itself. */
export async function initializeUserSecurityState(input: InitializeSecurityInput): Promise<void> {
  const operationId = input.operationId ?? randomUUID();
  const intent: SecurityTransitionInput = {...input, admin: input.allowAdminBootstrap === true};
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await replay(intent, operationId)) return;
    const existing = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
    if (existing) {
      await synchronizeUserSecurity(existing.operationId);
      const ready = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
      if (!ready || ready.syncStatus !== "READY") throw new Error("SECURITY_STATE_CONFLICT");
      const snapshot = await control();
      try {
        await db.recordSecurityNoop({userId: input.userId, actorId: input.actorId, actorKind: input.actorKind as db.SecurityActorKind,
          actorSecurityVersion: input.actorSecurityVersion ?? null, expectedControlVersion: snapshot.version, expectedVersion: ready.securityVersion,
          membershipStatus: ready.membershipStatus, desiredAdmin: ready.desiredAdmin, desiredEnabled: ready.desiredEnabled, verificationEmail: ready.verificationEmail,
          operationId, intentHash: securityIntentHash(intent), reason: input.reason});
        return;
      } catch (error) {if (await replay(intent, operationId)) return; if (conflict(error) && attempt < MAX_ATTEMPTS - 1) continue; mapped(error);}
    }
    const [user, profile] = await Promise.all([admin.auth().getUser(input.userId), getUserMembershipStatus({id: input.userId})]);
    const membershipStatus = profile.data.user?.membershipStatus;
    if (!membershipStatus) throw new HttpsError("failed-precondition", "A membership profile is required");
    const snapshot = await control();
    if (input.actorKind !== "OPERATOR" && snapshot.status !== "READY") mapped(new Error("ADMIN_SAFETY_RECOVERY_REQUIRED"));
    const desiredAdmin = input.actorKind === "OPERATOR" && input.allowAdminBootstrap === true && user.customClaims?.admin === true;
    const desiredEnabled = isNonRestrictedStatus(membershipStatus) && !user.disabled && user.emailVerified;
    try {
      await db.initializeUserSecurityState({...input, actorKind: input.actorKind as db.SecurityActorKind, actorSecurityVersion: input.actorSecurityVersion ?? null, expectedControlVersion: snapshot.version,
        operationId, membershipStatus, desiredAdmin, desiredEnabled, verificationEmail: !user.emailVerified ? user.email?.trim().toLowerCase() ?? null : null,
        intentHash: securityIntentHash(intent)});
    } catch (error) {
      if (await replay(intent, operationId)) return;
      if (conflict(error) && attempt < MAX_ATTEMPTS - 1) continue;
      mapped(error);
    }
    await synchronizeRequestedOperation(operationId); return;
  }
}

/** One control/actor/target/profile/intent transaction precedes any Auth write. */
export async function transitionUserSecurity(input: SecurityTransitionInput): Promise<void> {
  if (!input.actorKind) throw new HttpsError("internal", "Explicit security authority is required.");
  const operationId = input.operationId ?? randomUUID();
  const intentHash = securityIntentHash(input);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await replay(input, operationId)) return;
    const state = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
    if (!state) {
      // Post-cutover applicants have no authority row. Their email correction
      // still needs a durable denial/hold before Auth can change: approval does
      // not share the email lease and may be racing this insertion.
      if (input.actorKind !== "ADMIN" || input.reason !== "EMAIL_REVERIFICATION" || !input.verificationEmail || !input.expectedEmail ||
          input.admin !== undefined || input.membershipStatus !== undefined || input.authDisabled !== undefined || input.releaseEmailVerification) {
        throw new HttpsError("failed-precondition", "Current authorization must be initialized by an operator");
      }
      const profile = (await getUserMembershipStatus({id: input.userId})).data.user;
      if (!profile || profile.membershipStatus !== "PENDING") throw new HttpsError("failed-precondition", "Only a pending applicant can initialize an email verification hold.", {code: "EMAIL_CHANGE_CONFLICT"});
      await admin.auth().getUser(input.userId);
      const snapshot = await control();
      try {
        await db.initializePendingEmailHold({userId: input.userId, actorId: input.actorId, actorSecurityVersion: input.actorSecurityVersion!,
          expectedControlVersion: snapshot.version, expectedProfileEmail: profile.email, verificationEmail: input.verificationEmail.trim().toLowerCase(),
          operationId, reason: input.reason, intentHash});
      } catch (error) {
        if (await replay(input, operationId)) return;
        if (conflict(error) && attempt < MAX_ATTEMPTS - 1) continue;
        if (conflict(error)) throw new HttpsError("aborted", "Concurrent account changes require a retry.", {code: "SECURITY_CONFLICT_RETRY"});
        mapped(error);
      }
      await synchronizeRequestedOperation(operationId); return;
    }
    let user;
    try {user = await admin.auth().getUser(input.userId);}
    catch (error) {
      if (authErrorCode(error) === "auth/user-not-found" && (state.accessReady || state.adminReady)) {
        await denyObservedIdentity(state, "AUTH_IDENTITY_DELETED");
        throw new HttpsError("failed-precondition", "The removed identity requires operator recovery.", {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"});
      }
      throw error;
    }
    const membershipStatus = input.membershipStatus ?? state.user.membershipStatus;
    const desiredAdmin = input.admin ?? state.desiredAdmin;
    let verificationEmail = input.verificationEmail?.trim().toLowerCase() ?? state.verificationEmail ?? null;
    if (input.releaseEmailVerification) {
      if ((!verificationEmail && !state.accessReady) || !user.emailVerified || (verificationEmail && user.email?.trim().toLowerCase() !== verificationEmail)) throw new HttpsError("failed-precondition", "The intended new email address must be verified");
      verificationEmail = null;
    }
    if (input.reason === "EMAIL_REVERIFICATION" && !state.verificationEmail && user.emailVerified && user.email?.trim().toLowerCase() === verificationEmail) verificationEmail = null;
    const disabled = input.authDisabled ?? user.disabled;
    const desiredEnabled = isNonRestrictedStatus(membershipStatus) && !disabled && user.emailVerified && !verificationEmail;
    if (input.admin === true && !desiredEnabled) throw new HttpsError("failed-precondition", "Only an active verified member can be an administrator");
    const snapshot = await control();
    if (input.actorKind !== "OPERATOR" && snapshot.status !== "READY") mapped(new Error("ADMIN_SAFETY_RECOVERY_REQUIRED"));
    const noOp = state.syncStatus === "READY" && state.accessReady === desiredEnabled && state.adminReady === (desiredEnabled && desiredAdmin) && state.membershipStatus === membershipStatus && state.user.membershipStatus === membershipStatus && state.desiredAdmin === desiredAdmin && state.desiredEnabled === desiredEnabled && (state.verificationEmail ?? null) === verificationEmail && disabled === user.disabled;
    if (state.adminReady && !noOp) await verifiedRoster(snapshot);
    const values = {userId: input.userId, operationId, actorId: input.actorId, actorKind: input.actorKind as db.SecurityActorKind, actorSecurityVersion: input.actorSecurityVersion ?? null,
      expectedControlVersion: snapshot.version, expectedVersion: state.securityVersion, membershipStatus: membershipStatus as db.MembershipStatus,
      desiredEnabled, desiredAdmin, verificationEmail, intentHash, reason: input.reason};
    try {
      if (noOp) await db.recordSecurityNoop(values);
      else await db.beginSecurityTransition({...values, nextVersion: state.securityVersion + 1, expectedMembershipStatus: state.user.membershipStatus, authDisabled: input.authDisabled ?? null});
    } catch (error) {
      if (await replay(input, operationId)) return;
      if (conflict(error) && attempt < MAX_ATTEMPTS - 1) continue;
      if (conflict(error)) throw new HttpsError("aborted", "Concurrent account changes require a retry.", {code: "SECURITY_CONFLICT_RETRY"});
      mapped(error);
    }
    await synchronizeRequestedOperation(operationId); return;
  }
}

/** Operator-only precreation; a separate committed activation follows a fresh roster audit. */
export async function bootstrapAdminSafetyControl(input: {operationId: string; actorId: string; reason: string; recoverObservedDrift?: boolean}): Promise<void> {
  const intentHash = controlIntent(input, input.recoverObservedDrift ? "CREATE_RECOVERY" : "CREATE");
  if (await replayControl(input, intentHash)) return;
  const existing = (await db.getAdminSafetyControl()).data.adminSafetyControl;
  if (existing) throw new HttpsError("failed-precondition", "Administrator safety control already exists; audit and activate it.");
  const rows = (await db.listReadyAdministrators()).data.userSecurityStates;
  if (rows.length >= 1001) throw new Error("Administrator roster exceeds audit bound");
  // Recovery creation records only DB flag contributions in BOOTSTRAP. It makes
  // no usability assertion and never restores Auth; recount/repair/activation are
  // explicit separate steps so replaying creation cannot reapply later work.
  if (!input.recoverObservedDrift) for (const row of rows) {
    const user = await admin.auth().getUser(row.userId);
    if (!row.accessReady || row.syncStatus !== "READY" || !row.desiredEnabled || !row.desiredAdmin || row.verificationEmail || row.membershipStatus !== row.user.membershipStatus || !isNonRestrictedStatus(row.user.membershipStatus as MembershipStatus) || user.disabled || !user.emailVerified || user.customClaims?.securityVersion !== row.securityVersion || user.customClaims?.enabled !== true || user.customClaims?.admin !== true) throw new Error("Resolve administrator drift before control bootstrap");
  }
    try {await db.createAdminSafetyControl({operationId: input.operationId, actorId: input.actorId,
    reason: input.recoverObservedDrift ? `[OBSERVED_DRIFT_RECOVERY] ${input.reason}` : input.reason, intentHash, readyAdminCount: rows.length});}
  catch (error) {if (!(await replayControl(input, intentHash))) throw error;}
}
export async function activateAdminSafetyControl(input: {operationId: string; actorId: string; reason: string}): Promise<void> {
  const intentHash = controlIntent(input, "ACTIVATE");
  if (await replayControl(input, intentHash)) return;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const snapshot = await control(); await verifiedRoster(snapshot);
    try {await db.activateAdminSafetyControl({...input, intentHash, expectedControlVersion: snapshot.version}); return;}
    catch (error) {if (await replayControl(input, intentHash)) return; if (!conflict(error) || attempt === MAX_ATTEMPTS - 1) throw error;}
  }
}
function controlIntent(input: {actorId: string; reason: string}, action: string): string {
  return createHash("sha256").update(JSON.stringify([action, input.actorId, input.reason])).digest("hex");
}
async function replayControl(input: {operationId: string}, intentHash: string): Promise<boolean> {
  const previous = (await db.getAdminSafetyAudit({operationId: input.operationId})).data.adminSafetyAudit;
  if (!previous) return false;
  if (previous.intentHash !== intentHash) throw new HttpsError("failed-precondition", "Control operation reference already used.", {code: "SECURITY_OPERATION_CONFLICT"});
  return true;
}

export async function resumeSecurityOperation(input: SecurityTransitionInput & {operationId: string}): Promise<boolean> {
  return replay(input, input.operationId);
}
export async function persistPotentialLostSecurity(input: SecurityTransitionInput & {operationId: string}, variables: Omit<db.ConfirmPotentialLostWithAdminSafetyVariables, "expectedControlVersion" | "actorSecurityVersion" | "securityIntentHash">): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await replay(input, input.operationId)) return;
    const snapshot = await control();
    if (snapshot.status !== "READY") mapped(new Error("ADMIN_SAFETY_RECOVERY_REQUIRED"));
    try {
      await db.confirmPotentialLostWithAdminSafety({...variables, expectedControlVersion: snapshot.version, actorSecurityVersion: input.actorSecurityVersion!, securityIntentHash: securityIntentHash(input)});
    } catch (error) {
      if (await replay(input, input.operationId)) return;
      if (conflict(error) && attempt < MAX_ATTEMPTS - 1) continue;
      mapped(error);
    }
    await synchronizeRequestedOperation(input.operationId); return;
  }
}

/** A frozen, audited operator correction; activation remains a separate reviewed step. */
export async function reconcileAdminSafetyControl(input: {operationId: string; actorId: string; reason: string}): Promise<void> {
  const intentHash = controlIntent(input, "RECOUNT");
  if (await replayControl(input, intentHash)) return;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const snapshot = await control(); await verifiedRoster(snapshot, false);
    const rows = (await db.listReadyAdministrators()).data.userSecurityStates;
    try {await db.reconcileAdminSafetyControl({...input, intentHash, expectedControlVersion: snapshot.version, readyAdminCount: rows.length}); return;}
    catch (error) {if (await replayControl(input, intentHash)) return; if (!conflict(error) || attempt === MAX_ATTEMPTS - 1) throw error;}
  }
}

/** Operator repair resumes current authority; it never derives enablement from Auth/profile. */
export async function repairUserSecurity(input: SecurityTransitionInput & {actorKind: "OPERATOR"; operationId: string}): Promise<void> {
  const intent = {...input, repairOnly: true};
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await replay(intent, input.operationId)) return;
    const current = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
    if (!current) throw new HttpsError("failed-precondition", "Repair cannot initialize missing authority.");
    await synchronizeUserSecurity(current.operationId);
    const ready = (await db.getUserSecurityState({userId: input.userId})).data.userSecurityState;
    if (!ready || ready.syncStatus !== "READY") throw new Error("SECURITY_STATE_CONFLICT");
    const snapshot = await control();
    try {
      await db.recordSecurityNoop({userId: input.userId, actorId: input.actorId, actorKind: input.actorKind as db.SecurityActorKind,
        actorSecurityVersion: null, expectedControlVersion: snapshot.version, expectedVersion: ready.securityVersion,
        membershipStatus: ready.membershipStatus, desiredAdmin: ready.desiredAdmin, desiredEnabled: ready.desiredEnabled, verificationEmail: ready.verificationEmail,
        operationId: input.operationId, intentHash: securityIntentHash(intent), reason: input.reason});
      return;
    } catch (error) {if (await replay(intent, input.operationId)) return; if (!conflict(error) || attempt === MAX_ATTEMPTS - 1) mapped(error);}
  }
}
