import {migrationHash, MigrationError} from './authorization-migration-state.mjs';

export const ABORT_ASSERTIONS = Object.freeze([
  'originalFunctionsUnchanged', 'originalSchemaUnchanged', 'originalAuthorizationUnchanged',
  'originalApiRestored', 'originalInvokersRestored', 'originalJobsRestored', 'originalAuthorityRestored',
]);
const assert = (ok, code) => {if (!ok) throw new MigrationError(code, 'Interrupted freeze recovery requires the exact original strict Dev boundary.');};
export const isAbortToolPath = filename => typeof filename === 'string' && (
  /^scripts\/(?:authorization-migration(?:-[a-z0-9-]+)?|check-authorization-migration)(?:\.test)?\.mjs$/.test(filename) ||
  filename === 'docs/operations/authorization-migration-tool.md'
);

/** The source exception belongs only to abort-freeze; normal phases keep exact-SHA checks. */
export function abortSourceProof(originalPlanSha, recoveryToolSha, changedPaths) {
  assert(/^[a-f0-9]{40}$/.test(originalPlanSha ?? '') && /^[a-f0-9]{40}$/.test(recoveryToolSha ?? ''), 'ABORT_SOURCE_INVALID');
  assert(Array.isArray(changedPaths) && changedPaths.length <= 100 && new Set(changedPaths).size === changedPaths.length && changedPaths.every(isAbortToolPath), 'ABORT_APPLICATION_SOURCE_CHANGED');
  const identity = {originalPlanSha, recoveryToolSha, changedPaths: [...changedPaths].sort()};
  return {schemaVersion: 'sodc-authorization-abort-source/v1', ...identity, applicationSourceUnchanged: true, diffHash: migrationHash(identity)};
}
export function validateAbortSource(proof, plan) {
  assert(proof?.schemaVersion === 'sodc-authorization-abort-source/v1' && proof.originalPlanSha === plan.gitSha && proof.applicationSourceUnchanged === true && migrationHash(proof) === migrationHash(abortSourceProof(proof.originalPlanSha, proof.recoveryToolSha, proof.changedPaths)), 'ABORT_SOURCE_INVALID');
  return proof;
}
export function assertAbortScope(run) {
  assert(run.plan.projectId === 'sodc-web' && run.plan.environment === 'dev' && run.plan.installation === 'strict', 'ABORT_STRICT_DEV_ONLY');
  const checkpoints = run.journal.checkpoints;
  assert(checkpoints.inspect?.status === 'complete' && checkpoints.freeze?.status === 'incomplete' && checkpoints.freeze.operationId === run.plan.phaseOperationIds.freeze && Number.isSafeInteger(checkpoints.freeze.attempt) && checkpoints.freeze.attempt > 0 && Object.keys(checkpoints).every(phase => ['inspect', 'freeze'].includes(phase)), 'ABORT_EARLY_FREEZE_ONLY');
  assert(!run.journal.terminal || (run.journal.terminal.status === 'ABORTED' && run.journal.terminal.kind === 'abort-freeze'), 'ABORT_TERMINAL_STATE_INVALID');
}
export function assertAbortEvidence(verification, run, source, now, intentHash) {
  const evidence = verification?.evidence, stamp = Date.parse(evidence?.observedAt);
  assert(verification?.ok === true && evidence?.projectId === run.plan.projectId && evidence.gitSha === run.plan.gitSha && evidence.runId === run.plan.runId && evidence.planHash === run.planHash && evidence.recoveryToolSha === source.recoveryToolSha && evidence.abortIntentHash === intentHash && /^[a-f0-9]{64}$/.test(intentHash ?? '') && Number.isFinite(stamp) && stamp <= now.getTime() + 30_000 && now.getTime() - stamp <= 300_000 && ABORT_ASSERTIONS.every(flag => evidence.assertions?.[flag] === true), 'ABORT_BOUNDARY_NOT_VERIFIED');
  return evidence;
}
