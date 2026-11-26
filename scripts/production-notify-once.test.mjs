import fs from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {PROJECT, TARGET_NAME, EXPECTED_REQUEST, REVIEWED_VERIFIER_COMMIT, productionOperatorReviewTemplate} from "./production-notify-once-lib.mjs";
import {parseProductionOnceArguments, runProductionNotifyOnce, runProductionNotifyCommand} from "./production-notify-once.mjs";
import {createBindingRepairProvider} from "./notify-secret-binding-repair-provider.mjs";
import {initializeProductionOperatorRun, readProspectiveJsonInput} from "./notify-secret-binding-repair-store.mjs";

const temporary = new Set(), NOW = Date.parse("2026-11-26T12:05:00.000Z"), iso = value => new Date(value).toISOString();
const OPERATION = `projects/${PROJECT}/locations/europe-west2/operations/offline-operator-fixture`;
const clone = value => structuredClone(value);
const operatorTool = {gitSha: "1".repeat(40), tree: "2".repeat(40), trackedSha256: "3".repeat(64), nodeMajor: 24};
const verifierTool = {gitSha: REVIEWED_VERIFIER_COMMIT, tree: "5".repeat(40), trackedSha256: "6".repeat(64), nodeMajor: 24};
const acknowledgement = () => ({name: OPERATION, done: false, metadata: {target: TARGET_NAME, verb: "update"}});
const responseFor = value => new Response(JSON.stringify(value), {status: 200, headers: {"content-type": "application/json"}});
const failure = code => Object.assign(new Error(code), {code});
async function privateJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  await fs.chmod(file, 0o600);
}
async function fixture({realStore = false} = {}) {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "production-once-cli-"))); temporary.add(base);
  await fs.chmod(base, 0o700);
  const root = path.join(base, "operator-tool"), legacyLocks = path.join(base, "locks", "notify-binding-repair-locks");
  const paths = {verifierRoot: path.join(base, "verifier"), sourceRoot: path.join(base, "application"),
    captureDirectory: path.join(base, "capture"), limitsBaselineFile: path.join(base, "inputs", "limits.json"),
    beforeOutputDirectory: path.join(base, "fresh-before"), runDirectory: path.join(base, "operator-run")};
  for (const directory of [root, paths.verifierRoot, paths.sourceRoot, paths.captureDirectory, path.dirname(paths.limitsBaselineFile)]) {
    await fs.mkdir(directory, {mode: 0o700});
  }
  await privateJson(path.join(root, ".firebaserc"), {projects: {prod: PROJECT}});
  const source = {binding: {gitSha: "a".repeat(40), buildSha256: "b".repeat(64)}};
  const plan = {schemaVersion: "sodc-production-notify-operator-plan/v1", createdAt: iso(NOW - 60_000), projectId: PROJECT,
    target: TARGET_NAME, request: clone(EXPECTED_REQUEST), context: {captureReportSha256: "c".repeat(64), limitsBaselineSha256: "d".repeat(64),
      requestSha256: digest(EXPECTED_REQUEST), sourceBindingSha256: digest(source.binding), comparisonToolBindingSha256: digest(verifierTool)},
    paths, operatorToolBinding: clone(operatorTool), verifierToolBinding: clone(verifierTool),
    provenanceBoundary: "ARCHIVE_AND_EXECUTABLE_EQUALITY_UNPROVEN", liveMailEffect: "NORMAL_APPLICATION_MAIL_MAY_RESUME"};
  const review = {...productionOperatorReviewTemplate(plan), decision: "APPROVED", reviewedBy: "Synthetic operator reviewer",
    reason: "Offline transport acceptance of the exact request and stated provenance and LIVE mail effects.",
    reviewedAt: iso(NOW - 30_000), expiresAt: iso(NOW + 30 * 60_000),
    acceptUnprovenSourceAndExecutableEquality: true, acceptLiveApplicationMailEffect: true};
  const report = {schemaVersion: "sodc-notify-binding-prospective/v1", status: "BASELINE_MATCH", phase: "before", readOnly: true,
    productionAuthorized: false, releaseAuthorized: false, originalContractAccepted: false, ...plan.context};
  const state = {plan, review, source, report, operatorTool: clone(operatorTool), verifierTool: clone(verifierTool), now: NOW, retained: {}, events: []};
  const store = {assertUnclaimed: vi.fn(async () => {state.events.push("assert-unclaimed");}),
    beginIntent: vi.fn(async intent => {state.events.push("durable-claim", "durable-intent"); state.retained.intent = clone(intent);}),
    writeOperation: vi.fn(async value => {state.events.push("durable-operation"); state.retained.operation = clone(value);})};
  let guardedFetch;
  const writer = {patchBindings: vi.fn(async ({name, bindings}) => {
    state.events.push("PATCH");
    const response = await guardedFetch(EXPECTED_REQUEST.url, {method: "PATCH", redirect: "error", signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({name, serviceConfig: {secretEnvironmentVariables: bindings}})});
    return response.json();
  }), snapshot: vi.fn()};
  const result = () => ({status: "BASELINE_MATCH", reportPath: path.join(plan.paths.beforeOutputDirectory, "report.json"), reportSha256: digest(state.report)});
  const deps = {readJson: vi.fn(async file => {
    if (file === path.join(state.plan.paths.runDirectory, "plan.json")) return clone(state.plan);
    if (file === path.join(state.plan.paths.runDirectory, "review.json")) return clone(state.review);
    if (file === path.join(state.plan.paths.beforeOutputDirectory, "report.json")) return clone(state.report);
    throw failure("unexpected-synthetic-input-path");
  }), readTool: vi.fn(async directory => clone(directory === root ? state.operatorTool : state.verifierTool)),
  readSource: vi.fn(async () => clone(state.source)), before: vi.fn(async () => {state.events.push("GET-before"); return result();}),
  openStore: vi.fn(async () => store), writerFactory: vi.fn(({fetchImpl}) => {guardedFetch = fetchImpl; return writer;}), legacyLockDirectory: vi.fn(() => legacyLocks),
  readClaims: vi.fn(async () => []), now: () => state.now,
  fetchImpl: vi.fn(async () => {state.events.push("HTTP"); return responseFor(acknowledgement());})};
  if (realStore) {
    await initializeProductionOperatorRun(plan.paths.runDirectory, {plan});
    await privateJson(path.join(plan.paths.runDirectory, "review.json"), review);
    delete deps.openStore;
    deps.readJson = vi.fn(readProspectiveJsonInput);
    deps.before = vi.fn(async () => {
      state.events.push("GET-before"); await fs.mkdir(plan.paths.beforeOutputDirectory, {mode: 0o700});
      await privateJson(path.join(plan.paths.beforeOutputDirectory, "report.json"), state.report); return result();
    });
  }
  return {base, root, legacyLocks, operatorLocks: path.join(path.dirname(legacyLocks), "production-notify-once-locks"),
    state, store, writer, deps, result, run: () => runProductionNotifyOnce(root, {runDirectory: state.plan.paths.runDirectory}, deps),
    command: (stdout = vi.fn(), stderr = vi.fn()) => runProductionNotifyCommand(["--run-dir", state.plan.paths.runDirectory], {root, deps, stdout, stderr})};
}
beforeEach(() => {vi.stubGlobal("fetch", vi.fn(() => {throw new Error("UNEXPECTED_GLOBAL_FETCH");}));});
afterEach(async () => {
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all([...temporary].map(directory => fs.rm(directory, {recursive: true, force: true}))); temporary.clear();}
});

