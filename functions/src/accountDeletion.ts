import { accountErasureState, startAccountErasure, drainAccountCommunications, cancelErasureTasks, completeAccountErasure } from "./accountErasureState";
import { pruneAnnouncementSnapshot, announcementErasureTaskIds, withSnapshotErasure, communicationInventoryFilter, type SnapshotErasureUpdate } from "./accountCommunicationErasure";
import { DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS } from "./notificationDelivery";
import { ANNOUNCEMENT_PROCESSING_LEASE_MS } from "./announcementDelivery";
import * as admin from "firebase-admin";
import { getDataConnect } from "firebase-admin/data-connect";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { createHash } from "node:crypto";
import { deleteInactiveAccountMutation, redactAccountSnapshotMutation, deleteErasedCommunicationMutation } from "./accountDeletionDatabase";
import { accountDeletionInventory } from "./accountDeletionInventory";
import { requireAdmin, requireString } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { enforceRateLimit } from "./rateLimiter";
import { transitionUserSecurity, securityRequestAuthority, securityRequestOperationId } from "./currentAuthorizationTransitions";
import { synchronizeUserSecurity } from "./currentAuthorizationTransitions";
import { getUserSecurityState, getSecurityTransition } from "./securityRepository";

const metadata = ["LegacyUserIdentity", "UserUserGroup", "SectionAnnouncementOptOut", "CallableInvocation", "CallableRateLimitBucket"];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const db = () => getDataConnect({connector: "api", serviceId: "sodc-web-service", location: FUNCTIONS_REGION});

export function accountDeletionMatch(name: string, row: any, uid: string, email: string, operationId?: string, emails = new Set([email.trim().toLowerCase()]), knownHashes = new Set<string>()): "none" | "remove" | "block" {
  if (name === "AccountErasure") return "none";
  const text = JSON.stringify(row).toLowerCase();
  if (![uid.toLowerCase(), ...emails, ...[...emails].map(sha), ...knownHashes].some(value => text.includes(value))) return "none";
  if (name === "AnnouncementSend") {
    try {
      const pruned = pruneAnnouncementSnapshot(row.recipientSnapshot, uid, email, emails);
      const remaining = JSON.stringify({...row, recipientSnapshot: pruned.replacement}).toLowerCase();
      const retainsIdentity = [uid.toLowerCase(), ...emails, ...[...emails].map(sha), ...knownHashes].some(value => remaining.includes(value));
      return pruned.removed && !retainsIdentity ? "remove" : "block";
    }
    catch { return "block"; }
  }
  if (name === "AnnouncementRecipient") return row.userId === uid ? "remove" : "block";
  if (name === "NotifyDeliveryReceipt") return row.user?.id === uid || (!row.user && ([...emails].some(value => sha(value) === row.recipientHash) || knownHashes.has(row.recipientHash))) ? "remove" : "block";
  if (name === "NotificationDelivery") return !row.booking && !row.ticketOrder &&
    (row.user?.id === uid || (!row.user && row.recipientUserId === uid)) ? "remove" : "block";
  if (name === "User") return row.id === uid && row.email?.toLowerCase() === email.toLowerCase() && !row.stripeCustomerId ? "remove" : "block";
  if (metadata.includes(name)) return (row.userId ?? row.user?.id) === uid ? "remove" : "block";
  if (name === "UserSecurityState") return row.user?.id === uid && !row.desiredAdmin && !row.adminReady && row.syncStatus === "READY" ? "remove" : "block";
  if (name === "SecurityTransition") return row.userId === uid && row.syncStatus !== "PENDING" &&
    (row.actorId === uid || (operationId !== undefined && row.operationId === operationId) ||
      (row.desiredAdmin === false && row.startedAdminDelta === 0 && row.completedAdminDelta === 0)) ? "remove" : "block";
  return "block";
}

