import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, chmod, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseAccountErasureDisposalArguments, readAccountErasureDisposalCase, runAccountErasureDisposalAdmin } from "./account-erasure-disposal-admin.mjs";

const project = ["--project", "sodc-web-production"];
const generation = "11111111-1111-4111-8111-111111111111";
const uid = "private-member-uid-never-print";
const hash = "deadbeef".repeat(8);
const now = Date.parse("2026-11-12T12:00:00Z");
const evidence = {uid, reviewReference: "restricted/case-123", taskSafeAt: "2026-12-11T00:00:00Z", providerSafeAt: "2026-12-11T00:00:00Z"};
const caseArgs = ["--case-file", "/private/restricted-case.json"];
const expected = ["--expected-version", "3", "--expected-generation", generation];

function fixture(overrides = {}) {
  let decision = {userId: uid, generation, version: 3, holdCode: "HISTORICAL_EVIDENCE_REQUIRED", internalQuiescedAt: null, taskSafeAt: null, providerSafeAt: null};
  let policy = {version: 2, externalReplayReviewed: false, reviewReference: null};
  const writes = [];
  let imports = 0, loads = 0, disposed = 0;
  const dependencies = {
    readAccountErasureDisposalPolicy: async () => policy,
    readAccountErasureDisposal: async subject => {assert.equal(subject, uid); return decision;},
    readMarkers: async subject => {assert.equal(subject, uid); return [{emailHash: hash, completedAt: "2026-11-10T12:00:00Z", profileDeletedAt: "2026-11-10T12:00:00Z"}];},
    setAccountErasureDisposalPolicy: async (version, reviewed, reference) => {writes.push(["policy", version, reviewed, reference]); policy = {version: version + 1, externalReplayReviewed: reviewed, reviewReference: reference};},
    ensureAccountErasureDisposal: async (subject, historical) => {writes.push(["initialize", subject, historical]); decision = {userId: subject, generation, version: 1, holdCode: "HISTORICAL_EVIDENCE_REQUIRED"}; return decision;},
    adoptHistoricalAccountErasureDisposal: async (subject, reviewed, markers, proof) => {writes.push(["adopt", subject, reviewed, markers, proof]); decision = {...decision, version: decision.version + 1, holdCode: null,
      internalQuiescedAt: "2026-11-12T12:00:00Z", evidenceReference: proof.reviewReference, taskSafeAt: proof.taskSafeAt, providerSafeAt: proof.providerSafeAt};},
    setAccountErasureDisposalHold: async (subject, reviewed, holdCode, reviewDueAt) => {writes.push(["hold", subject, reviewed, holdCode, reviewDueAt]); decision = {...decision, version: decision.version + 1, holdCode, reviewDueAt};},
    dispose: async () => {disposed++;},
    ...overrides,
  };
  return {dependencies, writes, setDecision: value => {decision = value;}, setPolicy: value => {policy = value;},
    imports: () => imports, loads: () => loads, disposed: () => disposed,
    options: {env: {}, now: () => now, loadCase: async () => {loads++; return {...evidence};}, createDependencies: async () => {imports++; return dependencies;}}};
}

