import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm, lstat, symlink, unlink, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMigrationPlan, prepareMigrationRun, loadMigrationRun, migrationHash, PHASE_ASSERTIONS, recordMigrationGate, phasesFor} from './authorization-migration-state.mjs';
import {adoptMigrationToolSource, verifyMigrationToolSource, inspectMigrationToolSource, parseToolSourceDiff, MAX_TOOL_SOURCE_AMENDMENTS} from './authorization-migration-tool-source.mjs';

const original = 'a'.repeat(40), tool = 'b'.repeat(40), now = new Date('2026-10-25T09:30:00Z');
const raw = ':100644 100644 ' + '1'.repeat(40) + ' ' + '2'.repeat(40) + ' M\0scripts/authorization-migration-cloud.mjs\0';
const patch = 'diff --git a/scripts/authorization-migration-cloud.mjs b/scripts/authorization-migration-cloud.mjs\n-reviewed old classifier\n+reviewed exact provider classifier\n';
const roots = [];
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
function sourceGit({head = tool, status = '', ancestry = true, rawDiff = raw, patchDiff = patch} = {}) {
  return vi.fn(async args => {
    if (args[0] === 'rev-parse') return typeof head === 'function' ? head() : head;
    if (args[0] === 'status') return status;
    if (args[0] === 'merge-base') {if (!ancestry) throw Error('not ancestor'); return '';}
    if (args.includes('--raw')) return typeof rawDiff === 'function' ? rawDiff(args.at(-2)) : rawDiff;
    if (args.includes('--binary')) return typeof patchDiff === 'function' ? patchDiff(args.at(-2)) : patchDiff;
    throw Error('unexpected git command');
  });
}
async function fixture({projectId = 'sodc-web', installation = 'strict'} = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'migration-tool-source-'))); roots.push(root);
  const repositoryRoot = path.join(root, 'repo'); await mkdir(repositoryRoot);
  const options = {repositoryRoot, projectId, runId: 'interrupted-tool-run'};
  const plan = createMigrationPlan({...options, gitSha: original, installation, operator: 'operator', reason: 'reviewed Dev rehearsal', artifactDirectory: path.join(root, 'artifacts'), now});
  const prepared = await prepareMigrationRun({repositoryRoot, plan});
  const inventory = {projectId, services: [{name: 'original-service', uid: 'preserved-service-uid', revisions: []}]};
  const freeze = {projectId, gitSha: original, runId: plan.runId, planHash: prepared.planHash, completedAt: now.toISOString(), oldWriterInventory: inventory};
  const journal = {schemaVersion: 'sodc-authorization-migration-journal/v1', planHash: prepared.planHash, baseline: {projectId, gitSha: original}, checkpoints: {
    inspect: {status: 'complete'}, freeze: {status: 'incomplete', operationId: plan.phaseOperationIds.freeze, attempt: 2, lastError: {code: 'PHASE_NOT_VERIFIED'}, result: {stateHash: migrationHash(freeze)}},
  }, gates: {}, events: []};
  const put = async (name, value) => writeFile(path.join(prepared.directory, name), JSON.stringify(value), {mode: 0o600});
  await put('journal.json', journal); await put('provider-freeze.json', freeze);
  await put('provider-old-writer-inventory.json', {projectId, gitSha: original, runId: plan.runId, planHash: prepared.planHash, capturedAt: now.toISOString(), inventory, inventoryHash: migrationHash(inventory)});
  await put('provider-freeze-proof.json', {passed: false, validTargetToken: true, callables: [{httpStatus: 401}]});
  await writeFile(path.join(path.dirname(prepared.directory), 'active-run.json'), JSON.stringify({runId: plan.runId, planHash: prepared.planHash, status: 'active'}), {mode: 0o600});
  const git = sourceGit(), adopt = extras => adoptMigrationToolSource(options, {confirmProject: projectId, toolSha: tool, reviewReference: 'reviewed fix PR', reason: 'actual provider contract mismatch', git, now, ...extras});
  return {...await loadMigrationRun(options), options, git, adopt, put, freeze, inventory};
}

