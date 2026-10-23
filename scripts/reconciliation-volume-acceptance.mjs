#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stableHash } from "./authorization-migration-sources.mjs";
import { percentile } from "./benchmark-security-reconciliation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = "sodc-reconciliation-volume/v1";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const ZERO_FIXTURE_KEYS = ["identities", "profiles", "states", "validDeniedReady", "nonterminalTransitions", "unexpectedOwnedRows", "rateRows", "invocations", "notificationRows", "receiptRows"];
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const clone = value => structuredClone(value);

function fixtureFor(runId, index) {
  return { uid: `rcv-${runId}-${String(index).padStart(5, "0")}`, operationId: `rcv-init:${runId}:${index}`, marker: `rcv:${runId}` };
}

/** A draft can only inspect: preparation proves all candidate identities/rows are absent. */
export function createVolumeDraft({ gitSha, runId = randomUUID(), now = new Date() }) {
  const createdAt = new Date(now).toISOString();
  const draft = { schemaVersion: SCHEMA, projectId: "sodc-web", runId, fixturePrefix: `rcv-${runId}-`, gitSha, createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 48 * 60 * 60 * 1000).toISOString(), targets: { baseline: 2000, stress: 10000 },
    fixtures: Array.from({ length: 10000 }, (_, index) => fixtureFor(runId, index)) };
  validateVolumeManifest(draft, { allowDraft: true, now });
  return draft;
}

export function validateVolumeManifest(manifest, { allowDraft = false, allowExpired = false, now = new Date() } = {}) {
  const keys = ["schemaVersion", "projectId", "runId", "fixturePrefix", "gitSha", "createdAt", "expiresAt", "targets", "fixtures", "baseline"];
  assert(manifest && Object.keys(manifest).every(key => keys.includes(key)) && manifest.schemaVersion === SCHEMA && manifest.projectId === "sodc-web", "DEV_MANIFEST_REQUIRED");
  assert(UUID.test(manifest.runId) && manifest.fixturePrefix === `rcv-${manifest.runId}-` && /^[a-f0-9]{40}$/.test(manifest.gitSha), "INVALID_RUN_BINDING");
  const created = Date.parse(manifest.createdAt), expires = Date.parse(manifest.expiresAt), current = Number(new Date(now));
  assert(Number.isFinite(created) && Number.isFinite(expires) && expires > created && expires - created <= 48 * 60 * 60 * 1000 && created <= current + 1000, "INVALID_RUN_LIFETIME");
  assert(allowExpired || expires > current, "RUN_EXPIRED_USE_CLEANUP");
  assert(stableHash(manifest.targets) === stableHash({ baseline: 2000, stress: 10000 }), "APPROVED_VOLUME_TARGETS_REQUIRED");
  assert(Array.isArray(manifest.fixtures) && manifest.fixtures.length > 0 && manifest.fixtures.length <= 10000 && manifest.fixtures.every((item, index) => stableHash(item) === stableHash(fixtureFor(manifest.runId, index))), "EXACT_OWNED_FIXTURE_ROSTER_REQUIRED");
  if (!manifest.baseline) {
    assert(allowDraft && manifest.fixtures.length === 10000, "PREPARED_BASELINE_REQUIRED");
    return manifest;
  }
  const base = manifest.baseline;
  assert(HASH.test(base.fingerprint) && Object.keys(base).every(key => ["fingerprint", "counts", "readyAdminCount", "scheduler", "deployment", "notification"].includes(key)), "INVALID_BASELINE");
  assert(base.readyAdminCount === 2 && ["identities", "profiles", "states"].every(key => Number.isSafeInteger(base.counts?.[key]) && base.counts[key] >= 0) && Object.keys(base.counts).length === 3 && base.counts.states >= 2 && base.counts.states < 2000, "BASELINE_ROSTER_OR_ADMIN_COUNT_INVALID");
  assert(manifest.fixtures.length === 10000 - base.counts.states, "FIXTURE_COUNT_MISMATCH");
  assert(base.scheduler?.resource === "projects/sodc-web/locations/europe-west2/jobs/firebase-schedule-reconcilePendingSecurityTransitions-europe-west2" && ["ENABLED", "PAUSED"].includes(base.scheduler.state) && HASH.test(base.scheduler.configurationHash), "RECONCILIATION_SCHEDULER_REQUIRED");
  assert(typeof base.deployment?.revision === "string" && base.deployment.revision && HASH.test(base.deployment.proofHash), "DEPLOYED_REVISION_REQUIRED");
  assert(["SIMULATION", "TEAM_TEST", "LIVE"].includes(base.notification?.mode) && HASH.test(base.notification.configurationHash), "READ_ONLY_NOTIFICATION_CONFIGURATION_REQUIRED");
  return manifest;
}

