import fs from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {PROJECT, TARGET_NAME, EXPECTED_REQUEST, REVIEWED_VERIFIER_COMMIT} from "./production-notify-once-lib.mjs";
import {initializeProductionOperatorRun, readProspectiveJsonInput} from "./notify-secret-binding-repair-store.mjs";
import {parsePrepareProductionArguments, runPrepareProductionNotifyOnce, runPrepareProductionNotifyCommand} from "./prepare-production-notify-once.mjs";

const temporary = [], clone = value => structuredClone(value), NOW = Date.parse("2026-11-26T18:00:00.000Z");
const flags = {"--verifier-root": "verifierRoot", "--source-root": "sourceRoot", "--capture-dir": "captureDirectory", "--limits-baseline": "limitsBaselineFile",
  "--check-output-dir": "checkOutputDirectory", "--before-output-dir": "beforeOutputDirectory", "--run-dir": "runDirectory"};
const args = options => Object.entries(flags).flatMap(([flag, name]) => [flag, options[name]]);
async function privateJson(file, value) {await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600}); await fs.chmod(file, 0o600);}
async function json(file) {return JSON.parse(await fs.readFile(file, "utf8"));}
async function fixture() {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "production-notify-prepare-"))); temporary.push(base); await fs.chmod(base, 0o700);
  const root = path.join(base, "operator"), legacyLocks = path.join(base, "locks/notify-binding-repair-locks");
  const options = {verifierRoot: path.join(base, "verifier"), sourceRoot: path.join(base, "application"), captureDirectory: path.join(base, "capture"),
    limitsBaselineFile: path.join(base, "inputs/limits.json"), checkOutputDirectory: path.join(base, "preparation-check"),
    beforeOutputDirectory: path.join(base, "future-before"), runDirectory: path.join(base, "operator-run")};
  for (const directory of [root, options.verifierRoot, options.sourceRoot, options.captureDirectory, path.dirname(options.limitsBaselineFile)]) await fs.mkdir(directory, {mode: 0o700});
  for (const directory of [root, options.verifierRoot, options.sourceRoot]) await privateJson(path.join(directory, ".firebaserc"), {projects: {prod: PROJECT}});
  const capture = {schemaVersion: "sodc-notify-binding-capture/v1", projectId: PROJECT, target: TARGET_NAME, observedAt: "2026-11-26T17:00:00.000Z",
    baseline: {project: {projectId: PROJECT, projectNumber: "688739640159"}, versions: Object.fromEntries(EXPECTED_REQUEST.body.serviceConfig.secretEnvironmentVariables
      .map(({secret, version}) => [secret, {secret, version, state: "ENABLED"}]))}, targetBindings: [clone(EXPECTED_REQUEST.body.serviceConfig.secretEnvironmentVariables[0])]};
  const limitsBaseline = {schemaVersion: "synthetic-complete-limits", functions: [{name: "synthetic", serviceMaximum: 1, revisionMaximum: 1}]};
  const source = {binding: {gitSha: "7".repeat(40), tree: "8".repeat(40), trackedSha256: "9".repeat(64), buildSha256: "a".repeat(64),
    manifestSha256: "b".repeat(64), sdk: {version: "7.2.5", binarySha256: "c".repeat(64), packageSha256: "d".repeat(64)}}, manifest: {endpoints: {}}};
  const operatorTool = {gitSha: "1".repeat(40), tree: "2".repeat(40), trackedSha256: "3".repeat(64), nodeMajor: 24};
  const verifierTool = {gitSha: REVIEWED_VERIFIER_COMMIT, tree: "5".repeat(40), trackedSha256: "6".repeat(64), nodeMajor: 24};
  await privateJson(path.join(options.captureDirectory, "report.json"), capture); await privateJson(options.limitsBaselineFile, limitsBaseline);
  const context = {captureReportSha256: digest(capture), limitsBaselineSha256: digest(limitsBaseline), requestSha256: digest(EXPECTED_REQUEST),
    sourceBindingSha256: digest(source.binding), comparisonToolBindingSha256: digest(verifierTool)};
  const state = {source, operatorTool, verifierTool, now: NOW, report: {schemaVersion: "sodc-notify-binding-prospective/v1", status: "BASELINE_MATCH", projectId: PROJECT,
    phase: "before", readOnly: true, providerWrites: 0, productionAuthorized: false, releaseAuthorized: false, originalContractAccepted: false, ...context}};
  const deps = {readJson: vi.fn(readProspectiveJsonInput), readTool: vi.fn(async directory => clone(directory === root ? state.operatorTool : state.verifierTool)),
    readSource: vi.fn(async () => clone(state.source)), legacyLockDirectory: vi.fn(() => legacyLocks), readClaims: vi.fn(async () => []),
    initialize: vi.fn(initializeProductionOperatorRun), now: () => state.now};
  deps.before = vi.fn(async () => {
    await fs.mkdir(options.checkOutputDirectory, {mode: 0o700}); await privateJson(path.join(options.checkOutputDirectory, "report.json"), state.report);
    return {status: state.report.status, reportPath: path.join(options.checkOutputDirectory, "report.json"), reportSha256: digest(state.report)};
  });
  return {base, root, options, legacyLocks, operatorLocks: path.join(path.dirname(legacyLocks), "production-notify-once-locks"), state, capture, limitsBaseline, context, deps,
    run: () => runPrepareProductionNotifyOnce(root, options, deps),
    command: (stdout = vi.fn(), stderr = vi.fn()) => runPrepareProductionNotifyCommand(args(options), {root, deps, stdout, stderr})};
}
beforeEach(() => {vi.stubGlobal("fetch", vi.fn(() => {throw new Error("UNEXPECTED_NETWORK_OR_MUTATION");}));});
afterEach(async () => {
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all(temporary.splice(0).map(directory => fs.rm(directory, {recursive: true, force: true})));}
});