export async function inventoryAccountDeletion(uid: string, email: string, operationId?: string, pendingOperation?: string, knownHashes = new Set<string>(), knownEmails: Iterable<string> = [email], aliasPass = 0) {
  const blockers: Record<string, number> = {};
  let profile = false, state = false, records = 0, communications = 0, activeDeliveryUntil = 0;
  let profileEmail: string | undefined;
  const emails = new Set([...knownEmails, email].map(value => value.trim().toLowerCase()));
  const initialAliasCount = emails.size;
  const snapshots: {id: string}[] = [];
  const taskIds = new Set<string>();
  // Learn historical addresses before checking callback hashes and ledgers.
  const tables = [...accountDeletionInventory].filter(table => table.name !== "AccountErasure").sort((a, b) => {
    const rank = (name: string) => name === "AnnouncementSend" ? 0 : name === "AnnouncementRecipient" ? 1 : 2;
    return rank(a.name) - rank(b.name);
  });
  for (const table of tables) {
    const pageSize = table.name === "AnnouncementSend" ? 1 : 250;
    for (let offset = 0; ; offset += pageSize) {
      const scoped = "searchStrings" in table ? communicationInventoryFilter(table.searchStrings, table.searchUserRefs, uid, emails, new Set([...knownHashes, ...[...emails].map(sha)])) : undefined;
      let result;
      try { result = await db().executeGraphqlRead<any, Record<string, unknown>>(`query AccountDeletionInventory${scoped?.declaration ?? ""} { ${table.collection}(${scoped?.filter ?? ""}orderBy: ${table.orderBy}, limit: ${pageSize}, offset: ${offset}) { ${table.selection} } }`, scoped ? {variables: scoped.variables} : undefined); }
      catch { throw new HttpsError("unavailable", "Account checks could not be completed. Try again."); }
      if (!Array.isArray(result.data?.[table.collection])) throw new HttpsError("unavailable", "Account checks could not be completed. Try again.");
      const rows = result.data[table.collection];
      for (const row of rows) {
        let match = accountDeletionMatch(table.name, row, uid, email, operationId, emails, knownHashes);
        if (pendingOperation && row.operationId === pendingOperation && row.desiredAdmin === false) {
          if (table.name === "UserSecurityState" && row.user?.id === uid && !row.accessReady && !row.adminReady && row.desiredEnabled === false) match = "remove";
          if (table.name === "SecurityTransition" && row.userId === uid && row.reason === "ACCOUNT_DELETION" && row.authDisabled === true && row.desiredEnabled === false) match = "remove";
        }
        if (match === "remove" && table.name === "NotificationDelivery" && row.status === "PENDING") {
          const time = Date.parse(row.lastAttemptedAt ?? row.createdAt);
          if (!Number.isFinite(time)) blockers.NotificationDeliveryLease = 1;
          else activeDeliveryUntil = Math.max(activeDeliveryUntil, time + DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS);
        }
        if (match === "remove" && table.name === "AnnouncementRecipient" && ["sending", "retrying", "delivery_unknown"].includes(row.status)) {
          const time = Date.parse(row.processingStartedAt ?? row.deliveryStatusUpdatedAt ?? row.announcementSend.sentAt);
          if (!Number.isFinite(time)) blockers.AnnouncementDeliveryLease = 1;
          else activeDeliveryUntil = Math.max(activeDeliveryUntil, time + ANNOUNCEMENT_PROCESSING_LEASE_MS);
        }
        if (match === "remove" && table.name === "AnnouncementSend") {
          const pruned = pruneAnnouncementSnapshot(row.recipientSnapshot, uid, email, emails);
          withSnapshotErasure(redactAccountSnapshotMutation, [{id: row.id, expected: row.recipientSnapshot, replacement: pruned.replacement, recipientCount: row.recipientCount, skippedCount: row.skippedCount, removedTasks: pruned.removedTasks, removedSkipped: pruned.removedSkipped}]);
          snapshots.push({id: row.id});
          for (const address of pruned.emails) emails.add(address);
          for (const task of pruned.tasks) for (const id of announcementErasureTaskIds(task.sendId, uid, task.effectiveDeliveryMode)) taskIds.add(id);
        }
        if (match === "remove" && table.name === "AnnouncementRecipient") {
          emails.add(row.email.trim().toLowerCase());
          for (const id of announcementErasureTaskIds(row.announcementSend.id, uid, row.effectiveDeliveryMode ?? undefined)) taskIds.add(id);
        }
        if (match === "remove" && ["AnnouncementSend", "AnnouncementRecipient", "NotificationDelivery", "NotifyDeliveryReceipt"].includes(table.name)) communications++;
        if (match === "remove") records++;
        if (match === "block") blockers[table.name] = (blockers[table.name] ?? 0) + 1;
        if (match === "remove" && table.name === "User") {profile = true; profileEmail = row.email;}
        if (match === "remove" && table.name === "UserSecurityState") state = true;
      }
      if (rows.length < pageSize) break;
      // Bound work rather than return a misleading partial preview.
      if (offset >= 10000) throw new HttpsError("resource-exhausted", "This account needs the operator deletion workflow.");
    }
  }
  // Re-scan with the complete alias set so earlier rows cannot hide a shared
  // historical address and offset pagination cannot omit newly matched rows.
  if (emails.size > initialAliasCount) {
    if (aliasPass >= 10) throw new HttpsError("resource-exhausted", "Account aliases need operator review.");
    return inventoryAccountDeletion(uid, email, operationId, pendingOperation, knownHashes, emails, aliasPass + 1);
  }
  return {blockers, profile, state, records, communications, snapshots, taskIds, emails, activeDeliveryUntil, profileEmail, hashes: new Set([...knownHashes, ...[...emails].map(sha)])};
}