describe("operator arguments and pre-GET approval", () => {
  it("prints help without reading files, source, credentials or constructing a provider", async () => {
    const readJson = vi.fn(() => {throw new Error("UNEXPECTED_IO");}), before = vi.fn(), writerFactory = vi.fn();
    const stdout = vi.fn(), stderr = vi.fn();
    expect(await runProductionNotifyCommand(["--help"], {root: "/missing", deps: {readJson, before, writerFactory}, stdout, stderr})).toBe(0);
    expect(stdout.mock.calls[0][0]).toContain("--run-dir"); expect(stderr).not.toHaveBeenCalled();
    expect(readJson).not.toHaveBeenCalled(); expect(before).not.toHaveBeenCalled(); expect(writerFactory).not.toHaveBeenCalled();
  });
  it.each([[], ["--run-dir", "relative"], ["--run-dir", "/private/tmp/run", "--apply"], ["--env", "prod"],
    ["--run-dir", "/private/tmp/run", "--run-dir", "/private/tmp/other"], ["--help", "--run-dir", "/private/tmp/run"]].map(args => [args]))("rejects unsupported arguments %j", args => {
    expect(() => parseProductionOnceArguments(args)).toThrow("invalid-production-operator-arguments");
  });
  it.each(["missing", "template", "source risk", "mail risk", "expired"])("blocks %s approval before any GET or write", async kind => {
    const f = await fixture();
    if (kind === "missing") f.deps.readJson.mockImplementation(async file => {if (file.endsWith("review.json")) throw failure("private-record-read-failed"); return clone(f.state.plan);});
    if (kind === "template") f.state.review = productionOperatorReviewTemplate(f.state.plan);
    if (kind === "source risk") f.state.review.acceptUnprovenSourceAndExecutableEquality = false;
    if (kind === "mail risk") f.state.review.acceptLiveApplicationMailEffect = false;
    if (kind === "expired") f.state.review.expiresAt = iso(NOW);
    await expect(f.run()).rejects.toThrow(); expect(f.deps.before).not.toHaveBeenCalled();
    expect(f.store.beginIntent).not.toHaveBeenCalled(); expect(f.deps.writerFactory).not.toHaveBeenCalled();
  });
  it("refuses a tooling checkout whose Production alias points at Dev", async () => {
    const f = await fixture(); await privateJson(path.join(f.root, ".firebaserc"), {projects: {prod: "sodc-web"}});
    await expect(f.run()).rejects.toThrow(); expect(f.deps.before).not.toHaveBeenCalled();
  });
});