describe("strict GET-only preparation arguments", () => {
  it("prints help without filesystem, provider, source, tool or initialization work", async () => {
    const blocked = vi.fn(() => {throw new Error("UNEXPECTED_IO");}), stdout = vi.fn(), stderr = vi.fn();
    expect(await runPrepareProductionNotifyCommand(["--help"], {root: "/missing", stdout, stderr,
      deps: {readJson: blocked, readSource: blocked, readTool: blocked, before: blocked, initialize: blocked, legacyLockDirectory: blocked}})).toBe(0);
    expect(blocked).not.toHaveBeenCalled(); expect(stderr).not.toHaveBeenCalled(); expect(stdout.mock.calls[0][0]).toContain("not Production authorization");
  });

  it.each(["missing", "duplicate", "unknown", "relative", "traversal", "trailing", "json-suffix", "flag-value", "mixed-help"])("rejects %s arguments before any provider", async shape => {
    const f = await fixture(), values = args(f.options);
    if (shape === "missing") values.pop();
    if (shape === "duplicate") values.push("--run-dir", f.options.runDirectory);
    if (shape === "unknown") values.push("--apply", "yes");
    if (shape === "relative") values[1] = "relative";
    if (shape === "traversal") values[1] += "/part/..";
    if (shape === "trailing") values[1] += "/";
    if (shape === "json-suffix") values[7] = path.join(f.base, "limits.txt");
    if (shape === "flag-value") values[1] = "--source-root";
    if (shape === "mixed-help") values.unshift("--help");
    expect(() => parsePrepareProductionArguments(values)).toThrow("invalid-production-preparation-arguments"); expect(f.deps.before).not.toHaveBeenCalled();
  });
});

