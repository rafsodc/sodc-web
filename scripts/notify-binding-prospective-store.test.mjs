import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {createHash} from "node:crypto";
import {afterEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {
  initializeBindingEvidenceDirectory,
  readBindingEvidenceCapture,
  readProspectiveJsonInput,
  readProspectiveOperationRecords,
  initializeProspectiveEvidenceDirectory,
} from "./notify-secret-binding-repair-store.mjs";

const directories = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, {recursive: true, force: true})));
});

async function fixture() {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "notify-prospective-store-")));
  await fs.chmod(base, 0o700); directories.push(base);
  return {base, capture: path.join(base, "capture"), output: path.join(base, "output"), records: path.join(base, "records")};
}
const captureReport = () => ({schemaVersion: "sodc-notify-binding-capture/v1", status: "CAPTURED_OBSERVATION_NOT_APPROVAL",
  projectId: "sodc-web-production", readOnly: true, observationOnly: true, productionAuthorized: false,
  releaseAuthorized: false, originalContractAccepted: false});
const prospectiveReport = () => ({schemaVersion: "sodc-notify-binding-prospective/v1", status: "BEFORE_MATCHES_REVIEW_REQUIRED",
  readOnly: true, productionAuthorized: false, releaseAuthorized: false, originalContractAccepted: false});
async function privateJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  await fs.chmod(file, 0o600);
}
async function captureFixture() {
  const f = await fixture(), report = captureReport(), comparisonKey = Buffer.alloc(32, 0x43);
  await initializeBindingEvidenceDirectory(f.capture, {report, comparisonKey});
  return {...f, report, comparisonKey};
}
async function fileState(directory) {
  const result = {};
  for (const name of (await fs.readdir(directory)).sort()) {
    const file = path.join(directory, name), stat = await fs.lstat(file);
    result[name] = {mode: stat.mode & 0o7777, size: stat.size, mtimeMs: stat.mtimeMs,
      sha256: createHash("sha256").update(await fs.readFile(file)).digest("hex")};
  }
  return result;
}
function spyOpen(transform) {
  const original = fs.open.bind(fs);
  return vi.spyOn(fs, "open").mockImplementation(async (...args) => transform(await original(...args), ...args));
}

