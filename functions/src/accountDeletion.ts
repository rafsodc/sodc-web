import * as admin from "firebase-admin";
import { getDataConnect } from "firebase-admin/data-connect";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { createHash } from "node:crypto";
import { deleteInactiveAccountMutation } from "./accountDeletionDatabase";
import { accountDeletionInventory } from "./accountDeletionInventory";
import { requireAdmin, requireString } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { enforceRateLimit } from "./rateLimiter";
import { transitionUserSecurity, securityRequestAuthority, securityRequestOperationId } from "./currentAuthorizationTransitions";
import { getUserSecurityState, getSecurityTransition } from "./securityRepository";

const metadata = ["LegacyUserIdentity", "UserUserGroup", "SectionAnnouncementOptOut", "CallableInvocation", "CallableRateLimitBucket"];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const db = () => getDataConnect({connector: "api", serviceId: "sodc-web-service", location: FUNCTIONS_REGION});

export function accountDeletionMatch(name: string, row: any, uid: string, email: string, operationId?: string): "none" | "remove" | "block" {
  const text = JSON.stringify(row).toLowerCase();
  if (![uid.toLowerCase(), email.toLowerCase(), sha(email.toLowerCase())].some(value => text.includes(value))) return "none";
  if (name === "User") return row.id === uid && row.email?.toLowerCase() === email.toLowerCase() && !row.stripeCustomerId ? "remove" : "block";
  if (metadata.includes(name)) return (row.userId ?? row.user?.id) === uid ? "remove" : "block";
  if (name === "UserSecurityState") return row.user?.id === uid && !row.desiredAdmin && !row.adminReady && row.syncStatus === "READY" ? "remove" : "block";
  if (name === "SecurityTransition") return row.userId === uid && row.syncStatus !== "PENDING" &&
    (row.actorId === uid || (operationId !== undefined && row.operationId === operationId)) ? "remove" : "block";
  return "block";
}

async function inventory(uid: string, email: string, operationId?: string) {
  const blockers: Record<string, number> = {};
  let profile = false, state = false, records = 0;
  for (const table of accountDeletionInventory) {
    for (let offset = 0; ; offset += 250) {
      const result = await db().executeGraphqlRead<any, never>(`query AccountDeletionInventory { ${table.collection}(orderBy: ${table.orderBy}, limit: 250, offset: ${offset}) { ${table.selection} } }`);
      if (!Array.isArray(result.data?.[table.collection])) throw new HttpsError("unavailable", "Account checks could not be completed. Try again.");
      const rows = result.data[table.collection];
      for (const row of rows) {
        const match = accountDeletionMatch(table.name, row, uid, email, operationId);
        if (match === "remove") records++;
        if (match === "block") blockers[table.name] = (blockers[table.name] ?? 0) + 1;
        if (match === "remove" && table.name === "User") profile = true;
        if (match === "remove" && table.name === "UserSecurityState") state = true;
      }
      if (rows.length < 250) break;
      // Bound work rather than return a misleading partial preview.
      if (offset >= 10000) throw new HttpsError("resource-exhausted", "This account needs the operator deletion workflow.");
    }
  }
  return {blockers, profile, state, records};
}

export const deleteAccount = onCall({region: FUNCTIONS_REGION, timeoutSeconds: 540}, async request => {
  await requireAdmin(request);
  await enforceRateLimit("deleteAccount", request.auth!.uid);
  const uid = requireString(request.data?.uid, "uid");
  const email = requireString(request.data?.email, "email");
  if (uid === request.auth!.uid) throw new HttpsError("failed-precondition", "You cannot delete your own account.");
  const apply = request.data?.apply === true;
  const operationId = securityRequestOperationId(request);
  const authority = securityRequestAuthority(request);
  const subjectHash = sha(uid);
  let target;
  try { target = await admin.auth().getUser(uid); }
  catch (error: any) { if (error.code !== "auth/user-not-found") throw new HttpsError("unavailable", "Account could not be checked."); }
  if (target && (target.customClaims?.admin === true || target.email?.toLowerCase() !== email.toLowerCase())) {
    throw new HttpsError("failed-precondition", "Administrator accounts cannot be deleted. If the email has changed, reopen the account.");
  }
  const plan = await inventory(uid, email, operationId);
  const needsOperator = (plan.profile && !plan.state) || (!plan.profile && (Boolean(target) || plan.records > 0));
  const blocked = Object.keys(plan.blockers).length > 0 || needsOperator;
  if (!apply) return {eligible: !blocked, blockers: Object.keys(plan.blockers), needsOperator};
  if (request.data?.noRetention !== true) throw new HttpsError("invalid-argument", "Confirm that no records need retaining.");
  if (blocked) throw new HttpsError("failed-precondition", "Linked records or account security require review. Use the operator erasure workflow.");
  // A missing profile is accepted only as recovery after our own completed hold.
  // Auth-only accounts are routed to operators because no durable hold exists.
  if (!plan.profile && target) throw new HttpsError("failed-precondition", "This account needs operator recovery before deletion.");
  if (!plan.profile && !target) return {deleted: true};
  try {
    await transitionUserSecurity({userId: uid, actorId: request.auth!.uid, authDisabled: true,
      reason: "ACCOUNT_DELETION", ...securityRequestAuthority(request), operationId});
    await admin.auth().revokeRefreshTokens(uid);
    const state = (await getUserSecurityState({userId: uid})).data.userSecurityState;
    const hold = (await getSecurityTransition({operationId})).data.securityTransition;
    if (!state || !hold || hold.userId !== uid || hold.syncStatus !== "READY" ||
        (state.operationId !== operationId && !(hold.noOp && hold.securityVersion === state.securityVersion))) {
      throw new HttpsError("aborted", "The account changed during deletion. Ask an operator to review it.");
    }
    await requireAdmin(request);
    const fresh = await inventory(uid, email, operationId);
    if (Object.keys(fresh.blockers).length) throw new HttpsError("failed-precondition", "Linked records appeared during deletion. The account remains disabled; request operator review.");
    // State deletion is a compare-and-swap fence against concurrent promotion,
    // enablement or email changes. Any later security operation needs this row
    // and profile; foreign keys protect relational domain records atomically.
    const result = await db().executeGraphql<any, {uid: string; email: string; operationId: string; actorId: string; actorVersion: number; targetVersion: number}>(deleteInactiveAccountMutation, {variables: {uid, email, operationId: state.operationId, targetVersion: state.securityVersion, actorId: request.auth!.uid, actorVersion: authority.actorSecurityVersion!}});
    if (!result.data) throw new Error("DATABASE_DELETE_FAILED");
    const remaining = await inventory(uid, email, operationId);
    if (remaining.records || Object.keys(remaining.blockers).length) throw new Error("DATABASE_VERIFICATION_FAILED");
    const finalAuth = await admin.auth().getUser(uid);
    if (!finalAuth.disabled || finalAuth.customClaims?.admin || finalAuth.email?.toLowerCase() !== email.toLowerCase()) throw new Error("AUTH_CHANGED");
    await admin.auth().deleteUser(uid);
    try { await admin.auth().getUser(uid); throw new Error("AUTH_VERIFICATION_FAILED"); }
    catch (error: any) { if (error.code !== "auth/user-not-found") throw error; }
    logger.info("Admin account deletion completed", {actorId: request.auth!.uid, subjectHash, operationId});
    return {deleted: true};
  } catch (error) {
    logger.error("Admin account deletion incomplete", {actorId: request.auth!.uid, subjectHash, operationId});
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", "Deletion did not complete. The account may be disabled. Ask an operator to inspect and finish the erasure.");
  }
});
