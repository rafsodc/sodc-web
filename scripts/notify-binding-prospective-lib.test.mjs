import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createHmac} from "node:crypto";
import {canonical, digest} from "./functions-config-guard-lib.mjs";
import {captureBindingEvidence} from "./notify-binding-evidence-lib.mjs";
import {compareProspectiveBindingEvidence, prospectiveBindingRequest, validateProspectiveInputs} from "./notify-binding-prospective-lib.mjs";
import {fixture, KEY, NOW, clone} from "./test-fixtures/notify-binding-repair-fixture.mjs";
import {TOOL_BINDING} from "./test-fixtures/binding-evidence-fixture.mjs";

const PROJECT = "sodc-web-production", NUMBER = "123", REGION = "europe-west2";
const TARGET = "reconcileMyCheckoutSessionOrders", PREFIX = `projects/${PROJECT}/locations/${REGION}`;
const TARGET_NAME = `${PREFIX}/functions/${TARGET}`, SERVICE = `${PREFIX}/services/${TARGET.toLowerCase()}`;
const OLD_BUILD = `${PREFIX}/builds/00000000-0000-4000-8000-000000000001`;
const NEW_BUILD = `${PREFIX}/builds/00000000-0000-4000-8000-000000000002`;
const OPERATION = `${PREFIX}/operations/prospective-fixture`;
const BUCKET = `gcf-v2-sources-${NUMBER}-${REGION}`;
const IMAGE = letter => `${REGION}-docker.pkg.dev/${PROJECT}/gcf-artifacts/fixture@sha256:${letter.repeat(64)}`;
const iso = offset => new Date(NOW + offset).toISOString();

beforeEach(() => {vi.stubGlobal("fetch", vi.fn(() => {throw new Error("UNEXPECTED_LIVE_NETWORK");}));});
afterEach(() => {
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();}
});

