import {afterEach, describe, expect, it, vi} from "vitest";
import {mkdtemp, readFile, rm, symlink, unlink, writeFile} from "node:fs/promises";
import {hostname, tmpdir} from "node:os";
import path from "node:path";
import {verifyAuthorizationMigration} from "./check-authorization-migration.mjs";
import {
  assertMigrationEnvironment, assertNoCredentials, assertNode24, assertProject,
  createMigrationPlan, executeMigrationPhase, loadMigrationRun, migrationHash,
  phasesFor, PHASE_ASSERTIONS, prepareMigrationRun, recordMigrationGate,
  summarizeRun, unlockMigrationRun, validateMigrationGate,
} from "./authorization-migration-state.mjs";

const roots = [];
const now = new Date("2026-10-23T12:00:00Z");
const gitSha = "a".repeat(40);
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
async function temporary() {const root = await mkdtemp(path.join(tmpdir(), "migration-state-test-")); roots.push(root); return root;}
async function fixture(overrides = {}) {
  const root = await temporary();
  const options = {repositoryRoot: root, projectId: overrides.projectId ?? "sodc-web-beta", runId: overrides.runId ?? "beta-test"};
  const plan = createMigrationPlan({...options, gitSha, operator: "reviewer", reason: "Reviewed migration", installation: "legacy", artifactDirectory: path.join(await temporary(), "sources"), now, ...overrides});
  await prepareMigrationRun({...options, plan});
  return {options, plan, ...await loadMigrationRun(options)};
}
function gate(plan, name, details) {
  return {schemaVersion: "sodc-authorization-migration-gate/v1", gate: name, projectId: plan.projectId, gitSha: plan.gitSha, runId: plan.runId,
    reviewedBy: "reviewer", observedAt: now.toISOString(), evidence: "https://example.test/review", details};
}
function oldWritersDetails(plan) {
  return {method: "cloud-run-retirement", freezeStateHash: "c".repeat(64), inventoryHash: "d".repeat(64),
    successorRevisions: [{name: `projects/${plan.projectId}/locations/europe-west2/services/security-writer/revisions/security-writer-00002-new`,
      uid: "12345678-1234-4123-8123-123456789012", images: [`europe-west2-docker.pkg.dev/${plan.projectId}/functions/security-writer@sha256:${"e".repeat(64)}`]}],
    externalOperationsReference: "reviewed-external-operations"};
}
function gates(plan) {
  return [
    gate(plan, "backup", {backupReference: "backup-1", restoreTestReference: "isolated-restore-1"}),
    gate(plan, "freeze-scope", {entrypoints: ["updateMembershipStatus"], jobNames: [], externalWritersReference: "review-1", probeUserId: "nonadmin", probeReference: "probe-approved"}),
    gate(plan, "old-writers", oldWritersDetails(plan)),
    gate(plan, "sql-review", {diffSha256: "b".repeat(64)}),
    gate(plan, "acceptance", {sourceProjectId: plan.environment === "prod" ? "sodc-web" : plan.projectId, backendTestReference: "backend", browserReviewReference: "browser", notificationsReference: "notifications", schedulerVolumeReference: "volume", appCheckReference: "appcheck"}),
  ];
}
async function recordGates(run, names = ["backup", "freeze-scope", "old-writers", "sql-review", "acceptance"]) {
  for (const item of gates(run.plan).filter(value => names.includes(value.gate))) await recordMigrationGate(run.options, item, now);
}
function provider(plan, hooks = {}) {
  return {
    observe: vi.fn(async () => ({projectId: plan.projectId, gitSha, observedAt: now.toISOString()})),
    perform: vi.fn(async (phase, context) => hooks.perform ? hooks.perform(phase, context) : phase === "inspect" ? {baseline: {originalPolicies: [], installation: plan.installation}} : {retained: phase}),
    verify: vi.fn(async (phase, context) => hooks.verify ? hooks.verify(phase, context) : ({ok: true, evidence: {
      projectId: plan.projectId, gitSha, runId: plan.runId, planHash: migrationHash(plan), observedAt: now.toISOString(),
      assertions: Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag => [flag, true])),
    }})),
  };
}
function apply(run, adapter, phase, extras = {}) {
  return executeMigrationPhase(run.options, {phase, confirmProject: run.plan.projectId, adapter, sourceCheck: async () => {}, now: () => now, ...extras});
}
async function through(run, adapter, last) {
  for (const phase of phasesFor(run.plan)) {await apply(run, adapter, phase); if (phase === last) break;}
}
async function alterJournal(run, mutate) {
  const file = path.join(run.directory, "journal.json"); const journal = JSON.parse(await readFile(file, "utf8"));
  mutate(journal); await writeFile(file, JSON.stringify(journal));
}

