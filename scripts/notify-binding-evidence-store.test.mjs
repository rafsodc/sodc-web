import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {createHash, randomBytes} from "node:crypto";
import {afterEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {prepareRepair} from "./notify-secret-binding-repair-lib.mjs";
import {initializeRunDirectory, openRepairStore, readRepairRunEvidence, initializeBindingEvidenceDirectory} from "./notify-secret-binding-repair-store.mjs";
import {fixture as protocolFixture, approved, NOW, OPERATION} from "./test-fixtures/notify-binding-repair-fixture.mjs";

const directories = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, {recursive: true, force: true})));
});
const json = async file => JSON.parse(await fs.readFile(file, "utf8"));
async function setup({initialize = true, claim = true, records = true} = {}) {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "notify-binding-evidence-store-"))); directories.push(base);
  const runDirectory = path.join(base, "original"), lockDirectory = path.join(base, "locks"), outputDirectory = path.join(base, "evidence");
  const comparisonKey = randomBytes(32), f = protocolFixture();
  const proposal = prepareRepair({environment: "dev", source: f.source, snapshot: f.snapshot, comparisonKey, now: NOW});
  const review = approved(proposal);
  const intent = {schemaVersion: proposal.schemaVersion, proposalSha256: digest(proposal), reviewSha256: digest(review),
    startedAt: new Date(NOW + 1000).toISOString()};
  const operation = {name: OPERATION};
  if (initialize) {
    await initializeRunDirectory(runDirectory, {proposal, comparisonKey});
    if (claim) {
      const store = await openRepairStore({runDirectory, lockDirectory, proposal});
      await store.writeOnce("intent.json", intent);
      if (records) {
        await fs.writeFile(path.join(runDirectory, "review.json"), JSON.stringify(review), {mode: 0o600});
        await store.writeOnce("operation.json", operation);
      }
    }
  }
  return {base, runDirectory, lockDirectory, outputDirectory, comparisonKey, proposal, review, intent, operation,
    read: () => readRepairRunEvidence({runDirectory, lockDirectory})};
}
async function snapshot(directory) {
  const result = {};
  async function visit(current) {
    for (const name of (await fs.readdir(current)).sort()) {
      const file = path.join(current, name), stat = await fs.lstat(file), relative = path.relative(directory, file);
      result[relative] = {mode: stat.mode & 0o7777, size: stat.size, modified: stat.mtimeMs};
      if (stat.isDirectory()) await visit(file);
      else result[relative].sha256 = createHash("sha256").update(await fs.readFile(file)).digest("hex");
    }
  }
  await visit(directory);
  return result;
}
function report(kind) {
  // Shape validation belongs to the evidence core; these test private IO only.
  return {schemaVersion: `sodc-notify-binding-${kind}/v1`, projectId: "sodc-web",
    status: kind === "capture" ? "CAPTURED_NOT_AUTHORIZATION" : "REVIEW_REQUIRED_WITH_HISTORICAL_GAPS"};
}
function spyOpen(transform) {
  const open = fs.open.bind(fs);
  return vi.spyOn(fs, "open").mockImplementation(async (...args) => transform(await open(...args), ...args));
}

