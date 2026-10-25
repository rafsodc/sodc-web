import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm, symlink, unlink, realpath, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMigrationPlan, prepareMigrationRun, loadMigrationRun, migrationHash, PHASE_ASSERTIONS, recordMigrationGate, phasesFor} from './authorization-migration-state.mjs';
import {verifyMigrationToolSource, inspectMigrationToolSource, parseToolSourceDiff, MAX_TOOL_SOURCE_AMENDMENTS} from './authorization-migration-tool-source.mjs';
import * as toolModule from './authorization-migration-tool-source.mjs';
import {runMigrationCli} from './authorization-migration.mjs';
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
  const git = sourceGit(), f = {...await loadMigrationRun(options), options, git, put, freeze, inventory, records: []};
  f.adopt = extras => savedAmendment(f, {toolSha: tool, git, ...extras});
  return f;
}


// Synthetic historical files only. This does not call or retain the retired adoption API.
// The verifier must independently validate these v1-v4 wire shapes and their archived bytes.
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function archive(f, names) {
  const rows = [];
  for (const name of [...new Set(names)].sort()) {
    let bytes; try {bytes = await readFile(path.join(f.directory, name));} catch (error) {if (error.code === 'ENOENT') continue; throw error;}
    const sha256 = digest(bytes), archive = 'evidence/tool-source-before-' + sha256 + '.json';
    await writeFile(path.join(f.directory, archive), bytes, {mode: 0o600});
    rows.push({name, sha256, archive});
  }
  return rows;
}
async function savedAmendment(f, {toolSha, git, previousAmendmentHash, completedOpenVerification, productionPreApiOpenRecovery}) {
  const run = await loadMigrationRun(f.options), previous = f.records.at(-1);
  const version = productionPreApiOpenRecovery ? 4 : completedOpenVerification ? 3 : previous ? 2 : 1;
  const names = ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json'];
  const prior = phasesFor(run.plan).slice(0, phasesFor(run.plan).indexOf('open'));
  if (version > 1) {
    names.push(...(await readdir(f.directory)).filter(name => /^provider-phase-(?!open|receipt)/.test(name)));
    names.push(...Object.entries(run.journal.checkpoints).filter(([name, cp]) => prior.includes(name) && cp.status === 'complete').map(([, cp]) => cp.evidenceFile));
  }
  const pinned = version >= 3 ? ['provider-phase-open.json', ...(await readdir(path.join(f.directory, 'gates'))).map(name => 'gates/' + name), ...(await readdir(f.directory)).filter(name => name.startsWith('scheduler-'))] : [];
  if (version >= 3) names.push(...pinned);
  const history = await archive(f, names);
  const value = {schemaVersion: 'sodc-authorization-tool-source-amendment/v' + version, projectId: run.plan.projectId, gitSha: original, runId: run.plan.runId, planHash: run.planHash,
    toolSha, reviewReference: 'historical reviewed tool change', reason: 'completed cutover recovery', adoptedAt: now.toISOString(),
    sourceProof: await inspectMigrationToolSource(f.options.repositoryRoot, original, toolSha, git), freezeStateHash: migrationHash(f.freeze), inventoryHash: migrationHash(f.inventory), history};
  if (previous) Object.assign(value, {previousAmendmentHash, interruptedPhase: version === 3 ? 'open' : 'control-create'});
  if (version === 3) Object.assign(value, {completionKind: 'completed-open-verifier', completionDeltaProof: await inspectMigrationToolSource(f.options.repositoryRoot, previous.amendment.toolSha, toolSha, git),
    completionBindings: {gateEntriesHash: migrationHash(run.journal.gates), priorCheckpointHashes: Object.fromEntries(prior.map(name => [name, migrationHash(run.journal.checkpoints[name])])), files: history.filter(row => pinned.includes(row.name))}});
  if (version === 4) Object.assign(value, {interruptedPhase: 'open', recoveryKind: 'production-pre-api-open-scheduler-target', productionRecoveryBindings: {
    gateEntriesHash: migrationHash(run.journal.gates), priorCheckpointHashes: Object.fromEntries(prior.map(name => [name, migrationHash(run.journal.checkpoints[name])])),
    failedCheckpointHash: migrationHash(run.journal.checkpoints.open), failedOpenFileHash: digest(await readFile(path.join(f.directory, 'provider-phase-open.json'))),
    historyFileHashes: Object.fromEntries(history.map(row => [row.name, row.sha256])), files: history.filter(row => pinned.includes(row.name) && row.name !== 'provider-phase-open.json' || /^provider-phase-(?!open)/.test(row.name) || row.name.startsWith('evidence/'))}});
  const record = {amendment: value, amendmentHash: migrationHash(value)};
  const name = previous ? 'tool-source-amendment-' + previous.amendmentHash + '.json' : 'tool-source-amendment.json';
  await f.put(name, record); f.records.push(record);
  return verifyMigrationToolSource(run, {repositoryRoot: f.options.repositoryRoot, git});
}


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

