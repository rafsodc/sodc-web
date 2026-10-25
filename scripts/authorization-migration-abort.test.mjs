import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMigrationPlan, executeMigrationPhase, loadMigrationRun, migrationHash, prepareMigrationRun, recordMigrationGate, summarizeRun, phasesFor} from './authorization-migration-state.mjs';
import {runMigrationCli} from './authorization-migration.mjs';

const sha = 'a'.repeat(40), toolSha = 'b'.repeat(40), now = new Date('2026-10-25T08:00:00Z');
const roots = [];
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
async function fixture({aborted = true} = {}) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'historical-abort-journal-')); roots.push(repositoryRoot);
  const options = {repositoryRoot, projectId: 'sodc-web', runId: 'historical-aborted-dev'};
  const plan = createMigrationPlan({...options, gitSha: sha, operator: 'operator', reason: 'historical completed recovery', installation: 'strict', artifactDirectory: path.join(tmpdir(), 'historical-unused-artifacts'), now});
  const run = await prepareMigrationRun({repositoryRoot, plan});
  const journal = JSON.parse(await readFile(path.join(run.directory, 'journal.json'), 'utf8'));
  // Only historical wire records are constructed: no recovery executor is retained or invoked.
  if (aborted) Object.assign(journal, {schemaVersion: 'sodc-authorization-migration-aborted-journal/v1', status: 'ABORTED',
    abortFreeze: {status: 'complete'}, terminal: {status: 'ABORTED', kind: 'abort-freeze', reason: 'original boundary was restored', recoveryToolSha: toolSha}});
  const putJournal = () => writeFile(path.join(run.directory, 'journal.json'), JSON.stringify(journal), {mode: 0o600});
  await putJournal();
  const adapter = {observe: vi.fn(), perform: vi.fn(), verify: vi.fn()};
  const sourceCheck = vi.fn();
  return {...options, options, plan, journal, putJournal, ...run, adapter, sourceCheck};
}
it('reads and reports historical terminal aborted journals without changing their bytes or loading a provider', async () => {
  const f = await fixture(), names = ['plan.json', 'journal.json'];
  const before = await Promise.all(names.map(name => readFile(path.join(f.directory, name))));
  const run = await loadMigrationRun(f.options);
  expect(summarizeRun(run)).toMatchObject({status: 'ABORTED', aborted: {reason: 'original boundary was restored', recoveryToolSha: toolSha}});
  const git = vi.fn(), loadAdapter = vi.fn();
  await expect(runMigrationCli(['status', '--project', 'sodc-web', '--run-id', f.plan.runId], {repositoryRoot: f.repositoryRoot, nodeVersion: '22.0.0', env: {}, git, loadAdapter})).resolves.toMatchObject({offline: true, status: 'ABORTED'});
  expect(git).not.toHaveBeenCalled(); expect(loadAdapter).not.toHaveBeenCalled();
  expect(await Promise.all(names.map(name => readFile(path.join(f.directory, name))))).toEqual(before);
});
it('keeps terminal aborted runs blocked from every normal phase and new gates before source/provider actions', async () => {
  const f = await fixture();
  for (const phase of phasesFor(f.plan)) {
    await expect(executeMigrationPhase(f.options, {phase, confirmProject: f.projectId, adapter: f.adapter, sourceCheck: f.sourceCheck})).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  }
  await expect(recordMigrationGate(f.options, {}, now)).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  expect(f.sourceCheck).not.toHaveBeenCalled(); for (const method of Object.values(f.adapter)) expect(method).not.toHaveBeenCalled();
});
it('retains the durable abort-intent replay block even when its historical journal write was interrupted', async () => {
  const f = await fixture({aborted: false}); await writeFile(path.join(f.directory, 'abort-freeze-intent.json'), '{}', {mode: 0o600});
  await expect(executeMigrationPhase(f.options, {phase: 'inspect', confirmProject: f.projectId, adapter: f.adapter, sourceCheck: f.sourceCheck})).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  await expect(recordMigrationGate(f.options, {}, now)).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  expect(f.sourceCheck).not.toHaveBeenCalled(); for (const method of Object.values(f.adapter)) expect(method).not.toHaveBeenCalled();
});
it('retains an incomplete historical abort as ABORTING and forbids normal replay', async () => {
  const f = await fixture({aborted: false}); f.journal.abortFreeze = {status: 'incomplete'}; await f.putJournal();
  expect(summarizeRun(await loadMigrationRun(f.options))).toMatchObject({status: 'ABORTING'});
  await expect(executeMigrationPhase(f.options, {phase: 'inspect', confirmProject: f.projectId, adapter: f.adapter, sourceCheck: f.sourceCheck})).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
});
for (const field of ['status', 'terminal', 'abortFreeze', 'schemaVersion']) it('rejects malformed historical aborted journal ' + field, async () => {
  const f = await fixture();
  if (field === 'status') f.journal.status = 'complete';
  if (field === 'terminal') f.journal.terminal.kind = 'unknown';
  if (field === 'abortFreeze') f.journal.abortFreeze.status = 'incomplete';
  if (field === 'schemaVersion') f.journal.schemaVersion = 'sodc-authorization-migration-aborted-journal/v2';
  await f.putJournal(); await expect(loadMigrationRun(f.options)).rejects.toMatchObject({code: 'JOURNAL_INVALID'});
});
it('retains the immutable original plan binding for historical aborted journals', async () => {
  const f = await fixture(); f.journal.planHash = migrationHash({unreviewed: true}); await f.putJournal();
  await expect(loadMigrationRun(f.options)).rejects.toMatchObject({code: 'PLAN_CHANGED'});
});