describe("fresh baseline preparation without mutation authority", () => {
  it("uses the fresh pinned verifier and prepares four private unapproved files without keys or claims", async () => {
    const f = await fixture(), result = await f.run();
    expect(result).toMatchObject({status: "PREPARED_FOR_REVIEW_NOT_AUTHORIZED", providerWrites: 0, productionAuthorized: false, releaseAuthorized: false});
    expect(f.deps.before).toHaveBeenCalledExactlyOnceWith(f.options.verifierRoot, {phase: "before", captureDirectory: f.options.captureDirectory,
      sourceRoot: f.options.sourceRoot, limitsBaselineFile: f.options.limitsBaselineFile, outputDirectory: f.options.checkOutputDirectory});
    expect((await fs.readdir(f.options.runDirectory)).sort()).toEqual(["initialized.json", "plan.json", "request.json", "review-template.json"]);
    expect((await fs.stat(f.options.runDirectory)).mode & 0o7777).toBe(0o700);
    for (const name of await fs.readdir(f.options.runDirectory)) expect((await fs.stat(path.join(f.options.runDirectory, name))).mode & 0o7777).toBe(0o600);
    const plan = await json(result.planPath), review = await json(result.reviewTemplatePath);
    expect(plan.context).toEqual(f.context); expect(plan.request).toEqual(EXPECTED_REQUEST); expect(plan.createdAt).toBe(new Date(NOW).toISOString());
    expect(plan.paths.beforeOutputDirectory).toBe(f.options.beforeOutputDirectory); expect(plan.paths).not.toHaveProperty("checkOutputDirectory");
    expect(result.planSha256).toBe(digest(plan)); expect(review).toMatchObject({decision: "REVIEW_REQUIRED", reviewedAt: null, expiresAt: null,
      acceptUnprovenSourceAndExecutableEquality: false, acceptLiveApplicationMailEffect: false});
    expect(result.command).toEqual(["node", path.join(f.root, "scripts/production-notify-once.mjs"), "--run-dir", f.options.runDirectory]);
    for (const file of [f.options.beforeOutputDirectory, f.operatorLocks, f.legacyLocks]) await expect(fs.lstat(file)).rejects.toHaveProperty("code", "ENOENT");
    expect(f.deps.readJson.mock.calls.every(([file]) => file.endsWith("report.json") || file === f.options.limitsBaselineFile)).toBe(true);
    expect(f.deps.initialize).toHaveBeenCalledOnce();
  });

  it("does not expire or approve preparation records", async () => {
    const f = await fixture(); f.state.now = Date.parse("2027-01-01T00:00:00.000Z");
    const result = await f.run(), plan = await json(result.planPath);
    expect(plan.createdAt).toBe("2027-01-01T00:00:00.000Z"); expect(plan).not.toHaveProperty("expiresAt");
    expect((await json(result.reviewTemplatePath)).decision).toBe("REVIEW_REQUIRED");
  });

  it.each(["operator", "verifierRoot", "sourceRoot"])("requires the Production alias in %s before GET", async kind => {
    const f = await fixture(), directory = kind === "operator" ? f.root : f.options[kind];
    await privateJson(path.join(directory, ".firebaserc"), {projects: {prod: "sodc-web"}});
    await expect(f.run()).rejects.toThrow(); expect(f.deps.before).not.toHaveBeenCalled(); expect(f.deps.initialize).not.toHaveBeenCalled();
  });

  it("rejects an unreviewed verifier before GET", async () => {
    const f = await fixture(); f.state.verifierTool.gitSha = "f".repeat(40);
    await expect(f.run()).rejects.toHaveProperty("code", "production-preparation-verifier-not-reviewed"); expect(f.deps.before).not.toHaveBeenCalled();
  });

  it("rejects a different requested binding profile before GET", async () => {
    const f = await fixture(); f.capture.baseline.versions.GOV_NOTIFY_TEST_API_KEY.version = "3";
    await privateJson(path.join(f.options.captureDirectory, "report.json"), f.capture);
    await expect(f.run()).rejects.toHaveProperty("code", "production-preparation-request-mismatch"); expect(f.deps.before).not.toHaveBeenCalled();
  });

  it.each(["status", "path", "digest", "schema", "phase", "project", "readOnly", "providerWrites", "authorization", "context"])("rejects an invalid fresh before result: %s", async kind => {
    const f = await fixture(), original = f.deps.before.getMockImplementation();
    f.deps.before.mockImplementation(async (...values) => {
      if (kind === "status") f.state.report.status = "FAIL";
      if (kind === "schema") f.state.report.schemaVersion = "old";
      if (kind === "phase") f.state.report.phase = "after";
      if (kind === "project") f.state.report.projectId = "sodc-web";
      if (kind === "readOnly") f.state.report.readOnly = false;
      if (kind === "providerWrites") f.state.report.providerWrites = 1;
      if (kind === "authorization") f.state.report.productionAuthorized = true;
      if (kind === "context") f.state.report.limitsBaselineSha256 = "0".repeat(64);
      const result = await original(...values);
      if (kind === "path") result.reportPath = path.join(f.base, "different/report.json");
      if (kind === "digest") result.reportSha256 = "0".repeat(64);
      return result;
    });
    await expect(f.run()).rejects.toThrow(); expect(f.deps.initialize).not.toHaveBeenCalled();
    await expect(fs.lstat(f.options.runDirectory)).rejects.toHaveProperty("code", "ENOENT");
    expect(await fs.readdir(f.options.checkOutputDirectory)).toContain("report.json");
  });

  it.each(["capture", "limits", "source", "operator-tool", "verifier-tool"])("rejects %s drift after the GET wait", async kind => {
    const f = await fixture(), original = f.deps.before.getMockImplementation();
    f.deps.before.mockImplementation(async (...values) => {
      const result = await original(...values);
      if (kind === "capture") await privateJson(path.join(f.options.captureDirectory, "report.json"), {...f.capture, changed: true});
      if (kind === "limits") await privateJson(f.options.limitsBaselineFile, {...f.limitsBaseline, changed: true});
      if (kind === "source") f.state.source.binding.buildSha256 = "0".repeat(64);
      if (kind === "operator-tool") f.state.operatorTool.trackedSha256 = "0".repeat(64);
      if (kind === "verifier-tool") f.state.verifierTool.trackedSha256 = "0".repeat(64);
      return result;
    });
    await expect(f.run()).rejects.toHaveProperty("code", "production-preparation-inputs-changed"); expect(f.deps.initialize).not.toHaveBeenCalled();
  });

  it("rejects an alias change during the GET wait", async () => {
    const f = await fixture(), original = f.deps.before.getMockImplementation();
    f.deps.before.mockImplementation(async (...values) => {const result = await original(...values); await privateJson(path.join(f.options.sourceRoot, ".firebaserc"), {projects: {prod: "sodc-web"}}); return result;});
    await expect(f.run()).rejects.toThrow(); expect(f.deps.initialize).not.toHaveBeenCalled();
  });
});

