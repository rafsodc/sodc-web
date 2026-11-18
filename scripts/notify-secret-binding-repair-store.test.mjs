import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {createHmac, randomBytes} from "node:crypto";
import {afterEach, describe, expect, it, vi} from "vitest";
import {REGION, TARGET, reviewTemplate} from "./notify-secret-binding-repair-lib.mjs";
import {initializeRunDirectory, loadRunDirectory, openRepairStore, persistVerification} from "./notify-secret-binding-repair-store.mjs";

const directories = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, {recursive: true, force: true})));
});
async function fixture(environment = "dev") {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "notify-binding-store-"))); directories.push(base);
  const comparisonKey = randomBytes(32);
  const projectId = environment === "dev" ? "sodc-web" : "sodc-web-production";
  const binding = key => ({key, secret: key, projectId, version: "1"});
  const proposal = {schemaVersion: "sodc-notify-binding-repair/v1", action: "add-existing-notify-secret-bindings", environment,
    projectId, target: `projects/${projectId}/locations/${REGION}/functions/${TARGET}`,
    updateMask: "serviceConfig.secretEnvironmentVariables", providerWrites: 0,
    createdAt: "2026-11-18T09:00:00.000Z", expiresAt: "2026-11-18T10:00:00.000Z",
    sourceBinding: {gitSha: "a".repeat(40), tree: "b".repeat(40), trackedSha256: "c".repeat(64),
      buildSha256: "d".repeat(64), manifestSha256: "e".repeat(64),
      sdk: {version: "7.2.5", binarySha256: "f".repeat(64), packageSha256: "0".repeat(64)}},
    limits: ["Storage fixture only; actual source and provider validation are exercised by the core tests."],
    baseline: {project: {projectId, projectNumber: "123"}, functions: {[TARGET]: createHmac("sha256", comparisonKey).update("PRIVATE_ENVIRONMENT_VALUE").digest("hex")}},
    before: [binding("STRIPE_SECRET")], after: ["GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEAM_API_KEY", "GOV_NOTIFY_TEST_API_KEY", "STRIPE_SECRET"].map(binding)};
  const runDirectory = path.join(base, "run"), lockDirectory = path.join(base, "locks");
  const intent = {schemaVersion: proposal.schemaVersion, proposalSha256: reviewTemplate(proposal).proposalSha256,
    reviewSha256: "a".repeat(64), startedAt: "2026-11-18T09:01:00.000Z"};
  const initialize = () => initializeRunDirectory(runDirectory, {proposal, comparisonKey});
  const open = (extra = {}) => openRepairStore({runDirectory, lockDirectory, proposal, ...extra});
  return {base, runDirectory, lockDirectory, comparisonKey, proposal, intent, initialize, open};
}
function spyOpen(transform) {
  const open = fs.open.bind(fs);
  return vi.spyOn(fs, "open").mockImplementation(async (...args) => transform(await open(...args), ...args));
}

