import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash, randomUUID} from 'node:crypto';
import {open, readFile, lstat, unlink, readdir, link} from 'node:fs/promises';
import {hostname} from 'node:os';
import path from 'node:path';
import {MigrationError, migrationHash, assertNoCredentials, loadMigrationRun, phasesFor, PHASE_ASSERTIONS, validateMigrationGate} from './authorization-migration-state.mjs';

const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const FILE = 'tool-source-amendment.json';
export const MAX_TOOL_SOURCE_AMENDMENTS = 8;
const RECORDS = ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json', 'provider-old-writers-proof.json', 'provider-old-writers-observed.json'];
const FINISH_PATHS = new Set(['scripts/authorization-migration-cloud.mjs', 'scripts/authorization-migration-cloud.test.mjs', 'scripts/authorization-migration-tool-source.mjs', 'scripts/authorization-migration-tool-source.test.mjs', 'scripts/authorization-migration.mjs', 'scripts/authorization-migration-tool-cli.test.mjs', 'docs/operations/authorization-migration-tool.md']);
const GATES = ['backup', 'freeze-scope', 'old-writers', 'sql-review', 'acceptance'];
const gatePattern = /^gates\/(backup|freeze-scope|old-writers|sql-review|acceptance)-([a-f0-9]{64})\.json$/;
const schedulerPattern = /^scheduler-firebase-schedule-(recoverNotificationDeliveries|reconcilePendingSecurityTransitions)-europe-west2\.json$/;
const assert = (ok, code) => {if (!ok) throw new MigrationError(code, 'Tool-source adoption requires the reviewed, unchanged application and original strict Dev run.');};
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
async function syncDirectory(directory) {const handle = await open(directory, 'r'); try {await handle.sync();} finally {await handle.close();}}
async function immutable(file, bytes) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  const handle = await open(temporary, 'wx', 0o600);
  try {await handle.writeFile(bytes); await handle.sync();} finally {await handle.close();}
  // Publish a complete synced inode without replacing an existing amendment.
  await link(temporary, file);
  await syncDirectory(path.dirname(file));
  await unlink(temporary); await syncDirectory(path.dirname(file));
}
async function lock(file, run, work) {
  const nonce = randomUUID(); let handle;
  try {handle = await open(file, 'wx', 0o600);} catch (error) {if (error.code === 'EEXIST') throw new MigrationError('TOOL_SOURCE_LOCKED', 'Another migration operation owns this project or run.'); throw error;}
  try {
    await handle.writeFile(JSON.stringify({pid: process.pid, hostname: hostname(), runId: run.plan.runId, planHash: run.planHash, purpose: 'adopt-tool-source', nonce}));
    await handle.sync(); await syncDirectory(path.dirname(file));
    return await work();
  } finally {
    const owned = await handle.stat(); await handle.close();
    const current = await lstat(file), value = JSON.parse(await regularBytes(file));
    assert(current.dev === owned.dev && current.ino === owned.ino && value.nonce === nonce, 'TOOL_SOURCE_LOCK_REPLACED');
    await unlink(file); await syncDirectory(path.dirname(file));
  }
}
function strictDev(run) {assert(run.plan.projectId === 'sodc-web' && run.plan.environment === 'dev' && run.plan.installation === 'strict', 'TOOL_SOURCE_STRICT_DEV_ONLY');}
async function frozenBoundary(run) {
  strictDev(run);
  assert(!run.journal.terminal && !run.journal.abortFreeze, 'TOOL_SOURCE_EARLY_FREEZE_ONLY');
  assert(!await optional(path.join(run.directory, 'abort-freeze-intent.json')), 'TOOL_SOURCE_ABORTING');
  const owner = JSON.parse(await regularBytes(path.join(path.dirname(run.directory), 'active-run.json')));
  assert(owner.planHash === run.planHash && owner.runId === run.plan.runId && owner.status === 'active', 'TOOL_SOURCE_OWNER_MISMATCH');
  const freeze = JSON.parse(await regularBytes(path.join(run.directory, 'provider-freeze.json')));
  const inventoryRecord = JSON.parse(await regularBytes(path.join(run.directory, 'provider-old-writer-inventory.json'))), inventory = inventoryRecord.inventory;
  assert(freeze.projectId === run.plan.projectId && freeze.gitSha === run.plan.gitSha && freeze.runId === run.plan.runId && freeze.planHash === run.planHash &&
    Number.isFinite(Date.parse(freeze.completedAt)) && freeze.oldWriterInventory?.projectId === run.plan.projectId &&
    inventoryRecord.projectId === run.plan.projectId && inventoryRecord.gitSha === run.plan.gitSha && inventoryRecord.runId === run.plan.runId && inventoryRecord.planHash === run.planHash &&
    same(inventory, freeze.oldWriterInventory) && inventoryRecord.inventoryHash === migrationHash(inventory) &&
    run.journal.checkpoints.freeze.result?.stateHash === migrationHash(freeze), 'TOOL_SOURCE_FREEZE_BINDING_INVALID');
  return {freezeStateHash: migrationHash(freeze), inventoryHash: migrationHash(inventory)};
}
async function adoptionScope(run) {
  strictDev(run);
  const c = run.journal.checkpoints;
  assert(!run.journal.terminal && !run.journal.abortFreeze && c.inspect?.status === 'complete' && c.freeze?.status === 'incomplete' &&
    c.freeze.operationId === run.plan.phaseOperationIds.freeze && Number.isSafeInteger(c.freeze.attempt) && c.freeze.attempt > 0 &&
    Object.keys(c).every(name => ['inspect', 'freeze'].includes(name)), 'TOOL_SOURCE_EARLY_FREEZE_ONLY');
  assert((await readdir(run.directory)).every(name => !/^provider-phase-(?!inspect\.json$|freeze\.json$).+\.json$/.test(name)), 'TOOL_SOURCE_LATER_PHASE_PRESENT');
  return frozenBoundary(run);
}
const evidencePattern = /^evidence\/(inspect|freeze|schema|compatibility|control-create|backfill|functions|activate|strict-api)-([a-f0-9]{64})\.json$/;
const providerPattern = /^provider-phase-(inspect|freeze|schema|compatibility|control-create|backfill|functions|activate|strict-api)\.json$/;
async function completedEvidence(run) {
  const files = [];
  for (const [phase, checkpoint] of Object.entries(run.journal.checkpoints)) {
    if (checkpoint.status !== 'complete') continue;
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
async function successorScope(run) {
  strictDev(run);
  const sequence = phasesFor(run.plan), c = run.journal.checkpoints;
  const incomplete = Object.keys(c).filter(name => c[name].status === 'incomplete'), phase = incomplete[0], index = sequence.indexOf(phase), open = sequence.indexOf('open');
  assert(!c.open && !c.receipt && !(await readdir(run.directory)).some(name => /^provider-phase-(?:open|receipt)\.json$/.test(name)), 'TOOL_SOURCE_OPEN_ATTEMPTED');
  assert(c.inspect?.status === 'complete' && c.freeze?.status === 'complete' && incomplete.length === 1 && index > sequence.indexOf('freeze') && index < open &&
    Object.keys(c).every(name => sequence.indexOf(name) >= 0 && sequence.indexOf(name) <= index) && sequence.slice(0, index).every(name => c[name]?.status === 'complete') &&
    c[phase].operationId === run.plan.phaseOperationIds[phase] && Number.isSafeInteger(c[phase].attempt) && c[phase].attempt > 0, 'TOOL_SOURCE_PREOPEN_INCOMPLETE_ONLY');
  for (const name of (await readdir(run.directory)).filter(name => /^provider-phase-.*\.json$/.test(name))) {
    const match = providerPattern.exec(name), providerPhase = match?.[1];
    assert(match && sequence.indexOf(providerPhase) >= 0 && sequence.indexOf(providerPhase) <= index, 'TOOL_SOURCE_LATER_PHASE_PRESENT');
    const record = JSON.parse(await regularBytes(path.join(run.directory, name)));
    assert(record.projectId === run.plan.projectId && record.gitSha === run.plan.gitSha && record.runId === run.plan.runId && record.planHash === run.planHash && record.phase === providerPhase, 'TOOL_SOURCE_PROVIDER_RECORD_INVALID');
  }
  await completedEvidence(run);
  return {...await frozenBoundary(run), interruptedPhase: phase};
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
async function completedOpenScope(run, repositoryRoot, now) {
  strictDev(run);
  const phases = phasesFor(run.plan), prior = phases.slice(0, phases.indexOf('open')), c = run.journal.checkpoints;
  assert(!c.receipt && !await optional(path.join(run.directory, 'provider-phase-receipt.json')) && !await optional(path.join(repositoryRoot, '.firebase/authorization-migration', run.plan.projectId + '.json')), 'TOOL_SOURCE_RECEIPT_ATTEMPTED');
  assert(c.open?.status === 'incomplete' && c.open.lastError === 'PHASE_NOT_VERIFIED' && Number.isSafeInteger(c.open.attempt) && c.open.attempt > 0 &&
    Object.keys(c).length === prior.length + 1 && prior.every(name => c[name]?.status === 'complete') && Object.keys(c).every(name => [...prior, 'open'].includes(name)), 'TOOL_SOURCE_COMPLETED_OPEN_REQUIRED');
  const open = JSON.parse(await regularBytes(path.join(run.directory, 'provider-phase-open.json'))); openRecordBinding(run, open);
  assert(Date.parse(open.completedAt) <= +now && Date.parse(c.open.startedAt) <= Date.parse(open.startedAt), 'TOOL_SOURCE_COMPLETED_OPEN_REQUIRED');
  await completedEvidence(run);
  assert(same(c.inspect.result?.baseline, run.journal.baseline), 'TOOL_SOURCE_COMPLETED_EVIDENCE_INVALID');
  for (const name of (await readdir(run.directory)).filter(name => name.startsWith('provider-phase-'))) {
    const match = /^provider-phase-(inspect|freeze|schema|control-create|backfill|functions|activate|strict-api|open)\.json$/.exec(name);
    assert(match, 'TOOL_SOURCE_LATER_PHASE_PRESENT');
    const value = JSON.parse(await regularBytes(path.join(run.directory, name)));
    assert(value.projectId === run.plan.projectId && value.gitSha === run.plan.gitSha && value.runId === run.plan.runId && value.planHash === run.planHash && value.phase === match[1], 'TOOL_SOURCE_PROVIDER_RECORD_INVALID');
  }
  assert(same(Object.keys(run.journal.gates).sort(), [...GATES].sort()), 'TOOL_SOURCE_COMPLETION_GATES_INVALID');
  const names = await completionFiles(run);
  for (const gateName of GATES) {
    const entry = run.journal.gates[gateName];
    assert(gatePattern.test(entry?.file ?? '') && names.includes(entry.file), 'TOOL_SOURCE_COMPLETION_GATES_INVALID');
    const gate = JSON.parse(await regularBytes(path.join(run.directory, entry.file)));
    assert(migrationHash(gate) === entry.hash && gate.gate === gateName, 'TOOL_SOURCE_COMPLETION_GATES_INVALID');
    validateMigrationGate(gate, run.plan, now);
  }
  for (const name of names.filter(name => gatePattern.test(name))) {
    const gate = JSON.parse(await regularBytes(path.join(run.directory, name))), match = gatePattern.exec(name);
    assert(gate.projectId === run.plan.projectId && gate.gitSha === run.plan.gitSha && gate.runId === run.plan.runId && gate.gate === match[1] && migrationHash(gate) === match[2], 'TOOL_SOURCE_COMPLETION_GATES_INVALID');
  }
  const intents = [...c.functions.result.schedulerIntents ?? [], ...open.deferredSchedulerIntents ?? []];
  assert(intents.length === 2 && new Set(intents.map(intent => intent.name)).size === 2, 'TOOL_SOURCE_COMPLETION_SCHEDULERS_INVALID');
  const proofs = [...c.functions.result.functionProofs ?? [], ...open.deferredProofs ?? []];
  for (const name of names.filter(name => schedulerPattern.test(name))) {
    const capture = JSON.parse(await regularBytes(path.join(run.directory, name)));
    assert(capture.projectId === run.plan.projectId && capture.gitSha === run.plan.gitSha && capture.runId === run.plan.runId && capture.planHash === run.planHash && capture.job?.name?.split('/').at(-1) + '.json' === name.slice('scheduler-'.length), 'TOOL_SOURCE_COMPLETION_SCHEDULERS_INVALID');
    const job = capture.job, functionName = schedulerPattern.exec(name)[1], proof = proofs.find(proof => proof.name === functionName);
    assert(typeof proof?.uri === 'string' && typeof proof?.serviceAccountEmail === 'string' && job.httpTarget?.uri === proof.uri && job.httpTarget?.httpMethod === 'POST' && job.httpTarget?.oidcToken?.serviceAccountEmail === proof.serviceAccountEmail &&
      (job.httpTarget.oidcToken.audience === undefined || job.httpTarget.oidcToken.audience === job.httpTarget.uri), 'TOOL_SOURCE_COMPLETION_SCHEDULERS_INVALID');
    const spec = JSON.parse(JSON.stringify({name: job.name, schedule: job.schedule, timeZone: job.timeZone ?? 'UTC', attemptDeadline: job.attemptDeadline, retryConfig: job.retryConfig,
      httpTarget: {uri: job.httpTarget.uri, httpMethod: 'POST', oidcIdentity: {serviceAccountEmail: job.httpTarget.oidcToken.serviceAccountEmail, ...(job.httpTarget.oidcToken.audience ? {audience: job.httpTarget.oidcToken.audience} : {})}}}));
    assert(intents.some(intent => intent.name === job.name && intent.specHash === migrationHash(spec)), 'TOOL_SOURCE_COMPLETION_SCHEDULERS_INVALID');
  }
  const files = []; for (const name of names) files.push({name, sha256: digest(await regularBytes(path.join(run.directory, name)))});
  return {...await frozenBoundary(run), interruptedPhase: 'open', completionBindings: {gateEntriesHash: migrationHash(run.journal.gates), priorCheckpointHashes: Object.fromEntries(prior.map(name => [name, migrationHash(c[name])])), files}};
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
function amendment(record, run, previous) {
  assert(keys(record, ['amendment', 'amendmentHash']) && HASH.test(record.amendmentHash ?? '') && migrationHash(record.amendment) === record.amendmentHash, 'TOOL_SOURCE_AMENDMENT_INVALID');
  const value = record.amendment;
  const fields = ['schemaVersion', 'projectId', 'gitSha', 'runId', 'planHash', 'toolSha', 'reviewReference', 'reason', 'adoptedAt', 'sourceProof', 'freezeStateHash', 'inventoryHash', 'history'];
  const completion = value.schemaVersion === 'sodc-authorization-tool-source-amendment/v3';
  if (previous) fields.push('previousAmendmentHash', 'interruptedPhase');
  if (completion) fields.push('completionKind', 'completionBindings', 'completionDeltaProof');
  assert(keys(value, fields) && value.schemaVersion === 'sodc-authorization-tool-source-amendment/v' + (completion ? '3' : previous ? '2' : '1') && (!completion || previous && value.completionKind === 'completed-open-verifier') && value.projectId === run.plan.projectId && value.gitSha === run.plan.gitSha && value.runId === run.plan.runId && value.planHash === run.planHash &&
    SHA.test(value.toolSha ?? '') && value.toolSha !== value.gitSha && text(value.reviewReference) && text(value.reason) && Number.isFinite(Date.parse(value.adoptedAt)) && HASH.test(value.freezeStateHash ?? '') && HASH.test(value.inventoryHash ?? ''), 'TOOL_SOURCE_AMENDMENT_INVALID');
  if (previous) assert(previous.amendment.schemaVersion !== 'sodc-authorization-tool-source-amendment/v3' && value.previousAmendmentHash === previous.amendmentHash && (completion ? value.interruptedPhase === 'open' : ['schema', 'compatibility', 'control-create', 'backfill', 'functions', 'activate', 'strict-api'].includes(value.interruptedPhase)) &&
    value.freezeStateHash === previous.amendment.freezeStateHash && value.inventoryHash === previous.amendment.inventoryHash && value.toolSha !== previous.amendment.toolSha, 'TOOL_SOURCE_CHAIN_INVALID');
  strictDev(run); assertNoCredentials(record); return value;
}
async function history(run, includePhases = false) {
  const names = [...RECORDS];
  if (includePhases) names.push(...(await readdir(run.directory)).filter(name => providerPattern.test(name)), ...await completedEvidence(run));
  return archiveRows(run, names);
}
async function archiveRows(run, names) {
  const records = [];
  for (const name of names) {
    const bytes = await optional(path.join(run.directory, name)); if (!bytes) continue;
    const value = JSON.parse(bytes);
    if (schedulerPattern.test(name)) {
      // This typed provider configuration names an identity; it contains no token.
      // Validate it narrowly before renaming just this key for credential checks.
      const job = value.job, target = job?.httpTarget, identity = target?.oidcToken;
      assert(keys(value, ['projectId', 'gitSha', 'runId', 'planHash', 'job']) && job && Object.keys(job).every(key => ['name', 'timeZone', 'httpTarget', 'schedule', 'attemptDeadline', 'retryConfig'].includes(key)) &&
        target && Object.keys(target).every(key => ['uri', 'httpMethod', 'oidcToken'].includes(key)) && identity && Object.keys(identity).every(key => ['serviceAccountEmail', 'audience'].includes(key)) &&
        typeof identity.serviceAccountEmail === 'string' && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(identity.serviceAccountEmail) &&
        (identity.audience === undefined || typeof identity.audience === 'string' && identity.audience === target.uri), 'TOOL_SOURCE_COMPLETION_SCHEDULERS_INVALID');
      target.oidcIdentity = identity; delete target.oidcToken;
    }
    assertNoCredentials(value); const hash = digest(bytes), archive = 'evidence/tool-source-before-' + hash + '.json';
    const existing = await optional(path.join(run.directory, archive));
    if (existing) assert(digest(existing) === hash, 'TOOL_SOURCE_HISTORY_CHANGED'); else await immutable(path.join(run.directory, archive), bytes);
    records.push({name, sha256: hash, archive});
  }
  return records;
}
async function verifyHistory(run, rows) {
  assert(Array.isArray(rows) && rows.length >= 4 && rows.length <= 64 && new Set(rows.map(row => row.name)).size === rows.length &&
    ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json'].every(name => rows.some(row => row.name === name)), 'TOOL_SOURCE_HISTORY_INVALID');
  for (const row of rows) {
    assert(keys(row, ['name', 'sha256', 'archive']) && (RECORDS.includes(row.name) || providerPattern.test(row.name) || evidencePattern.test(row.name)) && HASH.test(row.sha256 ?? '') && row.archive === 'evidence/tool-source-before-' + row.sha256 + '.json', 'TOOL_SOURCE_HISTORY_INVALID');
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
    const freeze = JSON.parse(await regularBytes(path.join(run.directory, 'provider-freeze.json'))), inventory = JSON.parse(await regularBytes(path.join(run.directory, 'provider-old-writer-inventory.json')));
    assert(migrationHash(freeze) === value.freezeStateHash && inventory.inventoryHash === value.inventoryHash && migrationHash(inventory.inventory) === value.inventoryHash && same(freeze.oldWriterInventory, inventory.inventory), 'TOOL_SOURCE_FREEZE_BINDING_INVALID');
    for (const file of ['plan.json', 'provider-freeze.json', 'provider-old-writer-inventory.json']) assert(digest(await regularBytes(path.join(run.directory, file))) === value.history.find(row => row.name === file).sha256, 'TOOL_SOURCE_FREEZE_BINDING_INVALID');
    previous = record;
  }
}

/** Local-only amendment. It never rewrites the plan, journal, gates or provider checkpoints. */
export async function adoptMigrationToolSource(options, {confirmProject, toolSha, reviewReference, reason, previousAmendmentHash, completedOpenVerification = false, git = gitDefault, now = new Date()} = {}) {
  assert(confirmProject === 'sodc-web' && options.projectId === 'sodc-web', 'TOOL_SOURCE_STRICT_DEV_ONLY');
  assert(text(reviewReference) && text(reason), 'TOOL_SOURCE_REVIEW_REQUIRED');
  const initial = await loadMigrationRun(options); strictDev(initial);
  assert(typeof completedOpenVerification === 'boolean', 'TOOL_SOURCE_COMPLETION_FLAG_REQUIRED');
  return lock(path.join(path.dirname(initial.directory), '.migration.lock'), initial, () => lock(path.join(initial.directory, '.phase.lock'), initial, async () => {
    const run = await loadMigrationRun(options), records = await chain(run), tip = records.at(-1)?.record;
    let filename = path.join(run.directory, FILE), boundary, completionDeltaProof;
    const stamp = new Date(typeof now === 'function' ? now() : now); assert(Number.isFinite(+stamp), 'TOOL_SOURCE_TIME_INVALID');
    const retry = tip?.amendment.toolSha === toolSha && tip.amendment.reviewReference === reviewReference && tip.amendment.reason === reason &&
      completedOpenVerification === (tip.amendment.schemaVersion === 'sodc-authorization-tool-source-amendment/v3') &&
      (records.length === 1 ? previousAmendmentHash === undefined : previousAmendmentHash === tip.amendment.previousAmendmentHash);
    if (retry) return verifyMigrationToolSource(run, {repositoryRoot: options.repositoryRoot, git});
    if (tip) {
      assert(previousAmendmentHash !== undefined, 'TOOL_SOURCE_PREVIOUS_REQUIRED');
      assert(previousAmendmentHash === tip.amendmentHash, 'TOOL_SOURCE_PREVIOUS_MISMATCH');
      assert(toolSha !== tip.amendment.toolSha, 'TOOL_SOURCE_SAME_REVISION');
      assert(tip.amendment.schemaVersion !== 'sodc-authorization-tool-source-amendment/v3', 'TOOL_SOURCE_COMPLETION_ALREADY_ADOPTED');
      assert(records.length < MAX_TOOL_SOURCE_AMENDMENTS, 'TOOL_SOURCE_CHAIN_LIMIT');
      await verifyChain(run, records, options.repositoryRoot, git);
      try {await git(['merge-base', '--is-ancestor', tip.amendment.toolSha, toolSha], {cwd: options.repositoryRoot});}
      catch {throw new MigrationError('TOOL_SOURCE_NOT_DESCENDANT', 'The successor tool must descend from the current reviewed tool revision.');}
      if (completedOpenVerification) {
        boundary = await completedOpenScope(run, options.repositoryRoot, stamp);
        completionDeltaProof = await inspectCommittedDiff(options.repositoryRoot, tip.amendment.toolSha, toolSha, git);
        assert(completionDeltaProof.changes.every(change => FINISH_PATHS.has(change.path) && change.status === 'M'), 'TOOL_SOURCE_COMPLETION_DELTA_INVALID');
      } else boundary = await successorScope(run);
      filename = path.join(run.directory, 'tool-source-amendment-' + tip.amendmentHash + '.json');
    } else {
      assert(!completedOpenVerification, 'TOOL_SOURCE_COMPLETION_PREDECESSOR_REQUIRED');
      assert(previousAmendmentHash === undefined, 'TOOL_SOURCE_PREVIOUS_MISMATCH');
      boundary = await adoptionScope(run);
    }
    const sourceProof = await inspectMigrationToolSource(options.repositoryRoot, run.plan.gitSha, toolSha, git);
    if (completedOpenVerification) {
      const files = await archiveRows(run, boundary.completionBindings.files.map(row => row.name));
      assert(files.every((row, index) => row.sha256 === boundary.completionBindings.files[index].sha256), 'TOOL_SOURCE_COMPLETION_BINDING_CHANGED');
      boundary.completionBindings.files = files;
    }
    const value = {schemaVersion: 'sodc-authorization-tool-source-amendment/v' + (completedOpenVerification ? '3' : tip ? '2' : '1'), projectId: run.plan.projectId, gitSha: run.plan.gitSha, runId: run.plan.runId, planHash: run.planHash,
      toolSha, reviewReference, reason, adoptedAt: stamp.toISOString(), sourceProof, ...boundary, history: await history(run, Boolean(tip)), ...(tip ? {previousAmendmentHash} : {})};
    if (completedOpenVerification) Object.assign(value, {completionKind: 'completed-open-verifier', completionDeltaProof});
    const record = {amendment: value, amendmentHash: migrationHash(value)}; assertNoCredentials(record);
    // Publish only after all historical bytes are durable, then re-inspect before returning.
    await immutable(filename, Buffer.from(JSON.stringify(record, null, 2) + '\n'));
    return verifyMigrationToolSource(run, {repositoryRoot: options.repositoryRoot, git});
  }));
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
