import {afterEach, describe, expect, it, vi} from "vitest";
import {mkdtemp, mkdir, readFile, rm, writeFile, symlink, readdir} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {parseMigrationArguments, runMigrationCli, safeMigrationCliError} from "./authorization-migration.mjs";
import {loadMigrationRun, migrationHash, PHASE_ASSERTIONS} from "./authorization-migration-state.mjs";

const sha = "a".repeat(40);
const instant = new Date("2026-10-23T12:00:00.000Z");
const roots = [];
afterEach(async () => {for (const directory of roots.splice(0)) await rm(directory, {recursive: true, force: true});});
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "migration-cli-test-"));
  roots.push(directory);
  const repositoryRoot = path.join(directory, "repository");
  await mkdir(repositoryRoot);
  const git = vi.fn(async args => args[0] === "rev-parse" ? sha + "\n" : "");
  const loadAdapter = vi.fn(async () => {throw new Error("Unexpected cloud adapter loading");});
  return {directory, repositoryRoot, artifactDirectory: path.join(directory, "artifacts"),
    dependencies: {repositoryRoot, nodeVersion: "24.22.0", env: {}, git, loadAdapter, now: () => instant}};
}
function prepareArgs(f, {installation = "legacy", projectId = "sodc-web-beta", runId = "reviewed-beta"} = {}) {
  return ["prepare", "--project", projectId, "--run-id", runId, "--operator", "operator", "--reason", "approved change",
    "--installation", installation, "--artifact-directory", f.artifactDirectory];
}
const runFlags = ["--project", "sodc-web-beta", "--run-id", "reviewed-beta"];
async function prepare(f, overrides) {return runMigrationCli(prepareArgs(f, overrides), f.dependencies);}
function backupGate(projectId = "sodc-web-beta", runId = "reviewed-beta") {
  return {schemaVersion: "sodc-authorization-migration-gate/v1", gate: "backup", projectId,
    gitSha: sha, runId, reviewedBy: "operator", observedAt: instant.toISOString(),
    evidence: "approved backup record", details: {backupReference: "completed backup", restoreTestReference: "isolated restore report"}};
}
function oldWritersGate(projectId = "sodc-web-beta", runId = "reviewed-beta") {
  return {...backupGate(projectId, runId), gate: "old-writers", evidence: "approved retirement review", details: {
    method: "cloud-run-retirement", freezeStateHash: "b".repeat(64), inventoryHash: "c".repeat(64),
    successorRevisions: [{name: `projects/${projectId}/locations/europe-west2/services/security-writer/revisions/security-writer-00002-new`,
      uid: "12345678-1234-4123-8123-123456789012", images: [`europe-west2-docker.pkg.dev/${projectId}/functions/security-writer@sha256:${"d".repeat(64)}`]}],
    externalOperationsReference: "reviewed external operations",
  }};
}
function acceptanceGate(projectId, runId, sourceProjectId) {
  return {...backupGate(projectId, runId), gate: "acceptance", evidence: "reviewed release evidence", details: {
    sourceProjectId, backendTestReference: "backend", browserReviewReference: "browser review", notificationsReference: "notifications",
    schedulerVolumeReference: "volume", appCheckReference: "appcheck",
  }};
}

