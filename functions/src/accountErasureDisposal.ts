import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getDataConnect } from "firebase-admin/data-connect";
import { FUNCTIONS_REGION } from "./constants";
import { erasureDisposalAbsenceCheck, erasureDisposalAbsenceSelection, erasureDisposalFence, erasureDisposalFenceWithData, erasureDisposalSelection, purgeAccountErasureMutation } from "./accountErasureDisposalDatabase";
import type { AccountErasureState } from "./accountErasureState";

export const ACCOUNT_ERASURE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const ACCOUNT_ERASURE_DISPOSAL_BATCH_LIMIT = 10;
export const ACCOUNT_ERASURE_DISPOSAL_BUDGET_MS = 30_000;
export interface AccountErasureDisposalDecision {
  userId: string; generation: string; version: number;
  internalQuiescedAt: string | null; taskSafeAt: string | null; providerSafeAt: string | null;
  evidenceReference: string | null; holdCode: string | null; reviewDueAt: string | null;
  nextAttemptAt: string; lastReason: string | null; updatedAt: string;
}
export interface AccountErasureDisposalPolicy {version: number; externalReplayReviewed: boolean; reviewReference: string | null}
export interface AccountErasureRetentionInput {projectId: string; profileDeletedAt: string; completedAt: string; now: string}
export type InspectAccountErasureRetentionHorizon = (input: AccountErasureRetentionInput) => Promise<{safe: boolean; reason: string}>;
interface DisposalSnapshot {decision: AccountErasureDisposalDecision; markers: AccountErasureState[]}
const db = () => getDataConnect({connector: "api", serviceId: "sodc-web-service", location: FUNCTIONS_REGION});
const isConflict = (error: unknown) => String(error).includes("ERASURE_DISPOSAL_CONFLICT");
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const canonicalUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function normalizeDecisionUuid(value: any): unknown {
  // Data Connect serializes UUID scalars as compact hexadecimal strings. Keep
  // the lifecycle token canonical at the application boundary; no other field
  // or malformed UUID is repaired or defaulted here.
  return value && typeof value.generation === "string" && /^[a-f0-9]{32}$/.test(value.generation) ?
    {...value, generation: value.generation.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")} : value;
}
function validDecision(value: any): value is AccountErasureDisposalDecision {
  return value && typeof value.userId === "string" && typeof value.generation === "string" && canonicalUuid.test(value.generation) &&
    Number.isSafeInteger(value.version) && value.version > 0 && validDate(value.nextAttemptAt) && validDate(value.updatedAt) &&
    ["internalQuiescedAt", "taskSafeAt", "providerSafeAt", "reviewDueAt"].every(key => value[key] === null || validDate(value[key])) &&
    ["evidenceReference", "holdCode", "lastReason"].every(key => value[key] === null || typeof value[key] === "string");
}
export async function readAccountErasureDisposal(uid: string): Promise<AccountErasureDisposalDecision | null> {
  const response = await db().executeGraphqlRead<any, {uid: string}>(`query AccountErasureDisposalState($uid: String!) {accountErasureDisposal(key: {userId: $uid}) {${erasureDisposalSelection}}}`, {variables: {uid}});
  const decision = normalizeDecisionUuid(response.data?.accountErasureDisposal);
  if (decision === null) return null;
  if (!validDecision(decision) || decision.userId !== uid) throw new Error("ERASURE_DISPOSAL_UNAVAILABLE");
  return decision;
}
export async function readAccountErasureDisposalPolicy(): Promise<AccountErasureDisposalPolicy | null> {
  const response = await db().executeGraphqlRead<any, Record<string, never>>("query ErasureDisposalPolicy {accountErasureDisposalPolicy(key: {id: \"site-wide\"}) {version externalReplayReviewed reviewReference}}");
  const policy = response.data?.accountErasureDisposalPolicy;
  if (policy === null) return null;
  if (!policy || !Number.isSafeInteger(policy.version) || policy.version < 1 || typeof policy.externalReplayReviewed !== "boolean" || (policy.reviewReference !== null && typeof policy.reviewReference !== "string")) throw new Error("ERASURE_DISPOSAL_UNAVAILABLE");
  return policy;
}

/** Insert-only initialization preserves existing holds/evidence across retries. */
export async function ensureAccountErasureDisposal(uid: string, historical: boolean): Promise<AccountErasureDisposalDecision> {
  const existing = await readAccountErasureDisposal(uid);
  if (existing) return existing;
  const generation = randomUUID();
  try {
    await db().executeGraphql(`mutation InitializeErasureDisposal($uid: String!, $generation: UUID!, $hold: String) {
      accountErasureDisposal_insert(data: {userId: $uid, generation: $generation, holdCode: $hold${historical ? ", reviewDueAt_expr: \"request.time + duration('2592000s')\"" : ""}})
    }`, {variables: {uid, generation, hold: historical ? "HISTORICAL_EVIDENCE_REQUIRED" : null}});
  } catch {
    // An independently read existing row is the only acceptable resolution of
    // insert conflict or an uncertain response; never overwrite its evidence.
    const observed = await readAccountErasureDisposal(uid);
    if (observed) return observed;
    throw new Error("ERASURE_DISPOSAL_UNAVAILABLE");
  }
  const created = await readAccountErasureDisposal(uid);
  if (!created) throw new Error("ERASURE_DISPOSAL_UNAVAILABLE");
  return created;
}

export async function withAccountErasureDisposalFence<T>(uid: string, historical: boolean, write: (decision: AccountErasureDisposalDecision) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const decision = await ensureAccountErasureDisposal(uid, historical);
    try {return await write(decision);}
    catch (error) {if (!isConflict(error) || attempt === 2) throw error;}
  }
  throw new Error("ERASURE_DISPOSAL_CONFLICT");
}

