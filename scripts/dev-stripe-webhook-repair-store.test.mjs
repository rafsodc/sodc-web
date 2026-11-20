import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {afterEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {preflightRepairStorage, initializeRunDirectory, loadRunDirectory, openRepairStore, persistVerification} from "./dev-stripe-webhook-repair-store.mjs";
import {fixture as protocolFixture, KEY} from "./test-fixtures/dev-stripe-webhook-repair-fixture.mjs";

const directories = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, {recursive: true, force: true})));
});
const recordSchema = "sodc-dev-stripe-webhook-repair-record/v1";
const stageNames = ["secret-intent.json", "secret-version.json", "function-intent.json", "operation.json",
  "function-pass.json", "stripe-intent.json", "stripe-ack.json"];
async function fixture() {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "dev-stripe-store-"))); directories.push(base);
  const runDirectory = path.join(base, "run"), lockDirectory = path.join(base, ".firebase/dev-stripe-webhook-repair-locks");
  const comparisonKey = Buffer.from(KEY);
  const proposal = protocolFixture().prepare();
  const initialize = () => initializeRunDirectory(runDirectory, {proposal, comparisonKey});
  const open = extra => openRepairStore({runDirectory, lockDirectory, proposal, ...extra});
  const record = extra => ({schemaVersion: recordSchema, proposalSha256: digest(proposal), ...extra});
  return {base, runDirectory, lockDirectory, comparisonKey, proposal, initialize, open, record};
}
function spyOpen(transform) {
  const original = fs.open.bind(fs);
  return vi.spyOn(fs, "open").mockImplementation(async (...args) => transform(await original(...args), ...args));
}
async function claimAndIntent(f) {
  await f.initialize(); const store = await f.open(); await store.claim(f.proposal);
  await store.writeOnce("secret-intent.json", f.record({stage: "secret"})); return store;
}

