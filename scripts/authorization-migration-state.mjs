import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, lstat, realpath, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { AUTHORIZATION_MIGRATION_ID } from "./check-authorization-migration.mjs";

export const MIGRATION_PROJECTS = Object.freeze({
  "sodc-web": "dev", "sodc-web-beta": "beta", "sodc-web-production": "prod",
});
export const MIGRATION_PHASES = Object.freeze([
  "inspect", "freeze", "schema", "compatibility", "control-create", "backfill",
  "functions", "activate", "strict-api", "open", "receipt",
]);
export const PHASE_ASSERTIONS = Object.freeze({
  inspect: ["targetVerified", "baselineCaptured"],
  freeze: ["serverFreezeVerified", "signedRefusalVerified", "onboardingDenied", "jobsBlocked", "oldWritersRetired", "drainComplete"],
  schema: ["schemaMatches", "authorizationConnectorMatches", "freezePreserved"],
  compatibility: ["compatibilityMatches", "onboardingDenied", "freezePreserved"],
  "control-create": ["controlExists", "freezePreserved"],
  backfill: ["backfillComplete", "mirrorsCurrent", "administratorsVerified", "freezePreserved"],
  functions: ["functionsMatch", "freezePreserved", "repairEndpointsDeferred"],
  activate: ["controlReady", "administratorsVerified", "freezePreserved"],
  "strict-api": ["strictApiReady", "legacyWritersAbsent", "freezePreserved"],
  open: ["schemaMatches", "authorizationConnectorMatches", "strictApiReady", "adminSafetyControlReady", "functionsMatch", "invokersRestored", "schedulersVerified"],
  receipt: ["backfillComplete", "schemaMatches", "authorizationConnectorMatches", "strictApiReady", "adminSafetyControlReady", "functionsMatch", "invokersRestored", "schedulersVerified"],
});
const GATE_DETAILS = Object.freeze({
  backup: ["backupReference", "restoreTestReference", "waiverReference"],
  "freeze-scope": ["entrypoints", "jobNames", "externalWritersReference", "probeUserId", "probeReference"],
  "old-writers": ["method", "freezeStateHash", "inventoryHash", "successorRevisions", "externalOperationsReference"],
  "sql-review": ["diffSha256"],
  acceptance: ["sourceProjectId", "backendTestReference", "browserReviewReference", "notificationsReference", "schedulerVolumeReference", "appCheckReference"],
});
const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_MS = 5 * 60 * 1000;

