import * as admin from "firebase-admin";
import * as db from "./securityRepository";
import { isNonRestrictedStatus, type MembershipStatus } from "./validation";

type State = db.ListSecurityStatesForReconciliationData["userSecurityStates"][number];
type Transition = db.ListSecurityTransitionsForReconciliationData["securityTransitions"][number];
export interface ReconciliationBatchMetrics {
  ledgerReads: number;
  ledgerReadDurationMs: number;
  ledgerReadFailures: number;
  authBatchReads: number;
  authBatchReadDurationMs: number;
  authBatchReadFailures: number;
}
export function createReconciliationBatchMetrics(): ReconciliationBatchMetrics {
  return {ledgerReads: 0, ledgerReadDurationMs: 0, ledgerReadFailures: 0, authBatchReads: 0, authBatchReadDurationMs: 0, authBatchReadFailures: 0};
}
const MEMBERSHIP_STATUSES = new Set(["PENDING", "REGULAR", "RESERVE", "RETIRED", "INDUSTRY", "CIVIL_SERVICE", "RESIGNED", "LOST", "DECEASED"]);

function candidate(state: State): boolean {
  return typeof state.userId === "string" && state.userId.length > 0 && typeof state.operationId === "string" && state.operationId.length > 0 &&
    Number.isSafeInteger(state.securityVersion) && state.securityVersion > 0 && state.syncStatus === "READY" &&
    state.desiredAdmin === false && state.adminReady === false && state.verificationEmail == null &&
    typeof state.desiredEnabled === "boolean" && state.accessReady === state.desiredEnabled &&
    MEMBERSHIP_STATUSES.has(state.membershipStatus) && state.user?.membershipStatus === state.membershipStatus &&
    (!state.desiredEnabled || isNonRestrictedStatus(state.membershipStatus as MembershipStatus));
}
function ledgerMatches(state: State, transition: Transition | undefined): boolean {
  return transition !== undefined && transition.operationId === state.operationId && transition.userId === state.userId &&
    transition.securityVersion === state.securityVersion && transition.syncStatus === "READY" && transition.noOp === false &&
    transition.membershipStatus === state.membershipStatus && transition.desiredEnabled === state.desiredEnabled &&
    transition.desiredAdmin === false && transition.verificationEmail == null;
}
function identityMatches(state: State, identity: admin.auth.UserRecord): boolean {
  return identity.uid === state.userId && typeof identity.disabled === "boolean" && typeof identity.emailVerified === "boolean" && (!state.desiredEnabled || (identity.disabled === false && identity.emailVerified === true)) &&
    identity.customClaims?.securityVersion === state.securityVersion && identity.customClaims?.enabled === state.desiredEnabled &&
    identity.customClaims?.admin === false;
}

/** A snapshot can only avoid work. All writes remain behind fresh coordinator reads. */
export async function healthySecurityMirrorUserIds(page: State[], metrics = createReconciliationBatchMetrics()): Promise<Set<string>> {
  const healthy = new Set<string>();
  if (page.length > 500) return healthy;
  // A malformed/duplicated page cannot bind either UID or operation unambiguously.
  const uidCounts = new Map<string, number>();
  const operationCounts = new Map<string, number>();
  for (const state of page) {
    uidCounts.set(state.userId, (uidCounts.get(state.userId) ?? 0) + 1);
    operationCounts.set(state.operationId, (operationCounts.get(state.operationId) ?? 0) + 1);
  }
  const candidates = page.filter(state => candidate(state) && uidCounts.get(state.userId) === 1 && operationCounts.get(state.operationId) === 1);
  if (!candidates.length) return healthy;
  const requestedOperations = new Set(candidates.map(state => state.operationId));
  const ledgers = new Map<string, Transition>();
  const ledgerStartedAt = Date.now();
  metrics.ledgerReads++;
  try {
    const rows = (await db.listSecurityTransitionsForReconciliation({operationIds: [...requestedOperations], limit: candidates.length})).data.securityTransitions;
    for (const row of rows) {
      if (!requestedOperations.has(row.operationId) || ledgers.has(row.operationId)) {metrics.ledgerReadFailures++; return healthy;}
      ledgers.set(row.operationId, row);
    }
  } catch {metrics.ledgerReadFailures++; return healthy;}
  finally {metrics.ledgerReadDurationMs += Math.max(0, Date.now() - ledgerStartedAt);}
  const matched = candidates.filter(state => ledgerMatches(state, ledgers.get(state.operationId)));
  for (let offset = 0; offset < matched.length; offset += 100) {
    const batch = matched.slice(offset, offset + 100);
    const requested = new Set(batch.map(state => state.userId));
    const authStartedAt = Date.now();
    metrics.authBatchReads++;
    try {
      // Firebase Admin gives no result ordering guarantee. Require exact coverage,
      // including explicit notFound entries, before trusting any identity here.
      const result = await admin.auth().getUsers(batch.map(state => ({uid: state.userId})));
      const found = new Map<string, admin.auth.UserRecord>();
      const covered = new Set<string>();
      let valid = Array.isArray(result.users) && Array.isArray(result.notFound);
      if (!valid) {metrics.authBatchReadFailures++; continue;}
      for (const identity of result.users) {
        if (!requested.has(identity.uid) || covered.has(identity.uid)) {valid = false; break;}
        covered.add(identity.uid); found.set(identity.uid, identity);
      }
      for (const identifier of result.notFound) {
        if (!("uid" in identifier) || Object.keys(identifier).length !== 1 || !requested.has(identifier.uid) || covered.has(identifier.uid)) {valid = false; break;}
        covered.add(identifier.uid);
      }
      if (!valid || covered.size !== requested.size) {metrics.authBatchReadFailures++; continue;}
      for (const state of batch) {
        const identity = found.get(state.userId);
        if (identity && identityMatches(state, identity)) healthy.add(state.userId);
      }
    } catch {
      metrics.authBatchReadFailures++;
      // One batch failure does not abandon other records. The caller repairs
      // these members serially with fresh state/ledger/Auth reads instead.
    } finally {metrics.authBatchReadDurationMs += Math.max(0, Date.now() - authStartedAt);}
  }
  return healthy;
}
