import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash, randomUUID} from 'node:crypto';
import {open, readFile, lstat, unlink, readdir, link} from 'node:fs/promises';
import {hostname} from 'node:os';
import path from 'node:path';
import {MigrationError, migrationHash, assertNoCredentials, loadMigrationRun} from './authorization-migration-state.mjs';

const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const FILE = 'tool-source-amendment.json';
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
export async function inspectMigrationToolSource(repositoryRoot, originalPlanSha, toolSha, git = gitDefault) {
  assert(SHA.test(originalPlanSha ?? '') && SHA.test(toolSha ?? '') && originalPlanSha !== toolSha, 'TOOL_SOURCE_INVALID');
  await cleanHead(repositoryRoot, git, toolSha);
  try {await git(['merge-base', '--is-ancestor', originalPlanSha, toolSha], {cwd: repositoryRoot});}
  catch {throw new MigrationError('TOOL_SOURCE_NOT_DESCENDANT', 'The reviewed tool revision must descend from the immutable plan revision.');}
  const flags = ['--no-renames', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none'];
  const raw = await git(['diff', '--raw', '--no-abbrev', '--full-index', '-z', ...flags, originalPlanSha, toolSha, '--'], {cwd: repositoryRoot});
  const changes = parseToolSourceDiff(raw);
  const patch = await git(['diff', '--binary', '--full-index', '--no-color', '--diff-algorithm=myers', '--no-indent-heuristic', '--unified=3', '--src-prefix=a/', '--dst-prefix=b/', ...flags, originalPlanSha, toolSha, '--'], {cwd: repositoryRoot});
  assert(typeof patch === 'string' && patch.length > 0 && Buffer.byteLength(patch) <= 8 * 1024 * 1024, 'TOOL_SOURCE_DIFF_INVALID');
  // Repeat after reading the complete diff; a concurrent checkout change cannot be adopted.
  await cleanHead(repositoryRoot, git, toolSha);
  return {schemaVersion: 'sodc-authorization-tool-source-proof/v1', originalPlanSha, toolSha, applicationSourceUnchanged: true, changes, rawDiffSha256: digest(raw), patchSha256: digest(patch)};
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
async function adoptionScope(run) {
  strictDev(run);
  const c = run.journal.checkpoints;
  assert(!run.journal.terminal && !run.journal.abortFreeze && c.inspect?.status === 'complete' && c.freeze?.status === 'incomplete' &&
    c.freeze.operationId === run.plan.phaseOperationIds.freeze && Number.isSafeInteger(c.freeze.attempt) && c.freeze.attempt > 0 &&
    Object.keys(c).every(name => ['inspect', 'freeze'].includes(name)), 'TOOL_SOURCE_EARLY_FREEZE_ONLY');
  assert(!await optional(path.join(run.directory, 'abort-freeze-intent.json')), 'TOOL_SOURCE_ABORTING');
  assert((await readdir(run.directory)).every(name => !/^provider-phase-(?!inspect\.json$|freeze\.json$).+\.json$/.test(name)), 'TOOL_SOURCE_LATER_PHASE_PRESENT');
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
function amendment(record, run) {
  assert(keys(record, ['amendment', 'amendmentHash']) && HASH.test(record.amendmentHash ?? '') && migrationHash(record.amendment) === record.amendmentHash, 'TOOL_SOURCE_AMENDMENT_INVALID');
  const value = record.amendment;
  assert(keys(value, ['schemaVersion', 'projectId', 'gitSha', 'runId', 'planHash', 'toolSha', 'reviewReference', 'reason', 'adoptedAt', 'sourceProof', 'freezeStateHash', 'inventoryHash', 'history']) &&
    value.schemaVersion === 'sodc-authorization-tool-source-amendment/v1' && value.projectId === run.plan.projectId && value.gitSha === run.plan.gitSha && value.runId === run.plan.runId && value.planHash === run.planHash &&
    SHA.test(value.toolSha ?? '') && value.toolSha !== value.gitSha && text(value.reviewReference) && text(value.reason) && Number.isFinite(Date.parse(value.adoptedAt)) && HASH.test(value.freezeStateHash ?? '') && HASH.test(value.inventoryHash ?? ''), 'TOOL_SOURCE_AMENDMENT_INVALID');
  strictDev(run); assertNoCredentials(record); return value;
}
async function history(run) {
  const records = [];
  for (const name of ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json', 'provider-old-writers-proof.json', 'provider-old-writers-observed.json']) {
    const bytes = await optional(path.join(run.directory, name)); if (!bytes) continue;
    assertNoCredentials(JSON.parse(bytes)); const hash = digest(bytes), archive = 'evidence/tool-source-before-' + hash + '.json';
    const existing = await optional(path.join(run.directory, archive));
    if (existing) assert(digest(existing) === hash, 'TOOL_SOURCE_HISTORY_CHANGED'); else await immutable(path.join(run.directory, archive), bytes);
    records.push({name, sha256: hash, archive});
  }
  return records;
}
async function verifyHistory(run, rows) {
  const names = ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json', 'provider-freeze-proof.json', 'provider-old-writers-proof.json', 'provider-old-writers-observed.json'];
  assert(Array.isArray(rows) && rows.length >= 4 && rows.length <= 7 && new Set(rows.map(row => row.name)).size === rows.length &&
    ['plan.json', 'journal.json', 'provider-freeze.json', 'provider-old-writer-inventory.json'].every(name => rows.some(row => row.name === name)), 'TOOL_SOURCE_HISTORY_INVALID');
  for (const row of rows) {
    assert(keys(row, ['name', 'sha256', 'archive']) && names.includes(row.name) && HASH.test(row.sha256 ?? '') && row.archive === 'evidence/tool-source-before-' + row.sha256 + '.json', 'TOOL_SOURCE_HISTORY_INVALID');
    assert(digest(await regularBytes(path.join(run.directory, row.archive))) === row.sha256, 'TOOL_SOURCE_HISTORY_CHANGED');
  }
}

/** Local-only amendment. It never rewrites the plan, journal, gates or provider checkpoints. */
export async function adoptMigrationToolSource(options, {confirmProject, toolSha, reviewReference, reason, git = gitDefault, now = new Date()} = {}) {
  assert(confirmProject === 'sodc-web' && options.projectId === 'sodc-web', 'TOOL_SOURCE_STRICT_DEV_ONLY');
  assert(text(reviewReference) && text(reason), 'TOOL_SOURCE_REVIEW_REQUIRED');
  const initial = await loadMigrationRun(options); strictDev(initial);
  return lock(path.join(path.dirname(initial.directory), '.migration.lock'), initial, () => lock(path.join(initial.directory, '.phase.lock'), initial, async () => {
    const run = await loadMigrationRun(options), filename = path.join(run.directory, FILE);
    const old = await optional(filename);
    if (old) {
      const saved = amendment(JSON.parse(old), run);
      assert(saved.toolSha === toolSha && saved.reviewReference === reviewReference && saved.reason === reason, 'TOOL_SOURCE_ALREADY_ADOPTED');
      return verifyMigrationToolSource(run, {repositoryRoot: options.repositoryRoot, git});
    }
    const boundary = await adoptionScope(run);
    const sourceProof = await inspectMigrationToolSource(options.repositoryRoot, run.plan.gitSha, toolSha, git);
    const stamp = new Date(typeof now === 'function' ? now() : now); assert(Number.isFinite(+stamp), 'TOOL_SOURCE_TIME_INVALID');
    const value = {schemaVersion: 'sodc-authorization-tool-source-amendment/v1', projectId: run.plan.projectId, gitSha: run.plan.gitSha, runId: run.plan.runId, planHash: run.planHash,
      toolSha, reviewReference, reason, adoptedAt: stamp.toISOString(), sourceProof, ...boundary, history: await history(run)};
    const record = {amendment: value, amendmentHash: migrationHash(value)}; assertNoCredentials(record);
    // Publish only after all historical bytes are durable, then re-inspect before returning.
    await immutable(filename, Buffer.from(JSON.stringify(record, null, 2) + '\n'));
    return verifyMigrationToolSource(run, {repositoryRoot: options.repositoryRoot, git});
  }));
}

/** Every ordinary phase rechecks the exact adopted tool commit and full original-to-tool diff. */
export async function verifyMigrationToolSource(run, {repositoryRoot, git = gitDefault} = {}) {
  const bytes = await optional(path.join(run.directory, FILE));
  if (!bytes) {await cleanHead(repositoryRoot, git, run.plan.gitSha); return {originalPlanSha: run.plan.gitSha, toolSha: run.plan.gitSha, amendmentHash: null};}
  const record = JSON.parse(bytes), value = amendment(record, run);
  const source = await inspectMigrationToolSource(repositoryRoot, run.plan.gitSha, value.toolSha, git);
  assert(same(source, value.sourceProof), 'TOOL_SOURCE_DIFF_CHANGED');
  await verifyHistory(run, value.history);
  const freeze = JSON.parse(await regularBytes(path.join(run.directory, 'provider-freeze.json'))), inventory = JSON.parse(await regularBytes(path.join(run.directory, 'provider-old-writer-inventory.json')));
  assert(migrationHash(freeze) === value.freezeStateHash && inventory.inventoryHash === value.inventoryHash && migrationHash(inventory.inventory) === value.inventoryHash && same(freeze.oldWriterInventory, inventory.inventory), 'TOOL_SOURCE_FREEZE_BINDING_INVALID');
  for (const name of ['plan.json', 'provider-freeze.json', 'provider-old-writer-inventory.json']) {
    const original = value.history.find(row => row.name === name);
    assert(digest(await regularBytes(path.join(run.directory, name))) === original.sha256, 'TOOL_SOURCE_FREEZE_BINDING_INVALID');
  }
  return {originalPlanSha: run.plan.gitSha, toolSha: value.toolSha, amendmentHash: record.amendmentHash};
}
