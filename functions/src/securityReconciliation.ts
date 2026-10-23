import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getAdminSafetyControl, listPendingSecurityTransitions, listSecurityStatesForReconciliation } from "./securityRepository";
import { synchronizeUserSecurity } from "./currentAuthorizationTransitions";
import { createReconciliationBatchMetrics, healthySecurityMirrorUserIds } from "./securityReconciliationBatch";
import { FUNCTIONS_REGION } from "./constants";

/** Durable retries never infer a grant from Auth claims or an old profile snapshot. */
export const reconcilePendingSecurityTransitions = onSchedule({region: FUNCTIONS_REGION, schedule: "every 5 minutes", timeoutSeconds: 540, maxInstances: 1}, async () => {
  // Deploying a scheduled function can create its job before operator cutover.
  // Only explicit operator work may synchronize authority during bootstrap.
  const control = (await getAdminSafetyControl()).data.adminSafetyControl;
  if (!control || control.status === "BOOTSTRAP") {
    logger.info("Security reconciliation awaits administrator-safety activation");
    return;
  }
  const startedAt = Date.now();
  let pendingAttempts = 0;
  let stateAttempts = 0;
  let failedAttempts = 0;
  let healthyMirrorChecks = 0;
  const batchMetrics = createReconciliationBatchMetrics();
  let pendingRepairDurationMs = 0;
  let stateRepairAttempts = 0;
  let stateRepairDurationMs = 0;
  let statePageReads = 0;
  let statePageReadDurationMs = 0;
  let statePages = 0;
  let maxStatePageDurationMs = 0;
  const {data} = await listPendingSecurityTransitions({limit: 100});
  for (const transition of data.securityTransitions) {
    pendingAttempts++;
    const repairStartedAt = Date.now();
    try { await synchronizeUserSecurity(transition.operationId); }
    catch { failedAttempts++; logger.warn("Security synchronization remains pending", {operationId: transition.operationId}); }
    finally {pendingRepairDurationMs += Math.max(0, Date.now() - repairStartedAt);}
  }
  for (let offset = 0; ; offset += 500) {
    const pageStartedAt = Date.now();
    statePageReads++;
    const page = (await listSecurityStatesForReconciliation({limit: 500, offset})).data.userSecurityStates;
    statePageReadDurationMs += Math.max(0, Date.now() - pageStartedAt);
    if (page.length) statePages++;
    const healthy = await healthySecurityMirrorUserIds(page, batchMetrics);
    for (const state of page) {
      stateAttempts++;
      if (healthy.has(state.userId)) {healthyMirrorChecks++; continue;}
      stateRepairAttempts++;
      const repairStartedAt = Date.now();
      try {await synchronizeUserSecurity(state.operationId);}
      catch {failedAttempts++; logger.warn("Current security mirror requires recovery", {userId: state.userId});}
      finally {stateRepairDurationMs += Math.max(0, Date.now() - repairStartedAt);}
    }
    if (page.length) maxStatePageDurationMs = Math.max(maxStatePageDurationMs, Date.now() - pageStartedAt);
    if (page.length < 500) break;
  }
  logger.info("Security reconciliation completed", {pendingAttempts, stateAttempts, failedAttempts, healthyMirrorChecks, durationMs: Date.now() - startedAt,
    phaseMetrics: {statePageReads, statePageReadDurationMs, statePages, maxStatePageDurationMs, pendingRepairs: pendingAttempts, pendingRepairDurationMs,
      stateRepairs: stateRepairAttempts, stateRepairDurationMs, ...batchMetrics}});
});