it('adopts exactly one tool-only revision, preserving plan, failed checkpoint and provider history', async () => {
  const f = await fixture(), originals = await Promise.all(['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json'].map(name => readFile(path.join(f.directory, name))));
  const result = await f.adopt(); expect(result).toMatchObject({originalPlanSha: original, toolSha: tool}); expect(result.amendmentHash).toMatch(/^[a-f0-9]{64}$/);
  const file = path.join(f.directory, 'tool-source-amendment.json'), saved = JSON.parse(await readFile(file));
  expect(saved.amendmentHash).toBe(migrationHash(saved.amendment)); expect(saved.amendment.sourceProof.applicationSourceUnchanged).toBe(true);
  expect((await lstat(file)).mode & 0o077).toBe(0);
  for (const row of saved.amendment.history) expect(await readFile(path.join(f.directory, row.archive))).toEqual(originals[['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json'].indexOf(row.name)]);
  expect(await Promise.all(['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json'].map(name => readFile(path.join(f.directory, name))))).toEqual(originals);
  expect(await f.adopt()).toEqual(result); expect(await readFile(file)).toEqual(Buffer.from(JSON.stringify(saved, null, 2) + '\n'));
  await expect(f.adopt({toolSha: 'c'.repeat(40)})).rejects.toMatchObject({code: 'TOOL_SOURCE_PREVIOUS_REQUIRED'});
});
it('ordinary verification remains valid after legitimate checkpoint advancement and rejects changed history', async () => {
  const f = await fixture(); await f.adopt();
  f.journal.checkpoints.freeze.status = 'complete'; f.journal.checkpoints.schema = {status: 'complete'};
  await f.put('journal.json', f.journal);
  expect(await verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).toMatchObject({toolSha: tool});
  const record = JSON.parse(await readFile(path.join(f.directory, 'tool-source-amendment.json'))); await writeFile(path.join(f.directory, record.amendment.history[0].archive), '{}');
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_HISTORY_CHANGED'});
});
it('ordinary verification binds exact adopted checkout, complete diff and original frozen inventory', async () => {
  const f = await fixture(); await f.adopt(); const run = await loadMigrationRun(f.options);
  for (const [args, code] of [[{head: original}, 'REVISION_CHANGED'], [{status: ' M scripts/authorization-migration-cloud.mjs'}, 'CHECKOUT_DIRTY'], [{patchDiff: patch + 'changed'}, 'TOOL_SOURCE_DIFF_CHANGED'], [{ancestry: false}, 'TOOL_SOURCE_NOT_DESCENDANT']]) await expect(verifyMigrationToolSource(run, {repositoryRoot: f.options.repositoryRoot, git: sourceGit(args)})).rejects.toMatchObject({code});
  f.freeze.oldWriterInventory.services = []; await f.put('provider-freeze.json', f.freeze);
  await expect(verifyMigrationToolSource(run, {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_FREEZE_BINDING_INVALID'});
});
for (const field of ['projectId', 'capturedAt']) it('rejects current immutable inventory envelope ' + field + ' drift even with unchanged inner inventory', async () => {
  const f = await fixture(); await f.adopt();
  const inventory = JSON.parse(await readFile(path.join(f.directory, 'provider-old-writer-inventory.json'))); inventory[field] = 'changed';
  await f.put('provider-old-writer-inventory.json', inventory);
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_FREEZE_BINDING_INVALID'});
});
it('unamended runs preserve exact normal source guard errors and never create amendment files', async () => {
  const f = await fixture(); expect(await verifyMigrationToolSource(f, {repositoryRoot: f.options.repositoryRoot, git: sourceGit({head: original})})).toEqual({originalPlanSha: original, toolSha: original, amendmentHash: null});
  await expect(verifyMigrationToolSource(f, {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'REVISION_CHANGED'});
  await expect(verifyMigrationToolSource(f, {repositoryRoot: f.options.repositoryRoot, git: sourceGit({head: original, status: '?? file'})})).rejects.toMatchObject({code: 'CHECKOUT_DIRTY'});
});
for (const [projectId, installation] of [['sodc-web-production', 'strict'], ['sodc-web-beta', 'strict'], ['sodc-web', 'legacy']]) it('refuses adoption for ' + projectId + '/' + installation, async () => {const f = await fixture({projectId, installation}); await expect(f.adopt()).rejects.toMatchObject({code: 'TOOL_SOURCE_STRICT_DEV_ONLY'});});
for (const [name, change] of [
  ['completed freeze', f => {f.journal.checkpoints.freeze.status = 'complete';}],
  ['unverified inspect', f => {f.journal.checkpoints.inspect.status = 'incomplete';}],
  ['later phase attempt', f => {f.journal.checkpoints.schema = {status: 'incomplete'};}],
  ['wrong operation', f => {f.journal.checkpoints.freeze.operationId = 'foreign';}],
  ['aborted run', f => {f.journal.terminal = {status: 'ABORTED'};}],
]) it('refuses ' + name, async () => {const f = await fixture(); change(f); await f.put('journal.json', f.journal); await expect(f.adopt()).rejects.toMatchObject({code: 'TOOL_SOURCE_EARLY_FREEZE_ONLY'});});
it('requires actual native inventory envelope and its bound hash, not an unwrapped substitute', async () => {
  const f = await fixture(); await f.put('provider-old-writer-inventory.json', f.inventory); await expect(f.adopt()).rejects.toMatchObject({code: 'TOOL_SOURCE_FREEZE_BINDING_INVALID'});
});
it('rejects later provider work, abort intent and foreign project ownership before source inspection', async () => {
  for (const kind of ['later', 'abort', 'owner']) {
    const f = await fixture(); if (kind === 'later') await f.put('provider-phase-schema.json', {}); else if (kind === 'abort') await f.put('abort-freeze-intent.json', {}); else await writeFile(path.join(path.dirname(f.directory), 'active-run.json'), JSON.stringify({runId: 'foreign', planHash: 'c'.repeat(64), status: 'active'}));
    await expect(f.adopt()).rejects.toMatchObject({code: kind === 'later' ? 'TOOL_SOURCE_LATER_PHASE_PRESENT' : kind === 'abort' ? 'TOOL_SOURCE_ABORTING' : 'TOOL_SOURCE_OWNER_MISMATCH'}); expect(f.git).not.toHaveBeenCalled();
  }
});
it('refuses symlink amendment/history and an active native project lock', async () => {
  const f = await fixture(), lock = path.join(path.dirname(f.directory), '.migration.lock'); await writeFile(lock, '{}', {mode: 0o600}); await expect(f.adopt()).rejects.toMatchObject({code: 'TOOL_SOURCE_LOCKED'}); await unlink(lock);
  const target = path.join(f.directory, 'tool-source-amendment.json'); await symlink('journal.json', target); await expect(f.adopt()).rejects.toMatchObject({code: 'TOOL_SOURCE_RECORD_UNSAFE'});
});
it('never unlinks a native lock whose nonce was replaced during source inspection', async () => {
  const f = await fixture(), originalGit = f.git;
  const git = async (args, options) => {const result = await originalGit(args, options); if (args.includes('--binary')) await writeFile(path.join(path.dirname(f.directory), '.migration.lock'), JSON.stringify({nonce: 'replacement'})); return result;};
  await expect(f.adopt({git})).rejects.toMatchObject({code: 'TOOL_SOURCE_LOCK_REPLACED'}); expect(JSON.parse(await readFile(path.join(path.dirname(f.directory), '.migration.lock'))).nonce).toBe('replacement');
});
it('diff inspection disables rename/external/textconv/submodule masking and binds binary patch bytes', async () => {
  const git = sourceGit(), proof = await inspectMigrationToolSource('/repo', original, tool, git);
  expect(proof).toMatchObject({originalPlanSha: original, toolSha: tool, applicationSourceUnchanged: true}); expect(proof.patchSha256).toMatch(/^[a-f0-9]{64}$/);
  for (const [args] of git.mock.calls.filter(([args]) => args[0] === 'diff')) for (const flag of ['--no-renames', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', '--full-index']) expect(args).toContain(flag);
});
it('permits regular same-mode modifications and regular additions only', () => {
  expect(parseToolSourceDiff(raw)).toHaveLength(1);
  expect(parseToolSourceDiff(':000000 100644 ' + '0'.repeat(40) + ' ' + '2'.repeat(40) + ' A\0scripts/authorization-migration-tool-source.mjs\0')).toHaveLength(1);
  expect(parseToolSourceDiff(raw.replaceAll('100644', '100755'))[0].newMode).toBe('100755');
});
for (const [name, value] of [
  ['application edit', raw.replace('scripts/authorization-migration-cloud.mjs', 'src/runtime.js')],
  ['unknown operation guide', raw.replace('scripts/authorization-migration-cloud.mjs', 'docs/operations/unrelated.md')],
  ['mode change', raw.replace(':100644 100644', ':100644 100755')],
  ['symlink', raw.replaceAll('100644', '120000')],
  ['deletion', raw.replace(' M\0', ' D\0')],
  ['rename', raw.replace(' M\0', ' R100\0')],
  ['duplicate path', raw + raw],
  ['empty changes', ''],
]) it('rejects raw diff ' + name, () => expect(() => parseToolSourceDiff(value)).toThrow());

async function successorFixture() {
  const f = await fixture(), state = {head: tool, patches: new Map([[tool, patch]])};
  const git = sourceGit({head: () => state.head, patchDiff: target => state.patches.get(target) ?? patch + target});
  const base = await f.adopt({git}), baseBytes = await readFile(path.join(f.directory, 'tool-source-amendment.json'));
  const complete = async (phase, result) => {
    const record = {schemaVersion: 'sodc-authorization-migration-phase/v1', phase, planHash: f.planHash, operationId: f.plan.phaseOperationIds[phase], result,
      evidence: {projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, planHash: f.planHash, assertions: Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag => [flag, true]))}};
    const evidenceHash = migrationHash(record), evidenceFile = 'evidence/' + phase + '-' + evidenceHash + '.json';
    await f.put(evidenceFile, record);
    f.journal.checkpoints[phase] = {status: 'complete', operationId: record.operationId, attempt: 1, result, evidenceHash, evidenceFile};
  };
  await complete('inspect', {baseline: f.journal.baseline}); await complete('freeze', {stateHash: migrationHash(f.freeze)}); await complete('schema', {reviewed: true});
  const provider = {projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, planHash: f.planHash, phase: 'control-create', startedAt: now.toISOString(), completedAt: now.toISOString()};
  f.journal.checkpoints['control-create'] = {status: 'incomplete', operationId: f.plan.phaseOperationIds['control-create'], attempt: 3, result: provider, lastError: {code: 'CLOUD_METADATA_READ_FAILED'}};
  await f.put('provider-phase-control-create.json', provider); await f.put('journal.json', f.journal);
  const append = async (toolSha = 'c'.repeat(40), previousAmendmentHash = base.amendmentHash, extras = {}) => {
    state.head = toolSha;
    return f.adopt({git, toolSha, previousAmendmentHash, ...extras});
  };
  return {...f, git, state, base, baseBytes, append, complete};
}

it('appends a reviewed pre-open successor while retaining the original plan, base amendment and failed attempts', async () => {
  const f = await successorFixture(), names = ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-phase-control-create.json'];
  const before = await Promise.all(names.map(name => readFile(path.join(f.directory, name))));
  const result = await f.append(), filename = 'tool-source-amendment-' + f.base.amendmentHash + '.json', bytes = await readFile(path.join(f.directory, filename)), record = JSON.parse(bytes);
  expect(record.amendment).toMatchObject({schemaVersion: 'sodc-authorization-tool-source-amendment/v2', previousAmendmentHash: f.base.amendmentHash, interruptedPhase: 'control-create', gitSha: original, toolSha: 'c'.repeat(40)});
  expect(record.amendment.history.filter(row => row.name.startsWith('evidence/'))).toHaveLength(3);
  expect(record.amendment.history.find(row => row.name === 'provider-phase-control-create.json')).toBeDefined();
  for (const row of record.amendment.history) expect(await readFile(path.join(f.directory, row.archive))).toEqual(await readFile(path.join(f.directory, row.name)));
  expect(await readFile(path.join(f.directory, 'tool-source-amendment.json'))).toEqual(f.baseBytes);
  expect(await Promise.all(names.map(name => readFile(path.join(f.directory, name))))).toEqual(before);
  expect(await f.append()).toEqual(result); expect(await readFile(path.join(f.directory, filename))).toEqual(bytes);
  await f.complete('control-create', {finished: true}); await f.put('journal.json', f.journal);
  expect(await verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).toEqual(result);
});
it('requires the explicit current tip and recomputes old committed proofs without checking out the old tool', async () => {
  const f = await successorFixture();
  await expect(f.append('c'.repeat(40), undefined, {previousAmendmentHash: undefined})).rejects.toMatchObject({code: 'TOOL_SOURCE_PREVIOUS_REQUIRED'});
  await expect(f.append('c'.repeat(40), '0'.repeat(64))).rejects.toMatchObject({code: 'TOOL_SOURCE_PREVIOUS_MISMATCH'});
  f.state.patches.set(tool, patch + 'old proof drift');
  await expect(f.append()).rejects.toMatchObject({code: 'TOOL_SOURCE_DIFF_CHANGED'});
  f.state.patches.set(tool, patch); const result = await f.append();
  expect(result.toolSha).toBe('c'.repeat(40));
  expect(f.git.mock.calls.some(([args]) => args.includes('--binary') && args.at(-2) === tool)).toBe(true);
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: sourceGit()})).rejects.toMatchObject({code: 'REVISION_CHANGED'});
});
for (const kind of ['checkpoint-result', 'evidence-bytes', 'future-provider', 'foreign-provider', 'open', 'receipt', 'terminal', 'owner', 'missing-prior']) it('rejects successor scope drift: ' + kind, async () => {
  const f = await successorFixture();
  if (kind === 'checkpoint-result') f.journal.checkpoints.schema.result = {changed: true};
  if (kind === 'evidence-bytes') await f.put(f.journal.checkpoints.schema.evidenceFile, {});
  if (kind === 'future-provider') await f.put('provider-phase-functions.json', {});
  if (kind === 'foreign-provider') await f.put('provider-phase-control-create.json', {...f.journal.checkpoints['control-create'].result, projectId: 'foreign'});
  if (kind === 'open' || kind === 'receipt') f.journal.checkpoints[kind] = {status: 'incomplete'};
  if (kind === 'terminal') f.journal.terminal = {status: 'ABORTED'};
  if (kind === 'owner') await writeFile(path.join(path.dirname(f.directory), 'active-run.json'), JSON.stringify({runId: 'foreign', planHash: f.planHash, status: 'active'}));
  if (kind === 'missing-prior') delete f.journal.checkpoints.schema;
  await f.put('journal.json', f.journal);
  const code = ['checkpoint-result', 'evidence-bytes'].includes(kind) ? 'TOOL_SOURCE_COMPLETED_EVIDENCE_INVALID' : kind === 'future-provider' ? 'TOOL_SOURCE_LATER_PHASE_PRESENT' : kind === 'foreign-provider' ? 'TOOL_SOURCE_PROVIDER_RECORD_INVALID' : ['open', 'receipt'].includes(kind) ? 'TOOL_SOURCE_OPEN_ATTEMPTED' : kind === 'terminal' ? 'TOOL_SOURCE_EARLY_FREEZE_ONLY' : kind === 'owner' ? 'TOOL_SOURCE_OWNER_MISMATCH' : 'TOOL_SOURCE_PREOPEN_INCOMPLETE_ONLY';
  await expect(f.append()).rejects.toMatchObject({code});
  await expect(readFile(path.join(f.directory, 'tool-source-amendment-' + f.base.amendmentHash + '.json'))).rejects.toMatchObject({code: 'ENOENT'});
});
it('bounds the chain at eight immutable single-child amendments', async () => {
  const f = await successorFixture(); let tip = f.base;
  for (let index = 1; index < MAX_TOOL_SOURCE_AMENDMENTS; index++) tip = await f.append(['c', 'd', 'e', 'f', '0', '1', '2'][index - 1].repeat(40), tip.amendmentHash);
  expect(await verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).toEqual(tip);
  await expect(f.append('f'.repeat(40), tip.amendmentHash)).rejects.toMatchObject({code: 'TOOL_SOURCE_CHAIN_LIMIT'});
});
it('rejects orphaned children and changed links without silently falling back to an earlier source', async () => {
  const f = await successorFixture(); await f.append();
  await f.put('tool-source-amendment-' + '0'.repeat(64) + '.json', {});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_CHAIN_ORPHAN'});
  await unlink(path.join(f.directory, 'tool-source-amendment-' + '0'.repeat(64) + '.json'));
  const filename = 'tool-source-amendment-' + f.base.amendmentHash + '.json', record = JSON.parse(await readFile(path.join(f.directory, filename)));
  record.amendment.previousAmendmentHash = '0'.repeat(64); record.amendmentHash = migrationHash(record.amendment); await f.put(filename, record);
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_CHAIN_INVALID'});
});
it('continues to bind archived completed evidence after a successor and halts on any current byte change', async () => {
  const f = await successorFixture(); await f.append();
  await f.put(f.journal.checkpoints.schema.evidenceFile, {});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_COMPLETED_EVIDENCE_CHANGED'});
});

async function completionFixture({changeCapture = () => {}} = {}) {
  const f = await successorFixture(), tip = await f.append();
  const identity = {projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, planHash: f.planHash};
  const captures = ['recoverNotificationDeliveries', 'reconcilePendingSecurityTransitions'].map(name => ({...identity, job: {
    name: `projects/sodc-web/locations/europe-west2/jobs/firebase-schedule-${name}-europe-west2`, schedule: 'every 5 minutes', timeZone: 'UTC', attemptDeadline: '300s',
    httpTarget: {uri: `https://${name.toLowerCase()}.a.run.app`, httpMethod: 'POST', oidcToken: {serviceAccountEmail: 'scheduler@sodc-web.iam.gserviceaccount.com'}},
  }}));
  changeCapture(captures[0]);
  const specs = captures.map(({job}) => ({name: job.name, schedule: job.schedule, timeZone: job.timeZone, attemptDeadline: job.attemptDeadline,
    ...(job.retryConfig ? {retryConfig: job.retryConfig} : {}), httpTarget: {uri: job.httpTarget.uri, httpMethod: 'POST', oidcIdentity: {serviceAccountEmail: job.httpTarget.oidcToken.serviceAccountEmail, ...(job.httpTarget.oidcToken.audience ? {audience: job.httpTarget.oidcToken.audience} : {})}}}));
  await f.complete('control-create', f.journal.checkpoints['control-create'].result);
  await f.complete('backfill', {reviewed: true});
  await f.complete('functions', {functionProofs: captures.map(({job}, index) => ({name: ['recoverNotificationDeliveries', 'reconcilePendingSecurityTransitions'][index], uri: job.httpTarget.uri, serviceAccountEmail: job.httpTarget.oidcToken.serviceAccountEmail})), schedulerIntents: specs.map(spec => ({name: spec.name, specHash: migrationHash(spec)}))});
  await f.complete('activate', {reviewed: true}); await f.complete('strict-api', {reviewed: true});
  await f.put('journal.json', f.journal);
  for (const [gate, details] of [
    ['backup', {waiverReference: 'explicit Dev waiver'}],
    ['freeze-scope', {entrypoints: ['grantAdmin'], jobNames: [], externalWritersReference: 'reviewed writer scope', probeUserId: 'approved-nonadmin', probeReference: 'reviewed probe'}],
    ['old-writers', {method: 'cloud-run-retirement', freezeStateHash: migrationHash(f.freeze), inventoryHash: migrationHash(f.inventory), successorRevisions: [], externalOperationsReference: 'reviewed operations'}],
    ['sql-review', {diffSha256: 'e'.repeat(64)}],
    ['acceptance', {sourceProjectId: 'sodc-web', backendTestReference: 'backend', browserReviewReference: 'browser', notificationsReference: 'notifications', schedulerVolumeReference: 'volume', appCheckReference: 'App Check'}],
    ['sql-review', {diffSha256: 'f'.repeat(64)}],
  ]) await recordMigrationGate(f.options, {schemaVersion: 'sodc-authorization-migration-gate/v1', projectId: identity.projectId, gitSha: identity.gitSha, runId: identity.runId, gate, details, reviewedBy: 'operator', observedAt: now.toISOString(), evidence: 'reviewed same-runtime evidence'}, now);
  Object.assign(f.journal, (await loadMigrationRun(f.options)).journal);
  const open = {...identity, phase: 'open', startedAt: now.toISOString(), completedAt: now.toISOString(), openingStarted: true, apiOpening: true};
  f.journal.checkpoints.open = {status: 'incomplete', operationId: f.plan.phaseOperationIds.open, attempt: 1, startedAt: now.toISOString(), lastError: 'PHASE_NOT_VERIFIED', result: open};
  await f.put('provider-phase-open.json', open);
  for (const capture of captures) await f.put('scheduler-' + capture.job.name.split('/').at(-1) + '.json', capture);
  await f.put('journal.json', f.journal);
  const finish = extras => f.append('d'.repeat(40), tip.amendmentHash, {completedOpenVerification: true, ...extras});
  const noChild = () => expect(readFile(path.join(f.directory, 'tool-source-amendment-' + tip.amendmentHash + '.json')).then(() => true)).rejects.toMatchObject({code: 'ENOENT'});
  return {...f, tip, open, captures, finish, noChild};
}

it('appends a distinct completed-open v3 amendment without rewriting the release, provider result, gates or prior chain', async () => {
  const f = await completionFixture(), names = ['plan.json', 'journal.json', 'provider-phase-open.json', 'tool-source-amendment.json', 'tool-source-amendment-' + f.base.amendmentHash + '.json'];
  const before = await Promise.all(names.map(name => readFile(path.join(f.directory, name))));
  const result = await f.finish(), file = 'tool-source-amendment-' + f.tip.amendmentHash + '.json', record = JSON.parse(await readFile(path.join(f.directory, file)));
  expect(record.amendment).toMatchObject({schemaVersion: 'sodc-authorization-tool-source-amendment/v3', completionKind: 'completed-open-verifier', interruptedPhase: 'open', previousAmendmentHash: f.tip.amendmentHash});
  expect(record.amendment.completionBindings.files).toHaveLength(9); // Provider opening, six gate versions and two scheduler captures.
  expect(Object.keys(record.amendment.completionBindings.priorCheckpointHashes)).toHaveLength(8);
  expect(await Promise.all(names.map(name => readFile(path.join(f.directory, name))))).toEqual(before);
  expect(await f.finish()).toEqual(result);
  await f.complete('open', f.open); f.journal.checkpoints.receipt = {status: 'incomplete', operationId: f.plan.phaseOperationIds.receipt, attempt: 1}; await f.put('journal.json', f.journal);
  await f.put('provider-phase-receipt.json', {...f.open, phase: 'receipt', completedAt: null});
  expect(await verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).toEqual(result);
});
it('keeps the normal pre-open guard and requires the explicit completion flag', async () => {
  const f = await completionFixture(); await expect(f.finish({completedOpenVerification: false})).rejects.toMatchObject({code: 'TOOL_SOURCE_OPEN_ATTEMPTED'}); await f.noChild();
});
it('accepts a captured literal OIDC audience without weakening the credential screen', async () => {
  const f = await completionFixture({changeCapture: capture => {capture.job.httpTarget.oidcToken.audience = capture.job.httpTarget.uri;}});
  expect((await f.finish()).amendmentHash).toMatch(/^[a-f0-9]{64}$/);
});
for (const kind of ['token', 'headers', 'secret', 'null-audience', 'empty-audience']) it('rejects unapproved scheduler data instead of suppressing credential checks: ' + kind, async () => {
  const f = await completionFixture({changeCapture: capture => {
    if (kind === 'token') capture.job.httpTarget.oidcToken.accessToken = 'not-a-real-token';
    if (kind === 'headers') capture.job.httpTarget.headers = {Authorization: 'not-a-real-credential'};
    if (kind === 'secret') capture.job.retryConfig = {password: 'not-a-real-secret'};
    if (kind === 'null-audience') capture.job.httpTarget.oidcToken.audience = null;
    if (kind === 'empty-audience') capture.job.httpTarget.oidcToken.audience = '';
  }});
  await expect(f.finish()).rejects.toThrow(); await f.noChild();
});
for (const kind of ['provider-unfinished', 'provider-result', 'open-status', 'wrong-error', 'prior-proof', 'prior-result', 'missing-prior', 'baseline', 'missing-gate', 'gate-entry', 'gate-bytes', 'scheduler', 'scheduler-intent', 'receipt-checkpoint', 'receipt-provider', 'receipt-file', 'future-provider', 'future-provider-partial', 'receipt-provider-partial', 'abort', 'owner']) it('refuses completed-open adoption scope drift: ' + kind, async () => {
  const f = await completionFixture();
  if (kind === 'provider-unfinished') await f.put('provider-phase-open.json', {...f.open, completedAt: null});
  if (kind === 'provider-result') f.journal.checkpoints.open.result = {...f.open, completedAt: '2026-10-25T09:29:59Z'};
  if (kind === 'open-status') f.journal.checkpoints.open.status = 'complete';
  if (kind === 'wrong-error') f.journal.checkpoints.open.lastError = 'PROVIDER_COMMAND_FAILED';
  if (kind === 'prior-proof') await f.put(f.journal.checkpoints.activate.evidenceFile, {});
  if (kind === 'prior-result') f.journal.checkpoints.activate.result = {changed: true};
  if (kind === 'missing-prior') delete f.journal.checkpoints.activate;
  if (kind === 'baseline') f.journal.baseline = {changed: true};
  if (kind === 'missing-gate') delete f.journal.gates.acceptance;
  if (kind === 'gate-entry') f.journal.gates.acceptance.hash = '0'.repeat(64);
  if (kind === 'gate-bytes') await f.put(f.journal.gates.acceptance.file, {});
  if (kind === 'scheduler') await f.put('scheduler-' + f.captures[0].job.name.split('/').at(-1) + '.json', {...f.captures[0], projectId: 'foreign'});
  if (kind === 'scheduler-intent') {const capture = structuredClone(f.captures[0]); capture.job.schedule = 'every 10 minutes'; await f.put('scheduler-' + capture.job.name.split('/').at(-1) + '.json', capture);}
  if (kind === 'receipt-checkpoint') f.journal.checkpoints.receipt = {status: 'incomplete'};
  if (kind === 'receipt-provider') await f.put('provider-phase-receipt.json', {});
  if (kind === 'receipt-file') await writeFile(path.join(f.options.repositoryRoot, '.firebase/authorization-migration/sodc-web.json'), '{}', {mode: 0o600});
  if (kind === 'future-provider') await f.put('provider-phase-unknown.json', {});
  if (kind === 'future-provider-partial') await f.put('provider-phase-future.json.tmp', {});
  if (kind === 'receipt-provider-partial') await f.put('provider-phase-receipt.json.next', {});
  if (kind === 'abort') await f.put('abort-freeze-intent.json', {});
  if (kind === 'owner') await writeFile(path.join(path.dirname(f.directory), 'active-run.json'), '{}', {mode: 0o600});
  await f.put('journal.json', f.journal); await expect(f.finish()).rejects.toThrow(); await f.noChild();
});
for (const kind of ['open-record', 'gate-file', 'gate-entry', 'scheduler-file', 'prior-checkpoint']) it('ordinary verification rejects pinned completion drift: ' + kind, async () => {
  const f = await completionFixture(); await f.finish();
  if (kind === 'open-record') await f.put('provider-phase-open.json', {...f.open, completedAt: '2026-10-25T09:31:00Z'});
  if (kind === 'gate-file') await f.put(f.journal.gates.acceptance.file, {});
  if (kind === 'gate-entry') f.journal.gates.acceptance.hash = '0'.repeat(64);
  if (kind === 'scheduler-file') await f.put('scheduler-' + f.captures[0].job.name.split('/').at(-1) + '.json', {});
  if (kind === 'prior-checkpoint') f.journal.checkpoints.activate.result = {changed: true};
  await f.put('journal.json', f.journal); await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_COMPLETION_BINDING_CHANGED'});
});
it('restricts the new completion delta to the seven existing reviewed files and forbids another successor', async () => {
  const f = await completionFixture(), git = async (args, options) => args.includes('--raw') && args.at(-3) === f.tip.toolSha ? raw.replace('authorization-migration-cloud.mjs', 'authorization-migration-retirement.mjs') : f.git(args, options);
  await expect(f.finish({git})).rejects.toMatchObject({code: 'TOOL_SOURCE_COMPLETION_DELTA_INVALID'}); await f.noChild();
  const result = await f.finish(); await expect(f.append('e'.repeat(40), result.amendmentHash, {completedOpenVerification: true})).rejects.toMatchObject({code: 'TOOL_SOURCE_COMPLETION_ALREADY_ADOPTED'});
});
for (const name of ['provider-phase-future.json', 'provider-phase-future.json.tmp', 'provider-phase-receipt.json.next']) it('rejects unknown or partial provider work after completion adoption: ' + name, async () => {
  const f = await completionFixture(); await f.finish();
  await f.put(name, {...f.open, phase: 'future'});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_LATER_PHASE_PRESENT'});
});


async function productionRecoveryFixture() {
  const f = await fixture({projectId: 'sodc-web-production', installation: 'legacy'});
  const complete = async (phase, result) => {
    const record = {schemaVersion: 'sodc-authorization-migration-phase/v1', phase, planHash: f.planHash, operationId: f.plan.phaseOperationIds[phase], result,
      evidence: {projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, planHash: f.planHash, assertions: Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag => [flag, true]))}};
    const evidenceHash = migrationHash(record), evidenceFile = 'evidence/' + phase + '-' + evidenceHash + '.json'; await f.put(evidenceFile, record);
    f.journal.checkpoints[phase] = {status: 'complete', operationId: record.operationId, attempt: 1, result, evidenceHash, evidenceFile};
  };
  for (const phase of phasesFor(f.plan).slice(0, phasesFor(f.plan).indexOf('open'))) {
    const result = phase === 'inspect' ? {baseline: f.journal.baseline} : phase === 'freeze' ? {stateHash: migrationHash(f.freeze)} :
      {projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, planHash: f.planHash, phase, startedAt: now.toISOString(), completedAt: now.toISOString()};
    await complete(phase, result); if (!['inspect', 'freeze'].includes(phase)) await f.put('provider-phase-' + phase + '.json', result);
  }
  f.open = {projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, planHash: f.planHash, phase: 'open', startedAt: now.toISOString(), completedAt: null, openingStarted: true};
  f.journal.checkpoints.open = {status: 'incomplete', operationId: f.plan.phaseOperationIds.open, attempt: 1, startedAt: now.toISOString(), lastError: 'SCHEDULER_TARGET_NOT_VERIFIED'};
  await f.put('journal.json', f.journal); await f.put('provider-phase-open.json', f.open);
  for (const [gate, details] of [
    ['backup', {backupReference: 'approved production backup', restoreTestReference: 'actual isolated restore'}],
    ['freeze-scope', {entrypoints: ['grantAdmin'], jobNames: ['recovery'], externalWritersReference: 'reviewed external writes', probeUserId: 'approved-existing', probeReference: 'approved existing session'}],
    ['old-writers', {method: 'cloud-run-retirement', freezeStateHash: migrationHash(f.freeze), inventoryHash: migrationHash(f.inventory), successorRevisions: [], externalOperationsReference: 'actual retirement review'}],
    ['sql-review', {diffSha256: 'f'.repeat(64)}],
    ['acceptance', {sourceProjectId: 'sodc-web', backendTestReference: 'backend', browserReviewReference: 'browser', notificationsReference: 'approved exception', schedulerVolumeReference: 'accepted volume', appCheckReference: 'app check'}],
  ]) await recordMigrationGate(f.options, {schemaVersion: 'sodc-authorization-migration-gate/v1', projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, reviewedBy: 'operator', observedAt: now.toISOString(), evidence: 'same application approval', gate, details}, now);
  f.journal = (await loadMigrationRun(f.options)).journal;
  f.schedulerNames = [];
  for (const fn of ['recoverNotificationDeliveries', 'reconcilePendingSecurityTransitions']) {
    const name = 'scheduler-firebase-schedule-' + fn + '-europe-west2.json'; f.schedulerNames.push(name);
    await f.put(name, {projectId: f.plan.projectId, gitSha: original, runId: f.plan.runId, planHash: f.planHash, job: {name: `projects/${f.plan.projectId}/locations/europe-west2/jobs/firebase-schedule-${fn}-europe-west2`, schedule: 'every 5 minutes', httpTarget: {uri: `https://europe-west2-${f.plan.projectId}.cloudfunctions.net/${fn}`, httpMethod: 'POST', oidcToken: {serviceAccountEmail: 'reviewed@sodc-web-production.iam.gserviceaccount.com'}}}});
  }
  f.recover = extras => f.adopt({productionPreApiOpenRecovery: true, ...extras});
  return f;
}
it('Production v4 records the exact pre-API-open failure without changing any original operational file', async () => {
  const f = await productionRecoveryFixture(), names = ['plan.json', 'journal.json', 'provider-phase-open.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', ...f.schedulerNames], before = await Promise.all(names.map(name => readFile(path.join(f.directory, name))));
  const result = await f.recover(), record = JSON.parse(await readFile(path.join(f.directory, 'tool-source-amendment.json')));
  expect(record.amendment).toMatchObject({schemaVersion: 'sodc-authorization-tool-source-amendment/v4', recoveryKind: 'production-pre-api-open-scheduler-target', interruptedPhase: 'open', gitSha: original, toolSha: tool});
  expect(record.amendment.productionRecoveryBindings.priorCheckpointHashes.compatibility).toMatch(/^[a-f0-9]{64}$/);
  expect(record.amendment.history.some(row => row.name === 'provider-phase-open.json')).toBe(true);
  for (let i = 0; i < names.length; i++) expect(await readFile(path.join(f.directory, names[i]))).toEqual(before[i]);
  expect(await f.recover()).toEqual(result);
});
for (const kind of ['API started', 'proofs already saved', 'completed open', 'wrong error', 'result present', 'missing compatibility', 'prior proof changed', 'foreign scheduler', 'foreign scheduler URI', 'future provider', 'receipt file', 'wrong owner']) it('Production recovery refuses before amendment publication: ' + kind, async () => {
  const f = await productionRecoveryFixture();
  if (kind === 'API started') await f.put('provider-phase-open.json', {...f.open, apiOpening: true});
  if (kind === 'proofs already saved') await f.put('provider-phase-open.json', {...f.open, deferredProofs: []});
  if (kind === 'completed open') await f.put('provider-phase-open.json', {...f.open, completedAt: now.toISOString()});
  if (kind === 'wrong error') f.journal.checkpoints.open.lastError = 'PHASE_NOT_VERIFIED';
  if (kind === 'result present') f.journal.checkpoints.open.result = f.open;
  if (kind === 'missing compatibility') delete f.journal.checkpoints.compatibility;
  if (kind === 'prior proof changed') await f.put(f.journal.checkpoints.backfill.evidenceFile, {});
  if (kind.startsWith('foreign scheduler')) {const capture = JSON.parse(await readFile(path.join(f.directory, f.schedulerNames[1]))); if (kind === 'foreign scheduler') capture.projectId = 'sodc-web'; else capture.job.httpTarget.uri = 'https://foreign.example.invalid/'; await f.put(f.schedulerNames[1], capture);}
  if (kind === 'future provider') await f.put('provider-phase-open.json.tmp', {});
  if (kind === 'receipt file') await writeFile(path.join(f.options.repositoryRoot, '.firebase/authorization-migration/sodc-web-production.json'), '{}', {mode: 0o600});
  if (kind === 'wrong owner') await writeFile(path.join(path.dirname(f.directory), 'active-run.json'), '{}', {mode: 0o600});
  await f.put('journal.json', f.journal); await expect(f.recover()).rejects.toThrow();
  await expect(readFile(path.join(f.directory, 'tool-source-amendment.json'))).rejects.toMatchObject({code: 'ENOENT'});
});
it('Production recovery permanently rechecks archived failure and unchanged prior provider records', async () => {
  const f = await productionRecoveryFixture(); await f.recover(); const record = JSON.parse(await readFile(path.join(f.directory, 'tool-source-amendment.json'))), row = record.amendment.history.find(row => row.name === 'provider-phase-open.json');
  await f.put(row.archive, {...f.open, openingStarted: false});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_HISTORY_CHANGED'});
});
it('Production recovery cannot adopt another tool successor or mix the Dev completion flag', async () => {
  const f = await productionRecoveryFixture(); await expect(f.recover({completedOpenVerification: true})).rejects.toThrow();
  await f.recover(); await expect(f.recover({toolSha: 'e'.repeat(40), previousAmendmentHash: 'f'.repeat(64)})).rejects.toThrow();
});
it('Production recovery ordinary guards allow saved deferred proofs before scheduler capture succeeds', async () => {
  const f = await productionRecoveryFixture(); await f.recover();
  await f.put('provider-phase-open.json', {...f.open, deferredProofs: ['getMyAuthorizationStatus', 'reconcilePendingSecurityTransitions'].map(name => ({name}))});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).resolves.toMatchObject({originalPlanSha: original, toolSha: tool});
});
it('Production v4 restricts changes to the seven existing reviewed files', async () => {
  const f = await productionRecoveryFixture(); await expect(f.recover({git: sourceGit({rawDiff: raw.replace('authorization-migration-cloud.mjs', 'authorization-migration-state.mjs')})})).rejects.toMatchObject({code: 'TOOL_SOURCE_PRODUCTION_DELTA_INVALID'});
});

for (const name of ['provider-phase-open.json', 'journal.json', 'gate']) it('refuses Production history byte replacement between validation and archive: ' + name, async () => {
  const f = await productionRecoveryFixture(); let changed = false;
  const git = async (args, options) => {if (!changed && args.includes('--binary')) {changed = true; const file = path.join(f.directory, name === 'gate' ? f.journal.gates.acceptance.file : name); await writeFile(file, Buffer.concat([await readFile(file), Buffer.from('\n')]), {mode: 0o600});} return f.git(args, options);};
  await expect(f.recover({git})).rejects.toMatchObject({code: 'TOOL_SOURCE_PRODUCTION_BINDING_CHANGED'});
  await expect(readFile(path.join(f.directory, 'tool-source-amendment.json'))).rejects.toMatchObject({code: 'ENOENT'});
});
