import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {afterEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {productionOperatorReviewTemplate} from "./production-notify-once-lib.mjs";
import {initializeProductionOperatorRun, openProductionOperatorStore, readProspectiveOperationRecords} from "./notify-secret-binding-repair-store.mjs";

const directories = [];
const PROJECT = "sodc-web-production";
const TARGET = `projects/${PROJECT}/locations/europe-west2/functions/reconcileMyCheckoutSessionOrders`;
const operation = {name: `projects/${PROJECT}/locations/europe-west2/operations/repair_123`};
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, {recursive: true, force: true})));
});

async function fixture() {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "production-notify-store-")));
  await fs.chmod(base, 0o700); directories.push(base);
  const request = {method: "PATCH", url: `https://cloudfunctions.googleapis.com/v2/${TARGET}?updateMask=serviceConfig.secretEnvironmentVariables`,
    updateMask: "serviceConfig.secretEnvironmentVariables", body: {name: TARGET, serviceConfig: {secretEnvironmentVariables:
      [["STRIPE_SECRET", "2"], ["GOV_NOTIFY_LIVE_API_KEY", "1"], ["GOV_NOTIFY_TEAM_API_KEY", "1"], ["GOV_NOTIFY_TEST_API_KEY", "2"]]
        .map(([key, version]) => ({key, secret: key, projectId: PROJECT, version}))}}};
  const operatorToolBinding = {gitSha: "1".repeat(40), tree: "2".repeat(40), trackedSha256: "3".repeat(64), nodeMajor: 24};
  const verifierToolBinding = {gitSha: "d58417688d8253449de8025b801d0df38bbc4d8e", tree: "5".repeat(40), trackedSha256: "6".repeat(64), nodeMajor: 24};
  const plan = {schemaVersion: "sodc-production-notify-operator-plan/v1", createdAt: "2026-11-26T12:00:00.000Z",
    projectId: PROJECT, target: TARGET, request, context: {captureReportSha256: "a".repeat(64), limitsBaselineSha256: "b".repeat(64),
      requestSha256: digest(request), sourceBindingSha256: "c".repeat(64), comparisonToolBindingSha256: digest(verifierToolBinding)},
    paths: {verifierRoot: path.join(base, "verifier"), sourceRoot: path.join(base, "source"), captureDirectory: path.join(base, "capture"),
      limitsBaselineFile: path.join(base, "inputs/limits.json"), beforeOutputDirectory: path.join(base, "before"), runDirectory: path.join(base, "run")},
    operatorToolBinding, verifierToolBinding, provenanceBoundary: "ARCHIVE_AND_EXECUTABLE_EQUALITY_UNPROVEN",
    liveMailEffect: "NORMAL_APPLICATION_MAIL_MAY_RESUME"};
  const runDirectory = plan.paths.runDirectory, lockDirectory = path.join(base, "locks"), reviewSha256 = "f".repeat(64);
  const intent = {schemaVersion: "sodc-notify-binding-operator-intent/v1", projectId: PROJECT, target: TARGET,
    ...plan.context, startedAt: "2026-11-26T12:01:00.000Z"};
  return {base, plan, runDirectory, lockDirectory, reviewSha256, intent,
    initialize: () => initializeProductionOperatorRun(runDirectory, {plan}),
    open: extra => openProductionOperatorStore({runDirectory, lockDirectory, plan, reviewSha256, ...extra})};
}
async function privateJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600}); await fs.chmod(file, 0o600);
}
async function readJson(file) {return JSON.parse(await fs.readFile(file, "utf8"));}
async function entries(directory) {return (await fs.readdir(directory)).sort();}
function traceOpen(transform = value => value) {
  const original = fs.open.bind(fs), events = [];
  const spy = vi.spyOn(fs, "open").mockImplementation(async (file, flags, mode) => {
    const handle = await original(file, flags, mode); events.push(["open", file, flags, mode]);
    const write = handle.writeFile.bind(handle), sync = handle.sync.bind(handle);
    vi.spyOn(handle, "writeFile").mockImplementation(async bytes => {events.push(["write", file]); return write(bytes);});
    vi.spyOn(handle, "sync").mockImplementation(async () => {events.push(["sync", file]); return sync();});
    return transform(handle, file, flags);
  });
  return {spy, events};
}