describe("fresh baseline and changing approval", () => {
  it.each(["source", "operator tool", "verifier tool", "plan", "review", "expiry"])("blocks %s drift during the GET-only comparison", async kind => {
    const f = await fixture(); f.deps.before.mockImplementation(async () => {
      const result = f.result();
      if (kind === "source") f.state.source.binding.gitSha = "9".repeat(40);
      if (kind === "operator tool") f.state.operatorTool.gitSha = "9".repeat(40);
      if (kind === "verifier tool") f.state.verifierTool.trackedSha256 = "9".repeat(64);
      if (kind === "plan") f.state.plan.context.captureReportSha256 = "9".repeat(64);
      if (kind === "review") f.state.review.reason += " changed";
      if (kind === "expiry") f.state.now = Date.parse(f.state.review.expiresAt);
      return result;
    });
    await expect(f.run()).rejects.toThrow(); expect(f.store.beginIntent).not.toHaveBeenCalled(); expect(f.writer.patchBindings).not.toHaveBeenCalled();
  });
  it.each(["source", "tool", "plan", "review", "expiry"])("retains intent but blocks PATCH after %s changes during its durable write", async kind => {
    const f = await fixture(); f.store.beginIntent.mockImplementation(async intent => {
      f.state.retained.intent = clone(intent);
      if (kind === "source") f.state.source.binding.buildSha256 = "9".repeat(64);
      if (kind === "tool") f.state.operatorTool.trackedSha256 = "9".repeat(64);
      if (kind === "plan") f.state.plan.createdAt = iso(NOW - 59_000);
      if (kind === "review") f.state.review.decision = "WITHDRAWN";
      if (kind === "expiry") f.state.now = Date.parse(f.state.review.expiresAt);
    });
    await expect(f.run()).rejects.toThrow(); expect(f.state.retained.intent).toBeDefined();
    expect(f.deps.writerFactory).not.toHaveBeenCalled(); expect(f.writer.patchBindings).not.toHaveBeenCalled();
  });
  it.each(["tool expiry", "tool withdrawal", "source expiry", "source withdrawal"])("rechecks approval after initial asynchronous %s", async kind => {
    const f = await fixture(), name = kind.startsWith("tool") ? "readTool" : "readSource", original = f.deps[name].getMockImplementation();
    f.deps[name].mockImplementation(async (...args) => {
      const value = await original(...args);
      if (kind.endsWith("expiry")) f.state.now = Date.parse(f.state.review.expiresAt);
      else f.state.review.decision = "WITHDRAWN";
      return value;
    });
    await expect(f.run()).rejects.toThrow(); expect(f.deps.before).not.toHaveBeenCalled(); expect(f.store.beginIntent).not.toHaveBeenCalled();
  });
  it.each(["tool expiry", "source withdrawal", "boundary expiry", "boundary withdrawal"])("blocks HTTP after durable intent and asynchronous %s", async kind => {
    const f = await fixture(), name = kind.startsWith("tool") ? "readTool" : kind.startsWith("source") ? "readSource" : "readClaims";
    const original = f.deps[name].getMockImplementation();
    f.deps[name].mockImplementation(async (...args) => {
      const value = await original(...args);
      if (f.state.retained.intent) {
        if (kind.endsWith("expiry")) f.state.now = Date.parse(f.state.review.expiresAt);
        else f.state.review.decision = "WITHDRAWN";
      }
      return value;
    });
    await expect(f.run()).rejects.toThrow(); expect(f.state.retained.intent).toBeDefined(); expect(f.deps.writerFactory).not.toHaveBeenCalled();
  });
  it.each(["status", "path", "hash", "report phase", "authority", "context"])("blocks a mismatched baseline %s", async kind => {
    const f = await fixture();
    if (kind === "report phase") f.state.report.phase = "after";
    if (kind === "authority") f.state.report.productionAuthorized = true;
    if (kind === "context") f.state.report.captureReportSha256 = "9".repeat(64);
    f.deps.before.mockImplementation(async () => ({...f.result(), ...(kind === "status" ? {status: "FAIL"} : {}),
      ...(kind === "path" ? {reportPath: path.join(f.base, "other", "report.json")} : {}), ...(kind === "hash" ? {reportSha256: "0".repeat(64)} : {})}));
    await expect(f.run()).rejects.toThrow(); expect(f.store.beginIntent).not.toHaveBeenCalled(); expect(f.writer.patchBindings).not.toHaveBeenCalled();
  });
});