/** A stale completion may observe disposal winning first. Its insert-only
 * initialization must not leave an empty replacement UID ledger behind. */
export async function removeEmptyAccountErasureDisposal(uid: string, expected: Pick<AccountErasureDisposalDecision, "generation" | "version">): Promise<void> {
  await db().executeGraphql(`mutation RemoveEmptyErasureDisposal($uid: String!, $generation: UUID!, $version: Int!) @transaction {
    query @redact @check(expr: "response.query.markers.size() == 0 && response.query.profile == null && response.query.decision != null && response.query.decision.holdCode == 'HISTORICAL_EVIDENCE_REQUIRED' && response.query.decision.internalQuiescedAt == null", message: "ERASURE_DISPOSAL_CONFLICT") {
      markers: accountErasures(where: {userId: {eq: $uid}}, limit: 1) {userId}
      profile: user(id: $uid) {id}
      decision: accountErasureDisposal(key: {userId: $uid}) {holdCode internalQuiescedAt}
    }
    ${erasureDisposalFence}
    accountErasureDisposal_deleteMany(where: {userId: {eq: $uid}, generation: {eq: $generation}}) @check(expr: "this == 1", message: "ERASURE_DISPOSAL_CONFLICT")
  }`, {variables: {uid, generation: expected.generation, version: expected.version}});
}

