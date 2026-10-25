import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {readFile, lstat, readdir} from 'node:fs/promises';
import path from 'node:path';
import {MigrationError, migrationHash, assertNoCredentials, phasesFor, PHASE_ASSERTIONS} from './authorization-migration-state.mjs';

const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const FILE = 'tool-source-amendment.json';
export const MAX_TOOL_SOURCE_AMENDMENTS = 8;
const RECORDS = ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json', 'provider-old-writers-proof.json', 'provider-old-writers-observed.json'];
const FINISH_PATHS = new Set(['scripts/authorization-migration-cloud.mjs', 'scripts/authorization-migration-cloud.test.mjs', 'scripts/authorization-migration-tool-source.mjs', 'scripts/authorization-migration-tool-source.test.mjs', 'scripts/authorization-migration.mjs', 'scripts/authorization-migration-tool-cli.test.mjs', 'docs/operations/authorization-migration-tool.md']);
const GATES = ['backup', 'freeze-scope', 'old-writers', 'sql-review', 'acceptance'];
const gatePattern = /^gates\/(backup|freeze-scope|old-writers|sql-review|acceptance)-([a-f0-9]{64})\.json$/;
const schedulerPattern = /^scheduler-firebase-schedule-(recoverNotificationDeliveries|reconcilePendingSecurityTransitions)-europe-west2\.json$/;
const assert = (ok, code) => {if (!ok) throw new MigrationError(code, 'Tool-source adoption requires the reviewed, unchanged application and original migration run and explicitly supported recovery boundary.');};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
const same = (a, b) => migrationHash(a) === migrationHash(b);
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)) && allowed.every(key => Object.hasOwn(value, key));
const execute = promisify(execFile);
async function gitDefault(args, {cwd}) {
  try {return (await execute('git', args, {cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000, shell: false})).stdout;}
  catch {throw new MigrationError('SOURCE_INSPECTION_FAILED', 'Could not inspect the reviewed source tree.');}
}
export const isMigrationToolSourcePath = name => typeof name === 'string' && (
  /^scripts\/(?:authorization-migration(?:-[a-z0-9-]+)?|check-authorization-migration)(?:\.test)?\.mjs$/.test(name) ||
  name === 'docs/operations/authorization-migration-tool.md'
);