function assertInitial(observation) {
  assert(observation?.projectId === "sodc-web" && observation.baselineAuthorityPassed === true && observation.controlReady === true && observation.readyAdminCount === 2 && observation.pendingTransitions === 0, "INITIAL_DEV_AUTHORITY_GUARD_FAILED");
  assert(observation.fixtures && ZERO_FIXTURE_KEYS.every(key => observation.fixtures[key] === 0), "FIXTURE_PREFIX_ALREADY_EXISTS");
}

export function prepareVolumeRun({ draft, observation, now = new Date() }) {
  validateVolumeManifest(draft, { allowDraft: true, now });
  assert(!draft.baseline, "RUN_ALREADY_PREPARED");
  assertInitial(observation);
  const manifest = { ...clone(draft), fixtures: draft.fixtures.slice(0, draft.targets.stress - observation.counts.states),
    baseline: { fingerprint: observation.baselineFingerprint, counts: clone(observation.counts), readyAdminCount: observation.readyAdminCount,
      scheduler: clone(observation.scheduler), deployment: clone(observation.deployment), notification: clone(observation.notification) } };
  validateVolumeManifest(manifest, { now });
  return manifest;
}

export function createVolumeCheckpoint(manifest) {
  validateVolumeManifest(manifest);
  return { schemaVersion: SCHEMA, manifestHash: stableHash(manifest), createdUIDs: [], creatingUID: null, cleanedUIDs: [], cleaningUIDs: [],
    measurements: [], measuring: null, cleanupStarted: false, paused: false, completed: false, acceptanceInvalidated: false, invalidationReasons: [] };
}

function validateCheckpoint(manifest, checkpoint) {
  assert(checkpoint?.schemaVersion === SCHEMA && checkpoint.manifestHash === stableHash(manifest), "CHECKPOINT_MANIFEST_MISMATCH");
  const owned = new Set(manifest.fixtures.map(item => item.uid));
  for (const key of ["createdUIDs", "cleanedUIDs", "cleaningUIDs"]) {
    assert(Array.isArray(checkpoint[key]) && checkpoint[key].every(uid => owned.has(uid)) && new Set(checkpoint[key]).size === checkpoint[key].length, "CHECKPOINT_UID_SCOPE_MISMATCH");
  }
  assert(checkpoint.creatingUID === null || owned.has(checkpoint.creatingUID), "CHECKPOINT_UID_SCOPE_MISMATCH");
  assert(Array.isArray(checkpoint.measurements) && new Set(checkpoint.measurements.map(item => item.measurementId)).size === checkpoint.measurements.length && new Set(checkpoint.measurements.map(item => item.executionId)).size === checkpoint.measurements.length &&
    (checkpoint.measuring === null || [2000, 10000].includes(checkpoint.measuring.targetSize) && new RegExp(`^volume-${checkpoint.measuring.targetSize}-[a-z0-9-]{1,48}$`).test(checkpoint.measuring.measurementId) && Date.parse(checkpoint.measuring.notBefore) >= Date.parse(manifest.createdAt)), "INVALID_MEASUREMENT_CHECKPOINT");
  for (const receipt of checkpoint.measurements) {
    assert([2000, 10000].includes(receipt.targetSize) && new RegExp(`^volume-${receipt.targetSize}-[a-z0-9-]{1,48}$`).test(receipt.measurementId), "INVALID_MEASUREMENT_CHECKPOINT");
    validateMeasurement(manifest, receipt, { targetSize: receipt.targetSize, measurementId: receipt.measurementId, notBefore: receipt.notBefore });
  }
  assert(["cleanupStarted", "paused", "completed", "acceptanceInvalidated"].every(key => typeof checkpoint[key] === "boolean") && Array.isArray(checkpoint.invalidationReasons) && checkpoint.invalidationReasons.every(reason => ["REAL_MEMBER_SNAPSHOT_CHANGED", "REAL_ROSTER_COUNTS_CHANGED", "READY_ADMINISTRATOR_COUNT_CHANGED"].includes(reason)), "INVALID_CHECKPOINT_FLAGS");
}

