import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { listPendingSecurityTransitions, listSecurityStatesForReconciliation } from "./securityRepository";
import { synchronizeUserSecurity } from "./currentAuthorizationTransitions";
import { FUNCTIONS_REGION } from "./constants";

/** Durable retries never infer a grant from Auth claims or an old profile snapshot. */
export const reconcilePendingSecurityTransitions = onSchedule({region: FUNCTIONS_REGION, schedule: "every 5 minutes", timeoutSeconds: 540, maxInstances: 1}, async () => {
  const {data} = await listPendingSecurityTransitions({limit: 100});
  for (const transition of data.securityTransitions) {
    try { await synchronizeUserSecurity(transition.operationId); }
    catch { logger.warn("Security synchronization remains pending", {operationId: transition.operationId}); }
  }
  for (let offset = 0; ; offset += 500) {
    const page = (await listSecurityStatesForReconciliation({limit: 500, offset})).data.userSecurityStates;
    for (const state of page) {
      try {await synchronizeUserSecurity(state.operationId);}
      catch {logger.warn("Current security mirror requires recovery", {userId: state.userId});}
    }
    if (page.length < 500) break;
  }
});