it('continues to bind archived completed evidence after a successor and halts on any current byte change', async () => {
  const f = await successorFixture(); await f.append();
  await f.put(f.journal.checkpoints.schema.evidenceFile, {});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_COMPLETED_EVIDENCE_CHANGED'});
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

for (const name of ['provider-phase-future.json', 'provider-phase-future.json.tmp', 'provider-phase-receipt.json.next']) it('rejects unknown or partial provider work after completion adoption: ' + name, async () => {
  const f = await completionFixture(); await f.finish();
  await f.put(name, {...f.open, phase: 'future'});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_LATER_PHASE_PRESENT'});
});

it('Production recovery permanently rechecks archived failure and unchanged prior provider records', async () => {
  const f = await productionRecoveryFixture(); await f.recover(); const record = JSON.parse(await readFile(path.join(f.directory, 'tool-source-amendment.json'))), row = record.amendment.history.find(row => row.name === 'provider-phase-open.json');
  await f.put(row.archive, {...f.open, openingStarted: false});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_HISTORY_CHANGED'});
});

it('Production recovery ordinary guards allow saved deferred proofs before scheduler capture succeeds', async () => {
  const f = await productionRecoveryFixture(); await f.recover();
  await f.put('provider-phase-open.json', {...f.open, deferredProofs: ['getMyAuthorizationStatus', 'reconcilePendingSecurityTransitions'].map(name => ({name}))});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).resolves.toMatchObject({originalPlanSha: original, toolSha: tool});
});


it('exports historical verification but no amendment writer', () => {expect(toolModule.adoptMigrationToolSource).toBeUndefined();});
for (const version of [1, 2, 3, 4]) it('verifies saved v' + version + ' records without rewriting any original or archived bytes', async () => {
  const f = version === 4 ? await productionRecoveryFixture() : version === 3 ? await completionFixture() : version === 2 ? await successorFixture() : await fixture();
  if (version === 4) await f.recover(); else if (version === 3) await f.finish(); else if (version === 2) await f.append(); else await f.adopt();
  const names = [...await readdir(f.directory), ...(await readdir(path.join(f.directory, 'evidence'))).map(name => 'evidence/' + name)].filter(name => name.endsWith('.json'));
  const before = await Promise.all(names.map(name => readFile(path.join(f.directory, name))));
  const result = await verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git});
  expect(result.originalPlanSha).toBe(original); expect(result.amendmentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(await Promise.all(names.map(name => readFile(path.join(f.directory, name))))).toEqual(before);
  const loadAdapter = vi.fn(async options => {expect(await options.sourceCheck()).toEqual(result); return {observe: vi.fn(async () => ({projectId: f.plan.projectId, gitSha: original, observedAt: now.toISOString(), authority: {counts: {}}}))};});
  await expect(runMigrationCli(['audit', '--project', f.plan.projectId, '--run-id', f.plan.runId], {repositoryRoot: f.options.repositoryRoot, nodeVersion: '24.22.0', env: {}, git: f.git, loadAdapter, now: () => now})).resolves.toMatchObject({gitSha: original, readOnly: true});
  expect(loadAdapter).toHaveBeenCalledTimes(1);
});
it('continues to verify historical v3 proof after open and receipt checkpoints advance', async () => {
  const f = await completionFixture(); await f.finish(); await f.complete('open', f.open);
  f.journal.checkpoints.receipt = {status: 'complete', operationId: f.plan.phaseOperationIds.receipt, attempt: 1}; await f.put('journal.json', f.journal);
  await f.put('provider-phase-receipt.json', {...f.open, phase: 'receipt'});
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).resolves.toMatchObject({toolSha: 'd'.repeat(40)});
});
it('continues to verify historical v4 proof after deferred proofs, opening and receipt advance', async () => {
  const f = await productionRecoveryFixture(); await f.recover();
  const current = {...f.open, deferredProofs: ['getMyAuthorizationStatus', 'reconcilePendingSecurityTransitions'].map(name => ({name})), deferredSchedulerIntents: [{name: 'projects/' + f.plan.projectId + '/locations/europe-west2/jobs/firebase-schedule-reconcilePendingSecurityTransitions-europe-west2', specHash: 'e'.repeat(64)}], apiOpening: true, completedAt: now.toISOString()};
  await f.put('provider-phase-open.json', current); Object.assign(f.journal.checkpoints.open, {status: 'complete', result: current});
  f.journal.checkpoints.receipt = {status: 'complete', operationId: f.plan.phaseOperationIds.receipt}; await f.put('journal.json', f.journal);
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).resolves.toMatchObject({toolSha: tool});
});
for (const name of ['provider-phase-future.json', 'provider-phase-open.json.next']) it('historical v4 rejects unknown or partial provider file ' + name, async () => {
 const f = await productionRecoveryFixture(); await f.recover(); await f.put(name, {});
 await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_LATER_PHASE_PRESENT'});
});
for (const field of ['projectId', 'gitSha', 'runId', 'planHash', 'sourceProof', 'schemaVersion']) it('rejects tampered historical amendment field ' + field, async () => {
  const f = await fixture(); await f.adopt(); const file = 'tool-source-amendment.json', record = JSON.parse(await readFile(path.join(f.directory, file)));
  record.amendment[field] = field === 'sourceProof' ? {...record.amendment.sourceProof, patchSha256: 'e'.repeat(64)} : 'changed'; record.amendmentHash = migrationHash(record.amendment); await f.put(file, record);
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toThrow();
});
it('rejects orphan chains, wrong predecessor hashes and more than eight saved amendments', async () => {
 const f = await successorFixture(); await f.append(); await f.put('tool-source-amendment-' + '0'.repeat(64) + '.json', {});
 await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_CHAIN_ORPHAN'});
 await unlink(path.join(f.directory, 'tool-source-amendment-' + '0'.repeat(64) + '.json'));
 const file = 'tool-source-amendment-' + f.base.amendmentHash + '.json', record = JSON.parse(await readFile(path.join(f.directory, file)));
 record.amendment.previousAmendmentHash = '0'.repeat(64); record.amendmentHash = migrationHash(record.amendment); await f.put(file, record);
 await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_CHAIN_INVALID'});
 const g = await successorFixture(); let tip = g.base; for (let index = 1; index < MAX_TOOL_SOURCE_AMENDMENTS; index++) tip = await g.append(['c','d','e','f','0','1','2'][index - 1].repeat(40), tip.amendmentHash);
 await expect(g.append('3'.repeat(40), tip.amendmentHash)).rejects.toMatchObject({code: 'TOOL_SOURCE_CHAIN_LIMIT'});
});
it('rejects symlink records and altered immutable plan bytes', async () => {
 const f = await fixture(); await f.adopt(); const filename = path.join(f.directory, 'tool-source-amendment.json'); await unlink(filename); await symlink('journal.json', filename);
 await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_RECORD_UNSAFE'});
 const g = await fixture(); await g.adopt(); const plan = path.join(g.directory, 'plan.json'); await writeFile(plan, Buffer.concat([await readFile(plan), Buffer.from('\n')]), {mode: 0o600});
 await expect(verifyMigrationToolSource(await loadMigrationRun(g.options), {repositoryRoot: g.options.repositoryRoot, git: g.git})).rejects.toMatchObject({code: 'TOOL_SOURCE_FREEZE_BINDING_INVALID'});
});

for (const kind of ['gate-entry', 'gate-file', 'scheduler-file', 'prior-checkpoint']) it('historical v4 rejects pinned recovery drift: ' + kind, async () => {
  const f = await productionRecoveryFixture(); await f.recover();
  if (kind === 'gate-entry') f.journal.gates.acceptance.hash = '0'.repeat(64);
  if (kind === 'gate-file') await f.put(f.journal.gates.acceptance.file, {});
  if (kind === 'scheduler-file') await f.put(f.schedulerNames[0], {});
  if (kind === 'prior-checkpoint') f.journal.checkpoints.activate.result = {changed: true};
  await f.put('journal.json', f.journal);
  await expect(verifyMigrationToolSource(await loadMigrationRun(f.options), {repositoryRoot: f.options.repositoryRoot, git: f.git})).rejects.toThrow();
});