describe("key-free Production operator preparation", () => {
  it("creates only private review records, with no claim, approval, key or intent", async () => {
    const f = await fixture();
    expect(await f.initialize()).toEqual({runDirectory: f.runDirectory, planSha256: digest(f.plan), projectId: PROJECT, target: TARGET});
    expect(await entries(f.runDirectory)).toEqual(["initialized.json", "plan.json", "request.json", "review-template.json"]);
    expect((await fs.stat(f.runDirectory)).mode & 0o7777).toBe(0o700);
    for (const file of await entries(f.runDirectory)) expect((await fs.stat(path.join(f.runDirectory, file))).mode & 0o7777).toBe(0o600);
    expect(await readJson(path.join(f.runDirectory, "plan.json"))).toEqual(f.plan);
    expect(await readJson(path.join(f.runDirectory, "request.json"))).toEqual(f.plan.request);
    expect(await readJson(path.join(f.runDirectory, "review-template.json"))).toEqual(productionOperatorReviewTemplate(f.plan));
    expect(await readJson(path.join(f.runDirectory, "initialized.json"))).toEqual({schemaVersion: "sodc-production-notify-operator-run/v1",
      planSha256: digest(f.plan), projectId: PROJECT, target: TARGET});
    expect(await entries(f.base)).toEqual(["run"]);
  });

  it("writes every file exclusively with NOFOLLOW and fsyncs each before its parent; marker is last", async () => {
    const f = await fixture(), {spy, events} = traceOpen(); await f.initialize();
    expect(events.filter(([kind]) => kind === "write").map(([, file]) => path.basename(file)))
      .toEqual(["plan.json", "request.json", "review-template.json", "initialized.json"]);
    for (const [file, flags, mode] of spy.mock.calls.filter(([, flags]) => flags & constants.O_WRONLY)) {
      expect(flags & (constants.O_EXCL | constants.O_CREAT | constants.O_NOFOLLOW)).toBe(constants.O_EXCL | constants.O_CREAT | constants.O_NOFOLLOW);
      expect(mode).toBe(0o600);
      const write = events.findIndex(([kind, name]) => kind === "write" && name === file);
      const sync = events.findIndex(([kind, name], index) => kind === "sync" && name === file && index > write);
      expect(sync).toBeGreaterThan(write);
      expect(events.findIndex(([kind, name], index) => kind === "sync" && name === f.runDirectory && index > sync)).toBeGreaterThan(sync);
    }
  });

  it.each([undefined, null, [], {}, {plan: {}, comparisonKey: Buffer.alloc(32)}, {plan: {}, approved: true}])("rejects unsupported preparation options before mkdir: %j", async options => {
    const f = await fixture(); await expect(initializeProductionOperatorRun(f.runDirectory, options)).rejects.toHaveProperty("code", "invalid-production-operator-initialize-options");
    expect(await entries(f.base)).toEqual([]);
  });

  it.each(["schema", "project", "target", "context", "request", "tool"])("rejects an invalid plan before mkdir: %s", async shape => {
    const f = await fixture();
    if (shape === "schema") f.plan.schemaVersion = "old";
    if (shape === "project") f.plan.projectId = "sodc-web";
    if (shape === "target") f.plan.target += "other";
    if (shape === "context") f.plan.context.requestSha256 = "0".repeat(64);
    if (shape === "request") f.plan.request.body.serviceConfig.secretEnvironmentVariables.pop();
    if (shape === "tool") f.plan.operatorToolBinding.nodeMajor = 22;
    await expect(f.initialize()).rejects.toThrow(); expect(await entries(f.base)).toEqual([]);
  });

  it("never replaces an existing or concurrent run", async () => {
    const f = await fixture(), results = await Promise.allSettled([f.initialize(), f.initialize()]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected").reason.code).toBe("production-operator-run-already-exists");
    expect(await readJson(path.join(f.runDirectory, "plan.json"))).toEqual(f.plan);
  });

  it("leaves failed initialization incomplete and refuses to reuse it", async () => {
    const f = await fixture(); traceOpen((handle, file) => {
      if (file === path.join(f.runDirectory, "request.json")) vi.spyOn(handle, "writeFile").mockRejectedValue(new Error("synthetic disk failure"));
      return handle;
    });
    await expect(f.initialize()).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    expect(await entries(f.runDirectory)).not.toContain("initialized.json");
    await expect(f.open()).rejects.toThrow();
    await expect(f.initialize()).rejects.toHaveProperty("code", "production-operator-run-already-exists");
  });

  it.each(["relative", "trailing", "traversal", "root"])("rejects an unsafe run path: %s", async shape => {
    const f = await fixture(), directory = {relative: "./run", trailing: `${f.runDirectory}/`, traversal: `${f.base}/part/../run`, root: "/"}[shape];
    await expect(initializeProductionOperatorRun(directory, {plan: f.plan})).rejects.toHaveProperty("code", "invalid-private-directory-path");
    expect(await entries(f.base)).toEqual([]);
  });
});

describe("Production operator durable one-shot journal", () => {
  it("checks unclaimed state without creating storage or changing the run", async () => {
    const f = await fixture(); await f.initialize(); const before = await entries(f.runDirectory), store = await f.open(), {spy} = traceOpen();
    await store.assertUnclaimed(); expect(await entries(f.runDirectory)).toEqual(before); expect(await entries(f.base)).toEqual(["run"]);
    for (const [, flags] of spy.mock.calls) expect(flags & (constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT)).toBe(0);
  });

  it("durably claims the target before intent and accepts only a retained scoped acknowledgement", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open(), {events} = traceOpen();
    await store.beginIntent(f.intent);
    const claimFile = path.join(f.lockDirectory, `${PROJECT}.json`), intentFile = path.join(f.runDirectory, "intent.json");
    const claimSync = events.findIndex(([kind, file]) => kind === "sync" && file === claimFile);
    const directorySync = events.findIndex(([kind, file], index) => kind === "sync" && file === f.lockDirectory && index > claimSync);
    expect(claimSync).toBeGreaterThan(events.findIndex(([kind, file]) => kind === "write" && file === claimFile));
    expect(directorySync).toBeGreaterThan(claimSync);
    expect(directorySync).toBeLessThan(events.findIndex(([kind, file]) => kind === "open" && file === intentFile));
    expect(await readJson(claimFile)).toEqual({schemaVersion: "sodc-production-notify-operator-claim/v1", planSha256: digest(f.plan),
      reviewSha256: f.reviewSha256, operatorToolBindingSha256: digest(f.plan.operatorToolBinding), projectId: PROJECT, target: TARGET, runDirectory: f.runDirectory});
    expect((await fs.stat(f.lockDirectory)).mode & 0o7777).toBe(0o700); expect((await fs.stat(claimFile)).mode & 0o7777).toBe(0o600);
    await store.writeOperation(operation);
    expect(await readProspectiveOperationRecords(f.runDirectory)).toEqual({intent: f.intent, acknowledgement: operation});
    await expect(store.beginIntent(f.intent)).rejects.toHaveProperty("code", "production-operator-target-already-claimed");
    await expect(store.writeOperation(operation)).rejects.toHaveProperty("code", "local-record-already-exists");
  });

  it("creates claim, intent and acknowledgement with exclusive private NOFOLLOW writes and fsync", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open(), {spy, events} = traceOpen();
    await store.beginIntent(f.intent); await store.writeOperation(operation);
    const writes = spy.mock.calls.filter(([, flags]) => flags & constants.O_WRONLY);
    expect(writes.map(([file]) => path.basename(file))).toEqual([`${PROJECT}.json`, "intent.json", "operation.json"]);
    for (const [file, flags, mode] of writes) {
      expect(flags & (constants.O_EXCL | constants.O_CREAT | constants.O_NOFOLLOW)).toBe(constants.O_EXCL | constants.O_CREAT | constants.O_NOFOLLOW);
      expect(mode).toBe(0o600);
      const write = events.findIndex(([kind, name]) => kind === "write" && name === file);
      const sync = events.findIndex(([kind, name], index) => kind === "sync" && name === file && index > write);
      expect(sync).toBeGreaterThan(write);
      expect(events.findIndex(([kind, name], index) => kind === "sync" && name === path.dirname(file) && index > sync)).toBeGreaterThan(sync);
    }
  });

  it.each(["schema", "project", "target", "context", "before", "invalid-time", "extra", "missing"])("blocks invalid intent without claiming: %s", async shape => {
    const f = await fixture(); await f.initialize(); const intent = structuredClone(f.intent);
    if (shape === "schema") intent.schemaVersion = "old";
    if (shape === "project") intent.projectId = "sodc-web";
    if (shape === "target") intent.target += "other";
    if (shape === "context") intent.requestSha256 = "0".repeat(64);
    if (shape === "before") intent.startedAt = "2026-11-26T11:59:59.999Z";
    if (shape === "invalid-time") intent.startedAt = "no";
    if (shape === "extra") intent.approved = true;
    if (shape === "missing") delete intent.sourceBindingSha256;
    await expect((await f.open()).beginIntent(intent)).rejects.toHaveProperty("code", "invalid-production-operator-intent");
    expect(await entries(f.base)).toEqual(["run"]); expect(await entries(f.runDirectory)).not.toContain("intent.json");
  });

  it.each(["other-project", "other-region", "extra", "missing", "traversal"])("rejects an unsupported acknowledgement: %s", async shape => {
    const f = await fixture(); await f.initialize(); const store = await f.open(); await store.beginIntent(f.intent);
    const value = {name: operation.name};
    if (shape === "other-project") value.name = value.name.replace(PROJECT, "sodc-web");
    if (shape === "other-region") value.name = value.name.replace("europe-west2", "europe-west1");
    if (shape === "extra") value.body = {};
    if (shape === "missing") delete value.name;
    if (shape === "traversal") value.name += "/../another";
    await expect(store.writeOperation(value)).rejects.toHaveProperty("code", "invalid-production-operator-operation");
    expect(await entries(f.runDirectory)).not.toContain("operation.json");
  });

  it("refuses an acknowledgement before intent", async () => {
    const f = await fixture(); await f.initialize();
    await expect((await f.open()).writeOperation(operation)).rejects.toHaveProperty("code", "production-operator-operation-without-intent");
    expect(await entries(f.base)).toEqual(["run"]);
  });

  it("blocks another run and every retry even if the claim cannot be parsed", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open(); await store.beginIntent(f.intent);
    await fs.writeFile(path.join(f.lockDirectory, `${PROJECT}.json`), "unreadable claim");
    const secondRun = path.join(f.base, "another-run"), plan = {...f.plan, paths: {...f.plan.paths, runDirectory: secondRun}};
    await initializeProductionOperatorRun(secondRun, {plan});
    const second = await f.open({runDirectory: secondRun, plan});
    await expect(second.assertUnclaimed()).rejects.toHaveProperty("code", "production-operator-target-already-claimed");
    await expect(second.beginIntent(f.intent)).rejects.toHaveProperty("code", "production-operator-target-already-claimed");
    expect(await entries(secondRun)).not.toContain("intent.json");
  });

  it("allows exactly one intent across concurrent distinct runs", async () => {
    const f = await fixture(); await f.initialize(); const secondRun = path.join(f.base, "second-run");
    const secondPlan = {...f.plan, paths: {...f.plan.paths, runDirectory: secondRun}};
    await initializeProductionOperatorRun(secondRun, {plan: secondPlan});
    const stores = [await f.open(), await f.open({runDirectory: secondRun, plan: secondPlan})];
    const outcomes = await Promise.allSettled(stores.map(store => store.beginIntent(f.intent)));
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find(result => result.status === "rejected").reason.code).toBe("production-operator-target-already-claimed");
    const claim = await readJson(path.join(f.lockDirectory, `${PROJECT}.json`));
    const winningRun = outcomes[0].status === "fulfilled" ? f.runDirectory : secondRun;
    expect(claim.runDirectory).toBe(winningRun); expect(await entries(winningRun)).toContain("intent.json");
    expect(await entries(winningRun === f.runDirectory ? secondRun : f.runDirectory)).not.toContain("intent.json");
  });

  it.each(["mode", "symlink"])("refuses unsafe claim directory without repairing it: %s", async shape => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    if (shape === "mode") await fs.mkdir(f.lockDirectory, {mode: 0o750});
    else {const outside = path.join(f.base, "outside-locks"); await fs.mkdir(outside, {mode: 0o700}); await fs.symlink(outside, f.lockDirectory);}
    await expect(store.assertUnclaimed()).rejects.toThrow();
    await expect(store.beginIntent(f.intent)).rejects.toThrow(); expect(await entries(f.runDirectory)).not.toContain("intent.json");
  });

  it("retains the claim after intent fsync fails and refuses another attempt", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    traceOpen((handle, file) => {if (file === path.join(f.runDirectory, "intent.json")) vi.spyOn(handle, "sync").mockRejectedValue(new Error("disk")); return handle;});
    await expect(store.beginIntent(f.intent)).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    expect(await readJson(path.join(f.lockDirectory, `${PROJECT}.json`))).toHaveProperty("planSha256", digest(f.plan));
    await expect(store.beginIntent(f.intent)).rejects.toHaveProperty("code", "production-operator-target-already-claimed");
  });

  it("never writes intent when the claim fails to become durable", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    traceOpen((handle, file) => {if (file === path.join(f.lockDirectory, `${PROJECT}.json`)) vi.spyOn(handle, "sync").mockRejectedValue(new Error("disk")); return handle;});
    await expect(store.beginIntent(f.intent)).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    expect(await entries(f.runDirectory)).not.toContain("intent.json"); expect(await entries(f.lockDirectory)).toEqual([`${PROJECT}.json`]);
  });

  it.each(["review", "tool", "run", "plan"])("requires the same retained claim before acknowledging: %s", async shape => {
    const f = await fixture(); await f.initialize(); const store = await f.open(); await store.beginIntent(f.intent);
    const claimFile = path.join(f.lockDirectory, `${PROJECT}.json`), claim = await readJson(claimFile);
    if (shape === "review") claim.reviewSha256 = "0".repeat(64);
    if (shape === "tool") claim.operatorToolBindingSha256 = "0".repeat(64);
    if (shape === "run") claim.runDirectory += "other";
    if (shape === "plan") claim.planSha256 = "0".repeat(64);
    await privateJson(claimFile, claim);
    await expect(store.writeOperation(operation)).rejects.toHaveProperty("code", "production-operator-claim-mismatch");
    expect(await entries(f.runDirectory)).not.toContain("operation.json");
  });
});