function assertBaseline(manifest, observation) {
  const base = manifest.baseline;
  assert(observation?.projectId === "sodc-web" && observation.baselineAuthorityPassed === true && observation.controlReady === true, "DEV_AUTHORITY_GUARD_FAILED");
  assert(stableHash(observation.notification) === stableHash(base.notification), "NOTIFICATION_CONFIGURATION_CHANGED");
  assert(observation.readyAdminCount === base.readyAdminCount && observation.baselineFingerprint === base.fingerprint, "REAL_MEMBER_AUTHORITY_CHANGED");
  assert(stableHash(observation.deployment) === stableHash(base.deployment), "DEPLOYED_FUNCTION_CHANGED");
  assert(observation.scheduler?.resource === base.scheduler.resource && observation.scheduler.configurationHash === base.scheduler.configurationHash, "SCHEDULER_CONFIGURATION_CHANGED");
  assert(observation.fixtures?.unexpectedOwnedRows === 0 && observation.fixtures.notificationRows === 0 && observation.fixtures.receiptRows === 0 && observation.pendingTransitions === observation.fixtures.nonterminalTransitions, "FOREIGN_PENDING_WORK_OR_OWNED_ROWS");
  for (const key of ["identities", "profiles", "states"]) assert(observation.counts?.[key] === base.counts[key] + observation.fixtures[key], "FOREIGN_ROSTER_CHANGE");
}

function assertTarget(manifest, observation, targetSize) {
  assertBaseline(manifest, observation);
  const expected = targetSize - manifest.baseline.counts.states;
  assert(observation.counts.states === targetSize && ["identities", "profiles", "states", "validDeniedReady"].every(key => observation.fixtures[key] === expected) && observation.pendingTransitions === 0, "COMPLETE_DENIED_READY_TARGET_REQUIRED");
}

function assertCleanupAuthority(manifest, observation) {
  assert(observation?.projectId === "sodc-web" && observation.currentAuthorityPassed === true && observation.controlReady === true && Number.isSafeInteger(observation.readyAdminCount) && observation.readyAdminCount > 0, "CURRENT_DEV_AUTHORITY_UNSAFE_FOR_CLEANUP");
  assert(stableHash(observation.deployment) === stableHash(manifest.baseline.deployment), "DEPLOYED_FUNCTION_CHANGED_REVIEW_RECOVERY");
  assert(observation.scheduler?.resource === manifest.baseline.scheduler.resource && observation.scheduler.configurationHash === manifest.baseline.scheduler.configurationHash, "SCHEDULER_CONFIGURATION_CHANGED_REVIEW_RECOVERY");
  assert(stableHash(observation.notification) === stableHash(manifest.baseline.notification), "NOTIFICATION_CONFIGURATION_CHANGED_REVIEW_RECOVERY");
  assert(observation.fixtures?.unexpectedOwnedRows === 0 && observation.fixtures.notificationRows === 0 && observation.fixtures.receiptRows === 0 && observation.pendingTransitions === observation.fixtures.nonterminalTransitions, "FOREIGN_PENDING_WORK_OR_OWNED_ROWS");
}

function recordUnrelatedDrift(manifest, observation, checkpoint) {
  const reasons = new Set(checkpoint.invalidationReasons);
  if (observation.baselineFingerprint !== manifest.baseline.fingerprint) reasons.add("REAL_MEMBER_SNAPSHOT_CHANGED");
  if (["identities", "profiles", "states"].some(key => observation.counts[key] - observation.fixtures[key] !== manifest.baseline.counts[key])) reasons.add("REAL_ROSTER_COUNTS_CHANGED");
  if (observation.readyAdminCount !== manifest.baseline.readyAdminCount) reasons.add("READY_ADMINISTRATOR_COUNT_CHANGED");
  checkpoint.invalidationReasons = [...reasons].sort();
  checkpoint.acceptanceInvalidated = reasons.size > 0;
}

