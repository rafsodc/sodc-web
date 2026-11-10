import { createHash } from "node:crypto";

export const ACCOUNT_ERASURE_DRAIN_MS = 330_000;
export function communicationInventoryFilter(fields: readonly string[], userReferences: readonly string[], uid: string, emails: Iterable<string>, hashes: Iterable<string>) {
  const names = [...fields, ...userReferences];
  if (!fields.length || names.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) throw new Error("COMMUNICATION_SCHEMA_CHANGED");
  const terms = [...new Set([uid, ...emails, ...hashes])].filter(Boolean);
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = terms.map(escape).join("|");
  const alternatives = [...fields.map(name => `{${name}: {pattern: {regex: $pattern, ignoreCase: true}}}`), ...userReferences.map(name => `{${name}: {eq: $uid}}`)];
  return {filter: `where: {_or: [${alternatives.join(", ")}]}, `, declaration: `($pattern: String!${userReferences.length ? ", $uid: String!" : ""})`, variables: {pattern, ...(userReferences.length ? {uid} : {})}};
}
export interface SnapshotErasureUpdate {id: string; expected: string; replacement: string; recipientCount: number; skippedCount: number; removedTasks: number; removedSkipped: number}
export function withSnapshotErasure(query: string, snapshots: SnapshotErasureUpdate[]) {
  if (snapshots.length > 100 || snapshots.reduce((size, row) => size + Buffer.byteLength(row.expected), 0) > 4 * 1024 * 1024) throw new Error("ERASURE_SNAPSHOT_LIMIT");
  const variables: Record<string, string | number> = {};
  if (!snapshots.length) return {query, variables};
  const declarations: string[] = [], operations: string[] = [];
  snapshots.forEach((row, index) => {
    if (!Number.isInteger(row.recipientCount) || !Number.isInteger(row.skippedCount) || row.recipientCount < row.removedTasks || row.skippedCount < row.removedSkipped) throw new Error("ANNOUNCEMENT_COUNTS_NEED_REVIEW");
    declarations.push(`$send${index}: UUID!`, `$before${index}: String!`, `$after${index}: String!`, `$recipientBefore${index}: Int!`, `$skippedBefore${index}: Int!`, `$recipientAfter${index}: Int!`, `$skippedAfter${index}: Int!`);
    variables[`recipientBefore${index}`] = row.recipientCount; variables[`skippedBefore${index}`] = row.skippedCount;
    variables[`recipientAfter${index}`] = row.recipientCount - row.removedTasks; variables[`skippedAfter${index}`] = row.skippedCount - row.removedSkipped;
    variables[`send${index}`] = row.id; variables[`before${index}`] = row.expected; variables[`after${index}`] = row.replacement;
    operations.push(`snapshot${index}: announcementSend_updateMany(where: {id: {eq: $send${index}}, recipientSnapshot: {eq: $before${index}}, recipientCount: {eq: $recipientBefore${index}}, skippedCount: {eq: $skippedBefore${index}}}, data: {recipientSnapshot: $after${index}, recipientCount: $recipientAfter${index}, skippedCount: $skippedAfter${index}}) @check(expr: "this == 1", message: "ANNOUNCEMENT_CHANGED_DURING_ERASURE")`);
  });
  if (!query.includes(") @transaction {") || !query.trim().endsWith("}")) throw new Error("ERASURE_TRANSACTION_CONTRACT_CHANGED");
  return {query: query.replace(") @transaction {", `, ${declarations.join(", ")}) @transaction {`)
    .replace(/\}\s*$/, `${operations.join("\n")}\n}`), variables};
}
export function erasureDrainRemaining(startedAt: string, now = Date.now()): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start) || start > now + 5000) throw new Error("INVALID_ERASURE_START");
  return Math.max(0, start + ACCOUNT_ERASURE_DRAIN_MS - now);
}

export function pruneAnnouncementSnapshot(value: string, uid: string, email: string, knownEmails: Iterable<string> = [email]) {
  const identities = new Set([...knownEmails].map(value => value.trim().toLowerCase()));
  const snapshot = JSON.parse(value);
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.tasks) || !Array.isArray(snapshot.skippedRecipients)) throw new Error("UNSUPPORTED_ANNOUNCEMENT_SNAPSHOT");
  const emails = new Set<string>();
  const tasks: {sendId: string; recipientId: string; effectiveDeliveryMode?: string}[] = [];
  let removed = 0;
  const retain = (item: any, idKey: string) => {
    if (!item || typeof item[idKey] !== "string" || typeof item.email !== "string") throw new Error("UNSUPPORTED_ANNOUNCEMENT_RECIPIENT");
    if (item[idKey] !== uid) {
      if (identities.has(item.email.trim().toLowerCase())) throw new Error("AMBIGUOUS_ANNOUNCEMENT_IDENTITY");
      return true;
    }
    emails.add(item.email.trim().toLowerCase()); removed++;
    if (idKey === "recipientId") {
      if (typeof item.sendId !== "string") throw new Error("MISSING_ANNOUNCEMENT_TASK_IDENTITY");
      tasks.push({sendId: item.sendId, recipientId: uid, effectiveDeliveryMode: item.effectiveDeliveryMode});
    }
    return false;
  };
  const replacement = {...snapshot, tasks: snapshot.tasks.filter((item: any) => retain(item, "recipientId")),
    skippedRecipients: snapshot.skippedRecipients.filter((item: any) => retain(item, "userId"))};
  return {replacement: JSON.stringify(replacement), removed, removedTasks: snapshot.tasks.length - replacement.tasks.length, removedSkipped: snapshot.skippedRecipients.length - replacement.skippedRecipients.length, emails: [...emails], tasks};
}

export function announcementErasureTaskIds(sendId: string, uid: string, mode?: string): string[] {
  const compact = sendId.replace(/-/g, "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(compact)) throw new Error("INVALID_ANNOUNCEMENT_SEND_ID");
  const canonical = compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const ids = [...new Set([sendId, compact, canonical, compact.toUpperCase(), canonical.toUpperCase()])];
  const modes = mode ? [mode] : ["SIMULATION", "TEAM_TEST", "LIVE"];
  if (modes.some(value => !["SIMULATION", "TEAM_TEST", "LIVE"].includes(value))) throw new Error("INVALID_ANNOUNCEMENT_MODE");
  return ids.flatMap(id => [createHash("sha256").update(`${id}:${uid}`).digest("hex"), ...modes.map(value => createHash("sha256").update(`${id}:${uid}:${value}`).digest("hex"))]);
}