export function parseToolSourceDiff(raw) {
  assert(typeof raw === 'string' && raw.endsWith('\0'), 'TOOL_SOURCE_DIFF_INVALID');
  const parts = raw.split('\0'); parts.pop();
  assert(parts.length > 0 && parts.length <= 200 && parts.length % 2 === 0, 'TOOL_SOURCE_DIFF_INVALID');
  const changes = [];
  for (let index = 0; index < parts.length; index += 2) {
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([AM])$/.exec(parts[index]);
    const name = parts[index + 1];
    assert(match && isMigrationToolSourcePath(name), 'TOOL_APPLICATION_SOURCE_CHANGED');
    const [, oldMode, newMode, oldBlob, newBlob, status] = match;
    assert(['100644', '100755'].includes(newMode) && newBlob !== '0'.repeat(40) &&
      (status === 'A' ? oldMode === '000000' && oldBlob === '0'.repeat(40) : oldMode === newMode && oldBlob !== '0'.repeat(40)), 'TOOL_SOURCE_MODE_OR_TYPE_CHANGED');
    assert(!changes.some(row => row.path === name), 'TOOL_SOURCE_DIFF_INVALID');
    changes.push({path: name, status, oldMode, newMode, oldBlob, newBlob});
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}
async function cleanHead(repositoryRoot, git, expected) {
  const head = (await git(['rev-parse', 'HEAD'], {cwd: repositoryRoot})).trim();
  assert(SHA.test(head), 'REVISION_REQUIRED');
  assert(expected === undefined || head === expected, 'REVISION_CHANGED');
  const status = await git(['status', '--porcelain', '--untracked-files=all'], {cwd: repositoryRoot});
  assert(!status.trim(), 'CHECKOUT_DIRTY');
  return head;
}
async function inspectCommittedDiff(repositoryRoot, originalPlanSha, toolSha, git) {
  assert(SHA.test(originalPlanSha ?? '') && SHA.test(toolSha ?? '') && originalPlanSha !== toolSha, 'TOOL_SOURCE_INVALID');
  try {await git(['merge-base', '--is-ancestor', originalPlanSha, toolSha], {cwd: repositoryRoot});}
  catch {throw new MigrationError('TOOL_SOURCE_NOT_DESCENDANT', 'The reviewed tool revision must descend from the immutable plan revision.');}
  const flags = ['--no-renames', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none'];
  const raw = await git(['diff', '--raw', '--no-abbrev', '--full-index', '-z', ...flags, originalPlanSha, toolSha, '--'], {cwd: repositoryRoot});
  const changes = parseToolSourceDiff(raw);
  const patch = await git(['diff', '--binary', '--full-index', '--no-color', '--diff-algorithm=myers', '--no-indent-heuristic', '--unified=3', '--src-prefix=a/', '--dst-prefix=b/', ...flags, originalPlanSha, toolSha, '--'], {cwd: repositoryRoot});
  assert(typeof patch === 'string' && patch.length > 0 && Buffer.byteLength(patch) <= 8 * 1024 * 1024, 'TOOL_SOURCE_DIFF_INVALID');
  return {schemaVersion: 'sodc-authorization-tool-source-proof/v1', originalPlanSha, toolSha, applicationSourceUnchanged: true, changes, rawDiffSha256: digest(raw), patchSha256: digest(patch)};
}
export async function inspectMigrationToolSource(repositoryRoot, originalPlanSha, toolSha, git = gitDefault) {
  await cleanHead(repositoryRoot, git, toolSha);
  const proof = await inspectCommittedDiff(repositoryRoot, originalPlanSha, toolSha, git);
  await cleanHead(repositoryRoot, git, toolSha);
  return proof;
}
async function regularBytes(file) {
  const info = await lstat(file);
  assert(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0, 'TOOL_SOURCE_RECORD_UNSAFE');
  return readFile(file);
}
async function optional(file) {
  try {return await regularBytes(file);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
function strictDev(run) {assert(run.plan.projectId === 'sodc-web' && run.plan.environment === 'dev' && run.plan.installation === 'strict', 'TOOL_SOURCE_STRICT_DEV_ONLY');}
function legacyProduction(run) {assert(run.plan.projectId === 'sodc-web-production' && run.plan.environment === 'prod' && run.plan.installation === 'legacy', 'TOOL_SOURCE_PRODUCTION_LEGACY_ONLY');}
const evidencePattern = /^evidence\/(inspect|freeze|schema|compatibility|control-create|backfill|functions|activate|strict-api)-([a-f0-9]{64})\.json$/;
const providerPattern = /^provider-phase-(inspect|freeze|schema|compatibility|control-create|backfill|functions|activate|strict-api)\.json$/;
async function completedEvidence(run, selectedPhases) {
  const files = [];
  for (const [phase, checkpoint] of Object.entries(run.journal.checkpoints)) {
    if (checkpoint.status !== 'complete' || selectedPhases && !selectedPhases.includes(phase)) continue;
    assert(evidencePattern.test(checkpoint.evidenceFile ?? '') && checkpoint.evidenceFile === 'evidence/' + phase + '-' + checkpoint.evidenceHash + '.json', 'TOOL_SOURCE_COMPLETED_EVIDENCE_INVALID');
    const record = JSON.parse(await regularBytes(path.join(run.directory, checkpoint.evidenceFile)));
    const proof = record.evidence;
    assert(migrationHash(record) === checkpoint.evidenceHash && record.phase === phase && record.planHash === run.planHash &&
      checkpoint.operationId === run.plan.phaseOperationIds[phase] && record.operationId === checkpoint.operationId &&
      same(record.result, checkpoint.result) &&
      proof?.projectId === run.plan.projectId && proof.gitSha === run.plan.gitSha && proof.runId === run.plan.runId && proof.planHash === run.planHash &&
      PHASE_ASSERTIONS[phase]?.every(flag => proof.assertions?.[flag] === true), 'TOOL_SOURCE_COMPLETED_EVIDENCE_INVALID');
    files.push(checkpoint.evidenceFile);
  }
  return files;
}
async function completionFiles(run) {
  const gateNames = (await readdir(path.join(run.directory, 'gates'))).map(name => 'gates/' + name).sort();
  assert(gateNames.length >= GATES.length && gateNames.length <= 32 && gateNames.every(name => gatePattern.test(name)), 'TOOL_SOURCE_COMPLETION_GATES_INVALID');
  const schedulers = (await readdir(run.directory)).filter(name => name.startsWith('scheduler-')).sort();
  assert(schedulers.length === 2 && schedulers.every(name => schedulerPattern.test(name)), 'TOOL_SOURCE_COMPLETION_SCHEDULERS_INVALID');
  return ['provider-phase-open.json', ...gateNames, ...schedulers];
}
function openRecordBinding(run, record) {
  const checkpoint = run.journal.checkpoints.open;
  assert(record?.projectId === run.plan.projectId && record.gitSha === run.plan.gitSha && record.runId === run.plan.runId && record.planHash === run.planHash && record.phase === 'open' &&
    record.openingStarted === true && record.apiOpening === true && Number.isFinite(Date.parse(record.startedAt)) && Number.isFinite(Date.parse(record.completedAt)) && Date.parse(record.completedAt) >= Date.parse(record.startedAt) &&
    checkpoint?.operationId === run.plan.phaseOperationIds.open && ['incomplete', 'complete'].includes(checkpoint.status) && same(record, checkpoint.result), 'TOOL_SOURCE_COMPLETED_OPEN_REQUIRED');
}
async function verifyCompletionBindings(run, value) {
  const binding = value.completionBindings, prior = phasesFor(run.plan).slice(0, phasesFor(run.plan).indexOf('open'));
  for (const name of (await readdir(run.directory)).filter(name => name.startsWith('provider-phase-'))) {
    const match = /^provider-phase-(inspect|freeze|schema|control-create|backfill|functions|activate|strict-api|open|receipt)\.json$/.exec(name);
    assert(match, 'TOOL_SOURCE_LATER_PHASE_PRESENT');
    const record = JSON.parse(await regularBytes(path.join(run.directory, name)));
    assert(record.projectId === run.plan.projectId && record.gitSha === run.plan.gitSha && record.runId === run.plan.runId && record.planHash === run.planHash && record.phase === match[1], 'TOOL_SOURCE_PROVIDER_RECORD_INVALID');
  }
  assert(keys(binding, ['gateEntriesHash', 'priorCheckpointHashes', 'files']) && HASH.test(binding.gateEntriesHash) && same(Object.keys(binding.priorCheckpointHashes ?? {}).sort(), [...prior].sort()) &&
    prior.every(name => HASH.test(binding.priorCheckpointHashes[name]) && migrationHash(run.journal.checkpoints[name]) === binding.priorCheckpointHashes[name]) && migrationHash(run.journal.gates) === binding.gateEntriesHash, 'TOOL_SOURCE_COMPLETION_BINDING_CHANGED');
  assert(Array.isArray(binding.files) && same(binding.files.map(row => row.name).sort(), (await completionFiles(run)).sort()), 'TOOL_SOURCE_COMPLETION_BINDING_CHANGED');
  for (const row of binding.files) {
    assert(keys(row, ['name', 'sha256', 'archive']) && HASH.test(row.sha256) && row.archive === 'evidence/tool-source-before-' + row.sha256 + '.json', 'TOOL_SOURCE_COMPLETION_BINDING_CHANGED');
    assert(digest(await regularBytes(path.join(run.directory, row.archive))) === row.sha256 && digest(await regularBytes(path.join(run.directory, row.name))) === row.sha256, 'TOOL_SOURCE_COMPLETION_BINDING_CHANGED');
  }
  openRecordBinding(run, JSON.parse(await regularBytes(path.join(run.directory, 'provider-phase-open.json'))));
}

const productionOpenKeys = ['projectId', 'gitSha', 'runId', 'planHash', 'phase', 'startedAt', 'completedAt', 'openingStarted'];
const deferredNames = ['getMyAuthorizationStatus', 'reconcilePendingSecurityTransitions'];
function productionFailedCheckpoint(run, checkpoint) {
  assert(keys(checkpoint, ['status', 'operationId', 'attempt', 'startedAt', 'lastError']) && checkpoint.status === 'incomplete' && checkpoint.lastError === 'SCHEDULER_TARGET_NOT_VERIFIED' && checkpoint.operationId === run.plan.phaseOperationIds.open &&
    Number.isSafeInteger(checkpoint.attempt) && checkpoint.attempt > 0 && Number.isFinite(Date.parse(checkpoint.startedAt)) && !Object.hasOwn(checkpoint, 'result'), 'TOOL_SOURCE_PRODUCTION_FAILURE_REQUIRED');
}
function productionOpenRecord(run, record, initial) {
  const allowed = [...productionOpenKeys, ...(initial ? [] : ['deferredProofs', 'deferredSchedulerIntents', 'apiOpening'])];
  assert(record && Object.keys(record).every(key => allowed.includes(key)) && productionOpenKeys.every(key => Object.hasOwn(record, key)) &&
    record.projectId === run.plan.projectId && record.gitSha === run.plan.gitSha && record.runId === run.plan.runId && record.planHash === run.planHash && record.phase === 'open' &&
    Number.isFinite(Date.parse(record.startedAt)) && record.openingStarted === true && (record.completedAt === null || !initial && Number.isFinite(Date.parse(record.completedAt)) && Date.parse(record.completedAt) >= Date.parse(record.startedAt)), 'TOOL_SOURCE_PRODUCTION_OPEN_BOUNDARY_INVALID');
  if (initial) assert(record.completedAt === null, 'TOOL_SOURCE_PRODUCTION_OPEN_BOUNDARY_INVALID');
  else {
    assert(record.apiOpening === undefined || record.apiOpening === true, 'TOOL_SOURCE_PRODUCTION_OPEN_BOUNDARY_INVALID');
    if (record.deferredProofs !== undefined) assert(Array.isArray(record.deferredProofs) && record.deferredProofs.length === 2 && same(record.deferredProofs.map(row => row.name).sort(), [...deferredNames].sort()), 'TOOL_SOURCE_PRODUCTION_OPEN_BOUNDARY_INVALID');
    if (record.deferredSchedulerIntents !== undefined) assert(Array.isArray(record.deferredSchedulerIntents) && record.deferredSchedulerIntents.length === 1 &&
      record.deferredSchedulerIntents[0].name === `projects/${run.plan.projectId}/locations/europe-west2/jobs/firebase-schedule-reconcilePendingSecurityTransitions-europe-west2` && HASH.test(record.deferredSchedulerIntents[0].specHash ?? ''), 'TOOL_SOURCE_PRODUCTION_OPEN_BOUNDARY_INVALID');
    if (record.apiOpening || record.completedAt !== null) assert(record.apiOpening === true && record.deferredProofs?.length === 2 && record.deferredSchedulerIntents?.length === 1, 'TOOL_SOURCE_PRODUCTION_OPEN_BOUNDARY_INVALID');
  }
}
async function productionPinnedFiles(run) {
  const prior = phasesFor(run.plan).slice(0, phasesFor(run.plan).indexOf('open'));
  const names = await completionFiles(run), files = [...names.filter(name => name !== 'provider-phase-open.json'), ...await completedEvidence(run, prior)];
  for (const name of (await readdir(run.directory)).filter(name => name.startsWith('provider-phase-'))) {
    const phase = /^provider-phase-(inspect|freeze|schema|compatibility|control-create|backfill|functions|activate|strict-api|open|receipt)\.json$/.exec(name)?.[1];
    assert(phase, 'TOOL_SOURCE_LATER_PHASE_PRESENT');
    const record = JSON.parse(await regularBytes(path.join(run.directory, name)));
    assert(record.projectId === run.plan.projectId && record.gitSha === run.plan.gitSha && record.runId === run.plan.runId && record.planHash === run.planHash && record.phase === phase, 'TOOL_SOURCE_PROVIDER_RECORD_INVALID');
    if (prior.includes(phase)) {assert(same(record, run.journal.checkpoints[phase]?.result), 'TOOL_SOURCE_COMPLETED_EVIDENCE_INVALID'); files.push(name);}
  }
  return [...new Set(files)].sort();
}
async function verifyProductionRecoveryBindings(run, value) {
  legacyProduction(run);
  const b = value.productionRecoveryBindings, prior = phasesFor(run.plan).slice(0, phasesFor(run.plan).indexOf('open'));
  assert(keys(b, ['gateEntriesHash', 'priorCheckpointHashes', 'failedCheckpointHash', 'failedOpenFileHash', 'historyFileHashes', 'files']) && HASH.test(b.gateEntriesHash) && HASH.test(b.failedCheckpointHash) && HASH.test(b.failedOpenFileHash) &&
    same(Object.keys(b.priorCheckpointHashes ?? {}).sort(), [...prior].sort()) && prior.every(name => HASH.test(b.priorCheckpointHashes[name]) && migrationHash(run.journal.checkpoints[name]) === b.priorCheckpointHashes[name]) &&
    migrationHash(run.journal.gates) === b.gateEntriesHash && !run.journal.terminal && !run.journal.abortFreeze && !await optional(path.join(run.directory, 'abort-freeze-intent.json')), 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  assert(b.historyFileHashes && same(Object.keys(b.historyFileHashes).sort(), value.history.map(row => row.name).sort()) && value.history.every(row => HASH.test(b.historyFileHashes[row.name]) && row.sha256 === b.historyFileHashes[row.name]), 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  assert(Array.isArray(b.files) && same(b.files.map(row => row.name).sort(), await productionPinnedFiles(run)), 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  for (const row of b.files) assert(keys(row, ['name', 'sha256', 'archive']) && HASH.test(row.sha256) && row.archive === 'evidence/tool-source-before-' + row.sha256 + '.json' &&
    digest(await regularBytes(path.join(run.directory, row.archive))) === row.sha256 && digest(await regularBytes(path.join(run.directory, row.name))) === row.sha256, 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  const archived = name => value.history.find(row => row.name === name);
  const initialOpen = JSON.parse(await regularBytes(path.join(run.directory, archived('provider-phase-open.json')?.archive ?? 'INVALID')));
  productionOpenRecord(run, initialOpen, true); assert(digest(await regularBytes(path.join(run.directory, archived('provider-phase-open.json').archive))) === b.failedOpenFileHash, 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  const originalJournal = JSON.parse(await regularBytes(path.join(run.directory, archived('journal.json').archive)));
  productionFailedCheckpoint(run, originalJournal.checkpoints?.open);
  assert(migrationHash(originalJournal.checkpoints.open) === b.failedCheckpointHash && migrationHash(originalJournal.gates) === b.gateEntriesHash && prior.every(name => migrationHash(originalJournal.checkpoints[name]) === b.priorCheckpointHashes[name]), 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  const current = JSON.parse(await regularBytes(path.join(run.directory, 'provider-phase-open.json'))); productionOpenRecord(run, current, false);
  assert(productionOpenKeys.filter(key => key !== 'completedAt').every(key => same(current[key], initialOpen[key])) &&
    Object.keys(run.journal.checkpoints).every(name => [...prior, 'open', 'receipt'].includes(name)) && run.journal.checkpoints.open?.operationId === run.plan.phaseOperationIds.open && ['incomplete', 'complete'].includes(run.journal.checkpoints.open.status) && Number.isSafeInteger(run.journal.checkpoints.open.attempt) && run.journal.checkpoints.open.attempt > 0, 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  const receipt = run.journal.checkpoints.receipt;
  if (receipt) assert(run.journal.checkpoints.open.status === 'complete' && receipt.operationId === run.plan.phaseOperationIds.receipt && ['incomplete', 'complete'].includes(receipt.status), 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
  if (run.journal.checkpoints.open.result !== undefined) assert(same(run.journal.checkpoints.open.result, current), 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED');
}

function amendment(record, run, previous) {
  assert(keys(record, ['amendment', 'amendmentHash']) && HASH.test(record.amendmentHash ?? '') && migrationHash(record.amendment) === record.amendmentHash, 'TOOL_SOURCE_AMENDMENT_INVALID');
  const value = record.amendment;
  const fields = ['schemaVersion', 'projectId', 'gitSha', 'runId', 'planHash', 'toolSha', 'reviewReference', 'reason', 'adoptedAt', 'sourceProof', 'freezeStateHash', 'inventoryHash', 'history'];
  const completion = value.schemaVersion === 'sodc-authorization-tool-source-amendment/v3', production = value.schemaVersion === 'sodc-authorization-tool-source-amendment/v4';
  if (previous) fields.push('previousAmendmentHash', 'interruptedPhase');
  if (completion) fields.push('completionKind', 'completionBindings', 'completionDeltaProof');
  if (production) fields.push('recoveryKind', 'productionRecoveryBindings', 'interruptedPhase');
  assert(keys(value, fields) && value.schemaVersion === 'sodc-authorization-tool-source-amendment/v' + (production ? '4' : completion ? '3' : previous ? '2' : '1') && (!completion || previous && value.completionKind === 'completed-open-verifier') && (!production || !previous && value.recoveryKind === 'production-pre-api-open-scheduler-target' && value.interruptedPhase === 'open') && value.projectId === run.plan.projectId && value.gitSha === run.plan.gitSha && value.runId === run.plan.runId && value.planHash === run.planHash &&
    SHA.test(value.toolSha ?? '') && value.toolSha !== value.gitSha && text(value.reviewReference) && text(value.reason) && Number.isFinite(Date.parse(value.adoptedAt)) && HASH.test(value.freezeStateHash ?? '') && HASH.test(value.inventoryHash ?? ''), 'TOOL_SOURCE_AMENDMENT_INVALID');
  if (previous) assert(!['sodc-authorization-tool-source-amendment/v3', 'sodc-authorization-tool-source-amendment/v4'].includes(previous.amendment.schemaVersion) && value.previousAmendmentHash === previous.amendmentHash && (completion ? value.interruptedPhase === 'open' : ['schema', 'compatibility', 'control-create', 'backfill', 'functions', 'activate', 'strict-api'].includes(value.interruptedPhase)) &&
    value.freezeStateHash === previous.amendment.freezeStateHash && value.inventoryHash === previous.amendment.inventoryHash && value.toolSha !== previous.amendment.toolSha, 'TOOL_SOURCE_CHAIN_INVALID');
  if (production) legacyProduction(run); else strictDev(run); assertNoCredentials(record); return value;
}
async function verifyHistory(run, rows) {
  assert(Array.isArray(rows) && rows.length >= 4 && rows.length <= 64 && new Set(rows.map(row => row.name)).size === rows.length &&
    ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json'].every(name => rows.some(row => row.name === name)), 'TOOL_SOURCE_HISTORY_INVALID');
  for (const row of rows) {
    assert(keys(row, ['name', 'sha256', 'archive']) && (RECORDS.includes(row.name) || providerPattern.test(row.name) || evidencePattern.test(row.name) || row.name === 'provider-phase-open.json' || gatePattern.test(row.name) || schedulerPattern.test(row.name)) && HASH.test(row.sha256 ?? '') && row.archive === 'evidence/tool-source-before-' + row.sha256 + '.json', 'TOOL_SOURCE_HISTORY_INVALID');
    assert(digest(await regularBytes(path.join(run.directory, row.archive))) === row.sha256, 'TOOL_SOURCE_HISTORY_CHANGED');
    if (evidencePattern.test(row.name)) assert(digest(await regularBytes(path.join(run.directory, row.name))) === row.sha256, 'TOOL_SOURCE_COMPLETED_EVIDENCE_CHANGED');
  }
}
async function chain(run) {
  const files = await readdir(run.directory), children = files.filter(name => /^tool-source-amendment-.*\.json$/.test(name));
  const result = []; let name = FILE, previous;
  while (true) {
    const bytes = await optional(path.join(run.directory, name)); if (!bytes) break;
    assert(result.length < MAX_TOOL_SOURCE_AMENDMENTS, 'TOOL_SOURCE_CHAIN_LIMIT');
    const record = JSON.parse(bytes); amendment(record, run, previous);
    assert(!result.some(row => row.record.amendmentHash === record.amendmentHash), 'TOOL_SOURCE_CHAIN_INVALID');
    result.push({name, record}); previous = record; name = 'tool-source-amendment-' + record.amendmentHash + '.json';
  }
  assert(children.every(file => result.some(row => row.name === file)), 'TOOL_SOURCE_CHAIN_ORPHAN');
  return result;
}
async function verifyChain(run, records, repositoryRoot, git) {
  let previous;
  for (const {record} of records) {
    const value = amendment(record, run, previous);
    const source = await inspectCommittedDiff(repositoryRoot, run.plan.gitSha, value.toolSha, git);
    assert(same(source, value.sourceProof), 'TOOL_SOURCE_DIFF_CHANGED');
    if (previous) {
      try {await git(['merge-base', '--is-ancestor', previous.amendment.toolSha, value.toolSha], {cwd: repositoryRoot});}
      catch {throw new MigrationError('TOOL_SOURCE_NOT_DESCENDANT', 'Successor tooling must descend from the previously reviewed tool commit.');}
    }
    await verifyHistory(run, value.history);
    if (value.schemaVersion === 'sodc-authorization-tool-source-amendment/v3') {
      const delta = await inspectCommittedDiff(repositoryRoot, previous.amendment.toolSha, value.toolSha, git);
      assert(same(delta, value.completionDeltaProof) && delta.changes.every(change => FINISH_PATHS.has(change.path) && change.status === 'M'), 'TOOL_SOURCE_COMPLETION_DELTA_INVALID');
      await verifyCompletionBindings(run, value);
    }
    if (value.schemaVersion === 'sodc-authorization-tool-source-amendment/v4') {
      assert(source.changes.every(change => FINISH_PATHS.has(change.path) && change.status === 'M'), 'TOOL_SOURCE_PRODUCTION_DELTA_INVALID');
      await verifyProductionRecoveryBindings(run, value);
    }
    const freeze = JSON.parse(await regularBytes(path.join(run.directory, 'provider-freeze.json'))), inventory = JSON.parse(await regularBytes(path.join(run.directory, 'provider-old-writer-inventory.json')));
    assert(migrationHash(freeze) === value.freezeStateHash && inventory.inventoryHash === value.inventoryHash && migrationHash(inventory.inventory) === value.inventoryHash && same(freeze.oldWriterInventory, inventory.inventory), 'TOOL_SOURCE_FREEZE_BINDING_INVALID');
    for (const file of ['plan.json', 'provider-freeze.json', 'provider-old-writer-inventory.json']) assert(digest(await regularBytes(path.join(run.directory, file))) === value.history.find(row => row.name === file).sha256, 'TOOL_SOURCE_FREEZE_BINDING_INVALID');
    previous = record;
  }
}

/** Every ordinary phase rechecks the exact adopted tool commit and full original-to-tool diff. */
export async function verifyMigrationToolSource(run, {repositoryRoot, git = gitDefault} = {}) {
  const records = await chain(run);
  if (!records.length) {await cleanHead(repositoryRoot, git, run.plan.gitSha); return {originalPlanSha: run.plan.gitSha, toolSha: run.plan.gitSha, amendmentHash: null};}
  const record = records.at(-1).record, value = record.amendment;
  await cleanHead(repositoryRoot, git, value.toolSha);
  await verifyChain(run, records, repositoryRoot, git);
  await cleanHead(repositoryRoot, git, value.toolSha);
  return {originalPlanSha: run.plan.gitSha, toolSha: value.toolSha, amendmentHash: record.amendmentHash};
}