describe("preparation output and claim boundaries", () => {
  it.each(["runDirectory", "beforeOutputDirectory", "checkOutputDirectory"])("rejects an existing %s before GET and keeps its data", async name => {
    const f = await fixture(); await fs.mkdir(f.options[name], {mode: 0o700}); await fs.writeFile(path.join(f.options[name], "keep"), "retained");
    await expect(f.run()).rejects.toHaveProperty("code", "production-preparation-output-already-exists");
    expect(f.deps.before).not.toHaveBeenCalled(); expect(await fs.readFile(path.join(f.options[name], "keep"), "utf8")).toBe("retained");
  });

  it.each(["runDirectory", "beforeOutputDirectory", "checkOutputDirectory"])("rejects %s inside capture before GET", async name => {
    const f = await fixture(); f.options[name] = path.join(f.options.captureDirectory, "nested-output");
    await expect(f.run()).rejects.toHaveProperty("code", "operator-path-overlaps-protected-input");
    expect(f.deps.before).not.toHaveBeenCalled(); expect(await fs.readdir(f.options.captureDirectory)).toEqual(["report.json"]);
  });

  it("rejects a symlink alias into the capture", async () => {
    const f = await fixture(), alias = path.join(f.base, "alias"); await fs.symlink(f.options.captureDirectory, alias);
    f.options.checkOutputDirectory = path.join(alias, "nested-output");
    await expect(f.run()).rejects.toHaveProperty("code", "operator-path-overlaps-protected-input"); expect(f.deps.before).not.toHaveBeenCalled();
  });

  it.each(["same", "parent", "child"])("rejects overlapping run/check outputs: %s", async shape => {
    const f = await fixture();
    if (shape === "same") f.options.checkOutputDirectory = f.options.runDirectory;
    if (shape === "parent") f.options.runDirectory = path.join(f.options.checkOutputDirectory, "run");
    if (shape === "child") f.options.checkOutputDirectory = path.join(f.options.runDirectory, "check");
    await expect(f.run()).rejects.toThrow(); expect(f.deps.before).not.toHaveBeenCalled();
  });

  it.each(["legacy", "new"])("blocks an existing %s Production claim without reading its content", async kind => {
    const f = await fixture(), directory = kind === "legacy" ? f.legacyLocks : f.operatorLocks;
    await fs.mkdir(directory, {recursive: true, mode: 0o700}); await fs.writeFile(path.join(directory, `${PROJECT}.json`), "CLAIM_CONTENT_MUST_NOT_BE_READ", {mode: 0o600});
    await expect(f.run()).rejects.toThrow(); expect(f.deps.before).not.toHaveBeenCalled();
    expect(f.deps.readJson.mock.calls.some(([file]) => file.includes("locks"))).toBe(false);
  });

  it("protects a new claim appearing while the GET comparison is pending", async () => {
    const f = await fixture(), original = f.deps.before.getMockImplementation();
    f.deps.before.mockImplementation(async (...values) => {const result = await original(...values); await fs.mkdir(f.operatorLocks, {recursive: true, mode: 0o700}); await fs.writeFile(path.join(f.operatorLocks, `${PROJECT}.json`), "new claim", {mode: 0o600}); return result;});
    await expect(f.run()).rejects.toHaveProperty("code", "production-preparation-output-already-exists"); expect(f.deps.initialize).not.toHaveBeenCalled();
  });

  it("retains newly protected original run paths from the second boundary check", async () => {
    const f = await fixture(); f.deps.readClaims.mockResolvedValueOnce([]).mockResolvedValue([path.join(f.options.runDirectory, "newly-claimed")]);
    await expect(f.run()).rejects.toHaveProperty("code", "operator-path-overlaps-protected-input"); expect(f.deps.before).toHaveBeenCalledOnce(); expect(f.deps.initialize).not.toHaveBeenCalled();
  });

  it("refuses a future execution output created during the GET wait", async () => {
    const f = await fixture(), original = f.deps.before.getMockImplementation();
    f.deps.before.mockImplementation(async (...values) => {const result = await original(...values); await fs.mkdir(f.options.beforeOutputDirectory, {mode: 0o700}); return result;});
    await expect(f.run()).rejects.toHaveProperty("code", "production-preparation-output-already-exists"); expect(f.deps.initialize).not.toHaveBeenCalled();
  });

  it("keeps the fresh report and refuses replay with the same output names", async () => {
    const f = await fixture(); await f.run(); const original = await fs.readFile(path.join(f.options.checkOutputDirectory, "report.json"), "utf8");
    await expect(f.run()).rejects.toHaveProperty("code", "production-preparation-output-already-exists");
    expect(f.deps.before).toHaveBeenCalledOnce(); expect(await fs.readFile(path.join(f.options.checkOutputDirectory, "report.json"), "utf8")).toBe(original);
  });
});