test("rejects unknown flags, implicit projects and malformed targeting before SDK or case access", async () => {
  for (const args of [[], ["--project", "production"], [...project, "--uid", uid], [...project, "--endpoint", "https://bad.invalid"], [...project, "--project", "sodc-web"], [...project, "--mode", "purge"], [...project, "--case-file", "relative.json"], [...project, "--mode", "inspect", "--apply"]]) {
    const state = fixture();
    const report = await runAccountErasureDisposalAdmin(args, state.options);
    assert.equal(report.result, "NOT_APPLIED"); assert.equal(state.imports(), 0); assert.equal(state.loads(), 0);
    assert.equal(JSON.stringify(report).includes(uid), false);
  }
});
test("allows only the three exact environments with no emulator or endpoint overrides", async () => {
  for (const id of ["sodc-web", "sodc-web-beta", "sodc-web-production"]) assert.equal(parseAccountErasureDisposalArguments(["--project", id], {}).projectId, id);
  for (const env of [{FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099"}, {DATA_CONNECT_EMULATOR_HOST: "localhost:9399"}, {CLOUDSDK_API_ENDPOINT_OVERRIDES_SQL: "https://bad.invalid"}, {GOOGLE_API_ENDPOINT: "https://bad.invalid"}, {GCE_METADATA_HOST: "bad.invalid"}, {FIREBASE_CONFIG: "{}"}, {GCLOUD_PROJECT: "different-project"}]) {
    const state = fixture();
    const report = await runAccountErasureDisposalAdmin(project, {...state.options, env});
    assert.equal(report.result, "NOT_APPLIED"); assert.equal(state.imports(), 0);
  }
});
test("requires exact apply versions and per-case generations before importing any SDK", async () => {
  for (const args of [[...project, "--mode", "policy", "--apply"], [...project, "--mode", "adopt", ...caseArgs, "--apply", "--expected-version", "3"], [...project, "--mode", "initialize", ...caseArgs, "--apply", "--expected-version", "1"], [...project, "--expected-version", "3.1"], [...project, "--expected-generation", uid]]) {
    const state = fixture();
    assert.equal((await runAccountErasureDisposalAdmin(args, state.options)).result, "NOT_APPLIED"); assert.equal(state.imports(), 0);
  }
});
test("policy writes require an explicit external-review decision and restricted reference", async () => {
  for (const extra of [[], ["--external-reviewed"], ["--external-reviewed", "--external-review-pending", "--review-reference", "restricted/review"], ["--external-reviewed", "--review-reference", "member@example.invalid"]]) {
    const state = fixture();
    assert.equal((await runAccountErasureDisposalAdmin([...project, "--mode", "policy", "--apply", "--expected-version", "2", ...extra], state.options)).result, "NOT_APPLIED");
    assert.equal(state.imports(), 0);
  }
});
test("case validation precedes SDK setup and never prints invalid private content", async () => {
  for (const bad of [{uid, emailHash: hash}, {uid, reviewReference: "member@example.invalid"}, {uid, taskSafeAt: "2026-02-30T00:00:00Z"}, {uid: ""}, null]) {
    const state = fixture();
    const report = await runAccountErasureDisposalAdmin([...project, ...caseArgs], {...state.options, loadCase: async () => bad});
    assert.equal(report.result, "NOT_APPLIED"); assert.equal(state.imports(), 0);
    assert.equal(JSON.stringify(report).includes(uid), false); assert.equal(JSON.stringify(report).includes(hash), false);
  }
});
test("reads only a private regular owned case file, refusing symlinks and group access", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sodc-erasure-admin-test-"));
  try {
    const file = path.join(directory, "case.json");
    await writeFile(file, JSON.stringify(evidence), {mode: 0o600});
    assert.deepEqual(await readAccountErasureDisposalCase(file), evidence);
    await chmod(file, 0o640);
    await assert.rejects(readAccountErasureDisposalCase(file), /DISPOSAL_CASE_FILE_PRIVATE_REQUIRED/);
    await chmod(file, 0o600);
    await symlink(file, path.join(directory, "link.json"));
    await assert.rejects(readAccountErasureDisposalCase(path.join(directory, "link.json")), /DISPOSAL_CASE_FILE_INVALID/);
    await writeFile(file, "invalid private text");
    await assert.rejects(readAccountErasureDisposalCase(file), /DISPOSAL_CASE_FILE_INVALID/);
  } finally {await rm(directory, {recursive: true, force: true});}
});
test("default inspection exposes counts and CAS state without raw identities or hashes", async () => {
  const state = fixture();
  const report = await runAccountErasureDisposalAdmin([...project, ...caseArgs], state.options);
  assert.equal(report.result, "INSPECTED"); assert.equal(report.decision.version, 3); assert.equal(report.decision.generation, generation);
  assert.deepEqual(report.markers, {total: 1, completed: 1}); assert.equal(state.writes.length, 0); assert.equal(state.disposed(), 1);
  const text = JSON.stringify(report); assert.equal(text.includes(uid), false); assert.equal(text.includes(hash), false); assert.equal(text.includes(evidence.reviewReference), false);
});
test("a proposed adoption is read-only without --apply", async () => {
  const state = fixture();
  assert.equal((await runAccountErasureDisposalAdmin([...project, "--mode", "adopt", ...caseArgs], state.options)).result, "INSPECTED");
  assert.equal(state.writes.length, 0);
});
test("applies policy using the exact reviewed version and checks the resulting state", async () => {
  const state = fixture();
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "policy", "--apply", "--expected-version", "2", "--external-reviewed", "--review-reference", "restricted/review"], state.options);
  assert.equal(report.result, "APPLIED"); assert.equal(report.policy.version, 3); assert.equal(report.policy.externalReplayReviewed, true);
  assert.deepEqual(state.writes, [["policy", 2, true, "restricted/review"]]);
});
test("can explicitly withdraw external-review clearance without purging anything", async () => {
  const state = fixture();
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "policy", "--apply", "--expected-version", "2", "--external-review-pending", "--review-reference", "restricted/hold"], state.options);
  assert.equal(report.result, "APPLIED"); assert.equal(report.policy.externalReplayReviewed, false); assert.equal(state.writes[0][0], "policy");
});
test("initializes only an absent historical decision and leaves it held for review", async () => {
  const state = fixture(); state.setDecision(null);
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "initialize", ...caseArgs, "--expected-version", "0", "--apply"], state.options);
  assert.equal(report.result, "APPLIED"); assert.equal(report.decision.held, true);
  assert.deepEqual(state.writes, [["initialize", uid, true]]);
});
test("does not initialize a decision for an unknown identity without erasure markers", async () => {
  const state = fixture({readMarkers: async () => []}); state.setDecision(null);
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "initialize", ...caseArgs, "--expected-version", "0", "--apply"], state.options);
  assert.equal(report.code, "DISPOSAL_MARKERS_REQUIRED"); assert.equal(state.writes.length, 0);
});
test("adoption passes reviewed generation/version, exact markers and private evidence", async () => {
  const state = fixture();
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "adopt", ...caseArgs, ...expected, "--apply"], state.options);
  assert.equal(report.result, "APPLIED"); assert.equal(report.decision.version, 4); assert.equal(report.decision.held, false);
  assert.deepEqual(state.writes[0].slice(0, 3), ["adopt", uid, {generation, version: 3}]);
  assert.equal(state.writes[0][3][0].emailHash, hash);
  assert.deepEqual(state.writes[0][4], {taskSafeAt: evidence.taskSafeAt, providerSafeAt: evidence.providerSafeAt, reviewReference: evidence.reviewReference});
  assert.equal(JSON.stringify(report).includes(uid), false); assert.equal(JSON.stringify(report).includes(hash), false);
});
test("refuses stale policy or subject versions without invoking any write", async () => {
  const state = fixture();
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "adopt", ...caseArgs, "--expected-version", "2", "--expected-generation", generation, "--apply"], state.options);
  assert.equal(report.code, "DISPOSAL_SNAPSHOT_CHANGED"); assert.equal(state.writes.length, 0);
  const policyReport = await runAccountErasureDisposalAdmin([...project, "--mode", "policy", "--expected-version", "1", "--external-reviewed", "--review-reference", "restricted/review", "--apply"], state.options);
  assert.equal(policyReport.code, "DISPOSAL_SNAPSHOT_CHANGED"); assert.equal(state.writes.length, 0);
});
test("accepts the compact UUID token returned by Data Connect without losing CAS identity", async () => {
  const state = fixture();
  const compact = generation.replace(/-/g, "");
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "adopt", ...caseArgs, "--expected-version", "3", "--expected-generation", compact, "--apply"], state.options);
  assert.equal(report.result, "APPLIED");
  assert.deepEqual(state.writes[0].slice(0, 3), ["adopt", uid, {generation, version: 3}]);
});
test("sets a bounded hold using exact CAS tokens", async () => {
  const state = fixture();
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "hold", ...caseArgs, ...expected, "--hold-code", "EXTERNAL_COPY", "--review-due-at", "2026-11-20T12:00:00Z", "--apply"], state.options);
  assert.equal(report.result, "APPLIED"); assert.equal(report.decision.held, true);
  assert.deepEqual(state.writes[0], ["hold", uid, {generation, version: 3}, "EXTERNAL_COPY", "2026-11-20T12:00:00Z"]);
});
test("rejects past or unbounded review dates before SDK setup", async () => {
  for (const date of ["2026-11-01T12:00:00Z", "2027-11-12T12:00:00Z", "tomorrow"]) {
    const state = fixture();
    const report = await runAccountErasureDisposalAdmin([...project, "--mode", "hold", ...caseArgs, ...expected, "--hold-code", "EXTERNAL_COPY", "--review-due-at", date, "--apply"], state.options);
    assert.equal(report.code, "DISPOSAL_HOLD_INVALID"); assert.equal(state.imports(), 0);
  }
});
test("uncertain writes and SDK errors report fixed codes without leaking SDK variables", async () => {
  const state = fixture({adoptHistoricalAccountErasureDisposal: async () => {throw new Error(`SDK response contained ${uid} ${hash}`);}});
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "adopt", ...caseArgs, ...expected, "--apply"], state.options);
  assert.equal(report.result, "WRITE_OUTCOME_UNKNOWN"); assert.equal(report.code, "DISPOSAL_OPERATION_FAILED");
  assert.equal(JSON.stringify(report).includes(uid), false); assert.equal(JSON.stringify(report).includes(hash), false);
});
test("a failed readback never claims the change was verified", async () => {
  const state = fixture({adoptHistoricalAccountErasureDisposal: async () => undefined});
  const report = await runAccountErasureDisposalAdmin([...project, "--mode", "adopt", ...caseArgs, ...expected, "--apply"], state.options);
  assert.equal(report.result, "WRITE_OUTCOME_UNKNOWN"); assert.equal(report.code, "DISPOSAL_READBACK_INCOMPLETE");
});
test("help and invalid targeting execute without compiled core or credential access", () => {
  const script = fileURLToPath(new URL("./account-erasure-disposal-admin.mjs", import.meta.url));
  for (const [args, code] of [[["--help"], 0], [[...project, "--endpoint", "https://bad.invalid"], 1]]) {
    const child = spawnSync(process.execPath, [script, ...args], {encoding: "utf8", env: {PATH: process.env.PATH, GOOGLE_APPLICATION_CREDENTIALS: "/nonexistent/do-not-read.json"}});
    assert.equal(child.status, code); assert.equal(child.stderr, "");
    const report = JSON.parse(child.stdout); assert.equal(report.result, code ? "NOT_APPLIED" : "HELP");
  }
});