describe("read-only repair storage preflight", () => {
  it("allows a safe new run without creating absent claim parents or any record", async () => {
    const f = await fixture(), mkdir = vi.spyOn(fs, "mkdir"), write = vi.spyOn(fs, "writeFile"), open = vi.spyOn(fs, "open");
    expect(await preflightRepairStorage({...f, preparing: true})).toEqual({status: "STORAGE_READY"});
    expect(mkdir).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
    expect(await fs.readdir(f.base)).toEqual([]);
  });

  it("allows an existing empty private claim directory without changing it", async () => {
    const f = await fixture(); await fs.mkdir(f.lockDirectory, {recursive: true, mode: 0o700});
    const mkdir = vi.spyOn(fs, "mkdir");
    expect(await preflightRepairStorage({...f, preparing: true})).toEqual({status: "STORAGE_READY"});
    expect(mkdir).not.toHaveBeenCalled(); expect(await fs.readdir(f.lockDirectory)).toEqual([]);
    await expect(fs.lstat(f.runDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it.each(["file", "directory", "symlink", "dangling-symlink"])("rejects an existing %s at the prepare leaf", async kind => {
    const f = await fixture();
    if (kind === "file") await fs.writeFile(f.runDirectory, "UNCHANGED", {mode: 0o600});
    if (kind === "directory") await fs.mkdir(f.runDirectory, {mode: 0o700});
    if (kind.endsWith("symlink")) await fs.symlink(kind === "symlink" ? f.base : path.join(f.base, "absent"), f.runDirectory);
    const mkdir = vi.spyOn(fs, "mkdir"), write = vi.spyOn(fs, "writeFile");
    await expect(preflightRepairStorage({...f, preparing: true})).rejects.toHaveProperty("code", "run-directory-already-exists");
    expect(mkdir).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("rejects an unsafe run ancestor or absent parent without creating either", async () => {
    const f = await fixture(); await fs.chmod(f.base, 0o770);
    try {
      await expect(preflightRepairStorage({...f, preparing: true})).rejects.toHaveProperty("code", "writable-private-directory-ancestor");
    } finally {await fs.chmod(f.base, 0o700);}
    const mkdir = vi.spyOn(fs, "mkdir");
    await expect(preflightRepairStorage({...f, runDirectory: path.join(f.base, "absent", "run"), preparing: true}))
      .rejects.toHaveProperty("code", "private-storage-preflight-failed");
    expect(mkdir).not.toHaveBeenCalled(); expect(await fs.readdir(f.base)).toEqual([]);
  });

  it.each(["writable-parent", "symlink-parent", "public-directory"])("rejects unsafe claim storage: %s", async kind => {
    const f = await fixture(), parent = path.dirname(f.lockDirectory);
    if (kind === "symlink-parent") await fs.symlink(f.base, parent);
    else {
      await fs.mkdir(f.lockDirectory, {recursive: true, mode: 0o700});
      await fs.chmod(kind === "writable-parent" ? parent : f.lockDirectory, kind === "writable-parent" ? 0o770 : 0o750);
    }
    const mkdir = vi.spyOn(fs, "mkdir");
    await expect(preflightRepairStorage({...f, preparing: true})).rejects.toThrow(/^Dev Stripe webhook repair blocked: [a-z-]+\.$/);
    expect(mkdir).not.toHaveBeenCalled(); await expect(fs.lstat(f.runDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it.each(["file", "directory", "dangling-symlink"])("blocks any existing fixed Dev claim before prepare: %s", async kind => {
    const f = await fixture(); await fs.mkdir(f.lockDirectory, {recursive: true, mode: 0o700});
    const claim = path.join(f.lockDirectory, "sodc-web.json");
    if (kind === "file") await fs.writeFile(claim, "ORIGINAL_CLAIM", {mode: 0o600});
    if (kind === "directory") await fs.mkdir(claim, {mode: 0o700});
    if (kind === "dangling-symlink") await fs.symlink(path.join(f.base, "absent"), claim);
    const open = vi.spyOn(fs, "open"), mkdir = vi.spyOn(fs, "mkdir");
    await expect(preflightRepairStorage({...f, preparing: true})).rejects.toHaveProperty("code", "global-target-already-claimed");
    expect(open).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled();
    if (kind === "file") expect(await fs.readFile(claim, "utf8")).toBe("ORIGINAL_CLAIM");
  });

  it("allows a retained private claim for later phases using read-only opens only", async () => {
    const f = await fixture(); await claimAndIntent(f);
    const before = await fs.readFile(path.join(f.lockDirectory, "sodc-web.json"));
    const mkdir = vi.spyOn(fs, "mkdir"), write = vi.spyOn(fs, "writeFile"), open = vi.spyOn(fs, "open");
    expect(await preflightRepairStorage({...f, preparing: false})).toEqual({status: "STORAGE_READY"});
    expect(mkdir).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    for (const [, flags] of open.mock.calls) expect(flags & (constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT)).toBe(0);
    expect(await fs.readFile(path.join(f.lockDirectory, "sodc-web.json"))).toEqual(before);
  });

  it.each(["mode", "symlink", "hardlink", "malformed"])("rejects unsafe retained claim files: %s", async kind => {
    const f = await fixture(); await claimAndIntent(f); const claim = path.join(f.lockDirectory, "sodc-web.json");
    if (kind === "mode") await fs.chmod(claim, 0o640);
    if (kind === "symlink") {await fs.rename(claim, path.join(f.base, "claim")); await fs.symlink(path.join(f.base, "claim"), claim);}
    if (kind === "hardlink") await fs.link(claim, path.join(f.base, "claim"));
    if (kind === "malformed") await fs.writeFile(claim, "PRIVATE_INVALID_JSON");
    const mkdir = vi.spyOn(fs, "mkdir"), write = vi.spyOn(fs, "writeFile");
    await expect(preflightRepairStorage({...f, preparing: false})).rejects.toThrow(/^Dev Stripe webhook repair blocked: [a-z-]+\.$/);
    expect(mkdir).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  });

  it("allows missing later-phase claims without creating them but requires an existing private run", async () => {
    const f = await fixture(); await f.initialize(); const mkdir = vi.spyOn(fs, "mkdir");
    expect(await preflightRepairStorage({...f, preparing: false})).toEqual({status: "STORAGE_READY"});
    await expect(preflightRepairStorage({...f, runDirectory: path.join(f.base, "absent"), preparing: false}))
      .rejects.toHaveProperty("code", "private-storage-preflight-failed");
    expect(mkdir).not.toHaveBeenCalled(); await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("applies the namespace and bidirectional overlap boundary before filesystem reads", async () => {
    const f = await fixture(), lstat = vi.spyOn(fs, "lstat");
    await expect(preflightRepairStorage({...f, preparing: true, runDirectory: path.dirname(f.lockDirectory)}))
      .rejects.toHaveProperty("code", "run-and-claim-directories-overlap");
    await expect(preflightRepairStorage({...f, preparing: true, runDirectory: path.join(f.lockDirectory, "run")}))
      .rejects.toHaveProperty("code", "run-and-claim-directories-overlap");
    await expect(preflightRepairStorage({...f, preparing: true, lockDirectory: path.join(f.base, ".firebase/notify-binding-repair-locks")}))
      .rejects.toHaveProperty("code", "invalid-claim-directory-namespace");
    expect(lstat).not.toHaveBeenCalled();
  });
});

describe("Dev-only private repair initialization", () => {
  it("creates a new private run, keeps the raw key private and returns only metadata", async () => {
    const f = await fixture(); const result = await f.initialize();
    expect(result).toEqual({runDirectory: f.runDirectory, proposalSha256: digest(f.proposal), projectId: "sodc-web",
      target: f.proposal.target, secret: "STRIPE_WEBHOOK_SECRET_PAYMENTS", endpointId: f.proposal.endpointId});
    expect((await fs.stat(f.runDirectory)).mode & 0o7777).toBe(0o700);
    for (const name of ["proposal.json", "review-template.json", "comparison.key", "initialized.json"]) {
      expect((await fs.stat(path.join(f.runDirectory, name))).mode & 0o7777).toBe(0o600);
    }
    expect(await loadRunDirectory({runDirectory: f.runDirectory})).toEqual({proposal: f.proposal, comparisonKey: f.comparisonKey});
    expect(JSON.stringify(result)).not.toContain(f.comparisonKey.toString("hex"));
    expect(await (await f.open()).read("review.json")).toBeNull();
    expect(await (await f.open()).read("secret-intent.json")).toBeNull();
    await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("refuses to reuse or overwrite an existing or concurrently initialized run", async () => {
    const f = await fixture();
    const attempts = await Promise.allSettled([f.initialize(), f.initialize()]);
    expect(attempts.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find(x => x.status === "rejected").reason.code).toBe("run-directory-already-exists");
    expect((await loadRunDirectory({runDirectory: f.runDirectory})).comparisonKey).toEqual(f.comparisonKey);
  });

  it.each(["relative", "root", "traversal", "trailing", "null"])("rejects a noncanonical run path: %s", async shape => {
    const f = await fixture();
    const value = {relative: "./run", root: "/", traversal: `${f.base}/nested/../run`, trailing: `${f.runDirectory}/`, null: `${f.runDirectory}\0bad`}[shape];
    await expect(initializeRunDirectory(value, f)).rejects.toHaveProperty("code", "invalid-private-directory-path");
  });

  it.each(["schemaVersion", "environment", "projectId", "projectNumber", "target", "endpointId", "accountId"])("rejects a wrong %s before mkdir", async field => {
    const f = await fixture(); f.proposal[field] = "UNEXPECTED_PRIVATE_VALUE";
    await expect(f.initialize()).rejects.toHaveProperty("code", "invalid-storage-proposal-scope");
    await expect(fs.lstat(f.runDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it.each([0, 31, 33])("rejects an invalid %i-byte comparison key", async length => {
    const f = await fixture();
    await expect(initializeRunDirectory(f.runDirectory, {...f, comparisonKey: Buffer.alloc(length)}))
      .rejects.toHaveProperty("code", "invalid-comparison-key");
  });

  it.each([0o770, 0o707, 0o1770])("rejects an unsafe parent mode %i without creating the run", async mode => {
    const f = await fixture(); await fs.chmod(f.base, mode);
    try {
      if ((mode & 0o1000) && process.getuid() === 0) {
        const lstat = fs.lstat.bind(fs);
        vi.spyOn(process, "getuid").mockReturnValue(1234);
        vi.spyOn(fs, "lstat").mockImplementation(async (...args) => {const stat = await lstat(...args); if (args[0] === f.base) stat.uid = 1234; return stat;});
      }
      await expect(f.initialize()).rejects.toHaveProperty("code", "writable-private-directory-ancestor");
      await expect(fs.lstat(f.runDirectory)).rejects.toHaveProperty("code", "ENOENT");
    } finally {await fs.chmod(f.base, 0o700);}
  });

  it("rejects directory aliases and dangling symlink ancestors", async () => {
    const f = await fixture(); await f.initialize();
    const alias = path.join(f.base, "alias"); await fs.symlink(f.runDirectory, alias);
    await expect(loadRunDirectory({runDirectory: alias})).rejects.toHaveProperty("code", "unsafe-private-directory-ancestor");
    const dangling = path.join(f.base, "dangling"); await fs.symlink(path.join(f.base, "absent"), dangling);
    await expect(initializeRunDirectory(path.join(dangling, "run"), f)).rejects.toHaveProperty("code", "unsafe-private-directory-ancestor");
  });

  it.each(["directory-mode", "file-mode", "directory-instead", "symlink", "hardlink", "malformed", "oversized", "short-key", "owner"])("fails closed on unsafe private state: %s", async change => {
    const f = await fixture(); await f.initialize(); const file = path.join(f.runDirectory, "proposal.json");
    if (change === "directory-mode") await fs.chmod(f.runDirectory, 0o750);
    if (change === "file-mode") await fs.chmod(file, 0o640);
    if (change === "directory-instead") {await fs.unlink(file); await fs.mkdir(file, {mode: 0o700});}
    if (change === "symlink") {const target = path.join(f.base, "outside.json"); await fs.rename(file, target); await fs.symlink(target, file);}
    if (change === "hardlink") await fs.link(file, path.join(f.base, "hardlink.json"));
    if (change === "malformed") await fs.writeFile(file, "PRIVATE_INVALID_JSON");
    if (change === "oversized") await fs.writeFile(file, Buffer.alloc(2 * 1024 * 1024 + 1));
    if (change === "short-key") await fs.writeFile(path.join(f.runDirectory, "comparison.key"), Buffer.alloc(31));
    if (change === "owner") spyOpen((handle, name) => {
      if (name === file) {const stat = handle.stat.bind(handle); vi.spyOn(handle, "stat").mockImplementation(async () => {const value = await stat(); value.uid++; return value;});}
      return handle;
    });
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toThrow(/^Dev Stripe webhook repair blocked: [a-z-]+\.$/);
  });

  it("detects a file swapped or changed during its read", async () => {
    const f = await fixture(); await f.initialize();
    spyOpen((handle, name) => {
      if (name === path.join(f.runDirectory, "proposal.json")) {
        const stat = handle.stat.bind(handle); let calls = 0;
        vi.spyOn(handle, "stat").mockImplementation(async () => {const result = await stat(); if (++calls > 1) result.mtimeMs++; return result;});
      }
      return handle;
    });
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toHaveProperty("code", "private-record-changed-during-read");
  });

  it("writes initialized.json last and does not adopt a failed initialization", async () => {
    const f = await fixture(); const writes = [];
    spyOpen((handle, file, flags) => {
      if (flags & constants.O_CREAT) writes.push(path.basename(file));
      if (file === path.join(f.runDirectory, "comparison.key")) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_FSYNC_ERROR"));
      return handle;
    });
    await expect(f.initialize()).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    expect(writes).toEqual(["proposal.json", "review-template.json", "comparison.key"]);
    vi.restoreAllMocks();
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toHaveProperty("code", "private-record-read-failed");
    await expect(f.initialize()).rejects.toHaveProperty("code", "run-directory-already-exists");
  });

  it.each(["missing", "different", "extra"])("rejects an invalid initialization marker: %s", async kind => {
    const f = await fixture(); await f.initialize(); const file = path.join(f.runDirectory, "initialized.json");
    if (kind === "missing") await fs.unlink(file);
    else {const marker = JSON.parse(await fs.readFile(file)); if (kind === "different") marker.proposalSha256 = "f".repeat(64); else marker.extra = true; await fs.writeFile(file, JSON.stringify(marker));}
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toThrow("Dev Stripe webhook repair blocked");
    await expect(f.open()).rejects.toThrow("Dev Stripe webhook repair blocked");
  });
});

describe("separate permanent claim and sequential stage records", () => {
  it("durably claims before any intent, keeps the old Notify claim unchanged, and supports the exact stages", async () => {
    const f = await fixture(); await f.initialize();
    const oldDirectory = path.join(f.base, ".firebase/notify-binding-repair-locks"); await fs.mkdir(oldDirectory, {recursive: true, mode: 0o700});
    const oldFile = path.join(oldDirectory, "sodc-web.json"); const original = "ORIGINAL_NOTIFY_CLAIM_UNCHANGED"; await fs.writeFile(oldFile, original, {mode: 0o600});
    const events = [];
    spyOpen((handle, file, flags) => {
      if (flags & constants.O_CREAT) events.push(`open:${path.basename(file)}`);
      const sync = handle.sync.bind(handle);
      vi.spyOn(handle, "sync").mockImplementation(async () => {await sync(); events.push(`sync:${path.basename(file)}`);}); return handle;
    });
    const store = await f.open();
    await expect(store.writeOnce("secret-intent.json", f.record())).rejects.toHaveProperty("code", "fresh-durable-claim-required");
    await store.claim(f.proposal);
    for (const name of stageNames) {await store.writeOnce(name, f.record({stage: name})); expect(await store.read(name)).toEqual(f.record({stage: name}));}
    expect(events.indexOf("sync:sodc-web.json")).toBeGreaterThan(-1);
    expect(events.indexOf("sync:sodc-web.json")).toBeLessThan(events.indexOf("open:secret-intent.json"));
    expect(await fs.readFile(oldFile, "utf8")).toBe(original);
    await expect(store.claim(f.proposal)).rejects.toHaveProperty("code", "global-target-already-claimed");
    await expect(store.writeOnce("secret-version.json", f.record())).rejects.toHaveProperty("code", "local-record-already-exists");
    for (const name of stageNames) expect((await fs.stat(path.join(f.runDirectory, name))).mode & 0o7777).toBe(0o600);
    expect((await fs.stat(path.join(f.lockDirectory, "sodc-web.json"))).mode & 0o7777).toBe(0o600);
  });

  it("allows only one concurrent claim across independently initialized runs", async () => {
    const f = await fixture(); await f.initialize(); const otherRun = path.join(f.base, "other");
    const otherProposal = {...f.proposal, candidateSecretHmac: "c".repeat(64)};
    await initializeRunDirectory(otherRun, {...f, proposal: otherProposal});
    const stores = await Promise.all([f.open(), f.open({runDirectory: otherRun, proposal: otherProposal})]);
    const attempts = await Promise.allSettled(stores.map((s, index) => s.claim(index ? otherProposal : f.proposal)));
    expect(attempts.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find(x => x.status === "rejected").reason.code).toBe("global-target-already-claimed");
    expect((await fs.readdir(f.lockDirectory))).toEqual(["sodc-web.json"]);
  });

  it.each(["global-file", "global-directory"])("never adopts a claim after an uncertain %s fsync", async where => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    spyOpen((handle, file) => {
      const expected = where === "global-file" ? path.join(f.lockDirectory, "sodc-web.json") : f.lockDirectory;
      if (file === expected) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_FSYNC_FAILURE")); return handle;
    });
    await expect(store.claim(f.proposal)).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    await expect(store.writeOnce("secret-intent.json", f.record())).rejects.toHaveProperty("code", "fresh-durable-claim-required");
    vi.restoreAllMocks();
    expect(await fs.lstat(path.join(f.lockDirectory, "sodc-web.json"))).toBeTruthy();
    const reopened = await f.open();
    await expect(reopened.claim(f.proposal)).rejects.toHaveProperty("code", "global-target-already-claimed");
    await expect(reopened.writeOnce("secret-intent.json", f.record())).rejects.toHaveProperty("code", "fresh-durable-claim-required");
  });

  it("retains claim and intent after a local fsync failure and refuses another write", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open(); await store.claim(f.proposal);
    spyOpen((handle, file) => {if (file === path.join(f.runDirectory, "secret-intent.json")) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_INTENT_FSYNC")); return handle;});
    await expect(store.writeOnce("secret-intent.json", f.record())).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    vi.restoreAllMocks();
    await expect(store.writeOnce("secret-intent.json", f.record())).rejects.toHaveProperty("code", "local-record-already-exists");
    expect(await fs.lstat(path.join(f.lockDirectory, "sodc-web.json"))).toBeTruthy();
  });

  it.each(stageNames.slice(1))("refuses a missing predecessor for %s", async name => {
    const f = await fixture(); await f.initialize(); const store = await f.open(); await store.claim(f.proposal);
    await expect(store.writeOnce(name, f.record())).rejects.toHaveProperty("code", "local-stage-predecessor-missing");
    await expect(fs.lstat(path.join(f.runDirectory, name))).rejects.toHaveProperty("code", "ENOENT");
  });

  it("rejects traversal, key access, writable proposal/review and unbound record data", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    for (const name of ["../secret-intent.json", "/operation.json", "comparison.key", "initialized.json", "arbitrary.json"]) {
      await expect(store.read(name)).rejects.toHaveProperty("code", "unsupported-local-record-name");
      await expect(store.writeOnce(name, f.record())).rejects.toHaveProperty("code", "unsupported-local-record-name");
    }
    for (const name of ["proposal.json", "review.json", "review-template.json"]) await expect(store.writeOnce(name, f.record())).rejects.toHaveProperty("code", "unsupported-local-record-name");
    await expect(store.writeOnce("secret-intent.json", {schemaVersion: "other", proposalSha256: digest(f.proposal)})).rejects.toHaveProperty("code", "invalid-local-stage-record");
    await expect(store.writeOnce("secret-intent.json", f.record({proposalSha256: "d".repeat(64)}))).rejects.toHaveProperty("code", "invalid-local-stage-record");
    await expect(store.claim({...f.proposal, candidateSecretHmac: "d".repeat(64)})).rejects.toHaveProperty("code", "stored-proposal-mismatch");
    await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it.each(["schema", "proposal", "claim"])("detects a changed existing %s while reading stage records", async change => {
    const f = await fixture(); const store = await claimAndIntent(f);
    if (change === "claim") {
      const file = path.join(f.lockDirectory, "sodc-web.json"); const v = JSON.parse(await fs.readFile(file)); v.target += "Other"; await fs.writeFile(file, JSON.stringify(v));
    } else {
      const value = f.record(change === "schema" ? {schemaVersion: "bad"} : {proposalSha256: "d".repeat(64)});
      await fs.writeFile(path.join(f.runDirectory, "secret-intent.json"), JSON.stringify(value));
    }
    await expect(store.read("secret-intent.json")).rejects.toThrow("Dev Stripe webhook repair blocked");
  });

  it("does not follow a global claim symlink or insecure lock directory", async () => {
    const f = await fixture(); await f.initialize(); const store = await f.open();
    await fs.mkdir(f.lockDirectory, {recursive: true, mode: 0o700}); const outside = path.join(f.base, "original");
    await fs.writeFile(outside, "UNCHANGED", {mode: 0o600}); await fs.symlink(outside, path.join(f.lockDirectory, "sodc-web.json"));
    await expect(store.claim(f.proposal)).rejects.toHaveProperty("code", "global-target-already-claimed");
    expect(await fs.readFile(outside, "utf8")).toBe("UNCHANGED");
    await fs.chmod(f.lockDirectory, 0o755);
    await expect(store.claim(f.proposal)).rejects.toHaveProperty("code", "private-directory-required");
  });

  it.each(["same", "run-parent", "claim-parent"])("rejects directory overlap in %s shape before a write", async kind => {
    const f = await fixture(); await f.initialize();
    const r = kind === "claim-parent" ? path.join(f.lockDirectory, "nested-run") : f.runDirectory;
    const l = kind === "same" ? r : kind === "run-parent" ? path.join(r, ".firebase/dev-stripe-webhook-repair-locks") : f.lockDirectory;
    await expect(f.open({runDirectory: r, lockDirectory: l})).rejects.toHaveProperty("code", "run-and-claim-directories-overlap");
    await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("conservatively rejects case and Unicode alias overlaps on Darwin", async () => {
    const f = await fixture(); await f.initialize();
    const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {value: "darwin", configurable: true});
    try {
      const run = path.join(f.base, "É-RUN"); const locks = path.join(f.base, "e\u0301-run/.firebase/dev-stripe-webhook-repair-locks");
      await expect(f.open({runDirectory: run, lockDirectory: locks})).rejects.toHaveProperty("code", "run-and-claim-directories-overlap");
    } finally {Object.defineProperty(process, "platform", descriptor);}
  });

  it("rejects the original Notify or an arbitrary claim namespace without touching it", async () => {
    const f = await fixture(); await f.initialize();
    for (const name of ["notify-binding-repair-locks", "other-locks"]) {
      const locks = path.join(f.base, ".firebase", name);
      await expect(f.open({lockDirectory: locks})).rejects.toHaveProperty("code", "invalid-claim-directory-namespace");
      await expect(fs.lstat(locks)).rejects.toHaveProperty("code", "ENOENT");
    }
  });
});

describe("append-only verification", () => {
  it("writes distinct durable private records without clearing the claim", async () => {
    const f = await fixture(); await claimAndIntent(f);
    const out = await Promise.all([persistVerification({runDirectory: f.runDirectory, verification: {status: "PENDING"}}),
      persistVerification({runDirectory: f.runDirectory, verification: {status: "PASS"}})]);
    expect(new Set(out.map(v => v.name)).size).toBe(2);
    for (const value of out) {
      expect(value.name).toMatch(/^verification-[a-f0-9-]{36}\.json$/); expect(value.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((await fs.stat(path.join(f.runDirectory, value.name))).mode & 0o7777).toBe(0o600);
      expect(Object.keys(value).sort()).toEqual(["name", "runDirectory", "sha256"]);
    }
    expect(await fs.lstat(path.join(f.lockDirectory, "sodc-web.json"))).toBeTruthy();
  });

  it("refuses an unrelated private directory and sanitizes disk/close errors", async () => {
    const f = await fixture();
    await expect(persistVerification({runDirectory: f.base, verification: {status: "PASS"}})).rejects.toHaveProperty("code", "private-record-read-failed");
    await f.initialize();
    spyOpen((handle, file) => {
      if (file === path.join(f.runDirectory, "proposal.json")) {
        const close = handle.close.bind(handle); vi.spyOn(handle, "close").mockImplementation(async () => {await close(); throw new Error("PRIVATE_DISK_MESSAGE");});
      } return handle;
    });
    await expect(loadRunDirectory({runDirectory: f.runDirectory})).rejects.toThrow(/^Dev Stripe webhook repair blocked: private-record-read-failed\.$/);
  });
});