describe("migration target, plan and private records", () => {
  it("requires literal known projects, Node24 and matching non-emulator configuration", () => {
    expect(assertProject("sodc-web-production")).toBe("prod");
    for (const target of ["dev", "beta", "prod", "other", undefined]) expect(() => assertProject(target)).toThrow();
    expect(() => assertNode24("24.22.0")).not.toThrow();
    expect(() => assertNode24("25.0.0")).toThrow();
    expect(() => assertMigrationEnvironment("sodc-web-beta", {GCLOUD_PROJECT: "sodc-web"})).toThrow();
    expect(() => assertMigrationEnvironment("sodc-web-beta", {FIREBASE_CONFIG: "broken"})).toThrow();
    expect(() => assertMigrationEnvironment("sodc-web-beta", {FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099"})).toThrow();
  });
  it("loads a hash-bound plan, stable operation IDs and offline progress", async () => {
    const run = await fixture();
    expect(summarizeRun(run).phases.every(value => value.status === "pending")).toBe(true);
    expect(run.plan.phaseOperationIds.backfill).toBe("auth-migration:beta-test:aaaaaaaaaaaa:backfill");
    const planFile = path.join(run.directory, "plan.json");
    await writeFile(planFile, JSON.stringify({plan: {...run.plan, importAdmins: true}, planHash: run.planHash}));
    await expect(loadMigrationRun(run.options)).rejects.toMatchObject({code: "PLAN_CHANGED"});
  });
  it("refuses traversal, existing runs, artifacts inside checkout and symlinked stores", async () => {
    const run = await fixture();
    expect(() => createMigrationPlan({...run.plan, runId: "../wrong", now})).toThrow();
    await expect(prepareMigrationRun({...run.options, plan: run.plan})).rejects.toMatchObject({code: "EEXIST"});
    await expect(prepareMigrationRun({...run.options, plan: {...run.plan, artifactDirectory: path.join(run.options.repositoryRoot, "sources")}})).rejects.toMatchObject({code: "UNSAFE_ARTIFACT_PATH"});
    const root = await temporary(); const external = await temporary();
    await symlink(external, path.join(root, ".firebase"));
    await expect(prepareMigrationRun({repositoryRoot: root, plan: run.plan})).rejects.toMatchObject({code: "UNSAFE_RUN_PATH"});
  });
  it("refuses credentials before writing operator evidence", () => {
    for (const value of [{accessToken: "x"}, {nested: {passwordHash: "x"}}, {note: "Bearer " + "x".repeat(25)}, {note: "eyJabcdefghij.abcdef.abcdef"}]) expect(() => assertNoCredentials(value)).toThrow();
  });
});

describe("typed manual gates", () => {
  it("rejects boolean pass flags, foreign target/revision/run, stale/future and missing review", async () => {
    const run = await fixture(); const valid = gates(run.plan)[0];
    for (const changed of [{...valid, passed: true}, {...valid, projectId: "sodc-web"}, {...valid, gitSha: "c".repeat(40)}, {...valid, runId: "different"}, {...valid, observedAt: "2026-10-21T12:00:00Z"}, {...valid, observedAt: "2026-10-24T12:00:00Z"}, {...valid, evidence: ""}]) expect(() => validateMigrationGate(changed, run.plan, now)).toThrow();
  });
  it("allows only explicit Dev backup waivers", async () => {
    for (const projectId of ["sodc-web-beta", "sodc-web-production"]) {
      const run = await fixture({projectId});
      expect(() => validateMigrationGate(gate(run.plan, "backup", {waiverReference: "Dev waiver"}), run.plan, now)).toThrow();
    }
    const dev = await fixture({projectId: "sodc-web"});
    expect(() => validateMigrationGate(gate(dev.plan, "backup", {waiverReference: "Dev waived"}), dev.plan, now)).not.toThrow();
  });
  it("records reviewed Dev acceptance for the bound production run", async () => {
    const prod = await fixture({projectId: "sodc-web-production"});
    const acceptance = gates(prod.plan).find(value => value.gate === "acceptance");
    expect(acceptance.details.sourceProjectId).toBe("sodc-web");
    expect(() => validateMigrationGate(acceptance, prod.plan, now)).not.toThrow();
    await expect(recordMigrationGate(prod.options, acceptance, now)).resolves.toMatchObject({gate: "acceptance", hash: migrationHash(acceptance)});
    expect((await loadMigrationRun(prod.options)).journal.gates.acceptance.hash).toBe(migrationHash(acceptance));
  });
  it.each(["sodc-web-beta", "sodc-web-production", "unknown-project"])("rejects %s as production acceptance source", async sourceProjectId => {
    const prod = await fixture({projectId: "sodc-web-production"});
    const acceptance = gates(prod.plan).find(value => value.gate === "acceptance");
    acceptance.details.sourceProjectId = sourceProjectId;
    expect(() => validateMigrationGate(acceptance, prod.plan, now)).toThrow(expect.objectContaining({code: "ACCEPTANCE_REQUIRED"}));
  });
  it("keeps production Dev acceptance bound to target, revision, run, reviewer and fresh evidence", async () => {
    const prod = await fixture({projectId: "sodc-web-production"});
    const acceptance = gates(prod.plan).find(value => value.gate === "acceptance");
    for (const changed of [
      {...acceptance, projectId: "sodc-web"},
      {...acceptance, gitSha: "c".repeat(40)},
      {...acceptance, runId: "different"},
    ]) expect(() => validateMigrationGate(changed, prod.plan, now)).toThrow(expect.objectContaining({code: "GATE_TARGET_MISMATCH"}));
    for (const changed of [
      {...acceptance, reviewedBy: ""},
      {...acceptance, observedAt: "2026-10-22T11:59:59Z"},
      {...acceptance, observedAt: "2026-10-23T12:00:31Z"},
      {...acceptance, evidence: ""},
    ]) expect(() => validateMigrationGate(changed, prod.plan, now)).toThrow(expect.objectContaining({code: "GATE_STALE"}));
    for (const key of ["backendTestReference", "browserReviewReference", "notificationsReference", "schedulerVolumeReference", "appCheckReference"]) {
      const changed = {...acceptance, details: {...acceptance.details}};
      delete changed.details[key];
      expect(() => validateMigrationGate(changed, prod.plan, now)).toThrow(expect.objectContaining({code: "ACCEPTANCE_REQUIRED"}));
    }
  });
  it("records typed old-writer retirement identities with project-bound immutable image digests", async () => {
    const run = await fixture({projectId: "sodc-web-production"});
    const valid = gate(run.plan, "old-writers", oldWritersDetails(run.plan));
    await expect(recordMigrationGate(run.options, valid, now)).resolves.toMatchObject({gate: "old-writers", hash: migrationHash(valid)});
    expect((await loadMigrationRun(run.options)).journal.gates["old-writers"].hash).toBe(migrationHash(valid));
  });
  it("rejects malformed old-writer methods, hashes, inventories and unknown keys", async () => {
    const run = await fixture();
    const details = oldWritersDetails(run.plan), revision = details.successorRevisions[0];
    for (const patch of [
      {method: "elapsed-time"}, {freezeStateHash: "invalid"}, {inventoryHash: "d".repeat(63)},
      {freezeStateHash: "c".repeat(64) + "\n"}, {externalOperationsReference: ""}, {externalOperationsReference: "x".repeat(2001)},
      {successorRevisions: null}, {successorRevisions: Array(10001).fill(revision)},
      {successorRevisions: [revision, {...revision, uid: "22345678-1234-4123-8123-123456789012"}]},
    ]) expect(() => validateMigrationGate(gate(run.plan, "old-writers", {...details, ...patch}), run.plan, now)).toThrow(expect.objectContaining({code: "OLD_WRITERS_GATE_INVALID"}));
    for (const patch of [
      {name: revision.name.replace(run.plan.projectId, "other-project")},
      {name: revision.name.replace("europe-west2", "us-central1")},
      {name: revision.name + "/extra"}, {name: revision.name + "\n"},
      {uid: "safe-but-not-a-uuid"}, {uid: "12345678-1234-1123-8123-123456789012"},
      {images: []}, {images: ["gcr.io/project/writer:latest"]},
      {images: [revision.images[0] + "\n"]}, {images: [{image: revision.images[0]}]},
      {extra: {unreviewed: true}},
    ]) expect(() => validateMigrationGate(gate(run.plan, "old-writers", {...details, successorRevisions: [{...revision, ...patch}]}), run.plan, now)).toThrow(expect.objectContaining({code: "OLD_WRITERS_GATE_INVALID"}));
    expect(() => validateMigrationGate(gate(run.plan, "old-writers", {...details, passed: true}), run.plan, now)).toThrow(expect.objectContaining({code: "GATE_DETAILS_INVALID"}));
    for (const key of ["method", "freezeStateHash", "inventoryHash", "successorRevisions", "externalOperationsReference"]) {
      const missing = {...details}; delete missing[key];
      expect(() => validateMigrationGate(gate(run.plan, "old-writers", missing), run.plan, now)).toThrow(expect.objectContaining({code: "OLD_WRITERS_GATE_INVALID"}));
    }
  });
  it("keeps old-writer retirement review bound to target, release, run and reviewer freshness", async () => {
    const run = await fixture({projectId: "sodc-web-production"});
    const valid = gate(run.plan, "old-writers", oldWritersDetails(run.plan));
    for (const patch of [{projectId: "sodc-web"}, {gitSha: "b".repeat(40)}, {runId: "another-run"}]) {
      expect(() => validateMigrationGate({...valid, ...patch}, run.plan, now)).toThrow(expect.objectContaining({code: "GATE_TARGET_MISMATCH"}));
    }
    for (const patch of [{reviewedBy: ""}, {observedAt: "2026-10-22T11:59:59Z"}, {observedAt: "2026-10-23T12:00:31Z"}, {evidence: ""}]) {
      expect(() => validateMigrationGate({...valid, ...patch}, run.plan, now)).toThrow(expect.objectContaining({code: "GATE_STALE"}));
    }
  });
  it("hash-checks persisted gates before any provider action", async () => {
    const run = await fixture(); await recordGates(run); const adapter = provider(run.plan);
    const loaded = await loadMigrationRun(run.options); const ref = loaded.journal.gates.backup;
    await writeFile(path.join(run.directory, ref.file), JSON.stringify({...gates(run.plan)[0], reviewedBy: "someone-else"}));
    await expect(apply(run, adapter, "inspect")).rejects.toMatchObject({code: "GATE_CHANGED"});
    expect(adapter.observe).not.toHaveBeenCalled(); expect(adapter.perform).not.toHaveBeenCalled();
  });
});

describe("phase ordering, verification and interrupted work", () => {
  it("holds the initial freeze without retirement proof and exposes only the bound inventory summary", async () => {
    const run = await fixture(); const adapter = provider(run.plan);
    const perform = adapter.perform.getMockImplementation(), verify = adapter.verify.getMockImplementation();
    const retirement = {freezeStateHash: "c".repeat(64), inventoryHash: "d".repeat(64), inventoryFile: "provider-old-writers.json", requiredMethod: "cloud-run-retirement"};
    adapter.perform.mockImplementation(async (phase, context) => phase === "freeze" ? {retirement: {...retirement, privateInventory: ["do-not-expose"]}, privateResult: "do-not-expose"} : perform(phase, context));
    adapter.verify.mockImplementation(async (phase, context) => {
      const result = await verify(phase, context);
      if (phase === "freeze") result.evidence.assertions.oldWritersRetired = Boolean(context.gates["old-writers"]);
      return result;
    });
    await recordGates(run, ["backup", "freeze-scope"]);
    expect(summarizeRun(await loadMigrationRun(run.options))).not.toHaveProperty("retirement");
    await apply(run, adapter, "inspect");
    await expect(apply(run, adapter, "freeze")).rejects.toMatchObject({code: "PHASE_NOT_VERIFIED"});
    const held = await loadMigrationRun(run.options), summary = summarizeRun(held);
    expect(summary.retirement).toEqual(retirement);
    expect(JSON.stringify(summary)).not.toContain("do-not-expose");
    expect(held.journal.checkpoints.freeze.status).toBe("incomplete");
    expect(adapter.perform.mock.calls.map(call => call[0])).toEqual(["inspect", "freeze"]);
    await recordMigrationGate(run.options, gate(run.plan, "old-writers", oldWritersDetails(run.plan)), now);
    await expect(apply(run, adapter, "freeze")).resolves.toMatchObject({phase: "freeze", status: "complete"});
    const completed = await loadMigrationRun(run.options);
    expect(completed.journal.checkpoints.freeze.operationId).toBe(held.journal.checkpoints.freeze.operationId);
    expect(summarizeRun(completed).retirement).toEqual(retirement);
  });
  it.each(["schema", "compatibility", "control-create", "backfill", "functions", "activate", "strict-api", "open", "receipt"])("requires reviewed old-writers evidence before %s reaches the provider", async phase => {
    const run = await fixture(); const adapter = provider(run.plan); await recordGates(run);
    const sequence = phasesFor(run.plan);
    await through(run, adapter, sequence[sequence.indexOf(phase) - 1]);
    await alterJournal(run, journal => {delete journal.gates["old-writers"];});
    adapter.observe.mockClear(); adapter.perform.mockClear(); adapter.verify.mockClear();
    await expect(apply(run, adapter, phase)).rejects.toMatchObject({code: "GATES_MISSING"});
    expect(adapter.observe).not.toHaveBeenCalled();
    expect(adapter.perform).not.toHaveBeenCalled();
    expect(adapter.verify).not.toHaveBeenCalled();
  });
  it("requires confirmation, the reviewed source and sequential verified phases", async () => {
    const run = await fixture(); const adapter = provider(run.plan);
    await expect(apply(run, adapter, "inspect", {confirmProject: "sodc-web"})).rejects.toMatchObject({code: "CONFIRM_PROJECT_REQUIRED"});
    await expect(apply(run, adapter, "freeze")).rejects.toMatchObject({code: "PHASE_ORDER"});
    await expect(apply(run, adapter, "inspect", {sourceCheck: async () => {throw new Error("changed source");}})).rejects.toThrow("changed source");
    expect(adapter.perform).not.toHaveBeenCalled();
    await apply(run, adapter, "inspect");
    await expect(apply(run, adapter, "freeze")).rejects.toMatchObject({code: "GATES_MISSING"});
  });
  it("rejects wrong or stale proof even with every assertion true", async () => {
    for (const patch of [{projectId: "sodc-web"}, {gitSha: "b".repeat(40)}, {runId: "wrong"}, {planHash: "b".repeat(64)}, {observedAt: "2026-10-23T11:54:59Z"}]) {
      const run = await fixture(); const adapter = provider(run.plan); const normal = adapter.verify.getMockImplementation();
      adapter.verify.mockImplementation(async (...args) => {const result = await normal(...args); Object.assign(result.evidence, patch); return result;});
      await expect(apply(run, adapter, "inspect")).rejects.toMatchObject({code: "PHASE_NOT_VERIFIED"});
      expect((await loadMigrationRun(run.options)).journal.checkpoints.inspect.status).toBe("incomplete");
    }
  });
  it("retains stable operation identity and drain outcome after refusal, with fresh observation on retry", async () => {
    const run = await fixture(); const adapter = provider(run.plan); await recordGates(run);
    await apply(run, adapter, "inspect");
    let ready = false;
    const verify = adapter.verify.getMockImplementation();
    adapter.perform.mockImplementation(async (phase, context) => ({drainUntil: context.result?.drainUntil ?? "2026-10-23T12:05:00Z"}));
    adapter.verify.mockImplementation(async (...args) => ready ? verify(...args) : {ok: false});
    await expect(apply(run, adapter, "freeze")).rejects.toMatchObject({code: "PHASE_NOT_VERIFIED"});
    const first = (await loadMigrationRun(run.options)).journal.checkpoints.freeze;
    ready = true; await apply(run, adapter, "freeze");
    const second = (await loadMigrationRun(run.options)).journal.checkpoints.freeze;
    expect(first.operationId).toBe(second.operationId); expect(second.attempt).toBe(2);
    expect(second.result.drainUntil).toBe(first.result.drainUntil);
    expect(adapter.observe).toHaveBeenCalledTimes(3);
    expect(adapter.perform.mock.calls.at(-1)[1].result).toEqual(first.result);
    expect(adapter.perform.mock.calls.map(call => call[0])).not.toContain("open");
  });
  it("reverifies completed phases live without repeating their mutations", async () => {
    const run = await fixture(); const adapter = provider(run.plan);
    await apply(run, adapter, "inspect");
    expect((await apply(run, adapter, "inspect")).status).toBe("verified-existing");
    expect(adapter.perform).toHaveBeenCalledTimes(1); expect(adapter.verify).toHaveBeenCalledTimes(2);
    adapter.verify.mockResolvedValue({ok: false});
    await expect(apply(run, adapter, "inspect")).rejects.toMatchObject({code: "PHASE_NOT_VERIFIED"});
    expect(adapter.perform).toHaveBeenCalledTimes(1);
  });
  it("binds baseline, retained result and operation IDs to immutable inspection proof", async () => {
    for (const mutate of [journal => {journal.baseline.originalPolicies = ["tampered"];}, journal => {journal.checkpoints.inspect.result.baseline.originalPolicies = ["tampered"];}, journal => {journal.checkpoints.inspect.evidenceHash = "0".repeat(64);}]) {
      const run = await fixture(); const adapter = provider(run.plan); await recordGates(run); await apply(run, adapter, "inspect");
      await alterJournal(run, mutate);
      await expect(apply(run, adapter, "freeze")).rejects.toThrow();
      expect(adapter.perform).toHaveBeenCalledTimes(1);
    }
  });
  it("never schedules compatibility for an already strict deployment", async () => {
    const run = await fixture({installation: "strict"}); const adapter = provider(run.plan); await recordGates(run);
    expect(phasesFor(run.plan)).not.toContain("compatibility");
    await expect(apply(run, adapter, "compatibility")).rejects.toMatchObject({code: "PHASE_INVALID"});
    await through(run, adapter, "receipt");
    expect(adapter.perform.mock.calls.map(call => call[0])).not.toContain("compatibility");
  });
});

describe("project ownership and receipts", () => {
  it("blocks another run for the same project between phases", async () => {
    const run = await fixture(); const adapter = provider(run.plan); await apply(run, adapter, "inspect");
    const otherPlan = createMigrationPlan({...run.plan, runId: "second-run", artifactDirectory: path.join(await temporary(), "other-sources"), now});
    await prepareMigrationRun({repositoryRoot: run.options.repositoryRoot, plan: otherPlan});
    await expect(executeMigrationPhase({...run.options, runId: otherPlan.runId}, {phase: "inspect", confirmProject: otherPlan.projectId, adapter: provider(otherPlan), sourceCheck: async () => {}, now: () => now})).rejects.toMatchObject({code: "PROJECT_RUN_ACTIVE"});
  });
  it("blocks overlapping phases, refuses live lock removal and recovers only this dead run", async () => {
    const run = await fixture(); const adapter = provider(run.plan);
    const projectLock = path.join(path.dirname(run.directory), ".migration.lock");
    const lock = {pid: process.pid, hostname: hostname(), runId: run.plan.runId, planHash: run.planHash};
    await writeFile(projectLock, JSON.stringify(lock));
    await expect(apply(run, adapter, "inspect")).rejects.toMatchObject({code: "PROJECT_LOCKED"});
    await expect(unlockMigrationRun(run.options, "reviewed interruption", () => true)).rejects.toMatchObject({code: "LOCK_OWNER_LIVE"});
    await writeFile(projectLock, JSON.stringify({...lock, planHash: "b".repeat(64)}));
    await expect(unlockMigrationRun(run.options, "reviewed interruption", () => false)).rejects.toMatchObject({code: "LOCK_RUN_MISMATCH"});
    await writeFile(projectLock, JSON.stringify(lock));
    await unlockMigrationRun(run.options, "reviewed interruption", () => false);
    await apply(run, adapter, "inspect");
    expect((await loadMigrationRun(run.options)).journal.events.at(-1).event).toBe("stale-lock-removed");
  });
  it("requires acceptance before traffic opens and cannot issue an early receipt", async () => {
    const run = await fixture(); const adapter = provider(run.plan); await recordGates(run, ["backup", "freeze-scope", "old-writers", "sql-review"]);
    await expect(apply(run, adapter, "receipt")).rejects.toMatchObject({code: "PHASE_ORDER"});
    await through(run, adapter, "strict-api");
    await expect(apply(run, adapter, "open")).rejects.toMatchObject({code: "GATES_MISSING"});
    expect(adapter.perform.mock.calls.map(call => call[0])).not.toContain("open");
  });
  it("writes deploy-compatible receipt only after complete live proof, and repairs a removed receipt", async () => {
    const run = await fixture(); const adapter = provider(run.plan); await recordGates(run);
    await through(run, adapter, "receipt");
    const file = path.join(run.options.repositoryRoot, ".firebase/authorization-migration", `${run.plan.projectId}.json`);
    const receipt = JSON.parse(await readFile(file, "utf8"));
    expect(receipt).toMatchObject({projectId: run.plan.projectId, gitSha, migrationPlanHash: run.planHash, backfillComplete: true, strictApiReady: true, securityWriteFreezeVerified: true});
    await expect(verifyAuthorizationMigration(run.options.repositoryRoot, {projectId: run.plan.projectId, gitSha}, () => true)).resolves.toEqual(receipt);
    await unlink(file); await apply(run, adapter, "receipt");
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(receipt);
    expect(adapter.perform.mock.calls.filter(call => call[0] === "receipt")).toHaveLength(1);
    expect(JSON.parse(await readFile(path.join(path.dirname(run.directory), "active-run.json"), "utf8")).status).toBe("complete");
  });
  it("preserves a foreign receipt and leaves migration incomplete", async () => {
    const run = await fixture(); const adapter = provider(run.plan); await recordGates(run);
    await through(run, adapter, "open");
    const file = path.join(run.options.repositoryRoot, ".firebase/authorization-migration", `${run.plan.projectId}.json`);
    const existing = {migrationPlanHash: "older-review", important: "preserve"}; await writeFile(file, JSON.stringify(existing));
    await expect(apply(run, adapter, "receipt")).rejects.toMatchObject({code: "RECEIPT_EXISTS"});
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(existing);
    expect((await loadMigrationRun(run.options)).journal.checkpoints.receipt.status).toBe("incomplete");
  });
});
