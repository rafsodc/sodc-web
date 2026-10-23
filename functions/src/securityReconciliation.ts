import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getAdminSafetyControl, listPendingSecurityTransitions, listSecurityStatesForReconciliation } from "./securityRepository";
import { synchronizeUserSecurity } from "./currentAuthorizationTransitions";
import { healthySecurityMirrorUserIds } from "./securityReconciliationBatch";
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
  const {data} = await listPendingSecurityTransitions({limit: 100});
  for (const transition of data.securityTransitions) {
    pendingAttempts++;
    try { await synchronizeUserSecurity(transition.operationId); }
    catch { failedAttempts++; logger.warn("Security synchronization remains pending", {operationId: transition.operationId}); }
  }
  for (let offset = 0; ; offset += 500) {
    const page = (await listSecurityStatesForReconciliation({limit: 500, offset})).data.userSecurityStates;
    const healthy = await healthySecurityMirrorUserIds(page);
    for (const state of page) {
      stateAttempts++;
      if (healthy.has(state.userId)) {healthyMirrorChecks++; continue;}
      try {await synchronizeUserSecurity(state.operationId);}
      catch {failedAttempts++; logger.warn("Current security mirror requires recovery", {userId: state.userId});}
    }
    if (page.length < 500) break;
  }
  logger.info("Security reconciliation completed", {pendingAttempts, stateAttempts, failedAttempts, healthyMirrorChecks, durationMs: Date.now() - startedAt});
});