function validateReference(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(value)) throw new Error("ERASURE_DISPOSAL_REFERENCE_INVALID");
}
function validateExpected(decision: Pick<AccountErasureDisposalDecision, "generation" | "version">): void {
  if (!canonicalUuid.test(decision.generation) || !Number.isSafeInteger(decision.version) || decision.version < 1) throw new Error("ERASURE_DISPOSAL_REFERENCE_INVALID");
}
function validateMarkers(markers: AccountErasureState[]): {hashes: string[]; completedAt: string; profileDeletedAt: string} {
  if (!Array.isArray(markers) || !markers.length || markers.length > 1000 || markers.some(row => !/^[a-f0-9]{64}$/.test(row.emailHash) || !validDate(row.startedAt) || !validDate(row.completedAt) || !validDate(row.profileDeletedAt) || Date.parse(row.completedAt) < Date.parse(row.profileDeletedAt) || Date.parse(row.profileDeletedAt) < Date.parse(row.startedAt))) throw new Error("ERASURE_DISPOSAL_INCOMPLETE");
  const hashes = [...new Set(markers.map(row => row.emailHash))];
  if (hashes.length !== markers.length) throw new Error("ERASURE_DISPOSAL_INCOMPLETE");
  return {hashes, completedAt: markers.reduce((latest, row) => Date.parse(row.completedAt!) > Date.parse(latest) ? row.completedAt! : latest, markers[0].completedAt!),
    profileDeletedAt: markers.reduce((latest, row) => Date.parse(row.profileDeletedAt!) > Date.parse(latest) ? row.profileDeletedAt! : latest, markers[0].profileDeletedAt!)};
}
export function accountErasureDisposalEligibility(snapshot: DisposalSnapshot, policy: AccountErasureDisposalPolicy, now: number): {eligible: boolean; reason: string; completedAt?: string; profileDeletedAt?: string; hashes?: string[]} {
  if (!validDecision(snapshot.decision) || !Number.isFinite(now)) return {eligible: false, reason: "INVALID_STATE"};
  if (!policy.externalReplayReviewed || !Number.isSafeInteger(policy.version) || policy.version < 1) return {eligible: false, reason: "EXTERNAL_REVIEW_REQUIRED"};
  if (snapshot.decision.holdCode !== null) return {eligible: false, reason: "HOLD"};
  let markers;
  try {markers = validateMarkers(snapshot.markers);} catch {return {eligible: false, reason: "INCOMPLETE"};}
  const evidence = snapshot.decision;
  if (!evidence.internalQuiescedAt || !evidence.taskSafeAt || !evidence.providerSafeAt) return {eligible: false, reason: "EVIDENCE_REQUIRED"};
  if (Date.parse(evidence.internalQuiescedAt) < Date.parse(markers.completedAt)) return {eligible: false, reason: "EVIDENCE_STALE"};
  if ([markers.completedAt, markers.profileDeletedAt].some(value => Date.parse(value) + ACCOUNT_ERASURE_RETENTION_MS > now) || Date.parse(evidence.providerSafeAt) < Date.parse(markers.completedAt) + ACCOUNT_ERASURE_RETENTION_MS || Date.parse(evidence.providerSafeAt) > now || Date.parse(evidence.taskSafeAt) > now) return {eligible: false, reason: "RETENTION_PENDING"};
  return {eligible: true, reason: "READY", ...markers};
}

/** Restricted operator helper; the caller must pass the version they reviewed. */
export async function setAccountErasureDisposalHold(uid: string, expected: Pick<AccountErasureDisposalDecision, "generation" | "version">, holdCode: string, reviewDueAt: string): Promise<void> {
  validateExpected(expected);
  if (!["EXTERNAL_COPY", "RESTORE_REVIEW", "PROVIDER_REVIEW", "TASK_REVIEW", "OPERATOR_REVIEW"].includes(holdCode) || !validDate(reviewDueAt) || Date.parse(reviewDueAt) <= Date.now() || Date.parse(reviewDueAt) > Date.now() + ACCOUNT_ERASURE_RETENTION_MS) throw new Error("ERASURE_DISPOSAL_HOLD_INVALID");
  await db().executeGraphql(`mutation HoldAccountErasureDisposal($uid: String!, $generation: UUID!, $version: Int!, $holdCode: String!, $reviewDueAt: Timestamp!) @transaction {
    ${erasureDisposalFenceWithData("holdCode: $holdCode, reviewDueAt: $reviewDueAt, nextAttemptAt: $reviewDueAt")}
  }`, {variables: {uid, generation: expected.generation, version: expected.version, holdCode, reviewDueAt}});
}

/** Service-wide assertion about exports/replay sources; missing policy is held. */
export async function setAccountErasureDisposalPolicy(expectedVersion: number, externalReplayReviewed: boolean, reviewReference: string): Promise<void> {
  validateReference(reviewReference);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("ERASURE_DISPOSAL_REFERENCE_INVALID");
  if (expectedVersion === 0) {
    await db().executeGraphql("mutation InitializeErasureDisposalPolicy($reviewed: Boolean!, $reference: String!) {accountErasureDisposalPolicy_insert(data: {id: \"site-wide\", externalReplayReviewed: $reviewed, reviewReference: $reference})}", {variables: {reviewed: externalReplayReviewed, reference: reviewReference}});
    return;
  }
  await db().executeGraphql(`mutation SetErasureDisposalPolicy($version: Int!, $reviewed: Boolean!, $reference: String!) @transaction {
    accountErasureDisposalPolicy_updateMany(where: {id: {eq: "site-wide"}, version: {eq: $version}}, data: {version_update: {inc: 1}, externalReplayReviewed: $reviewed, reviewReference: $reference, updatedAt_expr: "request.time"}) @check(expr: "this == 1", message: "ERASURE_DISPOSAL_CONFLICT")
  }`, {variables: {version: expectedVersion, reviewed: externalReplayReviewed, reference: reviewReference}});
}

