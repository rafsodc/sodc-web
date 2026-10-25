import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm, lstat, symlink, unlink, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMigrationPlan, prepareMigrationRun, loadMigrationRun, migrationHash} from './authorization-migration-state.mjs';
import {adoptMigrationToolSource, verifyMigrationToolSource, inspectMigrationToolSource, parseToolSourceDiff} from './authorization-migration-tool-source.mjs';

const original = 'a'.repeat(40), tool = 'b'.repeat(40), now = new Date('2026-10-25T09:30:00Z');
const raw = ':100644 100644 ' + '1'.repeat(40) + ' ' + '2'.repeat(40) + ' M\0scripts/authorization-migration-cloud.mjs\0';
const patch = 'diff --git a/scripts/authorization-migration-cloud.mjs b/scripts/authorization-migration-cloud.mjs\n-reviewed old classifier\n+reviewed exact provider classifier\n';
const roots = [];
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
function sourceGit({head = tool, status = '', ancestry = true, rawDiff = raw, patchDiff = patch} = {}) {
  return vi.fn(async args => {
    if (args[0] === 'rev-parse') return head;
    if (args[0] === 'status') return status;
    if (args[0] === 'merge-base') {if (!ancestry) throw Error('not ancestor'); return '';}
    if (args.includes('--raw')) return rawDiff;
    if (args.includes('--binary')) return patchDiff;
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
  await expect(f.adopt({toolSha: 'c'.repeat(40)})).rejects.toMatchObject({code: 'TOOL_SOURCE_ALREADY_ADOPTED'});
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
