import { describe, expect, it } from "vitest";
import { createVolumeCheckpoint, createVolumeDraft, executeVolumePhase, prepareVolumeRun, summarizeVolumeRun, validateVolumeManifest } from "./reconciliation-volume-acceptance.mjs";
import { stableHash } from "./authorization-migration-sources.mjs";

const HASH = "a".repeat(64);
function observation() {
  return { projectId: "sodc-web", notifySimulation: true, baselineAuthorityPassed: true, currentAuthorityPassed: true, controlReady: true, readyAdminCount: 2, pendingTransitions: 0,
    baselineFingerprint: HASH, counts: { identities: 1999, profiles: 1999, states: 1999 },
    scheduler: { resource: "projects/sodc-web/locations/europe-west2/jobs/firebase-schedule-reconcilePendingSecurityTransitions-europe-west2", state: "ENABLED", configurationHash: HASH },
    deployment: { revision: "reconcilependingsecuritytransitions-reviewed-revision", proofHash: HASH },
    notification: { mode: "TEAM_TEST", configurationHash: HASH },
    fixtures: { identities: 0, profiles: 0, states: 0, validDeniedReady: 0, nonterminalTransitions: 0, unexpectedOwnedRows: 0, rateRows: 0, invocations: 0, notificationRows: 0, receiptRows: 0 } };
}
function prepared() {
  return prepareVolumeRun({ draft: createVolumeDraft({ gitSha: "b".repeat(40) }), observation: observation() });
}
function harness() {
  const manifest = prepared();
  const fixtures = new Set();
  let schedulerState = "ENABLED", durable, override = {}, createFailure = false, deleteFailure = false, measureFailure = false;
  const calls = [];
  const provider = {
    async observe() {
      const value = observation();
      value.scheduler.state = schedulerState;
      for (const key of ["identities", "profiles", "states"]) { value.counts[key] += fixtures.size; value.fixtures[key] = fixtures.size; }
      value.fixtures.validDeniedReady = fixtures.size;
      return { ...value, ...override };
    },
    async pauseScheduler() { calls.push("pause"); schedulerState = "PAUSED"; return { quiescent: true, proofHash: HASH }; },
    async restoreScheduler() { calls.push("restore"); schedulerState = manifest.baseline.scheduler.state; },
    async createFixture(fixture) {
      expect(durable.creatingUID).toBe(fixture.uid);
      expect(durable.paused).toBe(true);
      calls.push("create");
      fixtures.add(fixture.uid);
      if (createFailure) throw new Error("UNCERTAIN_CREATE");
    },
    async deleteFixtureBatch(batch) {
      expect(batch.length).toBeLessThanOrEqual(100);
      expect(durable.cleaningUIDs).toEqual(batch.map(item => item.uid));
      calls.push("delete");
      for (const item of batch) fixtures.delete(item.uid);
      if (deleteFailure) throw new Error("UNCERTAIN_DELETE");
    },
    async measure({ targetSize, measurementId, notBefore }) {
      expect(durable.measuring).toEqual({ targetSize, measurementId, notBefore });
      calls.push("measure");
      if (measureFailure) throw new Error("MEASUREMENT_PENDING");
      const started = Date.parse(notBefore) + 1000;
      return { projectId: "sodc-web", runId: manifest.runId, measurementId, targetSize, revision: manifest.baseline.deployment.revision,
        executionId: measurementId, notBefore, startedAt: new Date(started).toISOString(), completedAt: new Date(started + 60000).toISOString(),
        durationMs: 58000, stateAttempts: targetSize, pendingAttempts: 0, failedAttempts: 0, providerVerified: true, evidenceHash: HASH, completed: true };
    },
  };
  durable = createVolumeCheckpoint(manifest);
  return { manifest, provider, calls, fixtures, get checkpoint() { return durable; }, setOverride(value) { override = value; },
    setCreateFailure(value) { createFailure = value; }, setDeleteFailure(value) { deleteFailure = value; }, setMeasureFailure(value) { measureFailure = value; },
    async phase(phase, args = {}) {
      return executeVolumePhase({ manifest, checkpoint: durable, provider, phase, persist: value => { durable = value; }, ...args });
    } };
}

