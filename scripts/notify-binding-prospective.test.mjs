import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {parseProspectiveArguments, runProspectiveComparison, runProspectiveCommand} from "./notify-binding-prospective.mjs";
import {digest} from "./functions-config-guard-lib.mjs";
import {captureBindingEvidence} from "./notify-binding-evidence-lib.mjs";
import {compareProspectiveBindingEvidence, prospectiveBindingRequest, validateProspectiveInputs} from "./notify-binding-prospective-lib.mjs";
import {fixture as protocolFixture, NOW} from "./test-fixtures/notify-binding-repair-fixture.mjs";
import {TOOL_BINDING} from "./test-fixtures/binding-evidence-fixture.mjs";

const temporary = new Set(), projectId = "sodc-web-production";
const target = "reconcileMyCheckoutSessionOrders", prefix = `projects/${projectId}/locations/europe-west2`;
const operationName = `${prefix}/operations/offline-operation`;
const aliases = {projects: {dev: "sodc-web", prod: projectId}};
const clone = value => structuredClone(value);
const argsFor = c => ["--phase", c.options.phase, "--capture-dir", c.options.captureDirectory, "--source-root", c.options.sourceRoot,
  "--limits-baseline", c.options.limitsBaselineFile, "--output-dir", c.options.outputDirectory,
  ...(c.options.operatorDirectory ? ["--operator-run-dir", c.options.operatorDirectory] : [])];

async function setup(phase = "before") {
  const base = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "binding-prospective-cli-"))); temporary.add(base);
  const root = path.join(base, "tool"), sourceRoot = path.join(base, "application"), captureDirectory = path.join(base, "capture");
  const inputs = path.join(base, "inputs"), operatorDirectory = path.join(base, "operator"), locks = path.join(base, "locks");
  for (const directory of [root, sourceRoot, captureDirectory, inputs, operatorDirectory]) await fs.mkdir(directory, {mode: 0o700});
  for (const directory of [root, sourceRoot]) await fs.writeFile(path.join(directory, ".firebaserc"), JSON.stringify(aliases));
  const report = {schemaVersion: "sodc-notify-binding-prospective/v1", status: phase === "before" ? "BASELINE_MATCH" : "METADATA_VERIFIED_WITH_PROVENANCE_LIMIT",
    readOnly: true, productionAuthorized: false, releaseAuthorized: false, originalContractAccepted: false};
  const capture = {schemaVersion: "sodc-notify-binding-capture/v1", projectId, baseline: {functions: {[target]: "synthetic-fingerprint"},
    targetObservation: {revision: "reconcilemycheckoutsessionorders-00001-old"}}};
  const source = {binding: {gitSha: "synthetic-application"}}, tool = {gitSha: "synthetic-tool"}, keyBuffers = [];
  const snapshot = {functions: [{name: `${prefix}/functions/${target}`}]};
  const records = {intent: {startedAt: "2026-11-26T00:00:00Z"}, acknowledgement: {name: operationName}};
  const provider = {snapshot: vi.fn(async () => clone(snapshot)), limits: vi.fn(async () => ({projectId, functions: []})),
    provenance: vi.fn(async () => ({})), operation: vi.fn(async () => ({name: operationName, done: true})), patchBindings: vi.fn()};
  const options = {phase, sourceRoot, captureDirectory, limitsBaselineFile: path.join(inputs, "limits.json"),
    outputDirectory: path.join(base, "output"), ...(phase === "after" ? {operatorDirectory} : {})};
  const deps = {readCapture: vi.fn(async () => {const comparisonKey = Buffer.alloc(32, 7); keyBuffers.push(comparisonKey);
    return {report: clone(capture), comparisonKey};}), readJson: vi.fn(async () => ({projectId, functions: []})),
  readRecords: vi.fn(async () => clone(records)), readSource: vi.fn(async () => clone(source)), readTool: vi.fn(async () => clone(tool)),
  validate: vi.fn(), providerFactory: vi.fn(() => provider), compare: vi.fn(() => clone(report)),
  initialize: vi.fn(async directory => ({outputDirectory: directory, reportSha256: digest(report)})),
  readClaims: vi.fn(async () => []), lockDirectory: vi.fn(() => locks), now: () => Date.parse("2026-11-26T00:01:00Z")};
  return {base, root, options, deps, provider, capture, source, tool, records, report, keyBuffers, locks,
    run: extra => runProspectiveComparison(root, {...options, ...extra}, deps)};
}
beforeEach(() => {vi.stubGlobal("fetch", vi.fn(() => {throw new Error("UNEXPECTED_REAL_NETWORK");}));});
afterEach(async () => {
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all([...temporary].map(file => fs.rm(file, {recursive: true, force: true}))); temporary.clear();}
});

