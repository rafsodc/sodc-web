import { describe, expect, it } from "vitest";
import { parseBenchmarkArguments, percentile, projectProviderSamples, runReconciliationCase, scenarioInputs, summarizeMeasurements } from "./benchmark-security-reconciliation.mjs";

describe("local reconciliation benchmark using the production handler", () => {
  it.each([[499, 8, 7], [500, 9, 7], [501, 10, 8], [1000, 11, 12], [2000, 15, 22], [10000, 47, 102]])("counts complete batched SDK operations across a %i-state page boundary", async (rosterSize, databaseRead, authRead) => {
    const result = await runReconciliationCase({ rosterSize });
    expect(result).toMatchObject({ actualProductionCode: true, cloudCalls: 0, pendingRemaining: 0, mirrorMismatches: 0,
      scheduleOptions: { schedule: "every 5 minutes", timeoutSeconds: 540, maxInstances: 1 },
      completion: { stateAttempts: rosterSize, pendingAttempts: 0, failedAttempts: 0, healthyMirrorChecks: rosterSize - 2 },
      simulatedServiceOperations: { databaseRead, databaseWrite: 0, authRead, authWrite: 0 } });
    expect(result.simulatedOperationCounts.ListSecurityStatesForReconciliation).toBe(Math.floor(rosterSize / 500) + 1);
    expect(Object.values(result.sourceSha256)).toHaveLength(5);
    expect(Object.values(result.sourceSha256).every(value => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    expect(result.latencyModel.liveVolumeAcceptancePassed).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/local-benchmark-|local-fixture@|customClaims/);
  });

  it("accepts the proposed disabled, email-free denied roster without granting access or modifying identities", async () => {
    const result = await runReconciliationCase({ rosterSize: 20, deniedCount: 18 });
    expect(result).toMatchObject({ deniedCount: 18, pendingRemaining: 0, mirrorMismatches: 0,
      completion: { stateAttempts: 20, failedAttempts: 0 },
      simulatedServiceOperations: { databaseRead: 8, databaseWrite: 0, authRead: 3, authWrite: 0 } });
  });

  it("completes pending grants then scans them again, including their actual CAS and Auth verification cost", async () => {
    const result = await runReconciliationCase({ rosterSize: 10, pendingCount: 2 });
    expect(result).toMatchObject({ pendingRemaining: 0, mirrorMismatches: 0,
      completion: { stateAttempts: 10, pendingAttempts: 2, failedAttempts: 0 },
      simulatedServiceOperations: { databaseRead: 16, databaseWrite: 2, authRead: 7, authWrite: 2 },
      simulatedOperationCounts: { CompleteSecurityTransition: 2, AuthSetCustomUserClaims: 2 },
      totalSimulatedServiceOperations: 27 });
  });

  it("measures real drift repair and the retry after a transient pending Auth failure in the same sweep", async () => {
    const result = await runReconciliationCase({ rosterSize: 10, pendingCount: 2, mirrorDriftCount: 1, transientAuthFailures: 1,
      latencyMs: { databaseRead: 3, databaseWrite: 5, authRead: 7, authWrite: 11 } });
    expect(result).toMatchObject({ warnings: 1, injectedFailures: 1, pendingRemaining: 0, mirrorMismatches: 0,
      completion: { stateAttempts: 10, pendingAttempts: 2, failedAttempts: 1 }, unrelatedClaimsPreserved: true,
      simulatedServiceOperations: { databaseRead: 21, databaseWrite: 3, authRead: 9, authWrite: 3 },
      simulatedOperationCounts: { RecordSecuritySynchronizationFailure: 1 }, totalSimulatedServiceOperations: 36 });
    expect(result.latencyModel).toMatchObject({ applied: true, modeledServiceWaitMs: 174, liveVolumeAcceptancePassed: false });
    expect(result.latencyModel.modeledSequentialDurationMs).toBeCloseTo(result.localMeasurement.sweepWallMs + 174);
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
  const sourceSha256 = Object.fromEntries(["securityReconciliation.ts", "securityReconciliationBatch.ts", "currentAuthorizationTransitions.ts", "validation.ts", "constants.ts"].map(name => [name, "a".repeat(64)]));
  function measurement(wallMs) {
    return { rosterSize: 2000, pendingCount: 0, deniedCount: 1998, mirrorDriftCount: 0, transientAuthFailures: 0,
      sourceSha256, simulatedServiceOperations: { databaseRead: 15, databaseWrite: 0, authRead: 22, authWrite: 0 },
      totalSimulatedServiceOperations: 37, completion: { stateAttempts: 2000, failedAttempts: 0 }, pendingRemaining: 0, mirrorMismatches: 0,
      localMeasurement: { sweepWallMs: wallMs, cpuMs: 10, executionHeapPeakDeltaBytes: 100, processMaxRssBytes: 1000 } };
  }
  function provider() {
    return { schemaVersion: "sodc-reconciliation-provider-samples/v2", projectId: "sodc-web", releaseGitSha: "b".repeat(40),
      sourceSha256: Object.fromEntries(Object.entries(sourceSha256).reverse()), observedAt: "2026-10-23T12:00:00Z", authorityVerifiedHealthy: true,
      evidenceReference: "private-receipt/aggregate.json", samples: [{ stateAttempts: 7, pendingAttempts: 0, failedAttempts: 0, durationMs: 240, logicalServiceOperations: 11 }],
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
      projections: [{ rosterSize: 2000, actualProviderVolumeTest: false, equalCostServiceOperationProjectionMs: { median: 240 / 11 * 37, p95: 240 / 11 * 37 } }] });
  });

  it.each([
    value => { value.projectId = "sodc-web-prod"; }, value => { value.samples[0].pendingAttempts = 1; },
    value => { value.samples[0].failedAttempts = 1; }, value => { value.samples[0].uid = "private"; },
    value => { value.sourceSha256["validation.ts"] = "c".repeat(64); }, value => { value.rawIdentities = []; }, value => { delete value.samples[0].logicalServiceOperations; },
    value => { value.schemaVersion = "sodc-reconciliation-provider-samples/v1"; },
  ])("rejects unbound, non-Dev, private or unhealthy calibration evidence", change => {
    const value = provider();
    change(value);
    expect(() => projectProviderSamples([], value, sourceSha256)).toThrow();
  });
});