function latestDrainContext(manifest, checkpoint) {
  // PAUSED Scheduler responses can omit both attempt timestamps. A durable arm
  // is therefore an explicit new execution epoch, including after its receipt.
  const latest = [...(checkpoint.measuring ? [checkpoint.measuring] : []), ...checkpoint.measurements]
    .sort((a, b) => Date.parse(b.notBefore) - Date.parse(a.notBefore))[0];
  if (!latest) return { drainNotBefore: manifest.createdAt };
  return { drainNotBefore: latest.notBefore, drainExecution: {
    measurementId: latest.measurementId, notBefore: latest.notBefore, targetSize: latest.targetSize,
    ...(latest.executionId ? { executionId: latest.executionId } : {})
  } };
}

function validateMeasurement(manifest, receipt, { targetSize, measurementId, notBefore }) {
  assert(receipt?.projectId === "sodc-web" && receipt.runId === manifest.runId && receipt.measurementId === measurementId && receipt.targetSize === targetSize && receipt.revision === manifest.baseline.deployment.revision && receipt.providerVerified === true && HASH.test(receipt.evidenceHash) && typeof receipt.executionId === "string" && receipt.executionId, "ACTUAL_PROVIDER_MEASUREMENT_REQUIRED");
  assert(receipt.notBefore === notBefore && Date.parse(notBefore) >= Date.parse(manifest.createdAt) && Number.isFinite(Date.parse(receipt.startedAt)) && Date.parse(receipt.startedAt) >= Date.parse(notBefore) && Date.parse(receipt.completedAt) >= Date.parse(receipt.startedAt), "MEASUREMENT_WINDOW_INVALID");
  if (receipt.completed === true) {
    assert(receipt.stateAttempts === targetSize && receipt.pendingAttempts === 0 && receipt.failedAttempts === 0 && Number.isFinite(receipt.durationMs) && receipt.durationMs > 0 && receipt.durationMs <= Date.parse(receipt.completedAt) - Date.parse(receipt.startedAt) + 5000, "INCOMPLETE_OR_FAILED_PROVIDER_SWEEP");
  } else assert(receipt.completed === false && receipt.timedOut === true, "VERIFIED_PROVIDER_TIMEOUT_REQUIRED");
  const fields = ["projectId", "runId", "measurementId", "targetSize", "revision", "executionId", "notBefore", "startedAt", "completedAt", "durationMs", "stateAttempts", "pendingAttempts", "failedAttempts", "providerVerified", "evidenceHash", "completed", "timedOut"];
  assert(Object.keys(receipt).every(key => fields.includes(key)), "UNEXPECTED_PRIVATE_MEASUREMENT_FIELDS");
}