describe("private run initialization and reads", () => {
  it.each(["dev", "prod"])("stores %s metadata privately and returns no comparison key", async environment => {
    const f = await fixture(environment);
    const result = await f.initialize();
    expect(result).toEqual({runDirectory: f.runDirectory, projectId: f.proposal.projectId,
      target: f.proposal.target, proposalSha256: reviewTemplate(f.proposal).proposalSha256});
    expect((await fs.stat(f.runDirectory)).mode & 0o7777).toBe(0o700);
    for (const file of ["proposal.json", "review-template.json", "comparison.key", "initialized.json"]) expect((await fs.stat(path.join(f.runDirectory, file))).mode & 0o7777).toBe(0o600);
    const loaded = await loadRunDirectory({runDirectory: f.runDirectory});
    expect(loaded).toEqual({proposal: f.proposal, comparisonKey: f.comparisonKey});
    expect(await fs.readFile(path.join(f.runDirectory, "comparison.key"))).toEqual(f.comparisonKey);
    const json = await fs.readFile(path.join(f.runDirectory, "proposal.json"), "utf8");
    expect(json).not.toContain("PRIVATE_ENVIRONMENT_VALUE");
    expect(json).not.toContain(f.comparisonKey.toString("hex"));
    expect(JSON.stringify(result)).not.toContain(f.comparisonKey.toString("hex"));
    expect(await (await f.open()).read("intent.json")).toBeNull();
  });

  it("atomically refuses an existing run directory without replacing its files", async () => {
    const f = await fixture();
    const attempts = await Promise.allSettled([f.initialize(), f.initialize()]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(result => result.status === "rejected")[0].reason.code).toBe("run-directory-already-exists");
    expect((await loadRunDirectory({runDirectory: f.runDirectory})).comparisonKey).toEqual(f.comparisonKey);
  });

  it.each(["relative", "root", "traversal", "trailing"])("rejects the non-canonical run path: %s", async shape => {
    const f = await fixture();
    const runDirectory = {relative: "./relative", root: "/", traversal: `${f.base}/nested/../run`, trailing: `${f.runDirectory}/`}[shape];
    await expect(initializeRunDirectory(runDirectory, f)).rejects.toHaveProperty("code", "invalid-private-directory-path");
  });

  it.each(["project", "environment", "target"])("rejects a proposal with an unexpected %s before mkdir", async change => {
    const f = await fixture();
    if (change === "project") f.proposal.projectId = "other-project";
    if (change === "environment") f.proposal.environment = "beta";
    if (change === "target") f.proposal.target += "Other";
    await expect(f.initialize()).rejects.toThrow("Notify binding repair blocked");
    await expect(fs.lstat(f.runDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it.each([0, 31, 33])("rejects an invalid %i-byte comparison key", async length => {
    const f = await fixture();
    await expect(initializeRunDirectory(f.runDirectory, {...f, comparisonKey: Buffer.alloc(length)})).rejects.toHaveProperty("code", "invalid-comparison-key");
  });

  it("rejects ancestor and leaf symlinks rather than following them", async () => {
    const f = await fixture(); await f.initialize();
    const alias = path.join(f.base, "alias"); await fs.symlink(f.runDirectory, alias);
    await expect(loadRunDirectory({runDirectory: alias})).rejects.toThrow("unsafe-private-directory-ancestor");
    const original = path.join(f.runDirectory, "comparison.key");
    const replacement = path.join(f.base, "outside.key"); await fs.rename(original, replacement); await fs.symlink(replacement, original);
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toThrow("private-regular-file-required");
  });

  it.each(["directory", "file", "nonfile", "hardlink", "malformed", "oversized", "key-size", "owner"])("rejects unsafe private read state: %s", async change => {
    const f = await fixture(); await f.initialize();
    const file = path.join(f.runDirectory, "proposal.json");
    if (change === "directory") await fs.chmod(f.runDirectory, 0o750);
    if (change === "file") await fs.chmod(file, 0o640);
    if (change === "nonfile") {await fs.unlink(file); await fs.mkdir(file, {mode: 0o700});}
    if (change === "hardlink") await fs.link(file, path.join(f.base, "linked-proposal.json"));
    if (change === "malformed") await fs.writeFile(file, "PRIVATE_BROKEN_JSON");
    if (change === "oversized") await fs.writeFile(file, Buffer.alloc(2 * 1024 * 1024 + 1));
    if (change === "key-size") await fs.writeFile(path.join(f.runDirectory, "comparison.key"), Buffer.alloc(31));
    if (change === "owner") spyOpen((handle, name) => {
      if (name === file) {
        const stat = handle.stat.bind(handle);
        vi.spyOn(handle, "stat").mockImplementation(async () => {const value = await stat(); value.uid += 1; return value;});
      }
      return handle;
    });
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toThrow("Notify binding repair blocked");
  });

  it("leaves a failed initialization closed and never reuses its partial directory", async () => {
    const f = await fixture();
    spyOpen((handle, name) => {
      if (name === path.join(f.runDirectory, "comparison.key")) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_KEY_FSYNC_ERROR"));
      return handle;
    });
    await expect(f.initialize()).rejects.toThrow("durable-local-record-write-failed");
    vi.restoreAllMocks();
    await expect(f.initialize()).rejects.toHaveProperty("code", "run-directory-already-exists");
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toHaveProperty("code", "private-record-read-failed");
    await expect(f.open()).rejects.toHaveProperty("code", "private-record-read-failed");
  });

  it.each(["missing", "mismatch"])("rejects an incomplete initialization marker: %s", async change => {
    const f = await fixture(); await f.initialize();
    const marker = path.join(f.runDirectory, "initialized.json");
    if (change === "missing") await fs.unlink(marker);
    else await fs.writeFile(marker, JSON.stringify({schemaVersion: "wrong"}));
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toThrow("Notify binding repair blocked");
    await expect(f.open()).rejects.toThrow("Notify binding repair blocked");
  });

  it("sanitizes a private file close failure", async () => {
    const f = await fixture(); await f.initialize();
    spyOpen((handle, file) => {
      if (file === path.join(f.runDirectory, "proposal.json")) {
        const close = handle.close.bind(handle);
        vi.spyOn(handle, "close").mockImplementation(async () => {await close(); throw new Error("PRIVATE_CLOSE_ERROR");});
      }
      return handle;
    });
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toThrow(/^Notify binding repair blocked: private-record-read-failed\.$/);
  });

  it("reads only valid private review JSON and detects a different valid stored proposal", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    const reviewFile = path.join(f.runDirectory, "review.json");
    await fs.writeFile(reviewFile, "PRIVATE_MALFORMED_REVIEW", {mode: 0o600});
    await expect(store.read("review.json")).rejects.toHaveProperty("code", "malformed-private-json-record");
    await fs.writeFile(reviewFile, JSON.stringify(reviewTemplate(f.proposal)));
    expect(await store.read("review.json")).toEqual(reviewTemplate(f.proposal));
    const other = {...f.proposal, baseline: {...f.proposal.baseline, functions: {[TARGET]: "b".repeat(64)}}};
    await expect(f.open({proposal: other})).rejects.toHaveProperty("code", "stored-proposal-mismatch");
  });
});

describe("irreversible project-wide intent claim", () => {
  it("fsyncs the global claim before opening the local intent and never overwrites a record", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    const events = [];
    spyOpen((handle, name, flags) => {
      if ((flags & constants.O_CREAT) !== 0) events.push(`open:${path.basename(name)}`);
      const sync = handle.sync.bind(handle);
      vi.spyOn(handle, "sync").mockImplementation(async () => {await sync(); events.push(`sync:${path.basename(name)}`);});
      return handle;
    });
    await store.writeOnce("intent.json", f.intent);
    expect(events.indexOf("sync:sodc-web.json")).toBeGreaterThan(-1);
    expect(events.indexOf("sync:sodc-web.json")).toBeLessThan(events.indexOf("open:intent.json"));
    await expect(store.writeOnce("intent.json", f.intent)).rejects.toHaveProperty("code", "global-target-already-claimed");
    const operation = {name: `projects/sodc-web/locations/${REGION}/operations/fixture-operation`};
    await store.writeOnce("operation.json", operation);
    await expect(store.writeOnce("operation.json", operation)).rejects.toHaveProperty("code", "local-record-already-exists");
    expect(await store.read("operation.json")).toEqual(operation);
    expect((await fs.stat(path.join(f.lockDirectory, "sodc-web.json"))).mode & 0o7777).toBe(0o600);
  });

  it("permits only one concurrent claim across distinct clean run directories", async () => {
    const f = await fixture(); await f.initialize();
    const other = path.join(f.base, "other-run");
    const otherProposal = {...f.proposal, baseline: {...f.proposal.baseline, functions: {[TARGET]: "b".repeat(64)}}};
    await initializeRunDirectory(other, {proposal: otherProposal, comparisonKey: f.comparisonKey});
    const stores = await Promise.all([f.open(), f.open({runDirectory: other, proposal: otherProposal})]);
    const outcomes = await Promise.allSettled(stores.map((store, index) => store.writeOnce("intent.json", index === 0 ? f.intent :
      {...f.intent, proposalSha256: reviewTemplate(otherProposal).proposalSha256})));
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")[0].reason.code).toBe("global-target-already-claimed");
    const intents = await Promise.all(stores.map(store => store.read("intent.json")));
    expect(intents.filter(Boolean)).toHaveLength(1);
  });

  it.each(["global", "global-directory", "intent"])("retains the global claim after a %s fsync failure and blocks another clean run", async failure => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    await fs.mkdir(f.lockDirectory, {mode: 0o700});
    spyOpen((handle, file) => {
      const failingFile = failure === "global-directory" ? f.lockDirectory :
        path.join(failure === "global" ? f.lockDirectory : f.runDirectory, failure === "global" ? "sodc-web.json" : "intent.json");
      if (file === failingFile) {
        vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_DISK_FAILURE"));
      }
      return handle;
    });
    await expect(store.writeOnce("intent.json", f.intent)).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    expect(JSON.parse(await fs.readFile(path.join(f.lockDirectory, "sodc-web.json"), "utf8"))).toHaveProperty("target", f.proposal.target);
    vi.restoreAllMocks();
    const other = path.join(f.base, "new-clean-run"); await initializeRunDirectory(other, f);
    await expect((await f.open({runDirectory: other})).writeOnce("intent.json", f.intent)).rejects.toHaveProperty("code", "global-target-already-claimed");
  });

  it("keeps Dev and Production claims separate", async () => {
    const dev = await fixture("dev"), prod = await fixture("prod"); await dev.initialize(); await prod.initialize();
    await (await dev.open()).writeOnce("intent.json", dev.intent);
    await (await prod.open({lockDirectory: dev.lockDirectory})).writeOnce("intent.json", prod.intent);
    expect((await fs.readdir(dev.lockDirectory)).sort()).toEqual(["sodc-web-production.json", "sodc-web.json"]);
  });

  it("rejects unknown names, invalid intent/operation and mismatched proposal state without claiming", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    for (const name of ["../intent.json", "comparison.key", "/intent.json", "anything.json"]) {
      await expect(store.read(name)).rejects.toHaveProperty("code", "unsupported-local-record-name");
      await expect(store.writeOnce(name, {})).rejects.toHaveProperty("code", "unsupported-local-record-name");
    }
    await expect(store.writeOnce("intent.json", {...f.intent, proposalSha256: "b".repeat(64)})).rejects.toHaveProperty("code", "invalid-local-intent");
    await expect(store.writeOnce("intent.json", {...f.intent, comparisonKey: "PRIVATE_EXTRA"})).rejects.toHaveProperty("code", "invalid-local-intent");
    await expect(store.writeOnce("operation.json", {name: "other"})).rejects.toHaveProperty("code", "operation-without-local-intent");
    await expect(f.open({proposal: {...f.proposal, expiresAt: "2026-11-18T11:00:00.000Z"}})).rejects.toThrow("invalid-proposal");
    await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("never follows an existing global lock symlink or writes an operation for another target", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    await fs.mkdir(f.lockDirectory, {mode: 0o700});
    const outside = path.join(f.base, "outside.json"); await fs.writeFile(outside, "unchanged", {mode: 0o600});
    const lockFile = path.join(f.lockDirectory, "sodc-web.json"); await fs.symlink(outside, lockFile);
    await expect(store.writeOnce("intent.json", f.intent)).rejects.toHaveProperty("code", "global-target-already-claimed");
    expect(await fs.readFile(outside, "utf8")).toBe("unchanged");
    await fs.unlink(lockFile); // Fixture-only removal; the production store has no unlock operation.
    await store.writeOnce("intent.json", f.intent);
    await expect(store.writeOnce("operation.json", {name: `projects/other/locations/${REGION}/operations/x`}))
      .rejects.toHaveProperty("code", "invalid-local-operation");
    await expect(store.writeOnce("operation.json", {name: `projects/sodc-web/locations/${REGION}/operations/x`, extra: "PRIVATE_VALUE"}))
      .rejects.toHaveProperty("code", "invalid-local-operation");
    await persistVerification({runDirectory: f.runDirectory, verification: {status: "PASS"}});
    expect(await fs.lstat(lockFile)).toBeTruthy();
    await expect(store.writeOnce("intent.json", f.intent)).rejects.toHaveProperty("code", "global-target-already-claimed");
  });

  it("refuses an insecure or symbolic global lock directory", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    await fs.mkdir(f.lockDirectory, {mode: 0o755});
    await expect(store.writeOnce("intent.json", f.intent)).rejects.toHaveProperty("code", "private-directory-required");
    await fs.rmdir(f.lockDirectory); await fs.symlink(f.runDirectory, f.lockDirectory);
    await expect(store.writeOnce("intent.json", f.intent)).rejects.toHaveProperty("code", "unsafe-private-directory-ancestor");
  });
});

describe("append-only verification snapshots", () => {
  it("writes distinct private snapshots and exposes only filenames/digests", async () => {
    const f = await fixture(); await f.initialize();
    const snapshots = await Promise.all([persistVerification({runDirectory: f.runDirectory, verification: {status: "PENDING"}}),
      persistVerification({runDirectory: f.runDirectory, verification: {status: "PASS"}})]);
    expect(new Set(snapshots.map(result => result.name)).size).toBe(2);
    for (const result of snapshots) {
      expect(result.name).toMatch(/^verification-[a-f0-9-]{36}\.json$/);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((await fs.stat(path.join(f.runDirectory, result.name))).mode & 0o7777).toBe(0o600);
      expect(Object.keys(result).sort()).toEqual(["name", "runDirectory", "sha256"]);
    }
  });
});