describe("protected operator and comparison paths", () => {
  it.each(["root", "verifier", "application", "capture", "sidecar", "legacy locks", "operator locks", "claimed run", "operator run"])(
    "blocks output overlapping %s before the comparison", async kind => {
      const f = await fixture();
      const protectedPath = {root: f.root, verifier: f.state.plan.paths.verifierRoot, application: f.state.plan.paths.sourceRoot,
        capture: f.state.plan.paths.captureDirectory, sidecar: path.dirname(f.state.plan.paths.limitsBaselineFile),
        "legacy locks": f.legacyLocks, "operator locks": f.operatorLocks, "claimed run": path.join(f.base, "original-run"), "operator run": f.state.plan.paths.runDirectory}[kind];
      if (kind === "claimed run") f.deps.readClaims.mockResolvedValue([protectedPath]);
      f.state.plan.paths.beforeOutputDirectory = path.join(protectedPath, "new-before");
      f.state.review.planSha256 = digest(f.state.plan);
      await expect(f.run()).rejects.toThrow(/overlaps/); expect(f.deps.before).not.toHaveBeenCalled(); expect(f.deps.writerFactory).not.toHaveBeenCalled();
    });
  it("rejects a symlink alias of protected input and a dangling alias before GET", async () => {
    const f = await fixture(), alias = path.join(f.base, "alias"); await fs.symlink(f.state.plan.paths.captureDirectory, alias);
    f.state.plan.paths.beforeOutputDirectory = path.join(alias, "new-before"); f.state.review.planSha256 = digest(f.state.plan);
    await expect(f.run()).rejects.toThrow(/overlaps/);
    await fs.unlink(alias); await fs.symlink(path.join(f.base, "missing"), alias);
    await expect(f.run()).rejects.toThrow("evidence-path-inspection-failed"); expect(f.deps.before).not.toHaveBeenCalled();
  });
  it("blocks an existing legacy Production claim without reading or modifying its contents", async () => {
    const f = await fixture(); await fs.mkdir(f.legacyLocks, {recursive: true, mode: 0o700});
    const file = path.join(f.legacyLocks, `${PROJECT}.json`); await privateJson(file, {PRIVATE: "ORIGINAL_CLAIM_MARKER"});
    const before = await fs.readFile(file); await expect(f.run()).rejects.toThrow("legacy-production-claim-present");
    expect(await fs.readFile(file)).toEqual(before); expect(f.deps.before).not.toHaveBeenCalled(); expect(f.store.beginIntent).not.toHaveBeenCalled();
  });
  it("rechecks claims that appear during the comparison", async () => {
    const f = await fixture(); f.deps.readClaims.mockResolvedValueOnce([]).mockResolvedValue([path.join(f.state.plan.paths.beforeOutputDirectory, "new-claim")]);
    await expect(f.run()).rejects.toThrow(/overlaps/); expect(f.store.beginIntent).not.toHaveBeenCalled();
  });
});