describe("read-only original repair evidence", () => {
  it("reads the original records and private key without changing any original file or directory", async () => {
    const f = await setup(), before = await snapshot(f.base);
    const opened = [];
    spyOpen((handle, name, flags) => {opened.push({name, flags}); return handle;});
    const mkdir = vi.spyOn(fs, "mkdir").mockRejectedValue(new Error("MUST_NOT_CREATE"));
    const write = vi.spyOn(fs, "writeFile").mockRejectedValue(new Error("MUST_NOT_WRITE"));
    const value = await f.read();
    expect(value).toEqual({proposal: f.proposal, comparisonKey: f.comparisonKey, review: f.review, intent: f.intent,
      operation: f.operation, claim: {schemaVersion: "sodc-notify-binding-repair-target-lock/v1", proposalSha256: digest(f.proposal),
        projectId: f.proposal.projectId, target: f.proposal.target, runDirectory: f.runDirectory}});
    expect(mkdir).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(opened.length).toBeGreaterThan(0);
    for (const {flags} of opened) expect(flags & (constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC | constants.O_APPEND)).toBe(0);
    expect(await snapshot(f.base)).toEqual(before);
    expect(Object.keys(value).sort()).toEqual(["claim", "comparisonKey", "intent", "operation", "proposal", "review"]);
  });

  it.each(["review.json", "intent.json", "operation.json"])("returns null for the missing optional %s and never recreates it", async name => {
    const f = await setup(); await fs.unlink(path.join(f.runDirectory, name));
    const before = await snapshot(f.base), value = await f.read();
    expect(value[name.split(".")[0]]).toBeNull();
    expect(await snapshot(f.base)).toEqual(before);
  });

  it("refuses missing original directories without creating them", async () => {
    const f = await setup({initialize: false});
    await expect(f.read()).rejects.toThrow("Notify binding repair blocked");
    await expect(fs.lstat(f.runDirectory)).rejects.toHaveProperty("code", "ENOENT");
    await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("refuses a missing lock directory without creating it or claiming the project", async () => {
    const f = await setup({claim: false}), before = await snapshot(f.base);
    await expect(f.read()).rejects.toThrow("Notify binding repair blocked");
    expect(await snapshot(f.base)).toEqual(before);
    await expect(fs.lstat(f.lockDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it.each(["missing", "run directory", "proposal", "project", "target", "extra field"])("refuses an original project claim with %s mismatch", async kind => {
    const f = await setup(), file = path.join(f.lockDirectory, "sodc-web.json");
    const value = await json(file);
    if (kind === "missing") await fs.unlink(file);
    else {
      if (kind === "run directory") value.runDirectory += "-copy";
      if (kind === "proposal") value.proposalSha256 = "0".repeat(64);
      if (kind === "project") value.projectId = "sodc-web-production";
      if (kind === "target") value.target += "Other";
      if (kind === "extra field") value.ignored = true;
      await fs.writeFile(file, JSON.stringify(value));
    }
    const before = await snapshot(f.base);
    await expect(f.read()).rejects.toHaveProperty("code", "missing-or-invalid-original-project-claim");
    expect(await snapshot(f.base)).toEqual(before);
  });

  it.each(["marker", "claim mode", "key mode", "claim hard link", "claim symlink"])("retains original private-file checks: %s", async kind => {
    const f = await setup(), claim = path.join(f.lockDirectory, "sodc-web.json");
    if (kind === "marker") await fs.unlink(path.join(f.runDirectory, "initialized.json"));
    if (kind === "claim mode") await fs.chmod(claim, 0o640);
    if (kind === "key mode") await fs.chmod(path.join(f.runDirectory, "comparison.key"), 0o640);
    if (kind === "claim hard link") await fs.link(claim, path.join(f.base, "claim-copy"));
    if (kind === "claim symlink") {await fs.rename(claim, path.join(f.base, "claim-copy")); await fs.symlink(path.join(f.base, "claim-copy"), claim);}
    await expect(f.read()).rejects.toThrow("Notify binding repair blocked");
  });

  it("sanitizes malformed optional records without exposing their contents", async () => {
    const f = await setup(); await fs.writeFile(path.join(f.runDirectory, "review.json"), "PRIVATE_BAD_REVIEW_CONTENT");
    await expect(f.read()).rejects.toThrow(/^Notify binding repair blocked: malformed-private-json-record\.$/);
  });
});

describe("new private binding evidence directories", () => {
  it.each(["capture", "reconciliation"])("creates only the private %s evidence and returns no key or report contents", async kind => {
    const f = await setup(), value = report(kind), key = randomBytes(32), before = await snapshot(f.runDirectory);
    const result = await initializeBindingEvidenceDirectory(f.outputDirectory, kind === "capture" ? {report: value, comparisonKey: key} : {report: value});
    expect(result).toEqual({outputDirectory: f.outputDirectory, reportSha256: digest(value), comparisonKeyPresent: kind === "capture"});
    expect((await fs.stat(f.outputDirectory)).mode & 0o7777).toBe(0o700);
    const names = (await fs.readdir(f.outputDirectory)).sort();
    expect(names).toEqual(kind === "capture" ? ["comparison.key", "initialized.json", "report.json"] : ["initialized.json", "report.json"]);
    for (const name of names) expect((await fs.stat(path.join(f.outputDirectory, name))).mode & 0o7777).toBe(0o600);
    expect(await json(path.join(f.outputDirectory, "report.json"))).toEqual(value);
    expect(await json(path.join(f.outputDirectory, "initialized.json"))).toEqual({schemaVersion: "sodc-notify-binding-evidence-private-run/v1",
      reportSchemaVersion: value.schemaVersion, reportSha256: digest(value), comparisonKeyPresent: kind === "capture"});
    if (kind === "capture") expect(await fs.readFile(path.join(f.outputDirectory, "comparison.key"))).toEqual(key);
    expect(JSON.stringify(result)).not.toContain(key.toString("hex"));
    expect(JSON.stringify(result)).not.toContain(key.toString("base64"));
    expect(await snapshot(f.runDirectory)).toEqual(before);
  });

  it.each([undefined, null, Buffer.alloc(32)])("forbids a comparisonKey option on reconciliation even when it is %j", async comparisonKey => {
    const f = await setup();
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("reconciliation"), comparisonKey}))
      .rejects.toHaveProperty("code", "comparison-key-forbidden-for-reconciliation");
    await expect(fs.lstat(f.outputDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it.each([undefined, null, "a".repeat(64), Buffer.alloc(0), Buffer.alloc(31), Buffer.alloc(33)])("requires a new 32-byte capture key", async comparisonKey => {
    const f = await setup();
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("capture"), comparisonKey}))
      .rejects.toHaveProperty("code", "invalid-comparison-key");
    await expect(fs.lstat(f.outputDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("refuses missing capture key options and unsupported schemas before creating output", async () => {
    const f = await setup();
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("capture")}))
      .rejects.toHaveProperty("code", "invalid-binding-capture-options");
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: {schemaVersion: "sodc-notify-binding-repair/v1"}}))
      .rejects.toHaveProperty("code", "unsupported-binding-evidence-schema");
    await expect(fs.lstat(f.outputDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("captures the report and key before any asynchronous filesystem wait", async () => {
    const f = await setup(), value = report("capture"), original = structuredClone(value), key = randomBytes(32), originalKey = Buffer.from(key);
    const mkdir = fs.mkdir.bind(fs);
    vi.spyOn(fs, "mkdir").mockImplementation(async (...args) => {
      const result = await mkdir(...args);
      if (args[0] === f.outputDirectory) {key.fill(0); value.status = "PRIVATE_CHANGED_AFTER_START";}
      return result;
    });
    const result = await initializeBindingEvidenceDirectory(f.outputDirectory, {report: value, comparisonKey: key});
    expect(await fs.readFile(path.join(f.outputDirectory, "comparison.key"))).toEqual(originalKey);
    expect(await json(path.join(f.outputDirectory, "report.json"))).toEqual(original);
    expect(result.reportSha256).toBe(digest(original));
  });

  it("never overwrites an original repair run or existing evidence directory", async () => {
    const f = await setup(), before = await snapshot(f.runDirectory);
    await expect(initializeBindingEvidenceDirectory(f.runDirectory, {report: report("reconciliation")}))
      .rejects.toHaveProperty("code", "evidence-directory-already-exists");
    expect(await snapshot(f.runDirectory)).toEqual(before);
    await initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("reconciliation")});
    const output = await snapshot(f.outputDirectory);
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("capture"), comparisonKey: randomBytes(32)}))
      .rejects.toHaveProperty("code", "evidence-directory-already-exists");
    expect(await snapshot(f.outputDirectory)).toEqual(output);
  });

  it("allows only one initialization of a new output directory", async () => {
    const f = await setup(), attempts = await Promise.allSettled([
      initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("capture"), comparisonKey: randomBytes(32)}),
      initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("capture"), comparisonKey: randomBytes(32)}),
    ]);
    expect(attempts.filter(value => value.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(value => value.status === "rejected")[0].reason.code).toBe("evidence-directory-already-exists");
  });

  it.each(["relative", "traversal", "trailing", "root"])("rejects a noncanonical output directory: %s", async kind => {
    const f = await setup(), directory = {relative: "relative", traversal: `${f.base}/nested/../evidence`, trailing: `${f.outputDirectory}/`, root: "/"}[kind];
    await expect(initializeBindingEvidenceDirectory(directory, {report: report("reconciliation")}))
      .rejects.toHaveProperty("code", "invalid-private-directory-path");
    await expect(fs.lstat(f.outputDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("does not follow an output ancestor symlink", async () => {
    const f = await setup(), alias = path.join(f.base, "alias"); await fs.symlink(f.base, alias);
    await expect(initializeBindingEvidenceDirectory(path.join(alias, "evidence"), {report: report("reconciliation")}))
      .rejects.toHaveProperty("code", "unsafe-private-directory-ancestor");
    await expect(fs.lstat(f.outputDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });

  it("rejects a writable output parent without creating records", async () => {
    const f = await setup(); await fs.chmod(f.base, 0o770);
    try {
      await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("reconciliation")}))
        .rejects.toHaveProperty("code", "writable-private-directory-ancestor");
      await expect(fs.lstat(f.outputDirectory)).rejects.toHaveProperty("code", "ENOENT");
    } finally {await fs.chmod(f.base, 0o700);}
  });

  it("writes the marker only after report/key and directory entries are synced", async () => {
    const f = await setup(), events = [];
    spyOpen((handle, name, flags) => {
      if ((flags & constants.O_CREAT) !== 0) events.push(`open:${path.basename(name)}`);
      const sync = handle.sync.bind(handle);
      vi.spyOn(handle, "sync").mockImplementation(async () => {await sync();events.push(`sync:${path.basename(name)}`);});
      return handle;
    });
    await initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("capture"), comparisonKey: randomBytes(32)});
    expect(events.indexOf("sync:report.json")).toBeGreaterThan(-1);
    expect(events.indexOf("sync:report.json")).toBeLessThan(events.indexOf("open:comparison.key"));
    expect(events.indexOf("sync:comparison.key")).toBeLessThan(events.indexOf("open:initialized.json"));
    const marker = events.indexOf("open:initialized.json");
    expect(events.slice(0, marker).filter(event => event === "sync:evidence")).toHaveLength(2);
    expect(events.at(-1)).toBe("sync:evidence");
  });

  it.each(["report.json", "comparison.key"])("fails closed before the marker on %s fsync failure", async name => {
    const f = await setup();
    spyOpen((handle, file) => {
      if (file === path.join(f.outputDirectory, name)) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_OUTPUT_FSYNC_ERROR"));
      return handle;
    });
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("capture"), comparisonKey: randomBytes(32)}))
      .rejects.toThrow(/^Notify binding repair blocked: durable-local-record-write-failed\.$/);
    vi.restoreAllMocks();
    await expect(fs.lstat(path.join(f.outputDirectory, "initialized.json"))).rejects.toHaveProperty("code", "ENOENT");
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: report("reconciliation")}))
      .rejects.toHaveProperty("code", "evidence-directory-already-exists");
  });

  it("rejects oversized output before creating its directory", async () => {
    const f = await setup();
    await expect(initializeBindingEvidenceDirectory(f.outputDirectory, {report: {...report("reconciliation"), oversized: "x".repeat(2 * 1024 * 1024)}}))
      .rejects.toHaveProperty("code", "local-json-record-too-large");
    await expect(fs.lstat(f.outputDirectory)).rejects.toHaveProperty("code", "ENOENT");
  });
});