describe("Dev volume run manifest", () => {
  it("plans exactly total target minus current states, preserving administrator count and private immutable ownership", () => {
    const manifest = prepared();
    expect(manifest.targets).toEqual({ baseline: 2000, stress: 10000 });
    expect(manifest.fixtures).toHaveLength(8001);
    expect(manifest.baseline.readyAdminCount).toBe(2);
    expect(manifest.fixtures[0]).toMatchObject({ uid: `${manifest.fixturePrefix}00000`, marker: `rcv:${manifest.runId}` });
    expect(validateVolumeManifest(manifest)).toBe(manifest);
    expect(JSON.stringify(summarizeVolumeRun(manifest, createVolumeCheckpoint(manifest)))).not.toMatch(/rcv-|fixturePrefix|customClaims|@/);
  });

  it.each([
    value => { value.projectId = "sodc-web-beta"; }, value => { value.fixturePrefix = "existing-"; },
    value => { value.fixtures[0].uid = "real-member"; }, value => { value.fixtures[0].operationId = "foreign-operation"; },
    value => { value.targets.stress = 10001; }, value => { value.baseline.readyAdminCount = 1; },
  ])("rejects changed project, scope, volume or administrator bindings", change => {
    const manifest = prepared();
    change(manifest);
    expect(() => validateVolumeManifest(manifest)).toThrow();
  });

  it("rejects dirty, unknown-notification-mode, pending or unready baselines before preparing cloud writes", () => {
    const draft = createVolumeDraft({ gitSha: "b".repeat(40) });
    for (const override of [{ notification: { mode: "UNKNOWN", configurationHash: HASH } }, { baselineAuthorityPassed: false }, { pendingTransitions: 1 }, { readyAdminCount: 3 },
      { fixtures: { ...observation().fixtures, identities: 1 } }]) {
      expect(() => prepareVolumeRun({ draft, observation: { ...observation(), ...override } })).toThrow();
    }
  });

  it("expires mutation approval after 48 hours while preserving scoped cleanup", () => {
    const manifest = prepared();
    const after = new Date(Date.parse(manifest.expiresAt) + 1);
    expect(() => validateVolumeManifest(manifest, { now: after })).toThrow(/EXPIRED/);
    expect(validateVolumeManifest(manifest, { now: after, allowExpired: true })).toBe(manifest);
  });
});