/** No cloud implementation is imported here. A phase journals before every uncertain provider write. */
export async function executeVolumePhase({ manifest, checkpoint, provider, phase, measurementId, persist, progress = () => {}, now = new Date() }) {
  assert(["setup-baseline", "setup-stress", "arm-baseline", "arm-stress", "measure-baseline", "measure-stress", "cleanup"].includes(phase), "UNKNOWN_VOLUME_PHASE");
  validateVolumeManifest(manifest, { allowExpired: phase === "cleanup", now });
  validateCheckpoint(manifest, checkpoint);
  assert(typeof persist === "function", "DURABLE_CHECKPOINT_WRITER_REQUIRED");
  const state = clone(checkpoint);
  async function save() { await persist(clone(state)); }
  if (state.completed) assert(phase === "cleanup", "RUN_ALREADY_CLEANED");
  const before = await provider.observe();
  if (phase === "cleanup") { assertCleanupAuthority(manifest, before); recordUnrelatedDrift(manifest, before, state); }
  else assertBaseline(manifest, before);
  if (state.completed) {
    assert(ZERO_FIXTURE_KEYS.every(key => before.fixtures[key] === 0) && before.scheduler.state === manifest.baseline.scheduler.state, "COMPLETED_RUN_CHANGED");
    await save();
    return state;
  }
  if (phase.startsWith("setup-")) {
    assert(!state.cleanupStarted && !state.measuring, "RUN_BUSY_OR_CLEANUP_STARTED");
    const targetSize = manifest.targets[phase.slice(6)];
    if (phase === "setup-stress") assert(state.measurements.filter(item => item.targetSize === 2000).at(-1)?.completed === true, "BASELINE_MEASUREMENT_REQUIRED_BEFORE_STRESS");
    assert(before.counts.states <= targetSize, "CANNOT_SHRINK_EXISTING_VOLUME_TARGET");
    const drain = await provider.pauseScheduler(latestDrainContext(manifest, state));
    assert(drain?.quiescent === true && HASH.test(drain.proofHash), "PAUSED_QUIESCENT_SCHEDULER_REQUIRED");
    state.paused = true;
    await save();
    const completed = new Set(state.createdUIDs);
    const targetFixtures = manifest.fixtures.slice(0, targetSize - manifest.baseline.counts.states);
    for (const fixture of targetFixtures) {
      if (completed.has(fixture.uid)) continue;
      assert(state.creatingUID === null || state.creatingUID === fixture.uid, "UNCERTAIN_FIXTURE_ORDER_CHANGED");
      state.creatingUID = fixture.uid;
      await save();
      await provider.createFixture(fixture);
      state.createdUIDs.push(fixture.uid);
      completed.add(fixture.uid);
      state.creatingUID = null;
      await save();
      if (state.createdUIDs.length % 25 === 0) progress({ phase, ownedReadyFixtures: state.createdUIDs.length, targetSize });
    }
    assertTarget(manifest, await provider.observe(), targetSize);
    return state;
  }
  if (phase.startsWith("measure-") || phase.startsWith("arm-")) {
    assert(!state.cleanupStarted && !state.creatingUID, "RUN_BUSY_OR_CLEANUP_STARTED");
    const targetSize = manifest.targets[phase.slice(phase.startsWith("arm-") ? 4 : 8)];
    assert(typeof measurementId === "string" && new RegExp(`^volume-${targetSize}-[a-z0-9-]{1,48}$`).test(measurementId), "EXPLICIT_MEASUREMENT_ID_REQUIRED");
    assertTarget(manifest, before, targetSize);
    const prior = state.measurements.find(item => item.measurementId === measurementId);
    if (prior) { validateMeasurement(manifest, prior, { targetSize, measurementId, notBefore: prior.notBefore }); return state; }
    assert(!state.measuring || state.measuring.measurementId === measurementId && state.measuring.targetSize === targetSize, "RESOLVE_PRIOR_MEASUREMENT_FIRST");
    if (phase.startsWith("arm-")) {
      assert(before.scheduler.state === "PAUSED", "PAUSED_RECONCILIATION_REQUIRED");
      if (!state.measuring) {
        if (state.measurements.length) {
          const drain = await provider.pauseScheduler(latestDrainContext(manifest, state));
          assert(drain?.quiescent === true && HASH.test(drain.proofHash), "PAUSED_QUIESCENT_SCHEDULER_REQUIRED");
        }
        const priorArm = latestDrainContext(manifest, state).drainNotBefore;
        const armedAt = state.measurements.length ? Math.max(Number(new Date(now)), Date.parse(priorArm) + 1) : Number(new Date(now));
        state.measuring = { targetSize, measurementId, notBefore: new Date(armedAt).toISOString() }; await save();
      }
      return state;
    }
    assert(state.measuring, "ARM_MEASUREMENT_BEFORE_DISPATCH");
    const { notBefore } = state.measuring;
    const receipt = await provider.measure({ targetSize, measurementId, notBefore });
    validateMeasurement(manifest, receipt, { targetSize, measurementId, notBefore });
    assert(!state.measurements.some(item => item.executionId === receipt.executionId), "EXECUTION_ALREADY_COUNTED");
    assertTarget(manifest, await provider.observe(), targetSize);
    state.measurements.push(clone(receipt));
    state.measuring = null;
    await save();
    return state;
  }
  // Cleanup also remains available after expiry or an interrupted create/measurement.
  const drain = await provider.pauseScheduler({ cleanup: true, ...latestDrainContext(manifest, state) });
  assert(drain?.quiescent === true && HASH.test(drain.proofHash), "PAUSED_QUIESCENT_SCHEDULER_REQUIRED");
  state.paused = true;
  state.cleanupStarted = true;
  await save();
  const cleaned = new Set(state.cleanedUIDs);
  // Inspect/delete all manifest IDs, including a create whose successful response was lost.
  for (let offset = 0; offset < manifest.fixtures.length; offset += 100) {
    const batch = manifest.fixtures.slice(offset, offset + 100).filter(item => !cleaned.has(item.uid));
    if (!batch.length) continue;
    state.cleaningUIDs = batch.map(item => item.uid);
    await save();
    await provider.deleteFixtureBatch(batch);
    for (const item of batch) { state.cleanedUIDs.push(item.uid); cleaned.add(item.uid); }
    state.cleaningUIDs = [];
    await save();
    progress({ phase, checkedOwnedFixtures: state.cleanedUIDs.length, totalManifestFixtures: manifest.fixtures.length });
  }
  const retired = await provider.observe();
  assertCleanupAuthority(manifest, retired);
  recordUnrelatedDrift(manifest, retired, state);
  assert(ZERO_FIXTURE_KEYS.every(key => retired.fixtures[key] === 0), "OWNED_OPERATIONAL_RESIDUE_REMAINS");
  await provider.restoreScheduler();
  const restored = await provider.observe();
  assertCleanupAuthority(manifest, restored);
  recordUnrelatedDrift(manifest, restored, state);
  assert(restored.scheduler.state === manifest.baseline.scheduler.state, "SCHEDULER_STATE_NOT_RESTORED");
  state.paused = restored.scheduler.state === "PAUSED";
  state.completed = true;
  state.creatingUID = null;
  state.measuring = null;
  await save();
  return state;
}

