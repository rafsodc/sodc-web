import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ABORT_ASSERTIONS, abortSourceProof, isAbortToolPath} from './authorization-migration-abort.mjs';
import {abortMigrationFreeze, createMigrationPlan, executeMigrationPhase, loadMigrationRun, migrationHash, prepareMigrationRun, recordMigrationGate, PHASE_ASSERTIONS, summarizeRun} from './authorization-migration-state.mjs';
import {parseMigrationArguments, reviewedAbortSource, runMigrationCli} from './authorization-migration.mjs';

const oldSha = 'a'.repeat(40), toolSha = 'b'.repeat(40), now = new Date('2026-10-25T08:00:00Z');
const roots = [];
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
function provider(plan) {
  return {observe: vi.fn(async () => ({projectId: plan.projectId, gitSha: plan.gitSha, observedAt: now.toISOString()})),
    perform: vi.fn(async phase => phase === 'inspect' ? {baseline: {projectId: plan.projectId, gitSha: plan.gitSha, installation: plan.installation, authority: {counts: {identities: 9, profiles: 8, states: 7}}}} : {stateHash: 'c'.repeat(64)}),
    verify: vi.fn(async phase => ({ok: true, evidence: {projectId: plan.projectId, gitSha: plan.gitSha, runId: plan.runId, planHash: migrationHash(plan), observedAt: now.toISOString(), assertions: {...Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag => [flag, true])), ...(phase === 'freeze' ? {oldWritersRetired: false} : {})}}})),
  };
}
async function fixture({projectId = 'sodc-web', installation = 'strict'} = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'abort-freeze-test-')); roots.push(directory);
  const repositoryRoot = path.join(directory, 'repo'); await mkdir(repositoryRoot);
  const options = {repositoryRoot, projectId, runId: 'interrupted-dev'};
  const plan = createMigrationPlan({...options, gitSha: oldSha, operator: 'operator', reason: 'reviewed rehearsal', installation, artifactDirectory: path.join(directory, 'artifacts'), now});
  const prepared = await prepareMigrationRun({repositoryRoot, plan}), adapter = provider(plan);
  for (const gate of [
    {gate: 'backup', details: projectId === 'sodc-web' ? {waiverReference: 'Dev waiver'} : {backupReference: 'backup', restoreTestReference: 'restore'}},
    {gate: 'freeze-scope', details: {entrypoints: ['grantAdmin'], jobNames: [], externalWritersReference: 'external reviewed', probeUserId: 'probe', probeReference: 'probe reviewed'}},
  ]) await recordMigrationGate(options, {schemaVersion: 'sodc-authorization-migration-gate/v1', projectId, gitSha: oldSha, runId: plan.runId, reviewedBy: 'operator', observedAt: now.toISOString(), evidence: 'local reviewed evidence', ...gate}, now);
  await executeMigrationPhase(options, {phase: 'inspect', confirmProject: projectId, adapter, sourceCheck: async () => {}, now: () => now});
  await expect(executeMigrationPhase(options, {phase: 'freeze', confirmProject: projectId, adapter, sourceCheck: async () => {}, now: () => now})).rejects.toMatchObject({code: 'PHASE_NOT_VERIFIED'});
  const source = abortSourceProof(oldSha, toolSha, ['scripts/authorization-migration-abort.mjs', 'scripts/authorization-migration-cloud.mjs']);
  const abortAdapter = {abortFreeze: vi.fn(async context => ({ok: true, evidence: {projectId, gitSha: oldSha, runId: plan.runId, planHash: prepared.planHash, observedAt: now.toISOString(), recoveryToolSha: context.recoverySource.recoveryToolSha, abortIntentHash: migrationHash(context.abortIntent), assertions: Object.fromEntries(ABORT_ASSERTIONS.map(flag => [flag, true]))}}))};
  const abort = extras => abortMigrationFreeze(options, {confirmProject: projectId, reason: 'restore original Dev boundary', adapter: abortAdapter, sourceCheck: async () => source, now: () => now, ...extras});
  return {directory, options, plan, source, abort, adapter, abortAdapter, ...await loadMigrationRun(options)};
}
async function changeJournal(f, mutate) {const file = path.join(f.directory, 'journal.json'), value = JSON.parse(await readFile(file, 'utf8')); mutate(value); await writeFile(file, JSON.stringify(value));}