describe("prospective capture reader", () => {
  it("returns only an initialized capture and its synthetic key without writing any file", async () => {
    const f = await captureFixture(), before = await fileState(f.capture), open = vi.spyOn(fs, "open");
    const loaded = await readBindingEvidenceCapture(f.capture);
    expect(loaded).toEqual({report: f.report, comparisonKey: f.comparisonKey});
    expect(await fileState(f.capture)).toEqual(before);
    expect(open).toHaveBeenCalled();
    for (const [, flags] of open.mock.calls) {
      expect(flags & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
      expect(flags & (constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC)).toBe(0);
    }
    expect((await fs.readdir(f.base)).sort()).toEqual(["capture"]);
  });

  it.each(["schema", "report-schema", "digest", "key-present", "extra", "missing"])("rejects a malformed capture marker: %s", async change => {
    const f = await captureFixture(), file = path.join(f.capture, "initialized.json");
    const marker = JSON.parse(await fs.readFile(file, "utf8"));
    if (change === "schema") marker.schemaVersion = "other";
    if (change === "report-schema") marker.reportSchemaVersion = "sodc-notify-binding-reconciliation/v1";
    if (change === "digest") marker.reportSha256 = "0".repeat(64);
    if (change === "key-present") marker.comparisonKeyPresent = false;
    if (change === "extra") marker.extra = true;
    if (change === "missing") delete marker.reportSha256;
    await privateJson(file, marker);
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", "invalid-prospective-capture-initialization");
  });

  it("rejects a changed report even if its JSON and private file checks remain valid", async () => {
    const f = await captureFixture();
    await privateJson(path.join(f.capture, "report.json"), {...f.report, observationOnly: false});
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", "invalid-prospective-capture-initialization");
  });

  it("rejects malformed capture JSON before returning a comparison key", async () => {
    const f = await captureFixture();
    await fs.writeFile(path.join(f.capture, "report.json"), "PRIVATE_CAPTURE_INVALID_JSON");
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", "malformed-private-json-record");
  });

  it.each(["initialized.json", "report.json", "comparison.key"])("does not repair a missing %s", async name => {
    const f = await captureFixture(); await fs.unlink(path.join(f.capture, name));
    const before = (await fs.readdir(f.capture)).sort();
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", "private-record-read-failed");
    expect((await fs.readdir(f.capture)).sort()).toEqual(before);
  });

  it.each([[31, "invalid-comparison-key-file"], [33, "private-record-too-large"]])("rejects a %i-byte key", async (size, code) => {
    const f = await captureFixture(); await fs.writeFile(path.join(f.capture, "comparison.key"), Buffer.alloc(size, 0x43));
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", code);
  });

  it.each(["mode", "symlink", "hardlink", "owner"])("rejects an unsafe private comparison key: %s", async change => {
    const f = await captureFixture(), key = path.join(f.capture, "comparison.key");
    if (change === "mode") await fs.chmod(key, 0o640);
    if (change === "hardlink") await fs.link(key, path.join(f.base, "linked-key"));
    if (change === "symlink") {
      const outside = path.join(f.base, "outside-key"); await fs.rename(key, outside); await fs.symlink(outside, key);
    }
    if (change === "owner") spyOpen((handle, name) => {
      if (name === key) {
        const stat = handle.stat.bind(handle);
        vi.spyOn(handle, "stat").mockImplementation(async () => {const value = await stat(); value.uid += 1; return value;});
      }
      return handle;
    });
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", "private-regular-file-required");
  });

  it("rejects a readable capture directory and an alias of a valid capture", async () => {
    const f = await captureFixture();
    await fs.chmod(f.capture, 0o750);
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", "private-directory-required");
    await fs.chmod(f.capture, 0o700); const alias = path.join(f.base, "alias"); await fs.symlink(f.capture, alias);
    await expect(readBindingEvidenceCapture(alias)).rejects.toHaveProperty("code", "unsafe-private-directory-ancestor");
  });

  it("leaves a missing capture directory absent", async () => {
    const f = await fixture();
    await expect(readBindingEvidenceCapture(f.capture)).rejects.toHaveProperty("code", "private-record-read-failed");
    expect(await fs.readdir(f.base)).toEqual([]);
  });
});

describe("private prospective inputs and operation records", () => {
  it("reads a private JSON input using read-only NOFOLLOW opens and leaves bytes unchanged", async () => {
    const f = await fixture(), file = path.join(f.base, "review-policy.json"), value = {review: "synthetic", accepted: false};
    await privateJson(file, value); const before = await fileState(f.base), open = vi.spyOn(fs, "open");
    expect(await readProspectiveJsonInput(file)).toEqual(value);
    expect(await fileState(f.base)).toEqual(before);
    expect(open).toHaveBeenCalled();
    for (const [, flags] of open.mock.calls) {
      expect(flags & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
      expect(flags & (constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC)).toBe(0);
    }
  });

  it.each(["relative", "traversal", "suffix", "basename"])("rejects a noncanonical JSON input path: %s", async change => {
    const f = await fixture();
    const file = {relative: "./review.json", traversal: `${f.base}/other/../review.json`, suffix: `${f.base}/review.txt`, basename: `${f.base}/review policy.json`}[change];
    await expect(readProspectiveJsonInput(file)).rejects.toHaveProperty("code", "invalid-prospective-input-path");
    expect(await fs.readdir(f.base)).toEqual([]);
  });

  it.each(["mode", "symlink", "hardlink", "directory", "malformed", "oversized"])("fails closed for an unsafe JSON input: %s", async change => {
    const f = await fixture(), file = path.join(f.base, "review.json"); await privateJson(file, {review: true});
    let code = "private-regular-file-required";
    if (change === "mode") await fs.chmod(file, 0o644);
    if (change === "hardlink") await fs.link(file, path.join(f.base, "second.json"));
    if (change === "symlink") {const outside = path.join(f.base, "outside.json"); await fs.rename(file, outside); await fs.symlink(outside, file);}
    if (change === "directory") {await fs.unlink(file); await fs.mkdir(file, {mode: 0o700});}
    if (change === "malformed") {await fs.writeFile(file, "PRIVATE_BAD_JSON"); code = "malformed-private-json-record";}
    if (change === "oversized") {await fs.writeFile(file, Buffer.alloc(2 * 1024 * 1024 + 1)); code = "private-record-too-large";}
    await expect(readProspectiveJsonInput(file)).rejects.toHaveProperty("code", code);
  });

  it.each(["file", "directory"])("does not create a missing input %s", async kind => {
    const f = await fixture(), file = kind === "file" ? path.join(f.base, "missing.json") : path.join(f.records, "missing.json");
    await expect(readProspectiveJsonInput(file)).rejects.toHaveProperty("code", "private-record-read-failed");
    expect(await fs.readdir(f.base)).toEqual([]);
  });

  it("reads only fixed intent and acknowledgement records, without touching unrelated files or a key", async () => {
    const f = await fixture(); await fs.mkdir(f.records, {mode: 0o700});
    const intent = {startedAt: "2026-11-26T12:00:00.000Z"}, acknowledgement = {name: "synthetic-operation"};
    await privateJson(path.join(f.records, "intent.json"), intent); await privateJson(path.join(f.records, "operation.json"), acknowledgement);
    await fs.writeFile(path.join(f.records, "comparison.key"), Buffer.alloc(32, 0x71), {mode: 0o600});
    const before = await fileState(f.records), open = vi.spyOn(fs, "open");
    expect(await readProspectiveOperationRecords(f.records)).toEqual({intent, acknowledgement});
    expect(open.mock.calls.map(([name]) => path.basename(name))).toEqual(["intent.json", "operation.json"]);
    expect(await fileState(f.records)).toEqual(before);
  });

  it.each(["intent.json", "operation.json"])("rejects missing %s rather than returning an inferred acknowledgement", async missing => {
    const f = await fixture(); await fs.mkdir(f.records, {mode: 0o700});
    await privateJson(path.join(f.records, missing === "intent.json" ? "operation.json" : "intent.json"), {fixture: true});
    const before = await fileState(f.records);
    await expect(readProspectiveOperationRecords(f.records)).rejects.toHaveProperty("code", "private-record-read-failed");
    expect(await fileState(f.records)).toEqual(before);
  });

  it.each(["intent.json", "operation.json"])("requires private mode for %s", async name => {
    const f = await fixture(); await fs.mkdir(f.records, {mode: 0o700});
    for (const record of ["intent.json", "operation.json"]) await privateJson(path.join(f.records, record), {fixture: true});
    await fs.chmod(path.join(f.records, name), 0o644);
    await expect(readProspectiveOperationRecords(f.records)).rejects.toHaveProperty("code", "private-regular-file-required");
  });

  it("does not create a missing operation directory", async () => {
    const f = await fixture();
    await expect(readProspectiveOperationRecords(f.records)).rejects.toHaveProperty("code", "private-record-read-failed");
    expect(await fs.readdir(f.base)).toEqual([]);
  });

  it("sanitizes a private read-close failure without revealing its original message", async () => {
    const f = await fixture(), file = path.join(f.base, "input.json"); await privateJson(file, {fixture: true});
    spyOpen((handle, name) => {
      if (name === file) {
        const close = handle.close.bind(handle);
        vi.spyOn(handle, "close").mockImplementation(async () => {await close(); throw new Error("PRIVATE_PROVIDER_OR_KEY_DETAIL");});
      }
      return handle;
    });
    await expect(readProspectiveJsonInput(file)).rejects.toThrow(/^Notify binding repair blocked: private-record-read-failed\.$/);
  });
});

describe("private prospective evidence initialization", () => {
  it("writes a private key-free report and marker, returning no authority or comparison key", async () => {
    const f = await fixture(), report = prospectiveReport();
    const result = await initializeProspectiveEvidenceDirectory(f.output, {report});
    expect(result).toEqual({outputDirectory: f.output, reportSha256: digest(report), comparisonKeyPresent: false});
    expect((await fs.stat(f.output)).mode & 0o7777).toBe(0o700);
    expect((await fs.readdir(f.output)).sort()).toEqual(["initialized.json", "report.json"]);
    for (const name of ["report.json", "initialized.json"]) expect((await fs.stat(path.join(f.output, name))).mode & 0o7777).toBe(0o600);
    expect(JSON.parse(await fs.readFile(path.join(f.output, "report.json"), "utf8"))).toEqual(report);
    expect(JSON.parse(await fs.readFile(path.join(f.output, "initialized.json"), "utf8"))).toEqual({
      schemaVersion: "sodc-notify-binding-prospective-private-run/v1", reportSchemaVersion: report.schemaVersion,
      reportSha256: digest(report), comparisonKeyPresent: false,
    });
    await expect(fs.lstat(path.join(f.output, "comparison.key"))).rejects.toHaveProperty("code", "ENOENT");
    expect(report.productionAuthorized).toBe(false); expect(report.releaseAuthorized).toBe(false); expect(report.originalContractAccepted).toBe(false);
  });

  it.each([
    ["schemaVersion", "sodc-notify-binding-capture/v1"], ["readOnly", false], ["readOnly", undefined],
    ["productionAuthorized", true], ["productionAuthorized", undefined], ["releaseAuthorized", true],
    ["releaseAuthorized", undefined], ["originalContractAccepted", true], ["originalContractAccepted", undefined],
  ])("rejects an unsafe authority/schema flag %s=%s before creating output", async (field, value) => {
    const f = await fixture(), report = {...prospectiveReport(), [field]: value};
    await expect(initializeProspectiveEvidenceDirectory(f.output, {report})).rejects.toHaveProperty("code", "invalid-prospective-report");
    expect(await fs.readdir(f.base)).toEqual([]);
  });

  it.each([
    ["undefined", undefined], ["array", []],
    ["comparison-key", {report: prospectiveReport(), comparisonKey: Buffer.alloc(32)}],
    ["unknown-field", {report: prospectiveReport(), extra: true}],
  ])("rejects unsupported %s options without creating output", async (_shape, options) => {
    const f = await fixture();
    await expect(initializeProspectiveEvidenceDirectory(f.output, options)).rejects.toHaveProperty("code", "invalid-prospective-report-options");
    expect(await fs.readdir(f.base)).toEqual([]);
  });

  it("durably writes the report before the final exclusive initialization marker", async () => {
    const f = await fixture(), events = [], created = [];
    spyOpen((handle, file, flags) => {
      const name = path.basename(file);
      if ((flags & constants.O_CREAT) !== 0) {events.push(`open:${name}`); created.push({name, flags});}
      const sync = handle.sync.bind(handle);
      vi.spyOn(handle, "sync").mockImplementation(async () => {await sync(); events.push(`sync:${name}`);});
      return handle;
    });
    await initializeProspectiveEvidenceDirectory(f.output, {report: prospectiveReport()});
    expect(created.map(x => x.name)).toEqual(["report.json", "initialized.json"]);
    for (const {flags} of created) {
      for (const required of [constants.O_WRONLY, constants.O_CREAT, constants.O_EXCL, constants.O_NOFOLLOW]) expect(flags & required).toBe(required);
    }
    expect(events.indexOf("sync:report.json")).toBeGreaterThan(-1);
    expect(events.indexOf("sync:report.json")).toBeLessThan(events.indexOf("open:initialized.json"));
    expect(events.slice(events.indexOf("sync:report.json") + 1, events.indexOf("open:initialized.json"))).toContain("sync:output");
    expect(events.lastIndexOf("sync:output")).toBeGreaterThan(events.indexOf("sync:initialized.json"));
  });

  it("captures report bytes and digest before asynchronous filesystem work", async () => {
    const f = await fixture(), report = prospectiveReport(), original = structuredClone(report);
    const pending = initializeProspectiveEvidenceDirectory(f.output, {report}); report.productionAuthorized = true; report.status = "MUTATED_BY_CALLER";
    const result = await pending;
    expect(JSON.parse(await fs.readFile(path.join(f.output, "report.json"), "utf8"))).toEqual(original);
    expect(result.reportSha256).toBe(digest(original));
  });

  it("refuses an existing evidence directory without replacing its bytes", async () => {
    const f = await fixture(); await initializeProspectiveEvidenceDirectory(f.output, {report: prospectiveReport()});
    const before = await fileState(f.output);
    await expect(initializeProspectiveEvidenceDirectory(f.output, {report: {...prospectiveReport(), status: "DIFFERENT"}}))
      .rejects.toHaveProperty("code", "evidence-directory-already-exists");
    expect(await fileState(f.output)).toEqual(before);
  });

  it("permits only one concurrent initializer", async () => {
    const f = await fixture(), report = prospectiveReport();
    const outcomes = await Promise.allSettled([
      initializeProspectiveEvidenceDirectory(f.output, {report}), initializeProspectiveEvidenceDirectory(f.output, {report}),
    ]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find(x => x.status === "rejected").reason.code).toBe("evidence-directory-already-exists");
    expect(JSON.parse(await fs.readFile(path.join(f.output, "initialized.json"), "utf8"))).toHaveProperty("comparisonKeyPresent", false);
  });

  it("keeps a failed report sync incomplete and refuses to reuse that directory", async () => {
    const f = await fixture();
    spyOpen((handle, file) => {
      if (file === path.join(f.output, "report.json")) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_FSYNC_DETAIL"));
      return handle;
    });
    await expect(initializeProspectiveEvidenceDirectory(f.output, {report: prospectiveReport()})).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    vi.restoreAllMocks();
    expect(await fs.readdir(f.output)).toEqual(["report.json"]);
    await expect(initializeProspectiveEvidenceDirectory(f.output, {report: prospectiveReport()})).rejects.toHaveProperty("code", "evidence-directory-already-exists");
  });

  it("does not write the marker when the report directory fsync fails", async () => {
    const f = await fixture();
    spyOpen((handle, file) => {
      if (file === f.output) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_DIRECTORY_SYNC_DETAIL"));
      return handle;
    });
    await expect(initializeProspectiveEvidenceDirectory(f.output, {report: prospectiveReport()})).rejects.toHaveProperty("code", "durable-local-record-write-failed");
    vi.restoreAllMocks();
    expect(await fs.readdir(f.output)).toEqual(["report.json"]);
  });

  it.each(["relative", "root", "traversal", "trailing"])("rejects a noncanonical output path: %s", async shape => {
    const f = await fixture(), output = {relative: "./output", root: "/", traversal: `${f.base}/nested/../output`, trailing: `${f.output}/`}[shape];
    await expect(initializeProspectiveEvidenceDirectory(output, {report: prospectiveReport()})).rejects.toHaveProperty("code", "invalid-private-directory-path");
    expect(await fs.readdir(f.base)).toEqual([]);
  });

  it("rejects a writable parent before creating the evidence directory", async () => {
    const f = await fixture(); await fs.chmod(f.base, 0o770);
    try {
      await expect(initializeProspectiveEvidenceDirectory(f.output, {report: prospectiveReport()})).rejects.toHaveProperty("code", "writable-private-directory-ancestor");
      expect(await fs.readdir(f.base)).toEqual([]);
    } finally {await fs.chmod(f.base, 0o700);}
  });

  it("rejects an output ancestor symlink", async () => {
    const f = await fixture(), actual = path.join(f.base, "actual"), alias = path.join(f.base, "alias");
    await fs.mkdir(actual, {mode: 0o700}); await fs.symlink(actual, alias);
    await expect(initializeProspectiveEvidenceDirectory(path.join(alias, "output"), {report: prospectiveReport()})).rejects.toHaveProperty("code", "unsafe-private-directory-ancestor");
    expect(await fs.readdir(actual)).toEqual([]);
  });
});