describe("one request and truthful acknowledgement", () => {
  it("dispatches the exact reviewed references only after durable claim and intent", async () => {
    const f = await fixture(), result = await f.run();
    expect(result).toMatchObject({status: "ACKNOWLEDGED_VERIFY_REQUIRED", projectId: PROJECT, operationName: OPERATION,
      providerWritesAttempted: 1, verificationComplete: false, releaseAuthorized: false});
    expect(f.deps.before).toHaveBeenCalledExactlyOnceWith(f.state.plan.paths.verifierRoot, {phase: "before", captureDirectory: f.state.plan.paths.captureDirectory,
      sourceRoot: f.state.plan.paths.sourceRoot, limitsBaselineFile: f.state.plan.paths.limitsBaselineFile, outputDirectory: f.state.plan.paths.beforeOutputDirectory});
    expect(f.writer.patchBindings).toHaveBeenCalledExactlyOnceWith({name: TARGET_NAME, bindings: EXPECTED_REQUEST.body.serviceConfig.secretEnvironmentVariables});
    expect(f.state.events.indexOf("durable-claim")).toBeLessThan(f.state.events.indexOf("durable-intent"));
    expect(f.state.events.indexOf("durable-intent")).toBeLessThan(f.state.events.indexOf("PATCH"));
    expect(f.state.events.indexOf("PATCH")).toBeLessThan(f.state.events.indexOf("durable-operation"));
    expect(f.state.retained.operation).toEqual({name: OPERATION}); expect(f.writer.snapshot).not.toHaveBeenCalled();
  });
  it.each(["malformed ack", "lost ack", "provider error", "ack write failure"])("retains intent and returns UNKNOWN without retry for %s", async kind => {
    const f = await fixture();
    if (kind === "malformed ack") f.deps.fetchImpl.mockResolvedValue(responseFor({name: OPERATION, metadata: {target: TARGET_NAME, verb: "create"}}));
    if (kind === "lost ack") f.deps.fetchImpl.mockResolvedValue(responseFor(undefined));
    if (kind === "provider error") f.deps.fetchImpl.mockRejectedValue(new Error("PRIVATE_PROVIDER_ERROR_TOKEN"));
    if (kind === "ack write failure") f.store.writeOperation.mockRejectedValue(new Error("PRIVATE_ACK_FSYNC_ERROR"));
    const stdout = vi.fn(), stderr = vi.fn(); expect(await f.command(stdout, stderr)).toBe(3);
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED", providerWritesAttempted: 1, verificationComplete: false});
    expect(stdout.mock.calls[0][0]).not.toMatch(/PRIVATE|TOKEN|FSYNC/); expect(stderr).not.toHaveBeenCalled();
    expect(f.writer.patchBindings).toHaveBeenCalledTimes(1); expect(f.deps.fetchImpl).toHaveBeenCalledTimes(1); expect(f.state.retained.intent).toBeDefined();
  });
  it("reports a local provider callback failure as blocked with zero HTTP attempts and retains the claim", async () => {
    const f = await fixture(); f.writer.patchBindings.mockRejectedValue(new Error("PRIVATE_LOCAL_CALLBACK_FAILURE"));
    const stdout = vi.fn(), stderr = vi.fn(); expect(await f.command(stdout, stderr)).toBe(3);
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({status: "BLOCKED_BEFORE_DISPATCH_CLAIM_RETAINED", providerWritesAttempted: 0});
    expect(stdout.mock.calls[0][0]).not.toContain("PRIVATE_LOCAL_CALLBACK_FAILURE"); expect(stderr).not.toHaveBeenCalled();
    expect(f.writer.patchBindings).toHaveBeenCalledTimes(1); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
    expect(f.state.retained.intent).toBeDefined(); expect(f.store.writeOperation).not.toHaveBeenCalled();
  });
  it("does not retain an acknowledgement returned without invoking the transport", async () => {
    const f = await fixture(); f.writer.patchBindings.mockResolvedValue(acknowledgement());
    expect(await f.run()).toMatchObject({status: "BLOCKED_BEFORE_DISPATCH_CLAIM_RETAINED", providerWritesAttempted: 0});
    expect(f.deps.fetchImpl).not.toHaveBeenCalled(); expect(f.store.writeOperation).not.toHaveBeenCalled();
    expect(f.state.retained.intent).toBeDefined();
  });
  it("retains only the scoped operation name even when the accepted operation already contains an error", async () => {
    const f = await fixture(); f.deps.fetchImpl.mockResolvedValue(responseFor({...acknowledgement(), done: true,
      error: {code: 7, message: "PRIVATE_PROVIDER_MESSAGE"}, response: {PRIVATE: "RESPONSE_TOKEN"}}));
    const stdout = vi.fn(), stderr = vi.fn(); expect(await f.command(stdout, stderr)).toBe(3);
    expect(f.state.retained.operation).toEqual({name: OPERATION}); expect(stdout.mock.calls[0][0]).not.toMatch(/PRIVATE|TOKEN|error/);
    expect(JSON.parse(stdout.mock.calls[0][0]).verificationComplete).toBe(false);
  });
  it("sanitizes a pre-write failure while retaining the no-resubmit instruction", async () => {
    const f = await fixture(); f.deps.before.mockRejectedValue(new Error("PRIVATE_TOKEN_AND_PATH"));
    const stdout = vi.fn(), stderr = vi.fn(); expect(await f.command(stdout, stderr)).toBe(1);
    expect(stdout).not.toHaveBeenCalled(); expect(stderr).toHaveBeenCalledExactlyOnceWith("Production operator blocked: invalid-operator-input-or-state. Retain any claim/intent; do not resubmit.");
    expect(f.writer.patchBindings).not.toHaveBeenCalled();
  });
  it("uses the existing provider for one PATCH without any inventory GET or external token command", async () => {
    const f = await fixture(), tokenProvider = vi.fn(() => "synthetic-offline-token"), fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(acknowledgement()), {status: 200, headers: {"content-type": "application/json"}}));
    f.deps.fetchImpl = fetchImpl;
    f.deps.writerFactory = vi.fn(options => createBindingRepairProvider({...options, tokenProvider}));
    expect((await f.run()).status).toBe("ACKNOWLEDGED_VERIFY_REQUIRED"); expect(tokenProvider).toHaveBeenCalledTimes(1); expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(EXPECTED_REQUEST.url); expect(options).toMatchObject({method: "PATCH", redirect: "error"});
    expect(options.signal).toBeInstanceOf(AbortSignal); expect(JSON.parse(options.body)).toEqual(EXPECTED_REQUEST.body);
    expect(options.headers["x-goog-user-project"]).toBe(PROJECT); expect(options.headers.Authorization).toBe("Bearer synthetic-offline-token");
  });
  it.each(["expiry", "withdrawal"])("rechecks %s after the real provider's asynchronous token wait and makes zero HTTP calls", async kind => {
    const f = await fixture(), tokenProvider = vi.fn(async () => {
      await Promise.resolve();
      if (kind === "expiry") f.state.now = Date.parse(f.state.review.expiresAt);
      else f.state.review.decision = "WITHDRAWN";
      return "synthetic-offline-token";
    });
    f.deps.fetchImpl = vi.fn(async () => new Response(JSON.stringify(acknowledgement())));
    f.deps.writerFactory = vi.fn(options => createBindingRepairProvider({...options, tokenProvider}));
    const stdout = vi.fn(), stderr = vi.fn(); expect(await f.command(stdout, stderr)).toBe(3);
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({status: "BLOCKED_BEFORE_DISPATCH_CLAIM_RETAINED", providerWritesAttempted: 0});
    expect(stderr).not.toHaveBeenCalled();
    expect(f.state.retained.intent).toBeDefined(); expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(f.deps.fetchImpl).not.toHaveBeenCalled(); expect(f.store.writeOperation).not.toHaveBeenCalled();
  });
  it("reserves the single HTTP slot before awaiting its final approval check", async () => {
    const f = await fixture(); let attempts;
    f.deps.fetchImpl = vi.fn(async () => new Response(JSON.stringify(acknowledgement())));
    f.deps.writerFactory = vi.fn(({fetchImpl}) => ({patchBindings: async () => {
      const options = {method: "PATCH", redirect: "error", body: JSON.stringify(EXPECTED_REQUEST.body), signal: new AbortController().signal};
      attempts = await Promise.allSettled([fetchImpl(EXPECTED_REQUEST.url, options), fetchImpl(EXPECTED_REQUEST.url, options)]);
      return acknowledgement();
    }}));
    expect((await f.run()).status).toBe("ACKNOWLEDGED_VERIFY_REQUIRED"); expect(f.deps.fetchImpl).toHaveBeenCalledTimes(1);
    expect(attempts.map(value => value.status)).toEqual(["fulfilled", "rejected"]);
    expect(attempts[1].reason.code).toBe("operator-http-request-outside-plan");
  });
  it.each(["wrong body", "wrong URL", "missing deadline", "aborted deadline"])("blocks a provider transport with %s before HTTP", async kind => {
    const f = await fixture(), controller = new AbortController();
    f.deps.fetchImpl = vi.fn(async () => new Response(JSON.stringify(acknowledgement())));
    f.deps.writerFactory = vi.fn(({fetchImpl}) => ({patchBindings: async () => {
      const options = {method: "PATCH", redirect: "error", body: JSON.stringify(EXPECTED_REQUEST.body), signal: controller.signal};
      if (kind === "wrong body") options.body = JSON.stringify({...EXPECTED_REQUEST.body, environmentVariables: {}});
      if (kind === "missing deadline") delete options.signal;
      if (kind === "aborted deadline") controller.abort();
      await fetchImpl(kind === "wrong URL" ? EXPECTED_REQUEST.url + "&force=1" : EXPECTED_REQUEST.url, options);
      return acknowledgement();
    }}));
    expect(await f.run()).toMatchObject({status: "BLOCKED_BEFORE_DISPATCH_CLAIM_RETAINED", providerWritesAttempted: 0});
    expect(f.deps.fetchImpl).not.toHaveBeenCalled(); expect(f.state.retained.intent).toBeDefined(); expect(f.store.writeOperation).not.toHaveBeenCalled();
  });
});