export function summarizeVolumeRun(manifest, checkpoint) {
  validateVolumeManifest(manifest, { allowExpired: true });
  validateCheckpoint(manifest, checkpoint);
  const summarize = targetSize => {
    const runs = checkpoint.measurements.filter(item => item.targetSize === targetSize);
    const completed = runs.filter(item => item.completed === true);
    const durations = completed.map(item => item.durationMs);
    return { targetSize, actualProviderExecutions: runs.length, completedExecutions: completed.length, verifiedTimeouts: runs.filter(item => item.timedOut === true).length,
      durationMs: { median: percentile(durations, 0.5), p95: percentile(durations, 0.95), max: durations.length ? Math.max(...durations) : null },
      actualVolumeEvidence: runs.length > 0, exceedsFiveMinuteCadence: durations.some(value => value >= 300000),
      exceedsFunctionTimeout: runs.some(item => item.timedOut === true) || durations.some(value => value >= 540000),
      sampleSizeBelowTen: runs.length < 10 };
  };
  return { projectId: manifest.projectId, gitSha: manifest.gitSha, manifestHash: stableHash(manifest), targets: manifest.targets,
    baseline: summarize(2000), stress: summarize(10000), cleanupVerified: checkpoint.completed,
    acceptanceInvalidated: checkpoint.acceptanceInvalidated, invalidationReasons: checkpoint.invalidationReasons,
    releaseApprovalRequired: true, limitations: ["Provider observations cover denied READY fixtures, not grant/backlog write latency.", "Few executions establish an observed capacity result; they do not establish a stable p95 service-level objective.", "Local synthetic transport measurements and small-roster projections never count as actual volume evidence."] };
}

async function privateDirectory(directory, create = false) {
  const absolute = path.resolve(directory);
  assert(absolute !== ROOT && !absolute.startsWith(ROOT + path.sep), "RUN_DIRECTORY_MUST_BE_OUTSIDE_CHECKOUT");
  if (create) await mkdir(absolute, { mode: 0o700 });
  const resolved = await realpath(absolute);
  assert(resolved === absolute && (await lstat(absolute)).isDirectory() && ((await lstat(absolute)).mode & 0o077) === 0, "PRIVATE_NON_SYMLINK_RUN_DIRECTORY_REQUIRED");
  return absolute;
}
async function privateJson(directory, filename) {
  const target = path.join(directory, filename);
  const stat = await lstat(target);
  assert(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0, "PRIVATE_REGULAR_FILE_REQUIRED");
  return JSON.parse(await readFile(target, "utf8"));
}
async function saveJson(directory, filename, value, immutable = false) {
  const target = path.join(directory, immutable ? filename : filename + ".new-" + randomUUID());
  const file = await open(target, "wx", 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2) + "\n"); await file.sync(); } finally { await file.close(); }
  if (!immutable) await rename(target, path.join(directory, filename));
}