describe("checkpointed volume fixture lifecycle", () => {
  it("journals before create, requires a paused drained scheduler and validates actual target after setup", async () => {
    const test = harness();
    const result = await test.phase("setup-baseline");
    expect(test.calls).toEqual(["pause", "create"]);
    expect(result.createdUIDs).toEqual([test.manifest.fixtures[0].uid]);
    expect(result.creatingUID).toBeNull();
    await test.phase("setup-baseline");
    expect(test.calls.filter(value => value === "create")).toHaveLength(1);
  });

  it("resumes the same uncertain create operation rather than allocating another identity", async () => {
    const test = harness();
    test.setCreateFailure(true);
    await expect(test.phase("setup-baseline")).rejects.toThrow("UNCERTAIN_CREATE");
    expect(test.checkpoint.creatingUID).toBe(test.manifest.fixtures[0].uid);
    test.setCreateFailure(false);
    await test.phase("setup-baseline");
    expect(test.fixtures.size).toBe(1);
    expect(test.checkpoint.createdUIDs).toHaveLength(1);
  });

  it.each([
    { notification: { mode: "SIMULATION", configurationHash: HASH } }, { baselineFingerprint: "c".repeat(64) }, { readyAdminCount: 1 },
    { deployment: { revision: "changed", proofHash: HASH } }, { pendingTransitions: 1 },
  ])("refuses mutation when the authority, delivery mode or deployed revision changes", async override => {
    const test = harness();
    test.setOverride(override);
    await expect(test.phase("setup-baseline")).rejects.toThrow();
    expect(test.calls).toEqual([]);
  });

  it("does not allocate fixtures if paused scheduler has no verified quiescence proof", async () => {
    const test = harness();
    test.provider.pauseScheduler = async () => ({ quiescent: false, proofHash: HASH });
    await expect(test.phase("setup-baseline")).rejects.toThrow("PAUSED_QUIESCENT_SCHEDULER_REQUIRED");
    expect(test.calls).toEqual([]);
  });

  it("blocks stress allocation until an actual baseline execution is verified", async () => {
    const test = harness();
    await expect(test.phase("setup-stress")).rejects.toThrow("BASELINE_MEASUREMENT_REQUIRED_BEFORE_STRESS");
    expect(test.calls).toEqual([]);
  });

  it("requires real provider evidence and does not count the same execution twice", async () => {
    const test = harness();
    await test.phase("setup-baseline");
    await expect(test.phase("measure-baseline", { measurementId: "volume-2000-first" })).rejects.toThrow("ARM_MEASUREMENT_BEFORE_DISPATCH");
    await test.phase("arm-baseline", { measurementId: "volume-2000-first" });
    await test.phase("measure-baseline", { measurementId: "volume-2000-first" });
    await test.phase("measure-baseline", { measurementId: "volume-2000-first" });
    expect(test.calls.filter(value => value === "measure")).toHaveLength(1);
    expect(summarizeVolumeRun(test.manifest, test.checkpoint)).toMatchObject({ baseline: { actualProviderExecutions: 1, completedExecutions: 1, actualVolumeEvidence: true, sampleSizeBelowTen: true }, stress: { actualVolumeEvidence: false }, releaseApprovalRequired: true });
    test.provider.measure = async args => ({ ...test.checkpoint.measurements[0], ...args, providerVerified: false });
    await test.phase("arm-baseline", { measurementId: "volume-2000-second" });
    await expect(test.phase("measure-baseline", { measurementId: "volume-2000-second" })).rejects.toThrow("ACTUAL_PROVIDER_MEASUREMENT_REQUIRED");
  });

  it("resolves an uncertain measurement under its recorded ID and never silently starts a new one", async () => {
    const test = harness();
    await test.phase("setup-baseline");
    await test.phase("arm-baseline", { measurementId: "volume-2000-first" });
    test.setMeasureFailure(true);
    await expect(test.phase("measure-baseline", { measurementId: "volume-2000-first" })).rejects.toThrow("MEASUREMENT_PENDING");
    await expect(test.phase("measure-baseline", { measurementId: "volume-2000-second" })).rejects.toThrow("RESOLVE_PRIOR_MEASUREMENT_FIRST");
    test.setMeasureFailure(false);
    await test.phase("measure-baseline", { measurementId: "volume-2000-first" });
    expect(test.checkpoint.measurements).toHaveLength(1);
  });

  it("keeps the original armed time and rejects an earlier execution even at the correct roster size", async () => {
    const test = harness();
    await test.phase("setup-baseline");
    const now = new Date(Date.parse(test.manifest.createdAt) + 10000);
    await test.phase("arm-baseline", { measurementId: "volume-2000-first", now });
    await test.phase("arm-baseline", { measurementId: "volume-2000-first", now: new Date(Number(now) + 5000) });
    expect(test.checkpoint.measuring.notBefore).toBe(now.toISOString());
    const measure = test.provider.measure;
    test.provider.measure = async args => ({ ...await measure(args), startedAt: test.manifest.createdAt });
    await expect(test.phase("measure-baseline", { measurementId: "volume-2000-first" })).rejects.toThrow("MEASUREMENT_WINDOW_INVALID");
  });

  it("records a verified baseline timeout as failed capacity evidence and blocks expansion to stress", async () => {
    const test = harness();
    await test.phase("setup-baseline");
    await test.phase("arm-baseline", { measurementId: "volume-2000-timeout" });
    const measure = test.provider.measure;
    test.provider.measure = async args => ({ ...await measure(args), completed: false, timedOut: true, stateAttempts: null, pendingAttempts: null, failedAttempts: null });
    await test.phase("measure-baseline", { measurementId: "volume-2000-timeout" });
    expect(summarizeVolumeRun(test.manifest, test.checkpoint)).toMatchObject({ baseline: { actualVolumeEvidence: true, completedExecutions: 0, verifiedTimeouts: 1, exceedsFunctionTimeout: true } });
    await expect(test.phase("setup-stress")).rejects.toThrow("BASELINE_MEASUREMENT_REQUIRED_BEFORE_STRESS");
  });

  it("rejects changed aggregate counts and unexpected notification rows without touching fixtures", async () => {
    const test = harness();
    test.setOverride({ counts: { identities: 2000, profiles: 1999, states: 1999 } });
    await expect(test.phase("setup-baseline")).rejects.toThrow("FOREIGN_ROSTER_CHANGE");
    test.setOverride({ fixtures: { ...observation().fixtures, notificationRows: 1 } });
    await expect(test.phase("cleanup")).rejects.toThrow("FOREIGN_PENDING_WORK_OR_OWNED_ROWS");
    expect(test.calls).toEqual([]);
  });

  it("cleans every scoped slot including uncertain or never-created fixtures, then restores original scheduler state", async () => {
    const test = harness();
    test.setCreateFailure(true);
    await expect(test.phase("setup-baseline")).rejects.toThrow();
    await test.phase("cleanup");
    expect(test.fixtures.size).toBe(0);
    expect(test.checkpoint).toMatchObject({ completed: true, creatingUID: null, measuring: null });
    expect(test.checkpoint.cleanedUIDs).toHaveLength(test.manifest.fixtures.length);
    expect(test.calls.at(-1)).toBe("restore");
    await test.phase("cleanup");
    await expect(test.phase("setup-baseline")).rejects.toThrow("RUN_ALREADY_CLEANED");
  });

  it("retains the cleanup batch after an uncertain response and never restores the scheduler before verified removal", async () => {
    const test = harness();
    await test.phase("setup-baseline");
    test.setDeleteFailure(true);
    await expect(test.phase("cleanup")).rejects.toThrow("UNCERTAIN_DELETE");
    expect(test.checkpoint.cleaningUIDs).toHaveLength(100);
    expect(test.calls).not.toContain("restore");
    test.setDeleteFailure(false);
    await test.phase("cleanup", { now: new Date(Date.parse(test.manifest.expiresAt) + 1) });
    expect(test.checkpoint.completed).toBe(true);
  });

  it("cleans exact owned fixtures after a legitimate unrelated profile edit while invalidating acceptance", async () => {
    const test = harness();
    await test.phase("setup-baseline");
    test.setOverride({ baselineAuthorityPassed: false, currentAuthorityPassed: true, baselineFingerprint: "c".repeat(64) });
    await expect(test.phase("arm-baseline", { measurementId: "volume-2000-first" })).rejects.toThrow("DEV_AUTHORITY_GUARD_FAILED");
    await test.phase("cleanup");
    expect(test.fixtures.size).toBe(0);
    expect(test.calls.at(-1)).toBe("restore");
    expect(summarizeVolumeRun(test.manifest, test.checkpoint)).toMatchObject({ cleanupVerified: true, acceptanceInvalidated: true, invalidationReasons: ["REAL_MEMBER_SNAPSHOT_CHANGED"] });
  });

  it("keeps scoped cleanup paused if current real authority is unsafe rather than restoring stale real data", async () => {
    const test = harness();
    await test.phase("setup-baseline");
    test.setOverride({ currentAuthorityPassed: false });
    await expect(test.phase("cleanup")).rejects.toThrow("CURRENT_DEV_AUTHORITY_UNSAFE_FOR_CLEANUP");
    expect(test.calls).not.toContain("delete");
    expect(test.calls).not.toContain("restore");
    expect(test.fixtures.size).toBe(1);
  });

  it("rejects checkpoint scope/manifest tampering before any provider call", async () => {
    const test = harness();
    const checkpoint = { ...test.checkpoint, manifestHash: stableHash({ foreign: true }) };
    await expect(test.phase("cleanup", { checkpoint })).rejects.toThrow("CHECKPOINT_MANIFEST_MISMATCH");
    expect(test.calls).toEqual([]);
    await expect(test.phase("cleanup", { checkpoint: { ...test.checkpoint, createdUIDs: ["foreign"] } })).rejects.toThrow("CHECKPOINT_UID_SCOPE_MISMATCH");
  });
});