async function assertErasureActor(actorId: string, securityVersion: number): Promise<void> {
  const actor = await admin.auth().getUser(actorId);
  if (actor.disabled || !actor.emailVerified || actor.customClaims?.admin !== true || actor.customClaims?.enabled !== true || actor.customClaims?.securityVersion !== securityVersion) {
    throw new HttpsError("permission-denied", "Your administrator access changed. Sign in again before continuing deletion.");
  }
}

export async function redactSnapshots(snapshots: {id: string}[], uid: string, email: string, actorId: string, actorVersion: number, authority?: {assert: () => Promise<unknown>; mutation: string; operationId: string; targetVersion: number}) {
  for (const reference of snapshots) {
    if (authority) await authority.assert();
    else await assertErasureActor(actorId, actorVersion);
    const read = await db().executeGraphqlRead<any, {id: string}>(`query SnapshotForErasure($id: UUID!) {
      announcementSend(id: $id) {id recipientSnapshot recipientCount skippedCount}
    }`, {variables: {id: reference.id}});
    const row = read.data?.announcementSend;
    if (!row) continue;
    const pruned = pruneAnnouncementSnapshot(row.recipientSnapshot, uid, email);
    if (!pruned.removed) continue;
    const snapshot: SnapshotErasureUpdate = {id: row.id, expected: row.recipientSnapshot, replacement: pruned.replacement,
      recipientCount: row.recipientCount, skippedCount: row.skippedCount, removedTasks: pruned.removedTasks, removedSkipped: pruned.removedSkipped};
    const transaction = withSnapshotErasure(authority?.mutation ?? redactAccountSnapshotMutation, [snapshot]);
    const result = await db().executeGraphql(transaction.query, {variables: {uid, actorId, actorVersion,
      ...(authority ? {operationId: authority.operationId, targetVersion: authority.targetVersion} : {}), ...transaction.variables}});
    if (!result.data) throw new Error("SNAPSHOT_ERASURE_UNCONFIRMED");
  }
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
  await assertErasureActor(request.auth!.uid, authority.actorSecurityVersion!);
  const subjectHash = sha(uid);
  let target;
  try { target = await admin.auth().getUser(uid); }
  catch (error: any) { if (error.code !== "auth/user-not-found") throw new HttpsError("unavailable", "Account could not be checked."); }
  if (target && (target.customClaims?.admin === true || target.email?.toLowerCase() !== email.toLowerCase())) {
    throw new HttpsError("failed-precondition", "Administrator accounts cannot be deleted. If the email has changed, reopen the account.");
  }
  const markers = await accountErasureState(uid);
  const identityHash = sha(email.trim().toLowerCase());
  if (markers.length && !markers.some(marker => marker.emailHash === identityHash)) throw new HttpsError("failed-precondition", "The deletion identity has changed. Ask an operator to review it.");
  if (target && markers.some(marker => marker.completedAt)) throw new HttpsError("failed-precondition", "An identity was restored after deletion. Ask an operator to review it.");
  const resumedProfileDeletion = markers.some(marker => marker.profileDeletedAt && !marker.completedAt);
  let pendingOperation: string | undefined;
  if (markers.length) {
    const pending = (await getUserSecurityState({userId: uid})).data.userSecurityState;
    if (pending?.syncStatus === "PENDING" && !pending.desiredAdmin && !pending.desiredEnabled && !pending.accessReady && !pending.adminReady) {
      const intent = (await getSecurityTransition({operationId: pending.operationId})).data.securityTransition;
      if (intent?.userId === uid && intent.reason === "ACCOUNT_DELETION" && intent.authDisabled === true && !intent.desiredAdmin && !intent.desiredEnabled) pendingOperation = pending.operationId;
    }
  }
  const knownHashes = new Set(markers.map(marker => marker.emailHash));
  const plan = await inventoryAccountDeletion(uid, email, operationId, pendingOperation, knownHashes);
  const canResume = markers.length > 0 && (!target || resumedProfileDeletion);
  const needsOperator = (plan.profile && !plan.state) || (!plan.profile && (Boolean(target) || plan.records > 0) && !canResume);
  const blocked = Object.keys(plan.blockers).length > 0 || needsOperator;
  if (!apply) return {eligible: !blocked, blockers: Object.keys(plan.blockers), needsOperator, communicationRecords: plan.communications, sharedAnnouncements: plan.snapshots.length};
  if (request.data?.noRetention !== true) throw new HttpsError("invalid-argument", "Confirm that no records need retaining.");
  if (blocked) throw new HttpsError("failed-precondition", "Linked records or account security require review. Use the operator erasure workflow.");
  // A missing profile is accepted only as recovery after our own completed hold.
  // Auth-only accounts are routed to operators because no durable hold exists.
  if (!plan.profile && target && !canResume) throw new HttpsError("failed-precondition", "This account needs operator recovery before deletion.");
  if (!plan.profile && !target && plan.records === 0) {
    if (markers.length) await completeAccountErasure(uid);
    return {deleted: true};
  }
  try {
    const marker = await startAccountErasure(uid, plan.emails);
    await cancelErasureTasks(plan.taskIds);
    if (!plan.profile && canResume) {
      await assertErasureActor(request.auth!.uid, authority.actorSecurityVersion!);
      if (plan.activeDeliveryUntil > Date.now()) throw new HttpsError("aborted", "A delivery is still settling. Retry to finish deletion shortly.");
      await redactSnapshots(plan.snapshots, uid, email, request.auth!.uid, authority.actorSecurityVersion!);
      const purged = await db().executeGraphql(deleteErasedCommunicationMutation, {variables: {uid, actorId: request.auth!.uid, actorVersion: authority.actorSecurityVersion!, emailHashes: [...plan.hashes]}});
      if (!purged.data) throw new Error("COMMUNICATION_RECOVERY_UNCONFIRMED");
      const remaining = await inventoryAccountDeletion(uid, email, operationId, undefined, plan.hashes, plan.emails);
      if (remaining.records || Object.keys(remaining.blockers).length) throw new Error("DATABASE_VERIFICATION_FAILED");
      const identity = await admin.auth().getUser(uid).catch((error: any) => {if (error.code === "auth/user-not-found") return null; throw error;});
      if (identity && (!identity.disabled || identity.customClaims?.admin || identity.email?.toLowerCase() !== email.toLowerCase())) throw new Error("AUTH_CHANGED");
      if (identity) await admin.auth().deleteUser(uid).catch((error: any) => {if (error.code !== "auth/user-not-found") throw error;});
      await admin.auth().getUser(uid).then(() => {throw new Error("AUTH_VERIFICATION_FAILED");}, (error: any) => {if (error.code !== "auth/user-not-found") throw error;});
      await completeAccountErasure(uid);
      return {deleted: true};
    }
    if (pendingOperation) await synchronizeUserSecurity(pendingOperation);
    await transitionUserSecurity({userId: uid, actorId: request.auth!.uid, authDisabled: true,
      reason: "ACCOUNT_DELETION", ...securityRequestAuthority(request), operationId});
    await admin.auth().revokeRefreshTokens(uid);
    await drainAccountCommunications(marker.startedAt);
    await assertErasureActor(request.auth!.uid, authority.actorSecurityVersion!);
    const state = (await getUserSecurityState({userId: uid})).data.userSecurityState;
    const hold = (await getSecurityTransition({operationId})).data.securityTransition;
    if (!state || !hold || hold.userId !== uid || hold.syncStatus !== "READY" ||
        (state.operationId !== operationId && !(hold.noOp && hold.securityVersion === state.securityVersion))) {
      throw new HttpsError("aborted", "The account changed during deletion. Ask an operator to review it.");
    }
    await requireAdmin(request);
    const fresh = await inventoryAccountDeletion(uid, email, operationId, undefined, knownHashes, plan.emails);
    if (fresh.activeDeliveryUntil > Date.now()) throw new HttpsError("aborted", "A delivery is still settling. Retry to finish deletion shortly.");
    if (Object.keys(fresh.blockers).length) throw new HttpsError("failed-precondition", "Linked records appeared during deletion. The account remains disabled; request operator review.");
    // State deletion is a compare-and-swap fence against concurrent promotion,
    // enablement or email changes. Any later security operation needs this row
    // and profile; foreign keys protect relational domain records atomically.
    await startAccountErasure(uid, fresh.emails);
    await cancelErasureTasks(fresh.taskIds);
    await redactSnapshots(fresh.snapshots, uid, email, request.auth!.uid, authority.actorSecurityVersion!);
    await assertErasureActor(request.auth!.uid, authority.actorSecurityVersion!);
    const transaction = withSnapshotErasure(deleteInactiveAccountMutation, []);
    const result = await db().executeGraphql<any, Record<string, unknown>>(transaction.query, {variables: {
      uid, email: fresh.profileEmail ?? email, operationId: state.operationId, targetVersion: state.securityVersion, actorId: request.auth!.uid,
      actorVersion: authority.actorSecurityVersion!, emailHashes: [...fresh.hashes], ...transaction.variables,
    }});
    if (!result.data) throw new Error("DATABASE_DELETE_FAILED");
    const remaining = await inventoryAccountDeletion(uid, email, operationId, undefined, fresh.hashes, fresh.emails);
    if (remaining.records || Object.keys(remaining.blockers).length) throw new Error("DATABASE_VERIFICATION_FAILED");
    const finalAuth = await admin.auth().getUser(uid);
    if (!finalAuth.disabled || finalAuth.customClaims?.admin || finalAuth.email?.toLowerCase() !== email.toLowerCase()) throw new Error("AUTH_CHANGED");
    await admin.auth().deleteUser(uid).catch((error: any) => {if (error.code !== "auth/user-not-found") throw error;});
    try { await admin.auth().getUser(uid); throw new Error("AUTH_VERIFICATION_FAILED"); }
    catch (error: any) { if (error.code !== "auth/user-not-found") throw error; }
    await completeAccountErasure(uid);
    logger.info("Admin account deletion completed", {actorId: request.auth!.uid, subjectHash, operationId});
    return {deleted: true};
  } catch (error) {
    logger.error("Admin account deletion incomplete", {actorId: request.auth!.uid, subjectHash, operationId});
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", "Deletion did not complete. The account may be disabled. Ask an operator to inspect and finish the erasure.");
  }
});