function build(name, createTime) {
  return {state: "AVAILABLE", value: {name, id: name.split("/").at(-1), status: "SUCCESS", createTime,
    startTime: createTime, finishTime: iso(15_000), source: null, resolvedSource: null, archiveSha256: null, images: []}};
}
function provenance(target, rebuild = false) {
  return {
    currentRevision: {state: "AVAILABLE", value: {name: `${SERVICE}/revisions/${target.serviceConfig.revision}`,
      createTime: rebuild ? iso(18_000) : iso(-60_000), images: [{name: "worker", image: IMAGE(rebuild ? "b" : "a")}], buildAnnotations: {}}},
    previousRevision: {state: "NOT_REQUESTED"},
    functionBuild: build(target.buildConfig.build, rebuild ? iso(12_000) : iso(-90_000)),
    operationBuild: {state: "NOT_REQUESTED"},
    sourceObject: {state: "AVAILABLE", value: {bucket: BUCKET, name: `${TARGET}/function-source.zip`, generation: "7", size: "1000",
      md5Hash: Buffer.alloc(16, 1).toString("base64"), crc32c: Buffer.alloc(4, 2).toString("base64")}},
  };
}
function testCase({rebuild = true, omission = false, maintenance = false, extraSecret = false} = {}) {
  const base = fixture();
  const snapshot = JSON.parse(JSON.stringify(base.snapshot).replaceAll("sodc-web", PROJECT));
  const source = clone(base.source);
  if (extraSecret) {
    const name = "UNRELATED_CALLBACK_TOKEN";
    source.manifest.params.push({name, type: "secret"});
    source.manifest.endpoints.existingSender.secretEnvironmentVariables.push({key: name});
    source.binding.manifestSha256 = digest(source.manifest);
    snapshot.functions[1].serviceConfig.secretEnvironmentVariables.push({key: name, secret: name, projectId: PROJECT, version: "8"});
  }
  if (maintenance) {
    const fn = snapshot.functions[1], oldName = "existingSender", name = "recoverNotificationDeliveries";
    fn.name = `${PREFIX}/functions/${name}`; fn.buildConfig.entryPoint = name;
    fn.serviceConfig.service = `${PREFIX}/services/${name.toLowerCase()}`;
    fn.serviceConfig.revision = `${name.toLowerCase()}-original`; fn.serviceConfig.maxInstanceCount = 1;
    snapshot.invokerPolicies[name] = snapshot.invokerPolicies[oldName]; delete snapshot.invokerPolicies[oldName];
    source.manifest.endpoints[name] = {...source.manifest.endpoints[oldName], entryPoint: name};
    delete source.manifest.endpoints[oldName]; source.binding.manifestSha256 = digest(source.manifest);
  }
  const target = snapshot.functions[0];
  target.buildConfig.build = OLD_BUILD;
  target.buildConfig.source = {storageSource: {bucket: BUCKET, object: `${TARGET}/function-source.zip`, generation: "7"}};
  target.buildConfig.sourceProvenance = {resolvedStorageSource: clone(target.buildConfig.source.storageSource)};
  for (const fn of snapshot.functions) for (const ref of fn.serviceConfig.secretEnvironmentVariables) if (ref.key === "GOV_NOTIFY_TEST_API_KEY") ref.version = "2";
  for (const mode of ["numeric", "latest"]) snapshot.secretVersions.GOV_NOTIFY_TEST_API_KEY[mode].name = `projects/${PROJECT}/secrets/GOV_NOTIFY_TEST_API_KEY/versions/2`;
  const originalProvenance = provenance(target);
  const capture = captureBindingEvidence({environment: "prod", source: clone(source), toolBinding: clone(TOOL_BINDING), snapshot: clone(snapshot),
    provenance: clone(originalProvenance), comparisonKey: KEY, now: NOW});
  const limits = {projectId: PROJECT, functions: snapshot.functions.map(fn => ({name: fn.buildConfig.entryPoint, revision: fn.serviceConfig.revision,
    serviceMaximum: 20, revisionMaximum: fn.serviceConfig.maxInstanceCount, effectiveMaximum: fn.serviceConfig.maxInstanceCount,
    ready: true, allTrafficOnLatestRevision: true}))};
  const common = {capture, comparisonKey: KEY, source, toolBinding: clone(TOOL_BINDING), limitsBaseline: clone(limits),
    expectedBindings: prospectiveBindingRequest(capture).body.serviceConfig.secretEnvironmentVariables, now: NOW + 60_000};
  const before = {...common, phase: "before", snapshot: clone(snapshot), provenance: clone(originalProvenance), limitsObservation: clone(limits)};
  const checked = compareProspectiveBindingEvidence(before);
  if (checked.status !== "BASELINE_MATCH") throw new Error(`Fixture baseline failed: ${checked.issues.join(",")}`);
  const intent = {schemaVersion: "sodc-notify-binding-operator-intent/v1", projectId: PROJECT, target: TARGET_NAME,
    ...Object.fromEntries(["captureReportSha256", "limitsBaselineSha256", "requestSha256", "sourceBindingSha256", "comparisonToolBindingSha256"].map(key => [key, checked[key]])), startedAt: iso(10_000)};
  const afterSnapshot = clone(snapshot), afterTarget = afterSnapshot.functions[0];
  afterTarget.serviceConfig.secretEnvironmentVariables = clone(common.expectedBindings);
  afterTarget.serviceConfig.revision = `${TARGET.toLowerCase()}-updated`; afterTarget.updateTime = iso(20_000);
  if (rebuild) afterTarget.buildConfig.build = NEW_BUILD;
  const afterProvenance = provenance(afterTarget, rebuild);
  // An unchanged build retains the exact previously recorded build metadata.
  if (!rebuild) afterProvenance.functionBuild = clone(originalProvenance.functionBuild);
  const operation = {name: OPERATION, done: true, metadata: {target: TARGET_NAME, verb: "update", buildName: afterTarget.buildConfig.build}};
  if (rebuild) afterProvenance.operationBuild = clone(afterProvenance.functionBuild);
  const currentLimits = clone(limits); currentLimits.functions[0].revision = afterTarget.serviceConfig.revision;
  if (omission) {delete afterTarget.serviceConfig.maxInstanceCount; currentLimits.functions[0].revisionMaximum = null;}
  const after = {...common, phase: "after", snapshot: afterSnapshot, provenance: afterProvenance, limitsObservation: currentLimits,
    intent, operation, acknowledgement: {name: OPERATION}};
  return {before, after, target: afterTarget, originalProvenance};
}
function verified(options) {
  const result = compareProspectiveBindingEvidence(options);
  expect(result).toMatchObject({status: "METADATA_VERIFIED_WITH_PROVENANCE_LIMIT", originalContractAccepted: false,
    productionAuthorized: false, releaseAuthorized: false, sourceArchiveEquality: "UNPROVEN", executableEquality: "UNPROVEN", provenanceReviewRequired: true});
  return result;
}
function rejected(options, code) {
  const result = compareProspectiveBindingEvidence(options);
  expect(result.status).toBe("FAIL");
  if (code) expect(result.issues).toContain(code);
  expect(result).toMatchObject({productionAuthorized: false, releaseAuthorized: false, originalContractAccepted: false, providerWrites: 0});
  return result;
}
function localInputs(options) {
  return Object.fromEntries(["phase", "capture", "comparisonKey", "source", "toolBinding", "limitsBaseline", "intent", "acknowledgement", "now"]
    .filter(name => Object.hasOwn(options, name)).map(name => [name, options[name]]));
}