async function assertAuthAbsent(uid: string): Promise<void> {
  try {await getAuth().getUser(uid);} catch (error: any) {if (error?.code === "auth/user-not-found") return; throw new Error("ERASURE_DISPOSAL_AUTH_UNAVAILABLE");}
  throw new Error("ERASURE_DISPOSAL_AUTH_PRESENT");
}

/** Explicit adoption never infers historical task/provider evidence from age. */
export async function adoptHistoricalAccountErasureDisposal(uid: string, expected: Pick<AccountErasureDisposalDecision, "generation" | "version">, markers: AccountErasureState[], evidence: {taskSafeAt: string; providerSafeAt: string; reviewReference: string}): Promise<void> {
  validateExpected(expected); validateReference(evidence.reviewReference);
  const proof = validateMarkers(markers);
  if (!validDate(evidence.taskSafeAt) || !validDate(evidence.providerSafeAt) || Date.parse(evidence.providerSafeAt) < Date.parse(proof.completedAt) + ACCOUNT_ERASURE_RETENTION_MS) throw new Error("ERASURE_DISPOSAL_EVIDENCE_INVALID");
  await assertAuthAbsent(uid);
  await db().executeGraphql(`mutation AdoptHistoricalErasureDisposal($uid: String!, $generation: UUID!, $version: Int!, $hashes: [String!]!, $count: Int!, $taskSafeAt: Timestamp!, $providerSafeAt: Timestamp!, $reference: String!, $completedAt: Timestamp!, $profileDeletedAt: Timestamp!) @transaction {
    query @redact @check(expr: "response.query.markers.size() == vars.count && response.query.markers.size() > 0 && response.query.markers.size() < 1001 && response.query.markers.all(e, e.emailHash in vars.hashes && e.completedAt != null && e.profileDeletedAt != null && e.completedAt <= vars.completedAt && e.profileDeletedAt <= vars.profileDeletedAt) && ${erasureDisposalAbsenceCheck}", message: "ERASURE_DISPOSAL_NOT_READY") {
      markers: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {emailHash completedAt profileDeletedAt}
      ${erasureDisposalAbsenceSelection}
    }
    ${erasureDisposalFenceWithData("internalQuiescedAt_expr: \"request.time\", taskSafeAt: $taskSafeAt, providerSafeAt: $providerSafeAt, evidenceReference: $reference, holdCode: null, reviewDueAt: null, nextAttemptAt_expr: \"request.time\", lastReason: null")}
  }`, {variables: {uid, generation: expected.generation, version: expected.version, hashes: proof.hashes, count: markers.length, taskSafeAt: evidence.taskSafeAt, providerSafeAt: evidence.providerSafeAt, reference: evidence.reviewReference, completedAt: proof.completedAt, profileDeletedAt: proof.profileDeletedAt}});
}

