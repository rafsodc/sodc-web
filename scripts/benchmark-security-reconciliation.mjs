#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { compileFunction, createContext } from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = ["securityReconciliation.ts", "securityReconciliationBatch.ts", "currentAuthorizationTransitions.ts", "validation.ts", "constants.ts"];
const LATENCIES = ["databaseRead", "databaseWrite", "authRead", "authWrite"];

function integer(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${label}`);
  return value;
}
function memory() {
  const value = process.memoryUsage();
  return { heapUsedBytes: value.heapUsed, rssBytes: value.rss };
}
function digest(value) { return createHash("sha256").update(value).digest("hex"); }
function sameObject(left, right) {
  return left && right && Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(key => left[key] === right[key]);
}
function median(values) { return percentile(values, 0.5); }
export function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

/** Real production scheduler/coordinator, with local transport boundaries only. No Firebase SDK is loaded. */
export async function runReconciliationCase({ repositoryRoot = ROOT, rosterSize, pendingCount = 0, deniedCount = 0, mirrorDriftCount = 0, transientAuthFailures = 0, latencyMs = {} }) {
  integer(rosterSize, 2, 100_000, "roster size");
  integer(pendingCount, 0, rosterSize - 2, "pending count");
  integer(deniedCount, 0, rosterSize - pendingCount - 2, "denied count");
  integer(mirrorDriftCount, 0, rosterSize - pendingCount - 2, "mirror drift count");
  integer(transientAuthFailures, 0, pendingCount, "transient failure count");
  for (const [kind, value] of Object.entries(latencyMs)) {
    if (!LATENCIES.includes(kind) || !Number.isFinite(value) || value < 0 || value > 60_000) throw new Error("Invalid transport latency model");
  }
  const require = createRequire(path.join(repositoryRoot, "functions/package.json"));
  const ts = require("typescript");
  const source = Object.fromEntries(await Promise.all(SOURCES.map(async name => [name, await readFile(path.join(repositoryRoot, "functions/src", name), "utf8")])));
  const sourceSha256 = Object.fromEntries(SOURCES.map(name => [name, digest(source[name])]));
  const beforeFixtures = memory();
  const states = new Map();
  const transitions = new Map();
  const identities = new Map();
  const failures = new Set();
  const control = { status: "READY", version: 1, readyAdminCount: 2 };
  const counts = Object.fromEntries(LATENCIES.map(kind => [kind, 0]));
  const operations = {};
  let completion = null;
  let warnings = 0;
  let injectedFailures = 0;
  let peak = beforeFixtures;
  let serviceCalls = 0;
  function sample() {
    const value = memory();
    peak = { heapUsedBytes: Math.max(peak.heapUsedBytes, value.heapUsedBytes), rssBytes: Math.max(peak.rssBytes, value.rssBytes) };
  }
  function charge(kind, name) {
    counts[kind]++;
    operations[name] = (operations[name] ?? 0) + 1;
    if (++serviceCalls % 100 === 0) sample();
  }
  const clone = value => structuredClone(value);
  for (let index = 0; index < rosterSize; index++) {
    const uid = `local-benchmark-${index.toString().padStart(6, "0")}`;
    const operationId = `local-operation-${index}`;
    const pending = index >= rosterSize - pendingCount;
    const denied = index >= 2 && index < 2 + deniedCount;
    const admin = index < 2;
    const securityVersion = pending ? 2 : 1;
    const membershipStatus = denied ? "PENDING" : "REGULAR";
    const state = { userId: uid, securityVersion, operationId, membershipStatus, desiredEnabled: !denied, desiredAdmin: admin,
      accessReady: !pending && !denied, adminReady: admin, syncStatus: pending ? "PENDING" : "READY", verificationEmail: null,
      user: { membershipStatus, email: "local-fixture@example.invalid" } };
    states.set(uid, state);
    transitions.set(operationId, { ...state, user: undefined, actorId: "local-benchmark", actorKind: "OPERATOR", reason: "LOCAL_BENCHMARK", authDisabled: null, noOp: false });
    identities.set(uid, { uid, emailVerified: !denied, disabled: denied, ...(denied ? {} : { email: "local-fixture@example.invalid" }),
      customClaims: { unrelated: "preserved", securityVersion: pending ? 1 : index >= 2 && index < 2 + mirrorDriftCount ? 0 : 1, enabled: !pending && !denied, admin } });
    if (pending && index < rosterSize - pendingCount + transientAuthFailures) failures.add(uid);
  }
  const fixturesMemory = memory();
  const response = (key, value) => ({ data: { [key]: clone(value) } });
  const repository = {
    async getAdminSafetyControl() { charge("databaseRead", "GetAdminSafetyControl"); return response("adminSafetyControl", control); },
    async listPendingSecurityTransitions({ limit }) { charge("databaseRead", "ListPendingSecurityTransitions"); return response("securityTransitions", [...transitions.values()].filter(row => row.syncStatus === "PENDING").slice(0, limit).map(row => ({ operationId: row.operationId }))); },
    async listSecurityStatesForReconciliation({ limit, offset }) { charge("databaseRead", "ListSecurityStatesForReconciliation"); return response("userSecurityStates", [...states.values()].slice(offset, offset + limit)); },
    async listSecurityTransitionsForReconciliation({ operationIds, limit }) { charge("databaseRead", "ListSecurityTransitionsForReconciliation"); return response("securityTransitions", operationIds.map(id => transitions.get(id)).filter(Boolean).slice(0, limit)); },
    async getSecurityTransition({ operationId }) { charge("databaseRead", "GetSecurityTransition"); return response("securityTransition", transitions.get(operationId) ?? null); },
    async getUserSecurityState({ userId }) { charge("databaseRead", "GetUserSecurityState"); return response("userSecurityState", states.get(userId) ?? null); },
    async completeSecurityTransition(input) {
      charge("databaseWrite", "CompleteSecurityTransition");
      if (input.expectedControlVersion !== control.version) throw new Error("ADMIN_CONTROL_CONFLICT");
      const state = states.get(input.userId);
      if (!state || state.operationId !== input.operationId || state.securityVersion !== input.securityVersion) throw new Error("SECURITY_STATE_CONFLICT");
      Object.assign(state, { accessReady: input.accessReady, adminReady: input.adminReady, syncStatus: "READY" });
      transitions.get(input.operationId).syncStatus = "READY";
      control.version++;
      return { data: {} };
    },
    async recordSecuritySynchronizationFailure() { charge("databaseWrite", "RecordSecuritySynchronizationFailure"); return { data: {} }; },
  };
  const auth = {
    async getUser(uid) {
      charge("authRead", "AuthGetUser");
      if (failures.delete(uid)) { injectedFailures++; throw new Error("LOCAL_TRANSIENT_AUTH_FAILURE"); }
      if (!identities.has(uid)) throw new Error("UNKNOWN_LOCAL_IDENTITY");
      return clone(identities.get(uid));
    },
    async getUsers(identifiers) {
      charge("authRead", "AuthGetUsers");
      if (identifiers.length > 100) throw new Error("Oversized Auth batch");
      const users = identifiers.map(({uid}) => identities.get(uid)).filter(Boolean).map(clone).reverse();
      return {users, notFound: identifiers.filter(({uid}) => !identities.has(uid))};
    },
    async setCustomUserClaims(uid, claims) { charge("authWrite", "AuthSetCustomUserClaims"); identities.get(uid).customClaims = clone(claims); },
    async updateUser() { throw new Error("Unexpected account mutation in local scenario"); },
    async revokeRefreshTokens() { throw new Error("Unexpected token revocation in local scenario"); },
  };
  const logger = {
    info(message, fields) { if (message === "Security reconciliation completed") completion = clone(fields); },
    warn() { warnings++; },
  };
  let scheduleOptions;
  const modules = new Map();
  // Omit process, credentials, fetch and timer globals from the production module context.
  const moduleContext = createContext({});
  function load(name) {
    if (modules.has(name)) return modules.get(name).exports;
    if (!SOURCES.includes(name)) throw new Error("Unapproved benchmark module dependency");
    const filename = path.join(repositoryRoot, "functions/src", name);
    const compiled = ts.transpileModule(source[name], { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    const module = { exports: {} };
    modules.set(name, module);
    const restrictedRequire = id => {
      if (id === "node:crypto") return require(id);
      if (id === "firebase-admin") return { auth: () => auth };
      if (id === "firebase-functions/v2/https") return { HttpsError: class extends Error {} };
      if (id === "firebase-functions/v2/scheduler") return { onSchedule: (options, handler) => { scheduleOptions = clone(options); return handler; } };
      if (id === "firebase-functions/logger") return logger;
      if (id === "./securityRepository") return repository;
      if (id === "@dataconnect/admin-generated") return { getUserMembershipStatus: async () => { throw new Error("Unexpected bootstrap/profile operation in sweep"); } };
      if (id.startsWith("./")) return load(id.slice(2).replace(/\.js$/, "") + ".ts");
      throw new Error("Unapproved benchmark import; real SDK/network access is forbidden");
    };
    compileFunction(compiled.outputText, ["exports", "require", "module", "__filename", "__dirname"], { filename, parsingContext: moduleContext })(module.exports, restrictedRequire, module, filename, path.dirname(filename));
    return module.exports;
  }
  const handler = load("securityReconciliation.ts").reconcilePendingSecurityTransitions;
  if (globalThis.gc) globalThis.gc();
  const beforeSweep = memory();
  peak = beforeSweep;
  const cpuBefore = process.cpuUsage();
  const started = performance.now();
  await handler();
  const sweepWallMs = performance.now() - started;
  const cpu = process.cpuUsage(cpuBefore);
  sample();
  if (!completion || completion.stateAttempts !== rosterSize) throw new Error("Actual scheduler did not complete the entire roster");
  const pendingRemaining = [...transitions.values()].filter(row => row.syncStatus === "PENDING").length;
  const mirrorMismatches = [...states.values()].filter(state => {
    const claims = identities.get(state.userId).customClaims;
    return claims.securityVersion !== state.securityVersion || claims.enabled !== state.desiredEnabled || claims.admin !== state.desiredAdmin;
  }).length;
  const modeledServiceWaitMs = LATENCIES.reduce((sum, kind) => sum + counts[kind] * (latencyMs[kind] ?? 0), 0);
  return {
    rosterSize, pendingCount, deniedCount, mirrorDriftCount, transientAuthFailures, actualProductionCode: true, cloudCalls: 0,
    sourceSha256, typescriptVersion: ts.version, scheduleOptions,
    completion, warnings, injectedFailures, pendingRemaining, mirrorMismatches,
    unrelatedClaimsPreserved: [...identities.values()].every(identity => identity.customClaims.unrelated === "preserved"),
    simulatedServiceOperations: counts, simulatedOperationCounts: operations, totalSimulatedServiceOperations: serviceCalls,
    localMeasurement: { sweepWallMs, cpuMs: (cpu.user + cpu.system) / 1000,
      fixtureHeapDeltaBytes: fixturesMemory.heapUsedBytes - beforeFixtures.heapUsedBytes,
      executionHeapPeakDeltaBytes: Math.max(0, peak.heapUsedBytes - beforeSweep.heapUsedBytes),
      sampledExecutionRssPeakBytes: peak.rssBytes, processMaxRssBytes: process.resourceUsage().maxRSS * 1024,
      exposedGc: Boolean(globalThis.gc), memorySampleEveryServiceCalls: 100 },
    latencyModel: { assumedLatencyMs: latencyMs, modeledServiceWaitMs, modeledSequentialDurationMs: sweepWallMs + modeledServiceWaitMs,
      applied: Object.keys(latencyMs).length > 0, liveVolumeAcceptancePassed: false },
    requiredMeanServiceOperationMsFor180SecondSweep: Math.max(0, 180_000 - sweepWallMs) / serviceCalls,
  };
}

export function scenarioInputs(rosterSize) {
  integer(rosterSize, 2, 100_000, "roster size");
  const pending = Math.min(100, rosterSize - 2);
  const mixedPending = Math.min(100, Math.floor((rosterSize - 2) / 2));
  return [
    { name: "healthy", rosterSize },
    { name: "denied-fixture-roster", rosterSize, deniedCount: rosterSize - 2 },
    { name: "pending-backlog", rosterSize, pendingCount: pending },
    { name: "drift-and-transient-retry", rosterSize, pendingCount: mixedPending,
      mirrorDriftCount: Math.min(Math.max(1, Math.floor(rosterSize / 100)), rosterSize - mixedPending - 2),
      transientAuthFailures: Math.min(Math.max(1, Math.floor(rosterSize / 1000)), mixedPending) },
  ];
}

export function summarizeMeasurements(measurements) {
  const first = measurements[0];
  if (!first || measurements.some(value => !sameObject(value.sourceSha256, first.sourceSha256) || !sameObject(value.simulatedServiceOperations, first.simulatedServiceOperations))) throw new Error("Benchmark runs have different source or operation counts");
  return { rosterSize: first.rosterSize, pendingCount: first.pendingCount, deniedCount: first.deniedCount, mirrorDriftCount: first.mirrorDriftCount, transientAuthFailures: first.transientAuthFailures,
    runs: measurements.length, simulatedServiceOperations: first.simulatedServiceOperations,
    totalSimulatedServiceOperations: first.totalSimulatedServiceOperations,
    localSweepWallMs: { median: median(measurements.map(value => value.localMeasurement.sweepWallMs)), p95: percentile(measurements.map(value => value.localMeasurement.sweepWallMs), 0.95), max: Math.max(...measurements.map(value => value.localMeasurement.sweepWallMs)) },
    localCpuMsMedian: median(measurements.map(value => value.localMeasurement.cpuMs)),
    localExecutionHeapPeakDeltaBytesMax: Math.max(...measurements.map(value => value.localMeasurement.executionHeapPeakDeltaBytes)),
    localProcessMaxRssBytesMax: Math.max(...measurements.map(value => value.localMeasurement.processMaxRssBytes)),
    failedAttemptsPerRun: first.completion.failedAttempts, pendingRemainingPerRun: first.pendingRemaining,
    mirrorMismatchesPerRun: first.mirrorMismatches, allRunsCompleted: measurements.every(value => value.completion.stateAttempts === value.rosterSize),
    liveVolumeAcceptancePassed: false };
}

export function projectProviderSamples(summaries, provider, sourceSha256) {
  const allowed = ["schemaVersion", "projectId", "releaseGitSha", "sourceSha256", "observedAt", "authorityVerifiedHealthy", "evidenceReference", "samples", "missingCompletions", "timeouts", "backlogBefore", "backlogAfter"];
  if (!provider || Object.keys(provider).some(key => !allowed.includes(key)) || provider.schemaVersion !== "sodc-reconciliation-provider-samples/v2" || provider.projectId !== "sodc-web" ||
      !/^[a-f0-9]{40}$/.test(provider.releaseGitSha ?? "") || !Number.isFinite(Date.parse(provider.observedAt)) || provider.authorityVerifiedHealthy !== true ||
      typeof provider.evidenceReference !== "string" || !provider.evidenceReference || !Array.isArray(provider.samples) || !provider.samples.length ||
      !sameObject(provider.sourceSha256, sourceSha256) || Object.keys(sourceSha256).length !== SOURCES.length ||
      SOURCES.some(name => !/^[a-f0-9]{64}$/.test(sourceSha256[name] ?? ""))) throw new Error("Invalid aggregate Dev provider calibration or mismatched source");
  for (const sample of provider.samples) {
    if (Object.keys(sample).some(key => !["stateAttempts", "pendingAttempts", "failedAttempts", "durationMs", "logicalServiceOperations"].includes(key)) || !Number.isSafeInteger(sample.stateAttempts) || sample.stateAttempts < 2 ||
        !Number.isSafeInteger(sample.logicalServiceOperations) || sample.logicalServiceOperations < 1 || sample.pendingAttempts !== 0 || sample.failedAttempts !== 0 || !Number.isFinite(sample.durationMs) || sample.durationMs <= 0) throw new Error("Calibration requires healthy complete natural sweeps only");
  }
  for (const key of ["missingCompletions", "timeouts", "backlogBefore", "backlogAfter"]) integer(provider[key], 0, Number.MAX_SAFE_INTEGER, "provider aggregate");
  const unitCosts = provider.samples.map(sample => sample.durationMs / sample.logicalServiceOperations);
  return { projectId: provider.projectId, releaseGitSha: provider.releaseGitSha, observedAt: provider.observedAt,
    evidenceReference: provider.evidenceReference, measuredNaturalSweepCount: provider.samples.length,
    measuredRosterSizes: [...new Set(provider.samples.map(sample => sample.stateAttempts))].toSorted((a, b) => a - b),
    measuredNaturalSweepDurationMs: { median: median(provider.samples.map(sample => sample.durationMs)), p95: percentile(provider.samples.map(sample => sample.durationMs), 0.95), max: Math.max(...provider.samples.map(sample => sample.durationMs)) },
    missingCompletions: provider.missingCompletions, timeouts: provider.timeouts, backlogBefore: provider.backlogBefore, backlogAfter: provider.backlogAfter,
    projections: summaries.map(summary => ({ rosterSize: summary.rosterSize, pendingCount: summary.pendingCount, deniedCount: summary.deniedCount, mirrorDriftCount: summary.mirrorDriftCount,
      equalCostServiceOperationProjectionMs: { median: median(unitCosts) * summary.totalSimulatedServiceOperations, p95: percentile(unitCosts, 0.95) * summary.totalSimulatedServiceOperations },
      actualProviderVolumeTest: false })),
    assumptions: "Linear sequential cost at one mean logical service-operation price using explicitly supplied, source-bound sample operation counts; small-roster overhead, read/write latency differences, load, retries and larger query pages are not established.",
    liveVolumeAcceptancePassed: false };
}

export function parseBenchmarkArguments(args) {
  const options = { sizes: [100, 1000, 2000, 5000, 10000], runs: 3 };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const [key, value] = args.slice(index, index + 2);
    if (!value || !["--sizes", "--runs", "--output", "--provider-samples", "--latency-model"].includes(key) || seen.has(key)) throw new Error("Unknown or repeated benchmark option or missing value");
    seen.add(key);
    if (key === "--sizes") options.sizes = value.split(",").map(item => integer(Number(item), 2, 100_000, "roster size"));
    else if (key === "--runs") options.runs = integer(Number(value), 1, 25, "run count");
    else options[key.slice(2)] = value;
  }
  if (new Set(options.sizes).size !== options.sizes.length || options.sizes.length > 10) throw new Error("Use at most ten distinct roster sizes");
  return options;
}

async function main() {
  if (!/^24\./.test(process.versions.node)) throw new Error("Use Node 24 for reproducible reconciliation benchmarks");
  if (process.argv[2] === "--local-worker") {
    const input = JSON.parse(process.argv[3] ?? "null");
    process.stdout.write(JSON.stringify(await runReconciliationCase(input)));
    return;
  }
  const options = parseBenchmarkArguments(process.argv.slice(2));
  const latencyMs = options["latency-model"] ? JSON.parse(await readFile(options["latency-model"], "utf8")) : {};
  const provider = options["provider-samples"] ? JSON.parse(await readFile(options["provider-samples"], "utf8")) : null;
  const summaries = [];
  const measurements = [];
  for (const size of options.sizes) {
    for (const { name, ...scenario } of scenarioInputs(size)) {
      const runs = [];
      for (let index = 0; index < options.runs; index++) {
        const result = spawnSync(process.execPath, ["--expose-gc", fileURLToPath(import.meta.url), "--local-worker", JSON.stringify({ ...scenario, latencyMs })], { encoding: "utf8", timeout: 120_000, maxBuffer: 2 * 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME } });
        if (result.status !== 0 || result.error) throw new Error("Isolated local benchmark worker failed");
        runs.push(JSON.parse(result.stdout));
      }
      measurements.push({ name, runs });
      summaries.push({ name, ...summarizeMeasurements(runs) });
    }
  }
  const sourceSha256 = measurements[0].runs[0].sourceSha256;
  const report = { schemaVersion: "sodc-reconciliation-local-benchmark/v1", generatedAt: new Date().toISOString(),
    gitSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(), sourceSha256,
    environment: { node: process.versions.node, platform: process.platform, architecture: process.arch, cpuModel: os.cpus()[0]?.model, logicalCpuCount: os.cpus().length },
    cloudCalls: 0, actualProductionCode: true, summaries, measurements,
    providerCalibration: provider ? projectProviderSamples(summaries, provider, sourceSha256) : null,
    limitations: ["Synthetic local transports; SDK, network and database execution are not measured.", "Memory includes local fixture stores/transpiler scaffolding; execution deltas exclude the initial fixture baseline.", "Provider-calibrated durations are projections, not actual high-volume provider tests."], liveVolumeAcceptancePassed: false };
  if (options.output) await writeFile(path.resolve(options.output), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ ...report, measurements: undefined }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("Reconciliation benchmark stopped; check local inputs and source compatibility. No cloud operations are supported."); process.exitCode = 1; });
}