describe("real private journal integration", () => {
  it("keeps durable intent/name-only acknowledgement and blocks a repeated invocation before another GET", async () => {
    const f = await fixture({realStore: true}); expect((await f.run()).status).toBe("ACKNOWLEDGED_VERIFY_REQUIRED");
    const run = f.state.plan.paths.runDirectory;
    expect(JSON.parse(await fs.readFile(path.join(run, "operation.json"), "utf8"))).toEqual({name: OPERATION});
    expect(JSON.parse(await fs.readFile(path.join(run, "intent.json"), "utf8"))).toMatchObject({schemaVersion: "sodc-notify-binding-operator-intent/v1", ...f.state.plan.context});
    expect((await fs.stat(path.join(run, "intent.json"))).mode & 0o7777).toBe(0o600);
    expect(JSON.parse(await fs.readFile(path.join(f.operatorLocks, `${PROJECT}.json`), "utf8")).runDirectory).toBe(run);
    await expect(f.run()).rejects.toThrow("production-operator-target-already-claimed");
    expect(f.deps.before).toHaveBeenCalledTimes(1); expect(f.writer.patchBindings).toHaveBeenCalledTimes(1);
  });
  it.each(["claim", "intent"])("does not PATCH after a real %s fsync failure", async kind => {
    const f = await fixture({realStore: true}), originalOpen = fs.open.bind(fs);
    const wanted = kind === "claim" ? path.join(f.operatorLocks, `${PROJECT}.json`) : path.join(f.state.plan.paths.runDirectory, "intent.json");
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      const handle = await originalOpen(...args);
      if (args[0] === wanted) vi.spyOn(handle, "sync").mockRejectedValue(new Error("PRIVATE_FSYNC_DETAIL"));
      return handle;
    });
    await expect(f.run()).rejects.toThrow("durable-local-record-write-failed"); expect(f.writer.patchBindings).not.toHaveBeenCalled();
    expect(await fs.lstat(path.join(f.operatorLocks, `${PROJECT}.json`))).toBeDefined();
  });
});
