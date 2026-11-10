import { getDataConnect } from "firebase-admin/data-connect";
import { getFunctions } from "firebase-admin/functions";
import { FUNCTIONS_REGION } from "./constants";
import { erasureEmailHash } from "./communicationErasureGuard";
import { erasureDrainRemaining } from "./accountCommunicationErasure";

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
  let rows = await accountErasureState(uid);
  const hashes = [...new Set([...emails].map(erasureEmailHash))];
  if (hashes.length > 1000) throw new Error("ERASURE_ALIAS_LIMIT");
  for (const hash of hashes) {
    if (rows.some(row => row.emailHash === hash)) continue;
    const startedAt = rows[0]?.startedAt;
    try {
      await db().executeGraphql(`mutation BeginErasure($uid: String!, $hash: String!${startedAt ? ", $startedAt: Timestamp!" : ""}) {
        accountErasure_insert(data: {userId: $uid, emailHash: $hash, ${startedAt ? "startedAt: $startedAt" : "startedAt_expr: \"request.time\""}})
      }`, {variables: {uid, hash, ...(startedAt ? {startedAt} : {})}});
    } catch (error) {
      // Only an independently observed matching row resolves uncertain insertion.
      const observed = await accountErasureState(uid);
      if (!observed.some(row => row.emailHash === hash)) throw error;
    }
    rows = await accountErasureState(uid);
  }
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
export async function completeAccountErasure(uid: string): Promise<void> {
  await db().executeGraphql(`mutation CompleteErasure($uid: String!) {
    accountErasure_updateMany(where: {userId: {eq: $uid}}, data: {completedAt_expr: "request.time"})
  }`, {variables: {uid}});
}