export interface AccountErasureDisposalDependencies {
  projectId: string;
  inspectRetentionHorizon: InspectAccountErasureRetentionHorizon;
  now?: () => number;
  deadline?: number;
}
function beforeDeadline<T>(operation: Promise<T>, deadline: number, now: () => number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ERASURE_DISPOSAL_BUDGET")), Math.max(0, deadline - now()));
    operation.then(value => {clearTimeout(timer); resolve(value);}, error => {clearTimeout(timer); reject(error);});
  });
}
/** Bounded tail work for the existing scheduler, after authority repair. */
export async function disposeCompletedAccountErasures(dependencies: AccountErasureDisposalDependencies): Promise<{examined: number; disposed: number; deferred: number; failed: number; retentionProbe?: string}> {
  const now = dependencies.now ?? Date.now;
  const deadline = Math.min(dependencies.deadline ?? Infinity, now() + ACCOUNT_ERASURE_DISPOSAL_BUDGET_MS);
  const summary: {examined: number; disposed: number; deferred: number; failed: number; retentionProbe?: string} = {examined: 0, disposed: 0, deferred: 0, failed: 0};
  if (!["sodc-web", "sodc-web-beta", "sodc-web-production"].includes(dependencies.projectId) || deadline <= now()) return summary;
  const bounded = <T>(operation: Promise<T>) => beforeDeadline(operation, deadline, now);
  const policy = await bounded(readAccountErasureDisposalPolicy());
  if (!policy || policy.externalReplayReviewed !== true || !Number.isSafeInteger(policy.version) || policy.version < 1 || !policy.reviewReference) return summary;
  const candidatesResponse = await bounded(db().executeGraphqlRead<any, {now: string}>(`query DueErasureDisposals($now: Timestamp!) {
    accountErasureDisposals(where: {holdCode: {isNull: true}, internalQuiescedAt: {isNull: false}, nextAttemptAt: {le: $now}}, orderBy: [{nextAttemptAt: ASC}, {userId: ASC}], limit: 10) {${erasureDisposalSelection}}
  }`, {variables: {now: new Date(now()).toISOString()}}));
  const rawCandidates = candidatesResponse.data?.accountErasureDisposals;
  if (!Array.isArray(rawCandidates) || rawCandidates.length > ACCOUNT_ERASURE_DISPOSAL_BATCH_LIMIT) throw new Error("ERASURE_DISPOSAL_UNAVAILABLE");
  const candidates = rawCandidates.map(normalizeDecisionUuid);
  if (candidates.some(candidate => !validDecision(candidate))) throw new Error("ERASURE_DISPOSAL_UNAVAILABLE");
  if (!candidates.length && now() < deadline) {
    // Non-personal runtime permission/health evidence when no account is due.
    // This uses the same fixed metadata APIs without inventing a deletion case.
    const epoch = "1970-01-01T00:00:00.000Z";
    const probe = await bounded(dependencies.inspectRetentionHorizon({projectId: dependencies.projectId, profileDeletedAt: epoch, completedAt: epoch, now: new Date(now()).toISOString()}));
    const reasons = new Set(["RESTORE_HORIZON_CLEAR", "INVALID_RETENTION_INPUT", "BACKUP_CONFIGURATION_UNSUPPORTED", "RECOVERY_HORIZON_UNAVAILABLE", "PRE_ERASURE_RECOVERY_AVAILABLE", "BACKUP_INVENTORY_UNAVAILABLE", "PRE_ERASURE_BACKUP_AVAILABLE", "BACKUP_INVENTORY_TRUNCATED", "BACKUP_EVIDENCE_UNAVAILABLE"]);
    summary.retentionProbe = probe && reasons.has(probe.reason) ? probe.reason : "RETENTION_PROBE_UNAVAILABLE";
  }
  for (const decision of candidates as AccountErasureDisposalDecision[]) {
    if (now() >= deadline) break;
    summary.examined++;
    let reason: string;
    try {
      const markersResponse = await bounded(db().executeGraphqlRead<any, {uid: string}>("query DisposalMarkers($uid: String!) {accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {emailHash startedAt completedAt profileDeletedAt}}", {variables: {uid: decision.userId}}));
      const result = accountErasureDisposalEligibility({decision, markers: markersResponse.data?.accountErasures}, policy, now());
      reason = result.reason;
      if (result.eligible) {
        await bounded(assertAuthAbsent(decision.userId));
        const horizon = await bounded(dependencies.inspectRetentionHorizon({projectId: dependencies.projectId, profileDeletedAt: result.profileDeletedAt!, completedAt: result.completedAt!, now: new Date(now()).toISOString()}));
        if (!horizon || horizon.safe !== true) reason = "RESTORE_HORIZON_PENDING";
        else if (now() >= deadline) reason = "BUDGET";
        else {
          await bounded(assertAuthAbsent(decision.userId));
          await bounded(db().executeGraphql(purgeAccountErasureMutation, {variables: {uid: decision.userId, generation: decision.generation, version: decision.version, policyVersion: policy.version, hashes: result.hashes, count: result.hashes!.length, completedAt: result.completedAt, profileDeletedAt: result.profileDeletedAt}}));
          summary.disposed++;
          continue;
        }
      }
      summary.deferred++;
    } catch {summary.failed++; reason = "RETRY";}
    // Fairness: a blocked candidate must not starve every later UID. A stale
    // version is harmless: a concurrent lifecycle writer owns its next attempt.
    try {
      if (now() < deadline) await bounded(db().executeGraphql(`mutation DeferErasureDisposal($uid: String!, $generation: UUID!, $version: Int!, $next: Timestamp!, $reason: String!) @transaction {
        ${erasureDisposalFenceWithData("nextAttemptAt: $next, lastReason: $reason")}
      }`, {variables: {uid: decision.userId, generation: decision.generation, version: decision.version, next: new Date(now() + 24 * 60 * 60 * 1000).toISOString(), reason}}));
    } catch { /* Concurrent lifecycle changes safely supersede this attempt. */ }
  }
  return summary;
}