export class MigrationError extends Error {
  constructor(code, message) { super(message); this.name = "MigrationError"; this.code = code; }
}
function requireThat(condition, code, message) { if (!condition) throw new MigrationError(code, message); }
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  requireThat(value !== undefined && (typeof value !== "number" || Number.isFinite(value)), "INVALID_JSON", "Migration records require finite JSON values.");
  return JSON.stringify(value);
}
export const migrationHash = value => createHash("sha256").update(stableJson(value)).digest("hex");
function text(value, max = 500) { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
function exactKeys(value, allowed) { return object(value) && Object.keys(value).every(key => allowed.includes(key)); }
export function assertProject(projectId) {
  requireThat(Object.hasOwn(MIGRATION_PROJECTS, projectId ?? ""), "TARGET_REQUIRED", "Use an explicit supported Firebase project ID, never an alias.");
  return MIGRATION_PROJECTS[projectId];
}
export function assertNode24(version = process.versions.node) {
  requireThat(/^24\./.test(version), "NODE_24_REQUIRED", "Use Node 24 for migration preparation and execution.");
}
export function assertMigrationEnvironment(projectId, env = process.env) {
  assertProject(projectId);
  for (const [key, value] of Object.entries(env)) {
    requireThat(!(key.endsWith("_EMULATOR_HOST") && value), "EMULATOR_FORBIDDEN", "Cloud migration refuses emulator overrides.");
    if (["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"].includes(key)) requireThat(!value || value === projectId, "TARGET_CONFLICT", "Conflicting Firebase project configuration.");
  }
  if (env.FIREBASE_CONFIG) {
    let config; try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { /* Rejected below. */ }
    requireThat(config?.projectId === projectId, "TARGET_CONFLICT", "FIREBASE_CONFIG must name the selected project.");
  }
}
export function phasesFor(plan) { return MIGRATION_PHASES.filter(phase => phase !== "compatibility" || plan.installation === "legacy"); }
export function createMigrationPlan({projectId, runId, gitSha, operator, reason, installation, artifactDirectory, importAdmins = false, now = new Date()}) {
  const environment = assertProject(projectId);
  requireThat(/^[a-z0-9][a-z0-9-]{2,47}$/.test(runId ?? ""), "RUN_ID_INVALID", "Use a 3–48 character lowercase run ID containing letters, digits or hyphens.");
  requireThat(/^[a-f0-9]{40}$/.test(gitSha ?? ""), "REVISION_REQUIRED", "A full reviewed Git commit is required.");
  requireThat(text(operator, 128) && text(reason), "OPERATOR_REQUIRED", "Record the operator and reason for this migration.");
  requireThat(["legacy", "strict"].includes(installation), "INSTALLATION_REQUIRED", "Explicitly select legacy or strict; live inspection must agree before any write.");
  requireThat(path.isAbsolute(artifactDirectory ?? ""), "ARTIFACT_PATH_REQUIRED", "Specify a new absolute artifact directory outside the checkout.");
  requireThat(typeof importAdmins === "boolean", "IMPORT_POLICY_INVALID", "Legacy administrator adoption must be an explicit plan choice.");
  const plan = {schemaVersion: "sodc-authorization-migration-plan/v1", migrationId: AUTHORIZATION_MIGRATION_ID,
    projectId, environment, runId, gitSha, operator, reason, installation, importAdmins,
    artifactDirectory: path.resolve(artifactDirectory), createdAt: now.toISOString(),
    phaseOperationIds: Object.fromEntries(MIGRATION_PHASES.map(phase => [phase, `auth-migration:${runId}:${gitSha.slice(0, 12)}:${phase}`]))};
  assertNoCredentials(plan); return plan;
}
export function migrationRunDirectory(repositoryRoot, projectId, runId) {
  assertProject(projectId);
  requireThat(/^[a-z0-9][a-z0-9-]{2,47}$/.test(runId ?? ""), "RUN_ID_INVALID", "Invalid migration run ID.");
  return path.join(repositoryRoot, ".firebase/authorization-migration/runs", projectId, runId);
}
export function assertNoCredentials(value, key = "") {
  requireThat(!/(?:password|secret|api.?key|access.?token|refresh.?token|id.?token|authorization.?header)/i.test(key), "CREDENTIAL_RECORD_FORBIDDEN", "Credentials must stay in memory and must not be recorded in migration evidence.");
  if (typeof value === "string") requireThat(!/(?:-----BEGIN [\w ]*PRIVATE KEY-----|\bBearer\s+\S{20,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+)/.test(value), "CREDENTIAL_RECORD_FORBIDDEN", "Migration records must not contain credentials.");
  else if (Array.isArray(value)) for (const item of value) assertNoCredentials(item);
  else if (object(value)) for (const [name, item] of Object.entries(value)) assertNoCredentials(item, name);
}
async function readRecord(file) {
  const info = await lstat(file);
  requireThat(info.isFile() && !info.isSymbolicLink(), "UNSAFE_RECORD_PATH", "Migration records must be regular files, not symlinks.");
  return JSON.parse(await readFile(file, "utf8"));
}
async function atomicRecord(file, value) {
  assertNoCredentials(value);
  try { const info = await lstat(file); requireThat(info.isFile() && !info.isSymbolicLink(), "UNSAFE_RECORD_PATH", "Refusing to replace a non-regular migration record."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2) + "\n"); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, file);
}
async function assertPrivateRunRoot(repositoryRoot, directory) {
  const [root, run] = await Promise.all([realpath(repositoryRoot), realpath(directory)]);
  requireThat(run.startsWith(path.join(root, ".firebase", "authorization-migration", "runs") + path.sep), "UNSAFE_RUN_PATH", "Migration run resolves outside the repository's private run store.");
  let ancestor = directory;
  while (path.resolve(ancestor) !== path.resolve(repositoryRoot)) {
    const info = await lstat(ancestor);
    requireThat(info.isDirectory() && !info.isSymbolicLink(), "UNSAFE_RUN_PATH", "Private migration directories must not be symlinks.");
    ancestor = path.dirname(ancestor);
  }
}
async function createPrivateRunParent(repositoryRoot, projectId) {
  let directory = await realpath(repositoryRoot);
  for (const name of [".firebase", "authorization-migration", "runs", projectId]) {
    directory = path.join(directory, name);
    try { await mkdir(directory, {mode: 0o700}); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const info = await lstat(directory);
    requireThat(info.isDirectory() && !info.isSymbolicLink(), "UNSAFE_RUN_PATH", "Private migration directories must not be symlinks.");
  }
}
export async function prepareMigrationRun({repositoryRoot, plan}) {
  const root = await realpath(repositoryRoot);
  const artifactParent = await realpath(path.dirname(plan.artifactDirectory));
  const artifact = path.join(artifactParent, path.basename(plan.artifactDirectory));
  requireThat(artifact !== root && !artifact.startsWith(root + path.sep), "UNSAFE_ARTIFACT_PATH", "Deployment artifacts must be outside the checkout.");
  try { await lstat(plan.artifactDirectory); throw new MigrationError("ARTIFACT_EXISTS", "Choose a new artifact directory; existing sources are never overwritten."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const directory = migrationRunDirectory(repositoryRoot, plan.projectId, plan.runId);
  await createPrivateRunParent(repositoryRoot, plan.projectId);
  await mkdir(directory, {mode: 0o700}); // Existing runs cannot be overwritten.
  await assertPrivateRunRoot(repositoryRoot, directory);
  await mkdir(path.join(directory, "gates"), {mode: 0o700});
  await mkdir(path.join(directory, "evidence"), {mode: 0o700});
  const planHash = migrationHash(plan);
  const handle = await open(path.join(directory, "plan.json"), "wx", 0o600);
  try { await handle.writeFile(JSON.stringify({plan, planHash}, null, 2) + "\n"); await handle.sync(); } finally { await handle.close(); }
  await atomicRecord(path.join(directory, "journal.json"), {schemaVersion: "sodc-authorization-migration-journal/v1", planHash, checkpoints: {}, gates: {}, events: []});
  return {directory, planHash};
}
export async function loadMigrationRun({repositoryRoot, projectId, runId}) {
  const directory = migrationRunDirectory(repositoryRoot, projectId, runId);
  await assertPrivateRunRoot(repositoryRoot, directory);
  for (const name of ["gates", "evidence"]) {
    const info = await lstat(path.join(directory, name));
    requireThat(info.isDirectory() && !info.isSymbolicLink(), "UNSAFE_RUN_PATH", "Private evidence directories must not be symlinks.");
  }
  const [{plan, planHash}, journal] = await Promise.all([readRecord(path.join(directory, "plan.json")), readRecord(path.join(directory, "journal.json"))]);
  requireThat(plan?.schemaVersion === "sodc-authorization-migration-plan/v1" && plan.migrationId === AUTHORIZATION_MIGRATION_ID && plan.projectId === projectId && plan.runId === runId && migrationHash(plan) === planHash && journal.planHash === planHash, "PLAN_CHANGED", "Migration plan or journal does not match this immutable run.");
  const createdAt = new Date(plan.createdAt);
  requireThat(Number.isFinite(createdAt.getTime()) && migrationHash(createMigrationPlan({...plan, now: createdAt})) === planHash, "PLAN_CHANGED", "Migration plan fields or operation IDs are invalid.");
  const journalSchema = journal.schemaVersion === "sodc-authorization-migration-journal/v1" ||
    (journal.schemaVersion === "sodc-authorization-migration-aborted-journal/v1" && journal.status === "ABORTED" && journal.terminal?.status === "ABORTED" && journal.terminal.kind === "abort-freeze" && journal.abortFreeze?.status === "complete");
  requireThat(journalSchema && object(journal.checkpoints) && object(journal.gates) && Array.isArray(journal.events), "JOURNAL_INVALID", "Migration journal is malformed.");
  return {directory, plan, planHash, journal};
}
async function withRunLock(directory, work) {
  const file = path.join(directory, ".phase.lock");
  let handle; try { handle = await open(file, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new MigrationError("RUN_LOCKED", "Another phase owns this run. Inspect status; do not run migrations concurrently."); throw error; }
  try { await handle.writeFile(JSON.stringify({pid: process.pid, hostname: hostname(), startedAt: new Date().toISOString()})); await handle.sync(); return await work(); }
  finally { await handle.close(); await unlink(file); }
}
async function withProjectLock(run, work) {
  const file = path.join(path.dirname(run.directory), ".migration.lock");
  let handle;
  try { handle = await open(file, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new MigrationError("PROJECT_LOCKED", "Another phase owns this project. Resume that run after inspecting its state."); throw error; }
  try {
    await handle.writeFile(JSON.stringify({pid: process.pid, hostname: hostname(), runId: run.plan.runId, planHash: run.planHash, startedAt: new Date().toISOString()}));
    await handle.sync();
    const ownerFile = path.join(path.dirname(run.directory), "active-run.json");
    let owner;
    try { owner = await readRecord(ownerFile); } catch (error) { if (error.code !== "ENOENT") throw error; }
    requireThat(!owner || owner.planHash === run.planHash || ["complete", "aborted"].includes(owner.status), "PROJECT_RUN_ACTIVE", "This project has an unfinished migration. Resume its original run; never open traffic from another run.");
    if (owner?.planHash !== run.planHash) await atomicRecord(ownerFile, {runId: run.plan.runId, planHash: run.planHash, status: "active"});
    return await work(ownerFile);
  } finally { await handle.close(); await unlink(file); }
}
export async function unlockMigrationRun(options, reason, isAlive = pid => {try {process.kill(pid, 0); return true;} catch (error) {return error.code !== "ESRCH";}}) {
  requireThat(text(reason), "UNLOCK_REASON_REQUIRED", "Explain why the interrupted local lock can be removed.");
  const run = await loadMigrationRun(options);
  const locks = [];
  for (const file of [path.join(path.dirname(run.directory), ".migration.lock"), path.join(run.directory, ".phase.lock")]) {
    let lock; try { lock = await readRecord(file); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    requireThat(!lock.planHash || lock.planHash === run.planHash, "LOCK_RUN_MISMATCH", "This lock belongs to another migration run.");
    requireThat(Number.isInteger(lock.pid) && lock.pid > 0 && lock.hostname === hostname() && !isAlive(lock.pid), "LOCK_OWNER_LIVE", "The lock's owner is live or cannot be verified on this host; it cannot be unlocked.");
    locks.push(file);
  }
  requireThat(locks.length > 0, "LOCK_MISSING", "No interrupted local lock exists for this run.");
  run.journal.events.push({event: "stale-lock-removed", reason, at: new Date().toISOString()});
  await atomicRecord(path.join(run.directory, "journal.json"), run.journal);
  // Remove the project lock last, after all run-local state has been persisted.
  for (const file of locks.reverse()) await unlink(file);
}
function validTime(value, now, age) { const stamp = Date.parse(value); return Number.isFinite(stamp) && stamp <= now.getTime() + 30_000 && now.getTime() - stamp <= age; }
export function validateMigrationGate(gate, plan, now = new Date()) {
  requireThat(exactKeys(gate, ["schemaVersion", "gate", "projectId", "gitSha", "runId", "reviewedBy", "observedAt", "evidence", "details"]) && gate.schemaVersion === "sodc-authorization-migration-gate/v1" && Object.hasOwn(GATE_DETAILS, gate.gate ?? ""), "GATE_INVALID", "Use the documented typed operator gate envelope.");
  requireThat(gate.projectId === plan.projectId && gate.gitSha === plan.gitSha && gate.runId === plan.runId, "GATE_TARGET_MISMATCH", "Gate must bind this exact project, release revision and run.");
  requireThat(text(gate.reviewedBy, 128) && text(gate.evidence, 2000) && validTime(gate.observedAt, now, DAY_MS), "GATE_STALE", "Gate needs a named reviewer, evidence reference and review within the last 24 hours.");
  const details = gate.details;
  requireThat(exactKeys(details, GATE_DETAILS[gate.gate]), "GATE_DETAILS_INVALID", "Unexpected or missing gate detail object.");
  if (gate.gate === "backup") {
    const waiver = text(details.waiverReference, 2000);
    requireThat(waiver ? plan.environment === "dev" && !details.backupReference && !details.restoreTestReference : text(details.backupReference, 2000) && text(details.restoreTestReference, 2000), "BACKUP_REQUIRED", "Beta/production require backup and isolated restore-test references; only Dev permits an explicit waiver.");
  } else if (gate.gate === "freeze-scope") {
    for (const name of ["entrypoints", "jobNames"]) requireThat(Array.isArray(details[name]) && details[name].every(value => typeof value === "string" && /^[A-Za-z0-9_/-]{1,250}$/.test(value)) && new Set(details[name]).size === details[name].length, "FREEZE_SCOPE_INVALID", "Freeze entrypoints/jobs must be explicit unique provider names.");
    requireThat(details.entrypoints.length > 0 && text(details.externalWritersReference, 2000) && /^[A-Za-z0-9_-]{1,128}$/.test(details.probeUserId ?? "") && text(details.probeReference, 2000), "FREEZE_SCOPE_INVALID", "Freeze approval must cover external writers and an approved existing nonadmin probe identity.");
  } else if (gate.gate === "old-writers") {
    const revisions = details.successorRevisions;
    const digest = value => typeof value === "string" && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
    requireThat(details.method === "cloud-run-retirement" && digest(details.freezeStateHash) && digest(details.inventoryHash) && text(details.externalOperationsReference, 2000) && Array.isArray(revisions) && revisions.length <= 10000, "OLD_WRITERS_GATE_INVALID", "Record the bound retirement method, hashes, successors and external-operation review.");
    const name = new RegExp(`^projects/${plan.projectId}/locations/europe-west2/services/[a-z][a-z0-9-]*/revisions/[a-z][a-z0-9-]*$`);
    const image = /^[A-Za-z0-9.-]+(?::[0-9]+)?\/[A-Za-z0-9_./-]+@sha256:[a-f0-9]{64}$/;
    requireThat(revisions.every(revision => exactKeys(revision, ["name", "uid", "images"]) && typeof revision.name === "string" && !/\s/.test(revision.name) && name.test(revision.name) && typeof revision.uid === "string" && revision.uid.length === 36 && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(revision.uid) && Array.isArray(revision.images) && revision.images.length > 0 && revision.images.every(value => typeof value === "string" && !/\s/.test(value) && image.test(value))), "OLD_WRITERS_GATE_INVALID", "Successors must be flat target revision identities with UUIDv4 UIDs and immutable image digests.");
    requireThat(new Set(revisions.map(revision => revision.name)).size === revisions.length, "OLD_WRITERS_GATE_INVALID", "Successor revision names must be unique.");
  } else if (gate.gate === "sql-review") {
    requireThat(/^[a-f0-9]{64}$/.test(details.diffSha256 ?? ""), "SQL_REVIEW_REQUIRED", "SQL review must identify the exact inspected diff SHA-256.");
  } else {
    requireThat(details.sourceProjectId === (plan.environment === "prod" ? "sodc-web" : plan.projectId) && GATE_DETAILS.acceptance.filter(key => key !== "sourceProjectId").every(key => text(details[key], 2000)), "ACCEPTANCE_REQUIRED", "Record same-release backend, browser-review, notification, volume and App Check evidence; production uses Dev acceptance.");
  }
  assertNoCredentials(gate); return gate;
}
export async function recordMigrationGate(options, gate, now = new Date()) {
  const initial = await loadMigrationRun(options);
  await assertNotAborting(initial);
  return withRunLock(initial.directory, async () => {
    const run = await loadMigrationRun(options); await assertNotAborting(run); validateMigrationGate(gate, run.plan, now);
    const filename = `gates/${gate.gate}-${migrationHash(gate)}.json`;
    await atomicRecord(path.join(run.directory, filename), gate);
    run.journal.gates[gate.gate] = {file: filename, hash: migrationHash(gate)};
    run.journal.events.push({event: "operator-gate-recorded", gate: gate.gate, at: now.toISOString()});
    await atomicRecord(path.join(run.directory, "journal.json"), run.journal);
    return {gate: gate.gate, hash: migrationHash(gate)};
  });
}
function safeRelative(file) { return typeof file === "string" && !path.isAbsolute(file) && !file.split(/[\\/]/).includes("..") && !file.includes("\0"); }
async function verifiedGates(run, now) {
  const gates = {};
  for (const [name, entry] of Object.entries(run.journal.gates)) {
    requireThat(safeRelative(entry.file) && entry.file.startsWith("gates/"), "GATE_PATH_INVALID", "Unsafe gate evidence path.");
    const gate = await readRecord(path.join(run.directory, entry.file));
    requireThat(migrationHash(gate) === entry.hash && gate.gate === name, "GATE_CHANGED", "Recorded operator gate changed.");
    validateMigrationGate(gate, run.plan, now); gates[name] = gate;
  }
  return gates;
}
function requireGates(phase, gates) {
  const required = phase === "inspect" ? [] : ["backup", "freeze-scope"];
  if (!["inspect", "freeze"].includes(phase)) required.push("old-writers", "sql-review");
  if (["open", "receipt"].includes(phase)) required.push("acceptance");
  requireThat(required.every(name => gates[name]), "GATES_MISSING", `Phase ${phase} requires reviewed gates: ${[...new Set(required)].join(", ")}.`);
}
export function assertPhaseVerification(phase, verification, plan, now = new Date()) {
  const evidence = verification?.evidence;
  requireThat(verification?.ok === true && evidence?.projectId === plan.projectId && evidence.gitSha === plan.gitSha && evidence.runId === plan.runId && evidence.planHash === migrationHash(plan) && validTime(evidence.observedAt, now, FRESH_MS) && PHASE_ASSERTIONS[phase].every(key => evidence.assertions?.[key] === true), "PHASE_NOT_VERIFIED", `Phase ${phase} has not passed fresh provider verification; keep the freeze and inspect its evidence.`);
  assertNoCredentials(evidence); return evidence;
}
async function readVerifiedCheckpoint(run, phase) {
  const checkpoint = run.journal.checkpoints[phase];
  requireThat(checkpoint?.status === "complete" && safeRelative(checkpoint.evidenceFile) && checkpoint.evidenceFile.startsWith("evidence/"), "PHASE_ORDER", `Complete and verify phase ${phase} first.`);
  const record = await readRecord(path.join(run.directory, checkpoint.evidenceFile));
  requireThat(migrationHash(record) === checkpoint.evidenceHash && record.phase === phase && record.planHash === run.planHash && record.operationId === run.plan.phaseOperationIds[phase] && migrationHash(record.result) === migrationHash(checkpoint.result), "CHECKPOINT_CHANGED", "Completed phase evidence or its retained result changed or belongs to another run.");
  requireThat(record.evidence?.projectId === run.plan.projectId && record.evidence.gitSha === run.plan.gitSha && record.evidence.runId === run.plan.runId && record.evidence.planHash === run.planHash && PHASE_ASSERTIONS[phase].every(flag => record.evidence.assertions?.[flag] === true), "CHECKPOINT_CHANGED", "Historical phase proof does not bind this verified run.");
  return record;
}
export async function executeMigrationPhase(options, {phase, confirmProject, adapter, sourceCheck, now = () => new Date()}) {
  const initial = await loadMigrationRun(options);
  await assertNotAborting(initial);
  requireThat(confirmProject === initial.plan.projectId, "CONFIRM_PROJECT_REQUIRED", "--confirm-project must exactly repeat the target project ID.");
  requireThat(phasesFor(initial.plan).includes(phase), "PHASE_INVALID", "Unknown phase or compatibility requested for an already strict installation.");
  return withProjectLock(initial, ownerFile => withRunLock(initial.directory, async () => {
    const run = await loadMigrationRun(options); await assertNotAborting(run); await sourceCheck(run.plan);
    const sequence = phasesFor(run.plan); const index = sequence.indexOf(phase);
    const checkpoints = {...run.journal.checkpoints};
    for (const previous of sequence.slice(0, index)) {
      const record = await readVerifiedCheckpoint(run, previous);
      checkpoints[previous] = {...checkpoints[previous], result: record.result};
    }
    const baseline = index > 0 ? checkpoints.inspect.result.baseline : undefined;
    if (index > 0) requireThat(object(baseline) && migrationHash(baseline) === migrationHash(run.journal.baseline), "BASELINE_CHANGED", "Retained baseline differs from verified inspection evidence.");
    if (run.journal.checkpoints[phase]?.status === "complete") {
      const record = await readVerifiedCheckpoint(run, phase);
      const gates = await verifiedGates(run, now()); requireGates(phase, gates);
      // Verification is live even for a recorded completed phase. Never trust its journal alone.
      const verification = await adapter.verify(phase, {baseline: phase === "inspect" ? record.result.baseline : baseline, checkpoints, gates, result: record.result, planHash: run.planHash});
      assertPhaseVerification(phase, verification, run.plan, now());
      if (phase === "receipt") {
        await writeMigrationReceipt(options.repositoryRoot, run, verification.evidence);
        await atomicRecord(ownerFile, {runId: run.plan.runId, planHash: run.planHash, status: "complete"});
      }
      return {phase, status: "verified-existing", evidence: verification.evidence};
    }
    const gates = await verifiedGates(run, now()); requireGates(phase, gates);
    const observation = await adapter.observe(); assertNoCredentials(observation);
    requireThat(observation.projectId === run.plan.projectId && observation.gitSha === run.plan.gitSha && validTime(observation.observedAt, now(), FRESH_MS), "OBSERVATION_INVALID", "Fresh provider observation must bind this exact target/revision.");
    const previous = run.journal.checkpoints[phase] ?? {};
    run.journal.checkpoints[phase] = {...previous, status: "incomplete", operationId: run.plan.phaseOperationIds[phase], attempt: (previous.attempt ?? 0) + 1, startedAt: now().toISOString()};
    await atomicRecord(path.join(run.directory, "journal.json"), run.journal);
    const context = {baseline, checkpoints: {...checkpoints, [phase]: run.journal.checkpoints[phase]}, gates, planHash: run.planHash,
      freezeScopeApproved: Boolean(gates["freeze-scope"]),
      probeApproval: gates["freeze-scope"] ? {uid: gates["freeze-scope"].details.probeUserId, reference: gates["freeze-scope"].details.probeReference} : null,
      reviewedSqlHash: gates["sql-review"]?.details.diffSha256,
      observation, result: previous.result};
    try {
      const result = await adapter.perform(phase, context);
      assertNoCredentials(result);
      run.journal.checkpoints[phase].result = result;
      // Persist outcome hints before verification. A refused drain/opening check must resume the same intent.
      await atomicRecord(path.join(run.directory, "journal.json"), run.journal);
      const verification = await adapter.verify(phase, {...context, result});
      const evidence = assertPhaseVerification(phase, verification, run.plan, now());
      if (phase === "inspect") { requireThat(object(result.baseline), "BASELINE_MISSING", "Inspection must retain a provider baseline before mutations."); run.journal.baseline = result.baseline; }
      const record = {schemaVersion: "sodc-authorization-migration-phase/v1", phase, planHash: run.planHash, operationId: run.plan.phaseOperationIds[phase], evidence, result};
      const file = `evidence/${phase}-${migrationHash(record)}.json`;
      await atomicRecord(path.join(run.directory, file), record);
      Object.assign(run.journal.checkpoints[phase], {status: "complete", completedAt: now().toISOString(), evidenceFile: file, evidenceHash: migrationHash(record)});
      if (phase === "receipt") await writeMigrationReceipt(options.repositoryRoot, run, evidence);
      await atomicRecord(path.join(run.directory, "journal.json"), run.journal);
      if (phase === "receipt") await atomicRecord(ownerFile, {runId: run.plan.runId, planHash: run.planHash, status: "complete"});
      return {phase, status: "complete", evidence};
    } catch (error) {
      run.journal.checkpoints[phase].status = "incomplete";
      run.journal.checkpoints[phase].lastError = /^[A-Z][A-Z0-9_]{2,80}$/.test(error.code ?? "") ? error.code : "PHASE_INCOMPLETE";
      await atomicRecord(path.join(run.directory, "journal.json"), run.journal);
      throw error;
    }
  }));
}
async function assertNotAborting(run) {
  requireThat(!run.journal.terminal && !run.journal.abortFreeze, "RUN_ABORTED_OR_ABORTING", "An aborting or aborted run cannot resume normal phases or accept gates.");
  try { await lstat(path.join(run.directory, "abort-freeze-intent.json")); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new MigrationError("RUN_ABORTED_OR_ABORTING", "A durable abort intent blocks all normal phases, including after an interrupted journal write.");
}
async function syncDirectory(directory) { const handle = await open(directory, "r"); try { await handle.sync(); } finally { await handle.close(); } }
async function immutableAbortRecord(file, value) {
  assertNoCredentials(value); const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2) + "\n"); await handle.sync(); } finally { await handle.close(); }
  await syncDirectory(path.dirname(file));
}

/** Explicit restoration of an untouched strict Dev release after only its freeze failed. */
export async function abortMigrationFreeze(options, {confirmProject, reason, adapter, sourceCheck, now = () => new Date()}) {
  const {assertAbortScope, validateAbortSource, assertAbortEvidence} = await import("./authorization-migration-abort.mjs");
  const initial = await loadMigrationRun(options); assertAbortScope(initial);
  requireThat(confirmProject === "sodc-web" && text(reason), "ABORT_CONFIRMATION_REQUIRED", "Repeat literal sodc-web and explain the interrupted-freeze restoration.");
  return withProjectLock(initial, ownerFile => withRunLock(initial.directory, async () => {
    const run = await loadMigrationRun(options); assertAbortScope(run);
    const recoverySource = validateAbortSource(await sourceCheck(run.plan), run.plan);
    const inspected = await readVerifiedCheckpoint(run, "inspect");
    const baseline = inspected.result.baseline;
    requireThat(object(baseline) && migrationHash(baseline) === migrationHash(run.journal.baseline), "BASELINE_CHANGED", "Abort requires the original hash-bound inspected baseline.");
    const files = await readdir(run.directory);
    requireThat(!files.some(name => /^provider-phase-(?!freeze(?:\.|-))/.test(name)), "ABORT_LATER_PROVIDER_PHASE", "A later provider operation prevents early-freeze recovery.");
    const identity = {schemaVersion: "sodc-authorization-abort-freeze-intent/v1", projectId: run.plan.projectId, gitSha: run.plan.gitSha,
      runId: run.plan.runId, planHash: run.planHash, baselineHash: migrationHash(baseline), freezeCheckpointHash: migrationHash(run.journal.checkpoints.freeze), reason};
    const intentFile = path.join(run.directory, "abort-freeze-intent.json");
    let intent;
    try { intent = await readRecord(intentFile); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (intent) {
      requireThat(Object.entries(identity).every(([key, value]) => migrationHash(intent[key]) === migrationHash(value)), "ABORT_INTENT_CHANGED", "Retry only the exact original abort intent and reason.");
      validateAbortSource(intent.initialRecoverySource, run.plan);
    } else {
      intent = {...identity, initialRecoverySource: recoverySource, createdAt: now().toISOString()};
      await immutableAbortRecord(intentFile, intent);
    }
    const prior = run.journal.abortFreeze;
    requireThat(!prior || prior.intentHash === migrationHash(intent), "ABORT_INTENT_CHANGED", "The retained abort journal must bind its original immutable intent.");
    // Preserve all original checkpoints and outcomes. This is not a completed migration phase.
    run.journal.abortFreeze = {...prior, status: "incomplete", intentHash: migrationHash(intent), attempt: (prior?.attempt ?? 0) + 1,
      recoveryToolSha: recoverySource.recoveryToolSha, startedAt: now().toISOString()};
    if (run.journal.terminal) {
      // An already verified terminal record is retained during ownership reconciliation.
      run.journal.abortFreeze.status = "complete";
    }
    await atomicRecord(path.join(run.directory, "journal.json"), run.journal); await syncDirectory(run.directory);
    try {
      requireThat(typeof adapter.abortFreeze === "function", "ABORT_PROVIDER_UNAVAILABLE", "The reviewed provider must support explicit interrupted-freeze restoration.");
      const verification = await adapter.abortFreeze({baseline, planHash: run.planHash, checkpoints: run.journal.checkpoints, reason, recoverySource, abortIntent: intent});
      const evidence = assertAbortEvidence(verification, run, recoverySource, now(), migrationHash(intent)); assertNoCredentials(evidence);
      const record = {schemaVersion: "sodc-authorization-abort-freeze/v1", planHash: run.planHash, intentHash: migrationHash(intent), reason, recoverySource, evidence};
      const evidenceFile = "evidence/abort-freeze-" + migrationHash(record) + ".json";
      try { await immutableAbortRecord(path.join(run.directory, evidenceFile), record); }
      catch (error) { if (error.code !== "EEXIST") throw error; requireThat(migrationHash(await readRecord(path.join(run.directory, evidenceFile))) === migrationHash(record), "ABORT_EVIDENCE_CHANGED", "Existing recovery proof must remain immutable."); }
      Object.assign(run.journal.abortFreeze, {status: "complete", completedAt: now().toISOString(), evidenceFile, evidenceHash: migrationHash(record)});
      run.journal.status = "ABORTED";
      run.journal.terminal ??= {status: "ABORTED", kind: "abort-freeze", reason, recoveryToolSha: recoverySource.recoveryToolSha, evidenceFile, evidenceHash: migrationHash(record), recordedAt: now().toISOString()};
      // The original tool deliberately cannot read this terminal schema and resume old phases.
      run.journal.schemaVersion = "sodc-authorization-migration-aborted-journal/v1";
      run.journal.events.push({event: "freeze-aborted-original-boundary-restored", reason, recoveryToolSha: recoverySource.recoveryToolSha, evidenceFile, at: now().toISOString()});
      await atomicRecord(path.join(run.directory, "journal.json"), run.journal); await syncDirectory(run.directory);
      await atomicRecord(ownerFile, {runId: run.plan.runId, planHash: run.planHash, status: "aborted", evidenceHash: migrationHash(record)}); await syncDirectory(path.dirname(ownerFile));
      return {status: "ABORTED", evidence, evidenceFile, recoveryToolSha: recoverySource.recoveryToolSha};
    } catch (error) {
      if (!run.journal.terminal) {
        run.journal.abortFreeze.status = "incomplete";
        run.journal.abortFreeze.lastError = /^[A-Z][A-Z0-9_]{2,80}$/.test(error.code ?? "") ? error.code : "ABORT_INCOMPLETE";
        await atomicRecord(path.join(run.directory, "journal.json"), run.journal); await syncDirectory(run.directory);
      }
      throw error;
    }
  }));
}
async function writeMigrationReceipt(repositoryRoot, run, evidence) {
  for (const phase of phasesFor(run.plan)) {
    if (phase === "receipt") continue;
    const record = await readVerifiedCheckpoint(run, phase);
    requireThat(PHASE_ASSERTIONS[phase].every(flag => record.evidence.assertions?.[flag] === true), "RECEIPT_EVIDENCE_INCOMPLETE", "Migration receipt cannot be written from incomplete phase evidence.");
  }
  const receipt = {schemaVersion: "sodc-authorization-migration/v1", migrationId: AUTHORIZATION_MIGRATION_ID,
    projectId: run.plan.projectId, gitSha: run.plan.gitSha, backfillComplete: true, strictApiReady: true,
    adminSafetyControlReady: true, securityWriteFreezeVerified: true, reviewedBy: run.plan.operator,
    recordedAt: evidence.observedAt, evidence: path.relative(repositoryRoot, path.join(run.directory, "journal.json")),
    migrationRunId: run.plan.runId, migrationPlanHash: run.planHash};
  const target = path.join(repositoryRoot, ".firebase/authorization-migration", `${run.plan.projectId}.json`);
  // Never silently replace a previous project's operator receipt.
  try { const old = await readRecord(target); requireThat(old.migrationPlanHash === run.planHash, "RECEIPT_EXISTS", "A different migration receipt already exists; preserve and review it separately."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await atomicRecord(target, receipt);
}

export function summarizeRun(run) {
  const retirement = run.journal.checkpoints.freeze?.result?.retirement;
  return {projectId: run.plan.projectId, runId: run.plan.runId, gitSha: run.plan.gitSha, installation: run.plan.installation,
    importAdmins: run.plan.importAdmins, ...(run.journal.terminal ? {status: run.journal.terminal.status, aborted: {reason: run.journal.terminal.reason, recoveryToolSha: run.journal.terminal.recoveryToolSha}} : run.journal.abortFreeze ? {status: "ABORTING"} : {}), phases: phasesFor(run.plan).map(phase => ({phase, status: run.journal.checkpoints[phase]?.status ?? "pending", attempts: run.journal.checkpoints[phase]?.attempt ?? 0})),
    gates: Object.keys(run.journal.gates), ...(object(retirement) ? {retirement: {
      freezeStateHash: retirement.freezeStateHash, inventoryHash: retirement.inventoryHash,
      inventoryFile: retirement.inventoryFile, requiredMethod: retirement.requiredMethod,
    }} : {})};
}