describe("preparation exit and error privacy", () => {
  it("returns exit0 for prepared review records without claiming authorization", async () => {
    const f = await fixture(), stdout = vi.fn(), stderr = vi.fn(); expect(await f.command(stdout, stderr)).toBe(0);
    expect(stderr).not.toHaveBeenCalled(); expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({productionAuthorized: false, providerWrites: 0});
  });

  it("reports only a fixed code for a failed GET and creates no operator run", async () => {
    const f = await fixture(), stdout = vi.fn(), stderr = vi.fn();
    f.deps.before.mockRejectedValue(new Error("PRIVATE_TOKEN_AND_PATH")); expect(await f.command(stdout, stderr)).toBe(1);
    expect(stdout).not.toHaveBeenCalled(); expect(stderr.mock.calls[0][0]).not.toContain("PRIVATE_TOKEN_AND_PATH");
    expect(stderr.mock.calls[0][0]).toContain("invalid-production-preparation-input-or-state"); expect(f.deps.initialize).not.toHaveBeenCalled();
  });

  it.each(["mode", "symlink", "malformed"])("fails safely on %s capture input before GET", async shape => {
    const f = await fixture(), file = path.join(f.options.captureDirectory, "report.json");
    if (shape === "mode") await fs.chmod(file, 0o640);
    if (shape === "symlink") {const outside = path.join(f.base, "outside.json"); await fs.rename(file, outside); await fs.symlink(outside, file);}
    if (shape === "malformed") await fs.writeFile(file, "PRIVATE_INVALID_JSON");
    await expect(f.run()).rejects.toThrow(); expect(f.deps.before).not.toHaveBeenCalled(); expect(f.deps.initialize).not.toHaveBeenCalled();
  });
});
