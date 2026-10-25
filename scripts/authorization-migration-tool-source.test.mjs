import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm, lstat, symlink, unlink, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMigrationPlan, prepareMigrationRun, loadMigrationRun, migrationHash, PHASE_ASSERTIONS} from './authorization-migration-state.mjs';
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