describe("Production operator run integrity", () => {
  it.each(["plan.json", "request.json", "initialized.json"])("requires the exact stored %s", async name => {
    const f = await fixture(); await f.initialize(); const file = path.join(f.runDirectory, name), value = await readJson(file); value.changed = true; await privateJson(file, value);
    await expect(f.open()).rejects.toThrow(); expect(await entries(f.base)).toEqual(["run"]);
  });

  it.each(["plan.json", "request.json", "initialized.json"])("does not repair a missing %s", async name => {
    const f = await fixture(); await f.initialize(); await fs.unlink(path.join(f.runDirectory, name));
    await expect(f.open()).rejects.toHaveProperty("code", "private-record-read-failed"); expect(await entries(f.runDirectory)).not.toContain(name);
  });

  it.each(["mode", "hardlink", "symlink", "owner"])("rejects unsafe stored plan privacy: %s", async shape => {
    const f = await fixture(); await f.initialize(); const file = path.join(f.runDirectory, "plan.json");
    if (shape === "mode") await fs.chmod(file, 0o640);
    if (shape === "hardlink") await fs.link(file, path.join(f.base, "linked-plan.json"));
    if (shape === "symlink") {const target = path.join(f.base, "outside.json"); await fs.rename(file, target); await fs.symlink(target, file);}
    if (shape === "owner") traceOpen((handle, name) => {if (name === file) {const stat = handle.stat.bind(handle); vi.spyOn(handle, "stat").mockImplementation(async () => {const value = await stat(); value.uid += 1; return value;});} return handle;});
    await expect(f.open()).rejects.toHaveProperty("code", "private-regular-file-required");
  });

  it("rechecks run integrity after the store is opened", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    await privateJson(path.join(f.runDirectory, "request.json"), {...f.plan.request, approved: true});
    await expect(store.beginIntent(f.intent)).rejects.toHaveProperty("code", "production-operator-stored-plan-or-request-mismatch");
    expect(await entries(f.base)).toEqual(["run"]);
  });

  it.each(["", "F".repeat(64), "a".repeat(63), undefined])("requires an exact review SHA256: %j", async reviewSha256 => {
    const f = await fixture(); await f.initialize();
    await expect(f.open({reviewSha256})).rejects.toHaveProperty("code", "invalid-production-operator-review-hash");
  });

  it("rejects extra store options", async () => {
    const f = await fixture(); await f.initialize();
    await expect(f.open({comparisonKey: Buffer.alloc(32)})).rejects.toHaveProperty("code", "invalid-production-operator-store-options");
  });

  it("requires the plan-bound run path for preparation and reopening", async () => {
    const f = await fixture(), other = path.join(f.base, "unbound");
    await expect(initializeProductionOperatorRun(other, {plan: f.plan})).rejects.toHaveProperty("code", "production-operator-run-path-mismatch");
    expect(await entries(f.base)).toEqual([]); await f.initialize();
    await expect(f.open({runDirectory: other})).rejects.toHaveProperty("code", "production-operator-run-path-mismatch");
  });
});