it('aborts only the failed freeze, preserving immutable plan, original phase evidence and existing project receipt', async () => {
  const f = await fixture(), before = await loadMigrationRun(f.options), planBytes = await readFile(path.join(f.directory, 'plan.json'));
  const phaseBytes = await readFile(path.join(f.directory, before.journal.checkpoints.inspect.evidenceFile));
  const receipt = path.join(f.options.repositoryRoot, '.firebase/authorization-migration/sodc-web.json'); await writeFile(receipt, 'existing release receipt');
  f.abortAdapter.abortFreeze.mockImplementation(async context => {
    const intent = JSON.parse(await readFile(path.join(f.directory, 'abort-freeze-intent.json'), 'utf8'));
    expect(context.abortIntent).toEqual(intent); expect(context.reason).toBe(intent.reason);
    expect(intent.baselineHash).toBe(migrationHash(before.journal.baseline)); expect(intent.freezeCheckpointHash).toBe(migrationHash(before.journal.checkpoints.freeze));
    expect((await loadMigrationRun(f.options)).journal.abortFreeze.status).toBe('incomplete');
    return {ok: true, evidence: {projectId: f.plan.projectId, gitSha: oldSha, runId: f.plan.runId, planHash: f.planHash, observedAt: now.toISOString(), recoveryToolSha: toolSha, abortIntentHash: migrationHash(context.abortIntent), assertions: Object.fromEntries(ABORT_ASSERTIONS.map(flag => [flag, true]))}};
  });
  expect(await f.abort()).toMatchObject({status: 'ABORTED', recoveryToolSha: toolSha});
  const after = await loadMigrationRun(f.options);
  expect(after.journal.checkpoints).toEqual(before.journal.checkpoints);
  expect(after.journal.schemaVersion).toBe('sodc-authorization-migration-aborted-journal/v1');
  expect(summarizeRun(after)).toMatchObject({status: 'ABORTED'});
  expect(await readFile(path.join(f.directory, 'plan.json'))).toEqual(planBytes);
  expect(await readFile(path.join(f.directory, before.journal.checkpoints.inspect.evidenceFile))).toEqual(phaseBytes);
  expect(await readFile(receipt, 'utf8')).toBe('existing release receipt');
  expect(JSON.parse(await readFile(path.join(path.dirname(f.directory), 'active-run.json'), 'utf8'))).toMatchObject({planHash: f.planHash, status: 'aborted'});
});
it('normal phases and gates refuse terminal aborted runs before any provider action', async () => {
  const f = await fixture(); await f.abort(); const calls = f.adapter.perform.mock.calls.length;
  await expect(executeMigrationPhase(f.options, {phase: 'freeze', confirmProject: f.plan.projectId, adapter: f.adapter, sourceCheck: async () => {}, now: () => now})).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  await expect(recordMigrationGate(f.options, {}, now)).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  expect(f.adapter.perform).toHaveBeenCalledTimes(calls);
});
it('a failed provider restoration retains its exact intent and project ownership, allowing only explicit same-reason abort retry', async () => {
  const f = await fixture(); f.abortAdapter.abortFreeze.mockRejectedValueOnce(Object.assign(Error('provider'), {code: 'PROVIDER_OPERATION_FAILED'}));
  await expect(f.abort()).rejects.toMatchObject({code: 'PROVIDER_OPERATION_FAILED'});
  const intent = await readFile(path.join(f.directory, 'abort-freeze-intent.json'));
  expect((await loadMigrationRun(f.options)).journal.abortFreeze.status).toBe('incomplete');
  expect(JSON.parse(await readFile(path.join(path.dirname(f.directory), 'active-run.json'), 'utf8')).status).toBe('active');
  await expect(f.abort({reason: 'different reason'})).rejects.toMatchObject({code: 'ABORT_INTENT_CHANGED'});
  await expect(executeMigrationPhase(f.options, {phase: 'freeze', confirmProject: f.plan.projectId, adapter: f.adapter, sourceCheck: async () => {}, now: () => now})).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  expect(await f.abort()).toMatchObject({status: 'ABORTED'}); expect(await readFile(path.join(f.directory, 'abort-freeze-intent.json'))).toEqual(intent);
});
it('durable abort intent alone blocks old-phase replay if the subsequent journal write was interrupted', async () => {
  const f = await fixture(); await writeFile(path.join(f.directory, 'abort-freeze-intent.json'), '{}');
  await expect(executeMigrationPhase(f.options, {phase: 'freeze', confirmProject: f.plan.projectId, adapter: f.adapter, sourceCheck: async () => {}, now: () => now})).rejects.toMatchObject({code: 'RUN_ABORTED_OR_ABORTING'});
  expect(f.abortAdapter.abortFreeze).not.toHaveBeenCalled();
});
it('reconciles a crash after terminal journal persistence and before owner release without rewriting original history', async () => {
  const f = await fixture(); await f.abort(); const before = await loadMigrationRun(f.options), intent = await readFile(path.join(f.directory, 'abort-freeze-intent.json'));
  await writeFile(path.join(path.dirname(f.directory), 'active-run.json'), JSON.stringify({runId: f.plan.runId, planHash: f.planHash, status: 'active'}));
  expect(await f.abort()).toMatchObject({status: 'ABORTED'});
  const after = await loadMigrationRun(f.options); expect(after.journal.terminal).toEqual(before.journal.terminal); expect(after.journal.checkpoints).toEqual(before.journal.checkpoints); expect(await readFile(path.join(f.directory, 'abort-freeze-intent.json'))).toEqual(intent);
  expect(JSON.parse(await readFile(path.join(path.dirname(f.directory), 'active-run.json'), 'utf8')).status).toBe('aborted');
});
it('a fresh immutable run can claim the project after verified abort; the old run cannot reclaim an active successor', async () => {
  const f = await fixture(); await f.abort(); const plan = createMigrationPlan({...f.plan, runId: 'fresh-rehearsal', gitSha: toolSha, artifactDirectory: path.join(path.dirname(f.options.repositoryRoot), 'fresh-artifacts'), now});
  const options = {...f.options, runId: plan.runId}; await prepareMigrationRun({...options, plan}); const adapter = provider(plan);
  await executeMigrationPhase(options, {phase: 'inspect', confirmProject: plan.projectId, adapter, sourceCheck: async () => {}, now: () => now});
  await expect(f.abort()).rejects.toMatchObject({code: 'PROJECT_RUN_ACTIVE'});
});
it.each(['sodc-web-beta', 'sodc-web-production'])('refuses abort on %s', async projectId => {const f = await fixture({projectId}); await expect(f.abort()).rejects.toMatchObject({code: 'ABORT_STRICT_DEV_ONLY'}); expect(f.abortAdapter.abortFreeze).not.toHaveBeenCalled();});
it('refuses legacy installation before provider loading', async () => {const f = await fixture({installation: 'legacy'}); await expect(f.abort()).rejects.toMatchObject({code: 'ABORT_STRICT_DEV_ONLY'});});
it.each(['schema', 'compatibility', 'control-create', 'backfill', 'functions', 'activate', 'strict-api', 'open', 'receipt'])('refuses ANY later %s checkpoint or attempt', async phase => {const f = await fixture(); await changeJournal(f, j => {j.checkpoints[phase] = {status: 'incomplete', attempt: 1};}); await expect(f.abort()).rejects.toMatchObject({code: 'ABORT_EARLY_FREEZE_ONLY'}); expect(f.abortAdapter.abortFreeze).not.toHaveBeenCalled();});
it('refuses orphan later provider phase evidence even without a journal checkpoint', async () => {const f = await fixture(); await writeFile(path.join(f.directory, 'provider-phase-schema.json'), '{}'); await expect(f.abort()).rejects.toMatchObject({code: 'ABORT_LATER_PROVIDER_PHASE'}); expect(f.abortAdapter.abortFreeze).not.toHaveBeenCalled();});
it('refuses changed inspected baseline and incomplete inspect', async () => {const f = await fixture(); await changeJournal(f, j => {j.baseline.installation = 'legacy';}); await expect(f.abort()).rejects.toMatchObject({code: 'BASELINE_CHANGED'}); await changeJournal(f, j => {j.checkpoints.inspect.status = 'incomplete';}); await expect(f.abort()).rejects.toMatchObject({code: 'ABORT_EARLY_FREEZE_ONLY'});});
it.each(ABORT_ASSERTIONS)('refuses provider evidence missing %s and retains owner', async flag => {const f = await fixture(); f.abortAdapter.abortFreeze.mockImplementation(async context => ({ok: true, evidence: {projectId: f.plan.projectId, gitSha: oldSha, runId: f.plan.runId, planHash: f.planHash, recoveryToolSha: toolSha, abortIntentHash: migrationHash(context.abortIntent), observedAt: now.toISOString(), assertions: {...Object.fromEntries(ABORT_ASSERTIONS.map(x => [x, true])), [flag]: false}}})); await expect(f.abort()).rejects.toMatchObject({code: 'ABORT_BOUNDARY_NOT_VERIFIED'}); expect((await loadMigrationRun(f.options)).journal.terminal).toBeUndefined();});
it.each(['functions/src/index.ts', 'dataconnect/api/connector.yaml', 'package-lock.json', 'config/deployment-check.json', 'scripts/unrelated.mjs', '../scripts/authorization-migration.mjs'])('rejects source exception for application/unrelated path %s', filename => {expect(isAbortToolPath(filename)).toBe(false); expect(() => abortSourceProof(oldSha, toolSha, [filename])).toThrow();});
it('allows only clean reviewed descendant migration-tool differences and retains their exact SHA/path binding', async () => {
  const git = vi.fn(async args => args[0] === 'rev-parse' ? toolSha : args[0] === 'diff' ? 'scripts/authorization-migration-abort.mjs\0docs/operations/authorization-migration-tool.md\0' : '');
  expect(await reviewedAbortSource('/repo', git, oldSha)).toMatchObject({originalPlanSha: oldSha, recoveryToolSha: toolSha, applicationSourceUnchanged: true});
  expect(git).toHaveBeenCalledWith(['merge-base', '--is-ancestor', oldSha, toolSha], {cwd: '/repo'});
  expect(git).toHaveBeenCalledWith(['diff', '--no-renames', '--name-only', '-z', oldSha, toolSha, '--'], {cwd: '/repo'});
  const dirty = async args => args[0] === 'rev-parse' ? toolSha : args[0] === 'status' ? ' M scripts/authorization-migration.mjs' : '';
  await expect(reviewedAbortSource('/repo', dirty, oldSha)).rejects.toMatchObject({code: 'CHECKOUT_DIRTY'});
  const changedApp = async args => args[0] === 'rev-parse' ? toolSha : args[0] === 'diff' ? 'functions/src/index.ts\0' : '';
  await expect(reviewedAbortSource('/repo', changedApp, oldSha)).rejects.toMatchObject({code: 'ABORT_APPLICATION_SOURCE_CHANGED'});
});
it.each([
  ['abort-freeze', '--project', 'sodc-web-production', '--run-id', 'run', '--confirm-project', 'sodc-web-production', '--reason', 'review'],
  ['abort-freeze', '--project', 'sodc-web', '--run-id', 'run', '--reason', 'review'],
  ['abort-freeze', '--project', 'sodc-web', '--run-id', 'run', '--confirm-project', 'sodc-web', '--reason', 'review', '--phase', 'freeze'],
])('rejects ambiguous abort arguments before provider loading %j', args => expect(() => parseMigrationArguments(args)).toThrow());
it('CLI uses only abort provider with original plan and reviewed new tool SHA; normal apply still rejects SHA change', async () => {
  const f = await fixture(), args = ['abort-freeze', '--project', 'sodc-web', '--run-id', f.plan.runId, '--confirm-project', 'sodc-web', '--reason', 'restore original Dev boundary'];
  const git = vi.fn(async values => values[0] === 'rev-parse' ? toolSha : values[0] === 'diff' ? 'scripts/authorization-migration.mjs\0' : ''), loadAdapter = vi.fn(async () => f.abortAdapter);
  const deps = {repositoryRoot: f.options.repositoryRoot, nodeVersion: '24.22.0', env: {}, git, loadAdapter, now: () => now};
  await expect(runMigrationCli(['apply', '--project', 'sodc-web', '--run-id', f.plan.runId, '--phase', 'freeze', '--confirm-project', 'sodc-web'], deps)).rejects.toMatchObject({code: 'REVISION_CHANGED'}); expect(loadAdapter).not.toHaveBeenCalled();
  expect(await runMigrationCli(args, deps)).toMatchObject({status: 'ABORTED', originalGitSha: oldSha, recoveryToolSha: toolSha}); expect(loadAdapter.mock.calls[0][0].plan.gitSha).toBe(oldSha);
});