describe("local validation before provider construction", () => {
  it.each(["before", "after"])("validates %s with a callable clock and returns only bound context digests", phase => {
    const f = testCase(); const options = localInputs(f[phase]); options.now = () => NOW + 60_000;
    expect(validateProspectiveInputs(options)).toEqual(Object.fromEntries([
      "captureReportSha256", "limitsBaselineSha256", "requestSha256", "sourceBindingSha256", "comparisonToolBindingSha256",
    ].map(name => [name, f.after.intent[name]])));
  });
  it.each([
    ["capture", f => {f.capture.status = "APPROVED";}],
    ["key", f => {f.comparisonKey = Buffer.alloc(31);}],
    ["source", f => {f.source.binding.gitSha = "a".repeat(39);}],
    ["tool", f => {f.toolBinding.nodeMajor = 22;}],
    ["limit inventory", f => {f.limitsBaseline.functions.pop();}],
    ["extra sidecar field", f => {f.limitsBaseline.force = true;}],
    ["extra limit row field", f => {f.limitsBaseline.functions[0].force = true;}],
    ["missing intent", f => {delete f.intent;}],
    ["old intent hash", f => {f.intent.requestSha256 = "0".repeat(64);}],
    ["missing acknowledgement", f => {delete f.acknowledgement;}],
    ["unbound acknowledgement", f => {f.acknowledgement.response = {marker: "PRIVATE_MARKER"};}],
    ["new input flag", f => {f.force = true;}],
  ])("rejects local %s without inspecting an observation", (_name, change) => {
    const f = localInputs(testCase().after); change(f);
    let failure; try {validateProspectiveInputs(f);} catch (error) {failure = error;}
    expect(failure).toBeInstanceOf(Error); expect(failure.code).toMatch(/^[a-z0-9-]+$/);
    expect(failure.message).toBe(failure.code); expect(failure.message).not.toContain("PRIVATE_MARKER");
  });
});