describe("prospective comparison command scope", () => {
  it.each(["before", "after"])("accepts the exact %s read-only arguments", async phase => {
    const c = await setup(phase); expect(parseProspectiveArguments(argsFor(c))).toEqual(c.options);
  });
  it("keeps help independent of private files and provider construction", async () => {
    const c = await setup(); const result = await runProspectiveComparison("/missing", {help: true}, c.deps);
    expect(result.status).toBe("HELP"); expect(c.deps.readCapture).not.toHaveBeenCalled(); expect(c.deps.providerFactory).not.toHaveBeenCalled();
  });
  it.each(["--apply", "--accept", "--retry", "--unlock", "--env", "--waive"])("rejects %s without any reads", async flag => {
    const c = await setup(); expect(() => parseProspectiveArguments([...argsFor(c), flag, "prod"])).toThrow();
  });
  it.each(["phase", "captureDirectory", "sourceRoot", "limitsBaselineFile", "outputDirectory", "operatorDirectory"])("rejects invalid %s", async name => {
    const c = await setup("after"); await expect(c.run({[name]: name === "phase" ? "apply" : "relative"})).rejects.toThrow();
    expect(c.deps.providerFactory).not.toHaveBeenCalled();
  });
  it("requires operation records only in after phase and rejects duplicate flags", async () => {
    const c = await setup("after"), args = argsFor(c);
    expect(() => parseProspectiveArguments(args.slice(0, -2))).toThrow();
    expect(() => parseProspectiveArguments([...args, "--phase", "after"])).toThrow();
    args[1] = "before"; expect(() => parseProspectiveArguments(args)).toThrow();
  });
});

describe("protected input boundaries", () => {
  it.each(["sourceRoot", "captureDirectory", "operatorDirectory"])("rejects output inside %s before reading source or constructing a provider", async name => {
    const c = await setup("after"); await expect(c.run({outputDirectory: path.join(c.options[name], "output")})).rejects.toThrow("overlaps-protected-input");
    expect(c.deps.readSource).not.toHaveBeenCalled(); expect(c.deps.providerFactory).not.toHaveBeenCalled();
  });
  it.each(["tool", "sidecar", "claim", "claim ancestor"])("protects the %s path in both directions", async kind => {
    const c = await setup(); let outputDirectory;
    if (kind === "tool") outputDirectory = path.join(c.root, "output");
    if (kind === "sidecar") outputDirectory = path.join(path.dirname(c.options.limitsBaselineFile), "output");
    if (kind === "claim") {const run = path.join(c.base, "claimed-original"); c.deps.readClaims.mockResolvedValue([run]); outputDirectory = path.join(run, "output");}
    if (kind === "claim ancestor") {outputDirectory = path.join(c.base, "future-parent"); c.deps.readClaims.mockResolvedValue([path.join(outputDirectory, "claimed-run")]);}
    await expect(c.run({outputDirectory})).rejects.toThrow("overlaps-protected-input"); expect(c.deps.providerFactory).not.toHaveBeenCalled();
  });
  it("rejects symlink and dangling aliases before private reads", async () => {
    const c = await setup(), alias = path.join(c.base, "alias"); await fs.symlink(c.options.captureDirectory, alias);
    await expect(c.run({outputDirectory: path.join(alias, "output")})).rejects.toThrow("overlaps-protected-input");
    await fs.unlink(alias); await fs.symlink(path.join(c.base, "missing"), alias);
    await expect(c.run({outputDirectory: path.join(alias, "output")})).rejects.toThrow("evidence-path-inspection-failed");
    expect(c.deps.readCapture).not.toHaveBeenCalled();
  });
  it("rejects a pre-existing output instead of overwriting it", async () => {
    const c = await setup(); await fs.mkdir(c.options.outputDirectory);
    await expect(c.run()).rejects.toThrow("output-already-exists"); expect(c.deps.providerFactory).not.toHaveBeenCalled();
  });
  it("keeps earlier claims protected and rechecks new claims after the provider waits", async () => {
    const c = await setup(); c.deps.readClaims.mockResolvedValueOnce([]).mockResolvedValue([path.join(c.options.outputDirectory, "new-run")]);
    await expect(c.run()).rejects.toThrow("overlaps-protected-input"); expect(c.deps.initialize).not.toHaveBeenCalled();
    expect(c.keyBuffers.every(buffer => buffer.every(byte => byte === 0))).toBe(true);
  });
  it("fails malformed claims and a mismatched production alias before provider construction", async () => {
    const c = await setup(); c.deps.readClaims.mockResolvedValueOnce(["relative"]);
    await expect(c.run()).rejects.toThrow("invalid-prospective-claim-directories");
    await fs.writeFile(path.join(c.options.sourceRoot, ".firebaserc"), JSON.stringify({projects: {prod: "sodc-web"}}));
    await expect(c.run()).rejects.toThrow(); expect(c.deps.providerFactory).not.toHaveBeenCalled();
  });
});

