import { getDataConnect } from "firebase-admin/data-connect";
import { getFunctions } from "firebase-admin/functions";
import { FUNCTIONS_REGION } from "./constants";
import { erasureEmailHash } from "./communicationErasureGuard";
import { erasureDrainRemaining } from "./accountCommunicationErasure";
import { readAccountErasureDisposal, removeEmptyAccountErasureDisposal, withAccountErasureDisposalFence } from "./accountErasureDisposal";
import { erasureDisposalAbsenceCheck, erasureDisposalAbsenceSelection, erasureDisposalFenceWithData } from "./accountErasureDisposalDatabase";

const db = () => getDataConnect({connector: "api", serviceId: "sodc-web-service", location: FUNCTIONS_REGION});
export interface AccountErasureState {emailHash: string; startedAt: string; profileDeletedAt: string | null; completedAt: string | null}
export async function accountErasureState(uid: string): Promise<AccountErasureState[]> {
  const result = await db().executeGraphqlRead<any, {uid: string}>(`query ErasureState($uid: String!) {
    accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {emailHash startedAt profileDeletedAt completedAt}
  }`, {variables: {uid}});
  const rows = result.data?.accountErasures;
  if (!Array.isArray(rows) || rows.length > 1000) throw new Error("ERASURE_STATE_UNAVAILABLE");
  return rows;
}
export async function startAccountErasure(uid: string, emails: Iterable<string>): Promise<AccountErasureState> {
  const hashes = [...new Set([...emails].map(erasureEmailHash))];
  if (!hashes.length || hashes.length > 1000) throw new Error("ERASURE_ALIAS_LIMIT");
  const before = await accountErasureState(uid);
  await withAccountErasureDisposalFence(uid, before.length > 0, async decision => {
    const rows = await accountErasureState(uid);
    const missing = hashes.filter(hash => !rows.some(row => row.emailHash === hash));
    if (new Set([...rows.map(row => row.emailHash), ...hashes]).size > 1000) throw new Error("ERASURE_ALIAS_LIMIT");
    const startedAt = rows.reduce<string | undefined>((first, row) => !first || Date.parse(row.startedAt) < Date.parse(first) ? row.startedAt : first, undefined);
    const inserts = missing.length ? `accountErasure_insertMany(data: [${missing.map((_hash, index) => `{userId: $uid, emailHash: $hash${index}, ${startedAt ? "startedAt: $startedAt" : "startedAt_expr: \"request.time\""}}`).join(", ")}])` : "";
    try {
      await db().executeGraphql(`mutation BeginErasure($uid: String!, $generation: UUID!, $version: Int!${missing.map((_hash, index) => `, $hash${index}: String!`).join("")}${startedAt && missing.length ? ", $startedAt: Timestamp!" : ""}) @transaction {
        ${erasureDisposalFenceWithData("internalQuiescedAt: null, taskSafeAt: null, providerSafeAt: null, evidenceReference: null, lastReason: null, nextAttemptAt_expr: \"request.time\"")}
        accountErasure_updateMany(where: {userId: {eq: $uid}}, data: {completedAt: null})
        ${inserts}
      }`, {variables: {uid, generation: decision.generation, version: decision.version, ...Object.fromEntries(missing.map((hash, index) => [`hash${index}`, hash])), ...(startedAt && missing.length ? {startedAt} : {})}});
    } catch (error) {
      // A conflicting lifecycle writer must be retried through its new version;
      // a committed-but-lost response is safe only with independent evidence
      // that every requested alias is suppressed and completion was invalidated.
      if (String(error).includes("ERASURE_DISPOSAL_CONFLICT")) throw error;
      const [observed, evidence] = await Promise.all([accountErasureState(uid), readAccountErasureDisposal(uid)]);
      if (!hashes.every(hash => observed.some(row => row.emailHash === hash && row.completedAt === null)) || !evidence || evidence.internalQuiescedAt !== null) throw error;
    }
  });
  const rows = await accountErasureState(uid);
  if (!rows.length) throw new Error("ERASURE_STATE_MISSING");
  // First marker time is immutable across retries; later aliases use that time.
  return rows.reduce((first, row) => Date.parse(row.startedAt) < Date.parse(first.startedAt) ? row : first);
}
export async function drainAccountCommunications(startedAt: string): Promise<void> {
  const remaining = erasureDrainRemaining(startedAt);
  if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
}
export async function cancelErasureTasks(ids: Set<string>): Promise<void> {
  const queue = getFunctions().taskQueue(`locations/${FUNCTIONS_REGION}/functions/processAnnouncementEmail`);
  const values = [...ids];
  for (let offset = 0; offset < values.length; offset += 8) {
    await Promise.all(values.slice(offset, offset + 8).map(async id => {
      try { await queue.delete(id); }
      catch (error: any) {
        if (!["functions/task-not-found", "functions/not-found"].includes(error?.code)) throw error;
      }
    }));
  }
}
export async function completeAccountErasure(uid: string, evidence?: {communicationsQuiesced: true}): Promise<void> {
  await withAccountErasureDisposalFence(uid, true, async decision => {
    const rows = await accountErasureState(uid);
    if (!rows.length) {
      await removeEmptyAccountErasureDisposal(uid, decision);
      throw new Error("ERASURE_STATE_MISSING");
    }
    const hashes = rows.map(row => row.emailHash);
    const heldDefault = !evidence?.communicationsQuiesced && decision.holdCode !== null;
    await db().executeGraphql(`mutation CompleteErasure($uid: String!, $generation: UUID!, $version: Int!${evidence?.communicationsQuiesced ? ", $hashes: [String!]!" : ""}${heldDefault ? ", $holdCode: String!" : ""}) @transaction {
      query @redact @check(expr: "response.query.profile == null && response.query.markers.size() > 0 && response.query.markers.size() < 1001 && response.query.markers.all(e, e.profileDeletedAt != null && e.startedAt <= request.time - duration('330s'))${evidence?.communicationsQuiesced ? ` && ${erasureDisposalAbsenceCheck}` : ""}", message: "ERASURE_COMPLETION_NOT_READY") {
        ${evidence?.communicationsQuiesced ? erasureDisposalAbsenceSelection : "profile: user(id: $uid) {id}"}
        markers: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {startedAt profileDeletedAt}
      }
      ${erasureDisposalFenceWithData(evidence?.communicationsQuiesced ? "internalQuiescedAt_expr: \"request.time\", taskSafeAt_expr: \"request.time\", providerSafeAt_expr: \"request.time + duration('2592000s')\", nextAttemptAt_expr: \"request.time + duration('2592000s')\", evidenceReference: \"INTERNAL_COMPLETION\", lastReason: null" : `internalQuiescedAt: null, taskSafeAt: null, providerSafeAt: null, evidenceReference: null, holdCode: ${heldDefault ? "$holdCode" : "\"HISTORICAL_EVIDENCE_REQUIRED\""}, reviewDueAt_expr: "request.time + duration('2592000s')"`)}
      accountErasure_updateMany(where: {userId: {eq: $uid}}, data: {completedAt_expr: "request.time"}) @check(expr: "this > 0 && this < 1001", message: "ERASURE_STATE_MISSING")
    }`, {variables: {uid, generation: decision.generation, version: decision.version, ...(evidence?.communicationsQuiesced ? {hashes} : {}), ...(heldDefault ? {holdCode: decision.holdCode} : {})}});
  });
}