describe("prospective metadata comparison", () => {
  it("reproduces the capture transformations before a write using its original private context", () => {
    const f = testCase(); const untouched = digest(f.before);
    const result = compareProspectiveBindingEvidence(f.before);
    expect(result).toMatchObject({status: "BASELINE_MATCH", comparisonKeyVerifiedByProtectedFingerprints: true, functionCount: 2,
      captureReportSha256: digest(f.before.capture), requestSha256: digest(prospectiveBindingRequest(f.before.capture)),
      sourceBindingSha256: digest(f.before.capture.sourceBinding), comparisonToolBindingSha256: digest(TOOL_BINDING)});
    expect(result.limits).toEqual({count: 2, maximum20: 2, maximum1: 0});
    expect(digest(f.before)).toBe(untouched);
  });
  it.each([false, true])("describes exactly one metadata request with fixed numeric existing keys (rebuild fixture=%s)", rebuild => {
    const f = testCase({rebuild}); const request = prospectiveBindingRequest(f.before.capture);
    expect(request).toEqual({method: "PATCH", url: `https://cloudfunctions.googleapis.com/v2/${TARGET_NAME}?updateMask=serviceConfig.secretEnvironmentVariables`,
      updateMask: "serviceConfig.secretEnvironmentVariables", body: {name: TARGET_NAME, serviceConfig: {secretEnvironmentVariables: [
        {key: "STRIPE_SECRET", secret: "STRIPE_SECRET", projectId: PROJECT, version: "2"},
        {key: "GOV_NOTIFY_LIVE_API_KEY", secret: "GOV_NOTIFY_LIVE_API_KEY", projectId: PROJECT, version: "1"},
        {key: "GOV_NOTIFY_TEAM_API_KEY", secret: "GOV_NOTIFY_TEAM_API_KEY", projectId: PROJECT, version: "1"},
        {key: "GOV_NOTIFY_TEST_API_KEY", secret: "GOV_NOTIFY_TEST_API_KEY", projectId: PROJECT, version: "2"},
      ]}}});
  });
  it.each([false, true])("verifies a completed exact change without granting authority (rebuild=%s)", rebuild => {
    const f = testCase({rebuild}); const untouched = digest(f.after);
    const report = verified(f.after); expect(report.buildChanged).toBe(rebuild); expect(digest(f.after)).toBe(untouched);
  });
  it("accepts actual maximum omission only with its existing explicit Run20 backstop", () => {
    const f = testCase({omission: true}); const result = verified(f.after);
    expect(result.targetMaximumFieldOmitted).toBe(true);
    expect(Object.hasOwn(f.target.serviceConfig, "maxInstanceCount")).toBe(false);
  });
  it("allows only array order changes within the exact approved four references", () => {
    const f = testCase(); f.target.serviceConfig.secretEnvironmentVariables.reverse(); verified(f.after);
  });
  it("preserves the stricter maintenance revision maximum", () => {
    const f = testCase({maintenance: true}); expect(verified(f.after).limits).toEqual({count: 2, maximum20: 1, maximum1: 1});
  });
  it("preserves unrelated secret names in the complete Function inventory", () => {
    const f = testCase({extraSecret: true}); verified(f.after);
    f.after.snapshot.functions[1].serviceConfig.secretEnvironmentVariables.at(-1).version = "9";
    rejected(f.after, "protected-function-drift");
  });
  it("permits only the original policy and scheduler volatile metadata exclusions", () => {
    const f = testCase();
    for (const policy of Object.values(f.after.snapshot.invokerPolicies)) policy.etag = "new-etag";
    for (const policy of Object.values(f.after.snapshot.secretPolicies)) policy.etag = "new-etag";
    for (const job of f.after.snapshot.schedulers) {job.lastAttemptTime = iso(40_000); job.scheduleTime = iso(50_000); job.status = {code: 0};}
    verified(f.after);
  });
  it("supports project-number aliases only inside the exact approved references", () => {
    const f = testCase(); for (const ref of f.target.serviceConfig.secretEnvironmentVariables) ref.projectId = NUMBER; verified(f.after);
  });
  it("returns pending without interpreting a still-changing snapshot or inventing success", () => {
    const f = testCase(); f.after.operation = {name: OPERATION}; delete f.after.snapshot; delete f.after.provenance; delete f.after.limitsObservation;
    expect(compareProspectiveBindingEvidence(f.after)).toMatchObject({status: "PENDING", productionAuthorized: false, releaseAuthorized: false});
  });

  it.each([
    ["wrong key", f => {f.before.comparisonKey = Buffer.alloc(32, 3);}],
    ["missing source", f => {delete f.before.source;}],
    ["source drift", f => {f.before.source.binding.gitSha = "9".repeat(40);}],
    ["target revision drift", f => {f.before.snapshot.functions[0].serviceConfig.revision = "reconcilemycheckoutsessionorders-other";}],
    ["target update drift", f => {f.before.snapshot.functions[0].updateTime = iso(1);}],
    ["target build drift", f => {f.before.snapshot.functions[0].buildConfig.build = NEW_BUILD;}],
    ["target new field", f => {f.before.snapshot.functions[0].privateNewField = "PRIVATE_SENTINEL";}],
    ["target maximum omission", f => {delete f.before.snapshot.functions[0].serviceConfig.maxInstanceCount;}],
    ["other function drift", f => {f.before.snapshot.functions[1].serviceConfig.timeoutSeconds++;}],
    ["limit drift", f => {f.before.limitsObservation.functions[0].revisionMaximum = 1; f.before.limitsObservation.functions[0].effectiveMaximum = 1;}],
    ["before build metadata drift", f => {f.before.provenance.functionBuild.value.finishTime = iso(99);}],
    ["limits from another target revision", f => {f.before.limitsObservation.functions[0].revision = "reconcilemycheckoutsessionorders-other"; f.before.limitsBaseline.functions[0].revision = "reconcilemycheckoutsessionorders-other";}],
    ["limits from another unrelated revision", f => {f.before.limitsObservation.functions[1].revision = "existingsender-other"; f.before.limitsBaseline.functions[1].revision = "existingsender-other";}],
  ])("rejects before-state %s", (_name, change) => {const f = testCase(); change(f); rejected(f.before);});

  it.each([
    ["wrong key", f => {f.after.comparisonKey = Buffer.alloc(32, 3);}],
    ["extra key", f => {f.target.serviceConfig.secretEnvironmentVariables.push({key: "UNRELATED", secret: "UNRELATED", projectId: PROJECT, version: "1"});}],
    ["missing key", f => {f.target.serviceConfig.secretEnvironmentVariables.pop();}],
    ["duplicate key", f => {f.target.serviceConfig.secretEnvironmentVariables[3] = clone(f.target.serviceConfig.secretEnvironmentVariables[0]);}],
    ["latest alias", f => {f.target.serviceConfig.secretEnvironmentVariables[2].version = "latest";}],
    ["Stripe version", f => {f.target.serviceConfig.secretEnvironmentVariables[0].version = "3";}],
    ["foreign project", f => {f.target.serviceConfig.secretEnvironmentVariables[1].projectId = "foreign-project";}],
    ["unknown reference property", f => {f.target.serviceConfig.secretEnvironmentVariables[1].extra = true;}],
    ["caller changes requested refs", f => {f.after.expectedBindings[0].version = "4";}],
    ["source code binding", f => {f.after.source.binding.gitSha = "9".repeat(40);}],
    ["unrelated function", f => {f.after.snapshot.functions[1].serviceConfig.timeoutSeconds++;}],
    ["removed function", f => {f.after.snapshot.functions.pop();}],
    ["duplicate function", f => {f.after.snapshot.functions.push(clone(f.after.snapshot.functions[0]));}],
    ["different inventory", f => {f.after.snapshot.functions[1].name += "new";}],
    ["target runtime identity", f => {f.target.serviceConfig.serviceAccountEmail = "other@example.invalid";}],
    ["target CPU", f => {f.target.serviceConfig.availableCpu = "2";}],
    ["target memory", f => {f.target.serviceConfig.availableMemory = "512Mi";}],
    ["target network", f => {f.target.serviceConfig.vpcConnector = "new-network";}],
    ["target concurrency", f => {f.target.serviceConfig.maxInstanceRequestConcurrency++;}],
    ["target ingress", f => {f.target.serviceConfig.ingressSettings = "ALLOW_INTERNAL_ONLY";}],
    ["target source", f => {f.target.buildConfig.source.storageSource.generation = "8";}],
    ["target source provenance", f => {f.target.buildConfig.sourceProvenance.resolvedStorageSource.generation = "8";}],
    ["target build option", f => {f.target.buildConfig.workerPool = "new-worker";}],
    ["target build environment", f => {f.target.buildConfig.environmentVariables = {PRIVATE_SENTINEL: "PRIVATE_VALUE"};}],
    ["target delivery ceiling", f => {f.target.serviceConfig.environmentVariables.GOV_NOTIFY_DELIVERY_MODE = "LIVE";}],
    ["target environment removal", f => {delete f.target.serviceConfig.environmentVariables.PRIVATE_LEGACY_VALUE;}],
    ["unknown root field", f => {f.target.unknownField = {secret: "PRIVATE_SENTINEL"};}],
    ["unknown nested field", f => {f.target.buildConfig.unknownField = "PRIVATE_SENTINEL";}],
    ["label change", f => {f.target.labels["firebase-functions-hash"] = "changed";}],
    ["null versus absent", f => {f.target.serviceConfig.newOptionalField = null;}],
    ["max null versus absent", f => {f.target.serviceConfig.maxInstanceCount = null;}],
    ["maximum100", f => {f.target.serviceConfig.maxInstanceCount = 100;}],
    ["target no new revision", f => {f.target.serviceConfig.revision = f.after.capture.baseline.targetObservation.revision;}],
    ["target old timestamp", f => {f.target.updateTime = iso(-1);}],
    ["target failed state", f => {f.target.state = "FAILED";}],
    ["target traffic split", f => {f.target.serviceConfig.allTrafficOnLatestRevision = false;}],
    ["target state error", f => {f.target.stateMessages = [{message: "PRIVATE_ERROR"}];}],
    ["null state messages", f => {f.target.stateMessages = null;}],
    ["invoker grant", f => {f.after.snapshot.invokerPolicies[TARGET].bindings[0].members.push("allAuthenticatedUsers");}],
    ["secret policy grant", f => {f.after.snapshot.secretPolicies.STRIPE_SECRET.bindings[0].members.push("user:other@example.invalid");}],
    ["secret policy condition", f => {f.after.snapshot.secretPolicies.STRIPE_SECRET.bindings[0].condition = null;}],
    ["secret version disabled", f => {f.after.snapshot.secretVersions.STRIPE_SECRET.numeric.state = "DISABLED";}],
    ["latest version drift", f => {f.after.snapshot.secretVersions.STRIPE_SECRET.latest.name = `projects/${PROJECT}/secrets/STRIPE_SECRET/versions/3`;}],
    ["payload in metadata", f => {f.after.snapshot.secretVersions.STRIPE_SECRET.numeric.payload = {data: "PRIVATE_PAYLOAD"};}],
    ["scheduler schedule", f => {f.after.snapshot.schedulers[0].schedule = "*/7 * * * *";}],
    ["scheduler target", f => {f.after.snapshot.schedulers[0].httpTarget.uri = "https://other.invalid";}],
    ["scheduler disabled", f => {f.after.snapshot.schedulers[0].state = "PAUSED";}],
    ["scheduler removed", f => {f.after.snapshot.schedulers.pop();}],
  ])("rejects after-state %s", (_name, change) => {const f = testCase(); change(f); rejected(f.after);});

  it.each([
    ["unrelated service cap", f => {f.after.limitsObservation.functions[1].serviceMaximum = 10; f.after.limitsObservation.functions[1].effectiveMaximum = 10;}],
    ["invented effective value", f => {f.after.limitsObservation.functions[0].effectiveMaximum = 10;}],
    ["missing caps", f => {f.after.limitsObservation.functions[0].serviceMaximum = null; f.after.limitsObservation.functions[0].revisionMaximum = null;}],
    ["wrong serving revision", f => {f.after.limitsObservation.functions[0].revision = "reconcilemycheckoutsessionorders-other";}],
    ["not ready", f => {f.after.limitsObservation.functions[0].ready = false;}],
    ["missing limit row", f => {f.after.limitsObservation.functions.pop();}],
    ["duplicate limit row", f => {f.after.limitsObservation.functions.push(clone(f.after.limitsObservation.functions[0]));}],
    ["foreign limit project", f => {f.after.limitsObservation.projectId = "sodc-web";}],
    ["removed maximum without service20", f => {delete f.target.serviceConfig.maxInstanceCount; f.after.limitsObservation.functions[0].revisionMaximum = null; f.after.limitsObservation.functions[0].serviceMaximum = 100; f.after.limitsObservation.functions[0].effectiveMaximum = 100;}],
  ])("rejects %s", (_name, change) => {const f = testCase(); change(f); rejected(f.after);});
  it("does not raise the three explicit maintenance caps to match a broad20 assumption", () => {
    const f = testCase({maintenance: true}); f.after.limitsObservation.functions[1].revisionMaximum = 20; f.after.limitsObservation.functions[1].effectiveMaximum = 20; rejected(f.after);
  });

  it.each([
    ["missing acknowledgement", f => {delete f.after.acknowledgement;}],
    ["wrong acknowledgement", f => {f.after.acknowledgement.name += "other";}],
    ["extra acknowledgement field", f => {f.after.acknowledgement.extra = true;}],
    ["wrong operation", f => {f.after.operation.name += "other";}],
    ["wrong target", f => {f.after.operation.metadata.target = `${PREFIX}/functions/other`;}],
    ["wrong verb", f => {f.after.operation.metadata.verb = "create";}],
    ["missing operation scope", f => {delete f.after.operation.metadata;}],
    ["operation error", f => {f.after.operation.error = {code: 7, message: "PRIVATE_ERROR"};}],
    ["missing intent", f => {delete f.after.intent;}],
    ["intent wrong target", f => {f.after.intent.target += "other";}],
    ["intent old capture", f => {f.after.intent.captureReportSha256 = "0".repeat(64);}],
    ["intent other request", f => {f.after.intent.requestSha256 = "0".repeat(64);}],
    ["intent other source", f => {f.after.intent.sourceBindingSha256 = "0".repeat(64);}],
    ["intent other comparator", f => {f.after.intent.comparisonToolBindingSha256 = "0".repeat(64);}],
    ["intent other limit sidecar", f => {f.after.intent.limitsBaselineSha256 = "0".repeat(64);}],
    ["intent old timestamp", f => {f.after.intent.startedAt = iso(-1);}],
    ["intent future timestamp", f => {f.after.intent.startedAt = iso(120_000);}],
    ["intent extra field", f => {f.after.intent.waiveSource = true;}],
    ["tool changed", f => {f.after.toolBinding.gitSha = "8".repeat(40);}],
    ["baseline limits changed", f => {f.after.limitsBaseline.functions[0].serviceMaximum = null;}],
  ])("rejects %s", (_name, change) => {const f = testCase(); change(f); rejected(f.after);});

  it.each([
    ["failed build", f => {f.after.provenance.functionBuild.value.status = "FAILURE";}],
    ["working build", f => {f.after.provenance.functionBuild.value.status = "WORKING";}],
    ["old rebuild", f => {f.after.provenance.functionBuild.value.createTime = iso(9_999); f.after.provenance.operationBuild.value.createTime = iso(9_999);}],
    ["wrong operation build", f => {f.after.operation.metadata.buildName = OLD_BUILD;}],
    ["missing operation build", f => {delete f.after.operation.metadata.buildName;}],
    ["unavailable operation build", f => {f.after.provenance.operationBuild = {state: "UNAVAILABLE"};}],
    ["other operation metadata", f => {f.after.provenance.operationBuild.value.id = "00000000-0000-4000-8000-000000000003";}],
    ["missing function build", f => {f.after.provenance.functionBuild = {state: "UNAVAILABLE"};}],
    ["unrelated source metadata", f => {f.after.provenance.sourceObject.value.generation = "8";}],
    ["unavailable source metadata", f => {f.after.provenance.sourceObject = {state: "UNAVAILABLE"};}],
    ["wrong image revision", f => {f.after.provenance.currentRevision.value.name = `${SERVICE}/revisions/reconcilemycheckoutsessionorders-other`;}],
    ["missing image observation", f => {f.after.provenance.currentRevision = {state: "UNAVAILABLE"};}],
    ["different resolved build input", f => {f.after.provenance.functionBuild.value.resolvedSource = {bucket: BUCKET, object: "other.zip", generation: "7"};}],
    ["unbound source hash", f => {f.after.provenance.functionBuild.value.archiveSha256 = "f".repeat(64);}],
  ])("rejects %s", (_name, change) => {const f = testCase(); change(f); rejected(f.after);});
  it("allows a rebuild created exactly at the intent instant", () => {
    const f = testCase(); f.after.provenance.functionBuild.value.createTime = f.after.intent.startedAt; f.after.provenance.operationBuild.value.createTime = f.after.intent.startedAt; verified(f.after);
  });
  it.each(["FAILURE", "WORKING"])("rejects a matching %s Function/operation build rather than relying on their mismatch", status => {
    const f = testCase();
    f.after.provenance.functionBuild.value.status = status;
    f.after.provenance.operationBuild.value.status = status;
    rejected(f.after, "build-or-source-metadata-drift");
  });
  it.each([
    ["unchanged build record", f => {f.after.provenance.functionBuild.value.finishTime = iso(17_000);}],
    ["changed image despite unchanged build", f => {f.after.provenance.currentRevision.value.images[0].image = IMAGE("b");}],
    ["different operation build", f => {f.after.operation.metadata.buildName = NEW_BUILD;}],
  ])("rejects %s in the no-rebuild branch", (_name, change) => {const f = testCase({rebuild: false}); change(f); rejected(f.after);});
  it("does not use the unchanged-build branch as a fallback from a failed rebuild", () => {
    const f = testCase(); f.after.provenance.functionBuild.value.status = "FAILURE";
    f.after.provenance.currentRevision.value.images = clone(f.originalProvenance.currentRevision.value.images);
    rejected(f.after);
  });
  it("never infers archive or executable equality from MD5/CRC or images", () => {
    const f = testCase({rebuild: false}); const result = verified(f.after);
    expect(result.sourceArchiveEquality).toBe("UNPROVEN"); expect(result.executableEquality).toBe("UNPROVEN");
    expect(result.provenanceReviewRequired).toBe(true);
  });
  it.each(["acceptProvenanceGap", "allowSourceDrift", "apply", "waive", "force"]) ("rejects a %s override", name => {
    const f = testCase(); f.after[name] = true; rejected(f.after, "unsupported-comparison-option");
  });
  it("sanitizes rejected metadata and never serializes raw environment/IAM/provider values", () => {
    const f = testCase(); f.after.operation.error = {code: 7, message: "PRIVATE_PROVIDER_MESSAGE", token: "PRIVATE_TOKEN"};
    const text = JSON.stringify(rejected(f.after));
    for (const marker of ["PRIVATE_PROVIDER_MESSAGE", "PRIVATE_TOKEN", "PRIVATE_ENV_VALUE_744", "ops-fixture@example.invalid", "allUsers"]) expect(text).not.toContain(marker);
  });
});