describe("GET-only comparison orchestration", () => {
  it("connects real capture, local validation, comparison and private output across both phases", async () => {
    const c = await setup(), base = protocolFixture(), key = Buffer.alloc(32, 9);
    const snapshot = JSON.parse(JSON.stringify(base.snapshot).replaceAll("sodc-web", projectId)), source = clone(base.source);
    const fn = snapshot.functions[0], buildName = `${prefix}/builds/00000000-0000-4000-8000-000000000001`;
    const storage = {bucket: "gcf-v2-sources-123-europe-west2", object: `${target}/function-source.zip`, generation: "7"};
    fn.buildConfig.build = buildName; fn.buildConfig.source = {storageSource: storage}; fn.buildConfig.sourceProvenance = {resolvedStorageSource: clone(storage)};
    const revision = `${fn.serviceConfig.service}/revisions/${fn.serviceConfig.revision}`;
    const provenance = {currentRevision: {state: "AVAILABLE", value: {name: revision, createTime: new Date(NOW - 60_000).toISOString(),
      images: [{name: "worker", image: `europe-west2-docker.pkg.dev/${projectId}/gcf-artifacts/fixture@sha256:${"a".repeat(64)}`}], buildAnnotations: {}}},
    previousRevision: {state: "NOT_REQUESTED"}, operationBuild: {state: "NOT_REQUESTED"},
    functionBuild: {state: "AVAILABLE", value: {name: buildName, id: buildName.split("/").at(-1), status: "SUCCESS", createTime: new Date(NOW - 90_000).toISOString(),
      startTime: new Date(NOW - 80_000).toISOString(), finishTime: new Date(NOW - 70_000).toISOString(), source: null, resolvedSource: null, archiveSha256: null, images: []}},
    sourceObject: {state: "AVAILABLE", value: {bucket: storage.bucket, name: storage.object, generation: "7", size: "1000", md5Hash: null, crc32c: null}}};
    const capture = captureBindingEvidence({environment: "prod", source, toolBinding: TOOL_BINDING, snapshot, provenance, comparisonKey: key, now: NOW});
    const limits = {projectId, functions: snapshot.functions.map(value => ({name: value.buildConfig.entryPoint, revision: value.serviceConfig.revision,
      serviceMaximum: 20, revisionMaximum: 20, effectiveMaximum: 20, ready: true, allTrafficOnLatestRevision: true}))};
    c.deps.readSource.mockImplementation(async () => clone(source)); c.deps.readTool.mockImplementation(async () => clone(TOOL_BINDING));
    c.deps.readCapture.mockImplementation(async () => ({report: clone(capture), comparisonKey: Buffer.from(key)}));
    c.deps.readJson.mockImplementation(async () => clone(limits)); c.deps.validate = validateProspectiveInputs; c.deps.compare = compareProspectiveBindingEvidence;
    delete c.deps.initialize; // Use the real durable private writer too.
    c.provider.snapshot.mockImplementation(async () => clone(snapshot)); c.provider.limits.mockImplementation(async () => clone(limits));
    c.provider.provenance.mockImplementation(async () => clone(provenance));
    const before = await c.run(); expect(before.status).toBe("BASELINE_MATCH");
    const beforeReport = JSON.parse(await fs.readFile(before.reportPath, "utf8"));
    const intent = {schemaVersion: "sodc-notify-binding-operator-intent/v1", projectId, target: fn.name,
      ...Object.fromEntries(["captureReportSha256", "limitsBaselineSha256", "requestSha256", "sourceBindingSha256", "comparisonToolBindingSha256"].map(name => [name, beforeReport[name]])),
      startedAt: new Date(NOW + 1000).toISOString()};
    fn.serviceConfig.secretEnvironmentVariables = prospectiveBindingRequest(capture).body.serviceConfig.secretEnvironmentVariables;
    fn.serviceConfig.revision = `${target.toLowerCase()}-updated`; fn.updateTime = new Date(NOW + 2000).toISOString();
    provenance.currentRevision.value.name = `${fn.serviceConfig.service}/revisions/${fn.serviceConfig.revision}`;
    provenance.currentRevision.value.createTime = fn.updateTime;
    const currentLimits = clone(limits); currentLimits.functions[0].revision = fn.serviceConfig.revision;
    c.provider.limits.mockImplementation(async () => clone(currentLimits));
    c.provider.operation.mockResolvedValue({name: operationName, done: true, metadata: {target: fn.name, verb: "update", buildName}});
    c.deps.readRecords.mockResolvedValue({intent, acknowledgement: {name: operationName}});
    const after = await c.run({phase: "after", operatorDirectory: path.join(c.base, "operator"), outputDirectory: path.join(c.base, "after-output")});
    expect(after.status).toBe("METADATA_VERIFIED_WITH_PROVENANCE_LIMIT");
    const report = JSON.parse(await fs.readFile(after.reportPath, "utf8"));
    expect(report).toMatchObject({sourceArchiveEquality: "UNPROVEN", executableEquality: "UNPROVEN", buildChanged: false,
      functionCount: 2, unchangedOtherFunctions: 1, productionAuthorized: false, releaseAuthorized: false});
    expect(await fs.readdir(path.dirname(after.reportPath))).toEqual(["initialized.json", "report.json"]);
    expect(c.provider.patchBindings).not.toHaveBeenCalled();
  });

  it.each(["before", "after"])("uses the same original key, validates locally first and writes only a new %s report", async phase => {
    const c = await setup(phase), result = await c.run();
    expect(result).toMatchObject({status: c.report.status, productionAuthorized: false, releaseAuthorized: false, originalContractAccepted: false, providerWrites: 0});
    expect(c.deps.validate.mock.invocationCallOrder[0]).toBeLessThan(c.deps.providerFactory.mock.invocationCallOrder[0]);
    expect(c.deps.providerFactory).toHaveBeenCalledWith({projectId, region: "europe-west2"});
    expect(c.provider.patchBindings).not.toHaveBeenCalled();
    expect(c.deps.initialize).toHaveBeenCalledExactlyOnceWith(c.options.outputDirectory, {report: c.report});
    expect(c.deps.compare.mock.calls[0][0]).toMatchObject({phase, capture: c.capture, source: c.source, toolBinding: c.tool});
    expect(c.keyBuffers).toHaveLength(2); expect(c.keyBuffers.every(buffer => buffer.every(byte => byte === 0))).toBe(true);
    expect(c.provider.operation).toHaveBeenCalledTimes(phase === "after" ? 1 : 0);
    if (phase === "after") expect(c.provider.operation).toHaveBeenCalledWith(operationName);
  });
  it("never constructs a provider when local source or journal validation fails", async () => {
    const c = await setup("after"); c.deps.validate.mockImplementation(() => {throw Object.assign(new Error("PRIVATE_RECORD"), {code: "invalid-or-unbound-operator-intent"});});
    await expect(c.run()).rejects.toHaveProperty("code", "invalid-or-unbound-operator-intent");
    expect(c.deps.providerFactory).not.toHaveBeenCalled(); expect(c.deps.initialize).not.toHaveBeenCalled();
    expect(c.keyBuffers[0].every(byte => byte === 0)).toBe(true);
  });
  it("stops on inventory drift before reading extra limits or provenance", async () => {
    const c = await setup(); c.provider.snapshot.mockResolvedValue({functions: []});
    await expect(c.run()).rejects.toThrow("provider-inventory-changed"); expect(c.provider.limits).not.toHaveBeenCalled(); expect(c.provider.provenance).not.toHaveBeenCalled();
  });
  it("does not fabricate an acknowledgement from live metadata", async () => {
    const c = await setup("after"); c.deps.readRecords.mockResolvedValue({intent: c.records.intent, acknowledgement: null});
    await expect(c.run()).rejects.toThrow("operation-acknowledgement"); expect(c.provider.operation).not.toHaveBeenCalled(); expect(c.deps.initialize).not.toHaveBeenCalled();
  });
  it("reports a pending acknowledged operation without treating the snapshot as a final result", async () => {
    const c = await setup("after"); c.provider.operation.mockResolvedValue({name: operationName}); c.deps.compare.mockReturnValue({...c.report, status: "PENDING"});
    expect((await c.run()).status).toBe("PENDING"); expect(c.provider.limits).not.toHaveBeenCalled(); expect(c.provider.provenance).not.toHaveBeenCalled();
  });
  it.each(["source", "tool", "sidecar", "journal", "capture", "key"])("rejects %s changed during the provider wait before storing a report", async kind => {
    const c = await setup("after");
    if (kind === "source") c.deps.readSource.mockResolvedValueOnce(clone(c.source)).mockResolvedValue({binding: {gitSha: "changed"}});
    if (kind === "tool") c.deps.readTool.mockResolvedValueOnce(clone(c.tool)).mockResolvedValue({gitSha: "changed"});
    if (kind === "sidecar") c.deps.readJson.mockResolvedValueOnce({projectId, functions: []}).mockResolvedValue({changed: true});
    if (kind === "journal") c.deps.readRecords.mockResolvedValueOnce(clone(c.records)).mockResolvedValue({...c.records, changed: true});
    if (["capture", "key"].includes(kind)) {
      let reads = 0; c.deps.readCapture.mockImplementation(async () => {const comparisonKey = Buffer.alloc(32, kind === "key" && reads ? 8 : 7); c.keyBuffers.push(comparisonKey);
        return {report: reads++ && kind === "capture" ? {...c.capture, changed: true} : clone(c.capture), comparisonKey};});
    }
    await expect(c.run()).rejects.toThrow(/changed-during-read/); expect(c.deps.initialize).not.toHaveBeenCalled();
    expect(c.keyBuffers.every(buffer => buffer.every(byte => byte === 0))).toBe(true);
  });
  it.each(["BASELINE_MATCH", "METADATA_VERIFIED_WITH_PROVENANCE_LIMIT", "PENDING", "FAIL"])("uses a truthful, non-authorizing exit for %s", async status => {
    const c = await setup(); c.deps.compare.mockReturnValue({...c.report, status}); const stdout = vi.fn(), stderr = vi.fn();
    const exit = await runProspectiveCommand(argsFor(c), {root: c.root, deps: c.deps, stdout, stderr});
    expect(exit).toBe(status === "BASELINE_MATCH" ? 0 : status === "FAIL" ? 1 : 3); expect(stderr).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({status, productionAuthorized: false, releaseAuthorized: false});
  });
  it("keeps private error messages, bodies and paths out of command output", async () => {
    const c = await setup(); c.provider.snapshot.mockRejectedValue(new Error("PRIVATE_TOKEN_PRIVATE_PATH"));
    const stdout = vi.fn(), stderr = vi.fn(); expect(await runProspectiveCommand(argsFor(c), {root: c.root, deps: c.deps, stdout, stderr})).toBe(1);
    expect(stdout).not.toHaveBeenCalled(); expect(stderr).toHaveBeenCalledExactlyOnceWith("Prospective comparison blocked: invalid-prospective-input-or-state.");
  });
});