describe("authorization migration CLI boundaries", () => {
  it.each([
    ["plan", "--project", "beta"],
    ["plan", "--project", "sodc-web-beta", "--project", "sodc-web"],
    ["plan", "--project", "sodc-web-beta", "--all"],
    ["apply", ...runFlags, "--phase", "all", "--confirm-project", "sodc-web-beta"],
    ["apply", ...runFlags, "--phase", "freeze", "--confirm-project", "sodc-web-production"],
    ["apply", ...runFlags, "--phase", "inspect"],
    ["prepare", ...runFlags, "--operator", "operator", "--reason", "review", "--artifact-directory", "/tmp/new-artifact"],
    ["audit", "--project", "sodc-web-beta", "--import-admins"],
    ["status", ...runFlags, "--phase", "freeze"],
    ["plan", "--project", "sodc-web-beta", "unexpected"],
    ["plan", "--project"],
    ["gate", ...runFlags, "--name", "retirement", "--evidence", "/tmp/review.json"],
    ["gate", ...runFlags, "--name", "old-writers", "--evidence", "/tmp/review.json", "--method", "cloud-run-retirement"],
  ])("rejects ambiguous or unsupported targeting before execution: %j", args => {
    expect(() => parseMigrationArguments(args)).toThrow();
  });

  it("keeps planning offline without Git, Node 24, credentials or provider loading", async () => {
    const f = await fixture();
    const result = await runMigrationCli(["plan", "--project", "sodc-web-beta"], {...f.dependencies, nodeVersion: "22.0.0",
      env: {GCLOUD_PROJECT: "unrelated", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}});
    expect(result).toMatchObject({offline: true, installation: "unclassified", projectId: "sodc-web-beta"});
    expect(result.phases.some(item => item.phase === "compatibility")).toBe(true);
    expect(f.dependencies.git).not.toHaveBeenCalled();
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
    expect(await readdir(f.repositoryRoot)).toEqual([]);
    const strict = await runMigrationCli(["plan", "--project", "sodc-web-beta", "--installation", "strict"], f.dependencies);
    expect(strict.phases.some(item => item.phase === "compatibility")).toBe(false);
  });

  it("prepares and reads a private source-pinned run without a cloud adapter", async () => {
    const f = await fixture();
    const result = await runMigrationCli([...prepareArgs(f), "--import-admins"], f.dependencies);
    expect(result).toMatchObject({prepared: true, offline: true, cloudChanges: false, gitSha: sha, importAdmins: true});
    const run = await loadMigrationRun({repositoryRoot: f.repositoryRoot, projectId: "sodc-web-beta", runId: "reviewed-beta"});
    expect(run.plan).toMatchObject({operator: "operator", reason: "approved change", installation: "legacy", importAdmins: true});
    const status = await runMigrationCli(["status", ...runFlags], {...f.dependencies, nodeVersion: "22.0.0", env: {GCLOUD_PROJECT: "different"},
      git: vi.fn(async () => {throw new Error("Status must not inspect Git");})});
    expect(status).toMatchObject({offline: true, runId: "reviewed-beta", gitSha: sha});
    expect(status.phases.every(item => item.status === "pending")).toBe(true);
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
    await expect(prepare(f)).rejects.toThrow();
  });

  it("requires Node 24 and clean source before preparation", async () => {
    const f = await fixture();
    await expect(runMigrationCli(prepareArgs(f), {...f.dependencies, nodeVersion: "22.0.0"})).rejects.toMatchObject({code: "NODE_24_REQUIRED"});
    const dirtyGit = vi.fn(async args => args[0] === "rev-parse" ? sha : " M scripts/change.mjs\n");
    await expect(runMigrationCli(prepareArgs(f), {...f.dependencies, git: dirtyGit})).rejects.toMatchObject({code: "CHECKOUT_DIRTY"});
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
    expect(await readdir(f.repositoryRoot)).toEqual([]);
  });

  it.each([
    {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"},
    {DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399"},
    {GOOGLE_CLOUD_PROJECT: "sodc-web-production"},
    {FIREBASE_CONFIG: "not-json"},
    {FIREBASE_CONFIG: JSON.stringify({projectId: "sodc-web"})},
  ])("rejects conflicting target configuration before provider loading: %j", async env => {
    const f = await fixture();
    await expect(runMigrationCli(["audit", "--project", "sodc-web-beta"], {...f.dependencies, env})).rejects.toThrow();
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
  });

  it("records a typed gate locally without importing the cloud module", async () => {
    const f = await fixture(); await prepare(f);
    const file = path.join(f.directory, "gate.json"); await writeFile(file, JSON.stringify(backupGate()));
    const result = await runMigrationCli(["gate", ...runFlags, "--name", "backup", "--evidence", file], f.dependencies);
    expect(result).toMatchObject({gate: "backup", cloudChanges: false});
    const run = await loadMigrationRun({repositoryRoot: f.repositoryRoot, projectId: "sodc-web-beta", runId: "reviewed-beta"});
    expect(run.journal.gates.backup.hash).toBe(migrationHash(backupGate()));
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
  });

  it("accepts the old-writers gate name and records its typed evidence without a cloud adapter", async () => {
    const f = await fixture(); await prepare(f);
    const record = oldWritersGate(), file = path.join(f.directory, "old-writers.json");
    await writeFile(file, JSON.stringify(record));
    const args = ["gate", ...runFlags, "--name", "old-writers", "--evidence", file];
    expect(parseMigrationArguments(args)).toMatchObject({command: "gate", flags: {name: "old-writers"}});
    await expect(runMigrationCli(args, f.dependencies)).resolves.toMatchObject({gate: "old-writers", hash: migrationHash(record), cloudChanges: false});
    const run = await loadMigrationRun({repositoryRoot: f.repositoryRoot, projectId: record.projectId, runId: record.runId});
    expect(run.journal.gates["old-writers"].hash).toBe(migrationHash(record));
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
  });

  it.each(["sodc-web", "sodc-web-beta", "sodc-web-production", "unknown-project"])("uses the Production Dev-acceptance policy through the gate CLI for %s", async sourceProjectId => {
    const f = await fixture(), projectId = "sodc-web-production", runId = "reviewed-prod";
    await prepare(f, {projectId, runId});
    const record = acceptanceGate(projectId, runId, sourceProjectId), file = path.join(f.directory, "acceptance.json");
    await writeFile(file, JSON.stringify(record));
    const invoke = () => runMigrationCli(["gate", "--project", projectId, "--run-id", runId, "--name", "acceptance", "--evidence", file], f.dependencies);
    if (sourceProjectId === "sodc-web") await expect(invoke()).resolves.toMatchObject({gate: "acceptance", hash: migrationHash(record), cloudChanges: false});
    else await expect(invoke()).rejects.toMatchObject({code: "ACCEPTANCE_REQUIRED"});
    const run = await loadMigrationRun({repositoryRoot: f.repositoryRoot, projectId, runId});
    expect(run.journal.gates.acceptance?.hash).toBe(sourceProjectId === "sodc-web" ? migrationHash(record) : undefined);
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
  });

  it("resumes a held strict Dev freeze only with retirement review and exposes safe bindings through status", async () => {
    const f = await fixture(), projectId = "sodc-web", runId = "reviewed-dev";
    await prepare(f, {projectId, runId, installation: "strict"});
    const flags = ["--project", projectId, "--run-id", runId], original = backupGate(projectId, runId);
    for (const record of [original,
      {...original, gate: "freeze-scope", details: {entrypoints: ["grantAdmin"], jobNames: [], externalWritersReference: "external review", probeUserId: "nonadmin", probeReference: "approved probe"}},
      {...original, gate: "sql-review", details: {diffSha256: "e".repeat(64)}},
    ]) {
      const file = path.join(f.directory, record.gate + ".json"); await writeFile(file, JSON.stringify(record));
      await runMigrationCli(["gate", ...flags, "--name", record.gate, "--evidence", file], f.dependencies);
    }
    const proof = oldWritersGate(projectId, runId), retirement = {freezeStateHash: proof.details.freezeStateHash,
      inventoryHash: proof.details.inventoryHash, inventoryFile: "provider-old-writers.json", requiredMethod: proof.details.method};
    const perform = vi.fn(async phase => phase === "inspect" ? {baseline: {installation: "strict", policies: []}} : phase === "freeze" ? {retirement: {...retirement, privateInventory: "do-not-print"}} : {phase});
    const observe = vi.fn(async () => ({projectId, gitSha: sha, observedAt: instant.toISOString()}));
    const close = vi.fn(), loadAdapter = vi.fn(async ({plan}) => ({observe, perform, close,
      verify: vi.fn(async (phase, context) => ({ok: true, evidence: {projectId, gitSha: sha, runId, planHash: migrationHash(plan), observedAt: instant.toISOString(),
        assertions: {...Object.fromEntries(PHASE_ASSERTIONS[phase].map(key => [key, true])), ...(phase === "freeze" ? {oldWritersRetired: Boolean(context.gates["old-writers"])} : {})},
      }})),
    }));
    const dependencies = {...f.dependencies, loadAdapter};
    const applyPhase = phase => runMigrationCli(["apply", ...flags, "--phase", phase, "--confirm-project", projectId], dependencies);
    await applyPhase("inspect");
    await expect(applyPhase("freeze")).rejects.toMatchObject({code: "PHASE_NOT_VERIFIED"});
    const held = await loadMigrationRun({repositoryRoot: f.repositoryRoot, projectId, runId});
    const status = await runMigrationCli(["status", ...flags], f.dependencies);
    expect(status.retirement).toEqual(retirement);
    expect(JSON.stringify(status)).not.toContain("do-not-print");
    await expect(applyPhase("schema")).rejects.toMatchObject({code: "PHASE_ORDER"});
    const file = path.join(f.directory, "old-writers.json"); await writeFile(file, JSON.stringify(proof));
    await runMigrationCli(["gate", ...flags, "--name", "old-writers", "--evidence", file], f.dependencies);
    await expect(applyPhase("freeze")).resolves.toMatchObject({phase: "freeze", status: "complete"});
    await expect(applyPhase("schema")).resolves.toMatchObject({phase: "schema", status: "complete"});
    const completed = await loadMigrationRun({repositoryRoot: f.repositoryRoot, projectId, runId});
    expect(completed.journal.checkpoints.freeze.operationId).toBe(held.journal.checkpoints.freeze.operationId);
    expect(perform.mock.calls.map(([phase]) => phase)).toEqual(["inspect", "freeze", "freeze", "schema"]);
    expect(perform.mock.calls.at(-1)[1].gates["old-writers"].details).toEqual(proof.details);
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
  });

  it("refuses mismatched, stale, credential-bearing or symlink gate evidence", async () => {
    const f = await fixture(); await prepare(f);
    const file = path.join(f.directory, "gate.json");
    const args = ["gate", ...runFlags, "--name", "backup", "--evidence", file];
    for (const gate of [
      {...backupGate(), gate: "acceptance"},
      {...backupGate(), projectId: "sodc-web"},
      {...backupGate(), observedAt: "2026-10-21T00:00:00Z"},
      {...backupGate(), evidence: "Bearer " + "x".repeat(30)},
    ]) {
      await writeFile(file, JSON.stringify(gate));
      await expect(runMigrationCli(args, f.dependencies)).rejects.toThrow();
    }
    const linked = path.join(f.directory, "linked-gate.json"); await symlink(file, linked);
    await expect(runMigrationCli(["gate", ...runFlags, "--name", "backup", "--evidence", linked], f.dependencies)).rejects.toMatchObject({code: "GATE_FILE_INVALID"});
    const run = await loadMigrationRun({repositoryRoot: f.repositoryRoot, projectId: "sodc-web-beta", runId: "reviewed-beta"});
    expect(run.journal.gates).toEqual({});
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
  });

  it("refuses a changed source revision and strict compatibility before loading the adapter", async () => {
    const f = await fixture(); await prepare(f, {installation: "strict"});
    const auditArgs = ["audit", ...runFlags];
    const changedGit = vi.fn(async args => args[0] === "rev-parse" ? "b".repeat(40) : "");
    await expect(runMigrationCli(auditArgs, {...f.dependencies, git: changedGit})).rejects.toMatchObject({code: "REVISION_CHANGED"});
    await expect(runMigrationCli(["apply", ...runFlags, "--phase", "compatibility", "--confirm-project", "sodc-web-beta"], f.dependencies)).rejects.toMatchObject({code: "PHASE_INVALID"});
    expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
  });

  it("standalone audit observes only, persists no run and excludes private provider details", async () => {
    const f = await fixture();
    const observe = vi.fn(async () => ({projectId: "sodc-web-beta", gitSha: sha, observedAt: instant.toISOString(), installation: "legacy",
      schema: {files: [{path: "schema.gql", content: "type User {id:String!}"}]}, functions: [{name: "grantAdmin", state: "ACTIVE"}], jobs: [],
      databaseProtection: {instance: "reviewed-instance", state: "RUNNABLE", region: "europe-west2", automatedBackups: true, pointInTimeRecovery: true, deletionProtection: true},
      policies: [{privatePolicy: "must-not-print"}], authority: {passed: true, counts: {profiles: 2}, control: null,
        private: {eligibleLegacyAdminUIDs: ["private-user-id"], rosterFingerprint: "private-fingerprint"}}}));
    const perform = vi.fn(); const close = vi.fn();
    const loadAdapter = vi.fn(async () => ({observe, perform, close}));
    const result = await runMigrationCli(["audit", "--project", "sodc-web-beta"], {...f.dependencies, loadAdapter});
    expect(result).toMatchObject({readOnly: true, runId: null, installation: "legacy", authority: {counts: {profiles: 2}}});
    expect(result.databaseProtection).toMatchObject({automatedBackups: true, pointInTimeRecovery: true, deletionProtection: true});
    expect(JSON.stringify(result)).not.toMatch(/private-user-id|private-fingerprint|must-not-print|eligibleLegacyAdminUIDs/);
    expect(loadAdapter.mock.calls[0][0].plan).toMatchObject({schemaVersion: "sodc-authorization-migration-plan/v1", projectId: "sodc-web-beta", gitSha: sha});
    expect(perform).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
    expect(await readdir(f.repositoryRoot)).toEqual([]);
  });

  it("runs exactly the selected inspection phase with source rechecks and plan-bound evidence", async () => {
    const f = await fixture(); await prepare(f);
    const observe = vi.fn(async () => ({projectId: "sodc-web-beta", gitSha: sha, observedAt: instant.toISOString()}));
    const perform = vi.fn(async () => ({baseline: {installation: "legacy", policies: []}}));
    const close = vi.fn(); let createdPlan;
    const loadAdapter = vi.fn(async ({plan}) => {
      createdPlan = plan;
      return {observe, perform, close, verify: vi.fn(async () => ({ok: true, evidence: {
        projectId: plan.projectId, gitSha: plan.gitSha, runId: plan.runId, planHash: migrationHash(plan), observedAt: instant.toISOString(),
        assertions: {targetVerified: true, baselineCaptured: true},
      }}))};
    });
    const result = await runMigrationCli(["apply", ...runFlags, "--phase", "inspect", "--confirm-project", "sodc-web-beta"], {...f.dependencies, loadAdapter});
    expect(result).toMatchObject({phase: "inspect", status: "complete", gitSha: sha});
    expect(perform).toHaveBeenCalledOnce(); expect(perform.mock.calls[0][0]).toBe("inspect");
    expect(perform.mock.calls[0][1].planHash).toBe(migrationHash(createdPlan));
    expect(close).toHaveBeenCalledOnce();
    const status = await runMigrationCli(["status", ...runFlags], f.dependencies);
    expect(status.phases.filter(item => item.status === "complete").map(item => item.phase)).toEqual(["inspect"]);
    expect(f.dependencies.git.mock.calls.filter(([args]) => args[0] === "rev-parse").length).toBeGreaterThanOrEqual(3);
    await expect(readFile(path.join(f.repositoryRoot, ".firebase/authorization-migration/sodc-web-beta.json"))).rejects.toMatchObject({code: "ENOENT"});
  });

  it("blocks a genuinely overlapping second run for the project before any provider work", async () => {
    const f = await fixture(); await prepare(f);
    const otherRun = "second-reviewed-beta";
    const otherPrepare = prepareArgs(f).map(value => value === "reviewed-beta" ? otherRun : value === f.artifactDirectory ? path.join(f.directory, "other-artifacts") : value);
    await runMigrationCli(otherPrepare, f.dependencies);
    let signalEntered;
    const entered = new Promise(resolve => {signalEntered = resolve;});
    let release;
    const held = new Promise(resolve => {release = resolve;});
    const secondObserve = vi.fn(); const secondPerform = vi.fn();
    const loadAdapter = vi.fn(async ({plan}) => ({
      observe: plan.runId === otherRun ? secondObserve : vi.fn(async () => ({projectId: plan.projectId, gitSha: plan.gitSha, observedAt: instant.toISOString()})),
      perform: plan.runId === otherRun ? secondPerform : vi.fn(async () => {
        signalEntered(); await held; return {baseline: {installation: "legacy", policies: []}};
      }),
      verify: vi.fn(async () => ({ok: true, evidence: {projectId: plan.projectId, gitSha: plan.gitSha, runId: plan.runId,
        planHash: migrationHash(plan), observedAt: instant.toISOString(), assertions: {targetVerified: true, baselineCaptured: true}}})),
    }));
    const firstArgs = ["apply", ...runFlags, "--phase", "inspect", "--confirm-project", "sodc-web-beta"];
    const secondArgs = firstArgs.map(value => value === "reviewed-beta" ? otherRun : value);
    const first = runMigrationCli(firstArgs, {...f.dependencies, loadAdapter});
    let result;
    try {
      await entered;
      await expect(runMigrationCli(secondArgs, {...f.dependencies, loadAdapter})).rejects.toMatchObject({code: "PROJECT_LOCKED"});
      expect(secondObserve).not.toHaveBeenCalled(); expect(secondPerform).not.toHaveBeenCalled();
    } finally {release(); result = await first;}
    expect(result.status).toBe("complete");
    await expect(runMigrationCli(secondArgs, {...f.dependencies, loadAdapter})).rejects.toMatchObject({code: "PROJECT_RUN_ACTIVE"});
    expect(secondObserve).not.toHaveBeenCalled(); expect(secondPerform).not.toHaveBeenCalled();
  });

  it("does not print SDK error details or credentials in its error envelope", () => {
    const error = Object.assign(new Error("Bearer " + "sensitive".repeat(8)), {code: "permission-denied", response: {password: "must-not-print"}});
    expect(safeMigrationCliError(error)).toMatchObject({failed: true, code: "MIGRATION_COMMAND_FAILED"});
    expect(JSON.stringify(safeMigrationCliError(error))).not.toMatch(/sensitive|must-not-print|password|permission-denied/);
  });
});