describe("independent safety boundaries", () => {
  it("G1 rejects deletion of a captured leaf even when its permitted parent changes", () => {
    const f = testCase();
    delete f.target.serviceConfig.service;
    rejected(f.after, "protected-target-component-drift");
  });
  it("G2 rejects a maintenance cap raised in both the bound baseline and observation", () => {
    const f = testCase({maintenance: true});
    for (const limits of [f.after.limitsBaseline, f.after.limitsObservation]) {
      const maintenance = limits.functions.find(row => row.name === "recoverNotificationDeliveries");
      maintenance.revisionMaximum = 20;
      maintenance.effectiveMaximum = 20;
    }
    // Isolate the maintenance ceiling from the independent sidecar-digest guard.
    f.after.intent.limitsBaselineSha256 = digest(f.after.limitsBaseline);
    rejected(f.after, "unapproved-baseline-limit");
  });
  it("G3 rejects non-latest observed target traffic while Function metadata still claims latest", () => {
    const f = testCase();
    f.after.limitsObservation.functions.find(row => row.name === TARGET).allTrafficOnLatestRevision = false;
    expect(f.target.serviceConfig.allTrafficOnLatestRevision).toBe(true);
    rejected(f.after, "invalid-limit-observation");
  });
  it("G4 rejects an invented effective20 with both explicit maxima absent in both bound observations", () => {
    const f = testCase();
    for (const limits of [f.after.limitsBaseline, f.after.limitsObservation]) {
      const target = limits.functions.find(row => row.name === TARGET);
      target.serviceMaximum = null;
      target.revisionMaximum = null;
      target.effectiveMaximum = 20;
    }
    f.after.intent.limitsBaselineSha256 = digest(f.after.limitsBaseline);
    rejected(f.after, "unproven-effective-limit");
  });
  it("G5 rejects reuse of the captured revision with otherwise coherent provenance and limits", () => {
    const f = testCase();
    const original = f.after.capture.baseline.targetObservation.revision;
    f.target.serviceConfig.revision = original;
    f.after.provenance.currentRevision.value.name = `${SERVICE}/revisions/${original}`;
    f.after.limitsObservation.functions.find(row => row.name === TARGET).revision = original;
    rejected(f.after, "target-revision-or-update-not-attributed");
  });
  it.each(["source", "resolvedSource"])("G6 rejects non-null wrong %s even when Function and operation builds agree", field => {
    const f = testCase();
    const wrong = {bucket: BUCKET, object: "different-function-source.zip", generation: "7"};
    f.after.provenance.functionBuild.value[field] = clone(wrong);
    f.after.provenance.operationBuild.value[field] = clone(wrong);
    expect(f.after.provenance.functionBuild).toEqual(f.after.provenance.operationBuild);
    rejected(f.after, "build-source-context-mismatch");
  });
  it("G8 rejects omitted maximum unless the captured actual component was exactly20", () => {
    const f = testCase({omission: true});
    const original = clone(f.before.snapshot.functions[0]);
    original.serviceConfig.maxInstanceCount = 30;
    // A synthetic older component tree is needed because v1 capture itself
    // refuses non20. Recompute every affected HMAC, rather than corrupting a
    // digest and accidentally exercising a different comparison-key guard.
    const fingerprint = value => createHmac("sha256", KEY).update(JSON.stringify(canonical(value))).digest("hex");
    const fields = {};
    const walk = (value, pointer) => {
      fields[fingerprint(pointer)] = fingerprint({present: true, value});
      if (value && typeof value === "object") for (const [name, child] of Object.entries(value)) {
        walk(child, `${pointer}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`);
      }
    };
    walk(original, "");
    const captured = f.after.capture;
    captured.targetComponents.fullHmac = fingerprint(original);
    captured.targetComponents.fieldHmacs = fields;
    captured.targetComponents.selectedHmacs["/serviceConfig"] = fingerprint({present: true, value: original.serviceConfig});
    captured.targetComponents.selectedHmacs["/serviceConfig/maxInstanceCount"] = fingerprint({present: true, value: 30});
    const protectedFunction = clone(original);
    delete protectedFunction.updateTime; delete protectedFunction.stateMessages;
    delete protectedFunction.serviceConfig.revision; delete protectedFunction.serviceConfig.secretEnvironmentVariables;
    captured.baseline.functions[TARGET] = fingerprint(protectedFunction);
    captured.checks.targetMaxInstances = 30;
    f.after.intent.captureReportSha256 = digest(captured);
    rejected(f.after, "captured-maximum-not20");
  });
});