async function claimDevOwner(runDirectory, manifestHash) {
  const target = "/private/tmp/sodc-reconciliation-volume-sodc-web-owner.json";
  try {
    const file = await open(target, "wx", 0o600);
    try { await file.writeFile(JSON.stringify({ runDirectory, manifestHash }) + "\n"); await file.sync(); } finally { await file.close(); }
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const stat = await lstat(target);
    assert(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0, "PRIVATE_DEV_OWNER_REQUIRED");
    const owner = JSON.parse(await readFile(target, "utf8"));
    assert(owner.runDirectory === runDirectory && owner.manifestHash === manifestHash, "ANOTHER_DEV_VOLUME_RUN_OWNS_PROJECT");
  }
  return target;
}

async function main() {
  assert(/^24\./.test(process.versions.node), "NODE_24_REQUIRED");
  const [phase, directory, ...args] = process.argv.slice(2);
  assert(phase && directory && args.length % 2 === 0, "PHASE_AND_PRIVATE_DIRECTORY_REQUIRED");
  const options = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, index) => args.slice(index * 2, index * 2 + 2)));
  assert(Object.keys(options).every(key => ["--approve-manifest", "--measurement-id"].includes(key)), "UNKNOWN_OPTION");
  const runDirectory = await privateDirectory(directory, phase === "prepare");
  const lock = await open(path.join(runDirectory, "active.lock"), "wx", 0o600);
  await lock.writeFile(JSON.stringify({ pid: process.pid }) + "\n");
  await lock.sync();
  let provider;
  try {
    const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    const { createReconciliationVolumeCloud } = await import("./reconciliation-volume-cloud.mjs");
    if (phase === "prepare") {
      const draft = createVolumeDraft({ gitSha });
      provider = createReconciliationVolumeCloud({ repositoryRoot: ROOT, runDirectory, manifest: draft });
      const manifest = prepareVolumeRun({ draft, observation: await provider.observe() });
      await saveJson(runDirectory, "manifest.json", manifest, true);
      await saveJson(runDirectory, "checkpoint.json", createVolumeCheckpoint(manifest));
      console.log(JSON.stringify({ projectId: "sodc-web", manifestHash: stableHash(manifest), baselineCounts: manifest.baseline.counts, targets: manifest.targets, cloudWrites: 0 }));
      return;
    }
    const manifest = await privateJson(runDirectory, "manifest.json");
    const checkpoint = await privateJson(runDirectory, "checkpoint.json");
    assert(manifest.gitSha === gitSha, "REVIEWED_CHECKOUT_CHANGED");
    if (phase === "status") { console.log(JSON.stringify(summarizeVolumeRun(manifest, checkpoint))); return; }
    assert(options["--approve-manifest"] === stableHash(manifest), "REVIEWED_MANIFEST_HASH_REQUIRED");
    const ownerPath = await claimDevOwner(runDirectory, stableHash(manifest));
    provider = createReconciliationVolumeCloud({ repositoryRoot: ROOT, runDirectory, manifest });
    const result = await executeVolumePhase({ manifest, checkpoint, provider, phase, measurementId: options["--measurement-id"],
      persist: value => saveJson(runDirectory, "checkpoint.json", value), progress: value => console.log(JSON.stringify(value)) });
    await saveJson(runDirectory, `receipt-${phase}-${randomUUID()}.json`, { manifestHash: stableHash(manifest), checkpointHash: stableHash(result), observation: await provider.observe(), summary: summarizeVolumeRun(manifest, result) }, true);
    if (result.completed) await unlink(ownerPath);
    console.log(JSON.stringify(summarizeVolumeRun(manifest, result)));
  } finally {
    await provider?.close?.();
    await lock.close();
    await unlink(path.join(runDirectory, "active.lock"));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Dev volume acceptance stopped: ${/^[A-Z0-9_]+$/.test(error.message) ? error.message : "PRIVATE_PROVIDER_FAILURE"}. Keep the manifest/checkpoint for scoped recovery.`); process.exitCode = 1; });
}
