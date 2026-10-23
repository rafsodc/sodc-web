import { describe, expect, it } from "vitest";
import { parseBenchmarkArguments, percentile, projectProviderSamples, runReconciliationCase, scenarioInputs, summarizeMeasurements } from "./benchmark-security-reconciliation.mjs";

describe("local reconciliation benchmark using the production handler", () => {
  it.each([500, 501])("counts complete sequential SDK operations across a %i-state page boundary", async rosterSize => {
    const result = await runReconciliationCase({ rosterSize });
    expect(result).toMatchObject({ actualProductionCode: true, cloudCalls: 0, pendingRemaining: 0, mirrorMismatches: 0,
      scheduleOptions: { schedule: "every 5 minutes", timeoutSeconds: 540, maxInstances: 1 },
      completion: { stateAttempts: rosterSize, pendingAttempts: 0, failedAttempts: 0 },
      simulatedServiceOperations: { databaseRead: 2 * rosterSize + Math.floor(rosterSize / 500) + 3, databaseWrite: 0, authRead: rosterSize, authWrite: 0 } });
    expect(result.simulatedOperationCounts.ListSecurityStatesForReconciliation).toBe(Math.floor(rosterSize / 500) + 1);
    expect(Object.values(result.sourceSha256)).toHaveLength(4);
    expect(Object.values(result.sourceSha256).every(value => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    expect(result.latencyModel.liveVolumeAcceptancePassed).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/local-benchmark-|local-fixture@|customClaims/);
  });

  it("accepts the proposed disabled, email-free denied roster without granting access or modifying identities", async () => {
    const result = await runReconciliationCase({ rosterSize: 20, deniedCount: 18 });
    expect(result).toMatchObject({ deniedCount: 18, pendingRemaining: 0, mirrorMismatches: 0,
      completion: { stateAttempts: 20, failedAttempts: 0 },
      simulatedServiceOperations: { databaseRead: 43, databaseWrite: 0, authRead: 20, authWrite: 0 } });
  });

  it("completes pending grants then scans them again, including their actual CAS and Auth verification cost", async () => {
    const result = await runReconciliationCase({ rosterSize: 10, pendingCount: 2 });
    expect(result).toMatchObject({ pendingRemaining: 0, mirrorMismatches: 0,
      completion: { stateAttempts: 10, pendingAttempts: 2, failedAttempts: 0 },
      simulatedServiceOperations: { databaseRead: 31, databaseWrite: 2, authRead: 14, authWrite: 2 },
      simulatedOperationCounts: { CompleteSecurityTransition: 2, AuthSetCustomUserClaims: 2 },
      totalSimulatedServiceOperations: 49 });
  });

  it("measures real drift repair and the retry after a transient pending Auth failure in the same sweep", async () => {
    const result = await runReconciliationCase({ rosterSize: 10, pendingCount: 2, mirrorDriftCount: 1, transientAuthFailures: 1,
      latencyMs: { databaseRead: 3, databaseWrite: 5, authRead: 7, authWrite: 11 } });
    expect(result).toMatchObject({ warnings: 1, injectedFailures: 1, pendingRemaining: 0, mirrorMismatches: 0,
      completion: { stateAttempts: 10, pendingAttempts: 2, failedAttempts: 1 },
      simulatedServiceOperations: { databaseRead: 32, databaseWrite: 3, authRead: 14, authWrite: 3 },
      simulatedOperationCounts: { RecordSecuritySynchronizationFailure: 1 }, totalSimulatedServiceOperations: 52 });
    expect(result.latencyModel).toMatchObject({ applied: true, modeledServiceWaitMs: 242, liveVolumeAcceptancePassed: false });
    expect(result.latencyModel.modeledSequentialDurationMs).toBeCloseTo(result.localMeasurement.sweepWallMs + 242);
  });

  it("rejects impossible fixtures and unapproved transport models before loading code", async () => {
    for (const input of [{ rosterSize: 1 }, { rosterSize: 10, pendingCount: 9 }, { rosterSize: 10, deniedCount: 9 },
      { rosterSize: 10, pendingCount: 2, transientAuthFailures: 3 }, { rosterSize: 10, latencyMs: { network: 5 } }]) {
      await expect(runReconciliationCase(input)).rejects.toThrow(/Invalid/);
    }
  });

  it("includes the approved baseline and stress targets and bounds backlog/failure scenarios", () => {
    expect(parseBenchmarkArguments([])).toMatchObject({ sizes: [100, 1000, 2000, 5000, 10000], runs: 3 });
    expect(scenarioInputs(2000)).toEqual(expect.arrayContaining([
      { name: "healthy", rosterSize: 2000 }, { name: "denied-fixture-roster", rosterSize: 2000, deniedCount: 1998 },
      { name: "pending-backlog", rosterSize: 2000, pendingCount: 100 },
    ]));
    expect(scenarioInputs(2).every(value => (value.pendingCount ?? 0) === 0)).toBe(true);
    for (const args of [["--sizes", "2,2"], ["--runs", "0"], ["--runs", "3", "--runs", "4"], ["--unknown", "1"], ["--runs"]]) {
      expect(() => parseBenchmarkArguments(args)).toThrow();
    }
  });
});

describe("aggregate summaries and provider projections", () => {
  const sourceSha256 = Object.fromEntries(["securityReconciliation.ts", "currentAuthorizationTransitions.ts", "validation.ts", "constants.ts"].map(name => [name, "a".repeat(64)]));
  function measurement(wallMs) {
    return { rosterSize: 2000, pendingCount: 0, deniedCount: 1998, mirrorDriftCount: 0, transientAuthFailures: 0,
      sourceSha256, simulatedServiceOperations: { databaseRead: 4007, databaseWrite: 0, authRead: 2000, authWrite: 0 },
      totalSimulatedServiceOperations: 6007, completion: { stateAttempts: 2000, failedAttempts: 0 }, pendingRemaining: 0, mirrorMismatches: 0,
      localMeasurement: { sweepWallMs: wallMs, cpuMs: 10, executionHeapPeakDeltaBytes: 100, processMaxRssBytes: 1000 } };
  }
  function provider() {
    return { schemaVersion: "sodc-reconciliation-provider-samples/v1", projectId: "sodc-web", releaseGitSha: "b".repeat(40),
      sourceSha256: Object.fromEntries(Object.entries(sourceSha256).reverse()), observedAt: "2026-10-23T12:00:00Z", authorityVerifiedHealthy: true,
      evidenceReference: "private-receipt/aggregate.json", samples: [{ stateAttempts: 7, pendingAttempts: 0, failedAttempts: 0, durationMs: 240 }],
      missingCompletions: 0, timeouts: 0, backlogBefore: 0, backlogAfter: 0 };
  }

  it("calculates nearest-rank quantiles and accepts harmless source property reordering", () => {
    const reordered = { ...measurement(30), sourceSha256: Object.fromEntries(Object.entries(sourceSha256).reverse()) };
    const summary = summarizeMeasurements([measurement(10), reordered, measurement(20)]);
    expect(summary).toMatchObject({ localSweepWallMs: { median: 20, p95: 30, max: 30 }, allRunsCompleted: true, liveVolumeAcceptancePassed: false });
    expect(percentile([], 0.95)).toBeNull();
    expect(percentile([3, 1, 2], 0.5)).toBe(2);
    expect(() => summarizeMeasurements([measurement(10), { ...measurement(20), sourceSha256: { ...sourceSha256, "validation.ts": "c".repeat(64) } }])).toThrow();
  });

  it("labels actual small-roster durations and resulting large-roster estimates separately, never passing the live gate", () => {
    const result = projectProviderSamples([summarizeMeasurements([measurement(10)])], provider(), sourceSha256);
    expect(result).toMatchObject({ measuredRosterSizes: [7], measuredNaturalSweepCount: 1,
      measuredNaturalSweepDurationMs: { median: 240, p95: 240, max: 240 }, liveVolumeAcceptancePassed: false,
      projections: [{ rosterSize: 2000, actualProviderVolumeTest: false, equalCostServiceOperationProjectionMs: { median: 60070, p95: 60070 } }] });
  });

  it.each([
    value => { value.projectId = "sodc-web-prod"; }, value => { value.samples[0].pendingAttempts = 1; },
    value => { value.samples[0].failedAttempts = 1; }, value => { value.samples[0].uid = "private"; },
    value => { value.sourceSha256["validation.ts"] = "c".repeat(64); }, value => { value.rawIdentities = []; },
  ])("rejects unbound, non-Dev, private or unhealthy calibration evidence", change => {
    const value = provider();
    change(value);
    expect(() => projectProviderSamples([], value, sourceSha256)).toThrow();
  });
});
