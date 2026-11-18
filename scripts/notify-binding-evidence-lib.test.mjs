import {beforeEach, afterEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {TARGET, NOTIFY_KEYS, verifyRepair} from "./notify-secret-binding-repair-lib.mjs";
import {captureBindingEvidence, reconcileBindingEvidence} from "./notify-binding-evidence-lib.mjs";
import {PREFIX, TARGET_NAME, OPERATION, NOW, KEY, clone, operationRecord} from "./test-fixtures/notify-binding-repair-fixture.mjs";
import {ORIGINAL_DIRECTORY, TOOL_BINDING, NEW_BUILD, emptyProvenance, evidenceFixture} from "./test-fixtures/binding-evidence-fixture.mjs";

beforeEach(() => {vi.stubGlobal("fetch", vi.fn(() => {throw new Error("UNEXPECTED_LIVE_NETWORK_IN_EVIDENCE_TEST");}));});
afterEach(() => {
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();}
});

function noMutation(f) {
  expect(f.provider.patchBindings).not.toHaveBeenCalled();
  expect(f.f.store.writeOnce).not.toHaveBeenCalled();
}
function neverAuthorizes(report) {
  expect(report.status).not.toBe("PASS");
  expect(report.originalContractAccepted).toBe(false);
  expect(report.productionAuthorized).toBe(false);
}
async function reconcile(f, extra = {}) {
  return reconcileBindingEvidence({...f.reconcileOptions(), ...extra});
}

describe("read-only reconciliation of the original known operation", () => {
  it("reports a real rebuild with historical gaps without replacing the original contract", async () => {
    const f = evidenceFixture();
    const before = JSON.stringify(f.original);
    const report = await reconcile(f);
    expect(report).toMatchObject({schemaVersion: "sodc-notify-binding-reconciliation/v1",
      status: "REVIEW_REQUIRED_WITH_HISTORICAL_GAPS", historicalTargetPreservation: "UNKNOWN", sourceArchiveEquality: "UNPROVEN"});
    neverAuthorizes(report); noMutation(f);
    expect(JSON.stringify(f.original)).toBe(before);
    expect(f.provider.snapshot).toHaveBeenCalledTimes(1);
    expect(f.provider.operation).toHaveBeenCalledExactlyOnceWith(OPERATION);
    expect(f.provider.provenance).toHaveBeenCalledTimes(1);
    expect(f.provider.snapshot.mock.invocationCallOrder[0]).toBeLessThan(f.provider.operation.mock.invocationCallOrder[0]);
  });

  it("continues read-only reconciliation after proposal expiry using the original timely approval and intent", async () => {
    const f = evidenceFixture();
    const report = await reconcile(f, {now: NOW + 7 * 24 * 60 * 60 * 1000});
    expect(report.status).toBe("REVIEW_REQUIRED_WITH_HISTORICAL_GAPS"); neverAuthorizes(report); noMutation(f);
  });

  it("never treats an unchanged target fingerprint as release authorization or historical source proof", async () => {
    const f = evidenceFixture({rebuild: false});
    const report = await reconcile(f);
    neverAuthorizes(report);
    expect(report.sourceArchiveEquality).toBe("UNPROVEN");
    noMutation(f);
  });

  it("does not turn the new report into a PASS for the still-failing original v1 verifier", async () => {
    const f = evidenceFixture();
    const oldStore = {read: vi.fn(async name => ({"intent.json": f.original.intent, "operation.json": f.original.operation})[name] ?? null)};
    await expect(verifyRepair({proposal: f.original.proposal, comparisonKey: KEY, provider: f.provider,
      readSource: async () => clone(f.source), store: oldStore, now: NOW + 60_000})).rejects.toThrow("provider-baseline-drift");
    const report = await reconcile(f);
    expect(report.status).toBe("REVIEW_REQUIRED_WITH_HISTORICAL_GAPS"); neverAuthorizes(report); noMutation(f);
    await expect(verifyRepair({proposal: f.original.proposal, comparisonKey: KEY, provider: f.provider,
      readSource: async () => clone(f.source), store: oldStore, now: NOW + 60_000})).rejects.toThrow("provider-baseline-drift");
  });

  it("keeps an absent acknowledgement unknown without querying live state", async () => {
    const f = evidenceFixture(); f.original.operation = null;
    const report = await reconcile(f);
    expect(report.status).toBe("UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"); neverAuthorizes(report);
    expect(f.provider.snapshot).not.toHaveBeenCalled();
    expect(f.provider.operation).not.toHaveBeenCalled();
    expect(f.provider.provenance).not.toHaveBeenCalled(); noMutation(f);
  });

  it("keeps an omitted acknowledgement unknown without inferring success", async () => {
    const f = evidenceFixture(); delete f.original.operation;
    const report = await reconcile(f);
    expect(report.status).toBe("UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"); neverAuthorizes(report);
    expect(f.provider.snapshot).not.toHaveBeenCalled(); noMutation(f);
  });

  it("returns PENDING without fabricating preservation or requesting artifact evidence", async () => {
    const f = evidenceFixture(); f.provider.operation.mockResolvedValue(operationRecord({done: false}));
    const report = await reconcile(f);
    expect(report.status).toBe("PENDING"); neverAuthorizes(report);
    expect(f.provider.provenance).not.toHaveBeenCalled(); noMutation(f);
  });

  it("allows a pending name-only operation without treating it as completed", async () => {
    const f = evidenceFixture(); f.provider.operation.mockResolvedValue({name: OPERATION});
    const report = await reconcile(f);
    expect(report.status).toBe("PENDING"); neverAuthorizes(report);
    expect(f.provider.provenance).not.toHaveBeenCalled(); noMutation(f);
  });

  it("returns operation failure with only the numeric code and no provider messages", async () => {
    const f = evidenceFixture();
    f.provider.operation.mockResolvedValue(operationRecord({done: true,
      error: {code: 7, message: "PRIVATE_PROVIDER_ERROR_746", details: [{token: "PRIVATE_DETAIL_TOKEN_746"}]}}));
    const report = await reconcile(f);
    expect(report.status).toBe("OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED"); neverAuthorizes(report);
    expect(JSON.stringify(report)).not.toContain("PRIVATE_PROVIDER_ERROR_746");
    expect(JSON.stringify(report)).not.toContain("PRIVATE_DETAIL_TOKEN_746");
    expect(f.provider.provenance).not.toHaveBeenCalled(); noMutation(f);
  });

  it.each([
    ["missing approval", f => {f.original.review = null;}],
    ["approval decision", f => {f.original.review.decision = "REVIEW_REQUIRED";}],
    ["approval hash", f => {f.original.review.proposalSha256 = "0".repeat(64);} ],
    ["approval reviewer placeholder", f => {f.original.review.reviewedBy = "REPLACE_AFTER_REVIEW";}],
    ["approval reason placeholder", f => {f.original.review.reason = " replace_after_review ";}],
    ["missing intent", f => {f.original.intent = null;}],
    ["intent schema", f => {f.original.intent.schemaVersion = "other";}],
    ["intent proposal hash", f => {f.original.intent.proposalSha256 = "0".repeat(64);} ],
    ["intent review hash", f => {f.original.intent.reviewSha256 = "0".repeat(64);} ],
    ["intent before proposal", f => {f.original.intent.startedAt = new Date(NOW - 1).toISOString();}],
    ["intent after expiry", f => {f.original.intent.startedAt = new Date(NOW + 60 * 60 * 1000 + 1).toISOString();}],
    ["invalid intent time", f => {f.original.intent.startedAt = "PRIVATE_INVALID_TIME";}],
    ["missing claim", f => {f.original.claim = null;}],
    ["claim schema", f => {f.original.claim.schemaVersion = "other";}],
    ["claim proposal hash", f => {f.original.claim.proposalSha256 = "0".repeat(64);} ],
    ["claim project", f => {f.original.claim.projectId = "sodc-web-production";}],
    ["claim target", f => {f.original.claim.target = `${PREFIX}/functions/other`;}],
    ["claim run directory", f => {f.original.claim.runDirectory = `${ORIGINAL_DIRECTORY}-other`;}],
    ["acknowledgement different project", f => {f.original.operation.name = "projects/sodc-web-production/locations/europe-west2/operations/other";}],
    ["acknowledgement different region", f => {f.original.operation.name = "projects/sodc-web/locations/us-central1/operations/other";}],
  ])("rejects invalid original %s before provider calls", async (_label, change) => {
    const f = evidenceFixture(); change(f);
    await expect(reconcile(f)).rejects.toThrow();
    expect(f.provider.snapshot).not.toHaveBeenCalled(); expect(f.provider.operation).not.toHaveBeenCalled();
    expect(f.provider.provenance).not.toHaveBeenCalled(); noMutation(f);
  });

  it.each(["prod", "beta", "production", "", undefined])("rejects reconciliation environment %j", async environment => {
    const f = evidenceFixture();
    await expect(reconcile(f, {environment})).rejects.toThrow();
    expect(f.provider.snapshot).not.toHaveBeenCalled(); noMutation(f);
  });

  it.each([
    ["revision", source => {source.binding.gitSha = "0".repeat(40);} ],
    ["tree", source => {source.binding.tree = "0".repeat(40);} ],
    ["tracked bytes", source => {source.binding.trackedSha256 = "0".repeat(64);} ],
    ["build", source => {source.binding.buildSha256 = "0".repeat(64);} ],
    ["SDK binary", source => {source.binding.sdk.binarySha256 = "0".repeat(64);} ],
    ["SDK package", source => {source.binding.sdk.packageSha256 = "0".repeat(64);} ],
    ["manifest", source => {source.manifest.endpoints[TARGET].secretEnvironmentVariables.pop(); source.binding.manifestSha256 = digest(source.manifest);} ],
  ])("rejects a different original source %s before provider calls", async (_label, change) => {
    const f = evidenceFixture(); const source = clone(f.source); change(source);
    await expect(reconcile(f, {originalSource: source})).rejects.toThrow();
    expect(f.provider.snapshot).not.toHaveBeenCalled(); noMutation(f);
  });

  it.each([
    ["missing tool binding", undefined],
    ["tool revision", {...TOOL_BINDING, gitSha: "invalid"}],
    ["tool tree", {...TOOL_BINDING, tree: "invalid"}],
    ["tool tracked bytes", {...TOOL_BINDING, trackedSha256: "invalid"}],
    ["tool node", {...TOOL_BINDING, nodeMajor: 25}],
    ["unexpected tool field", {...TOOL_BINDING, waiveSource: true}],
  ])("rejects %s before provider calls", async (_label, toolBinding) => {
    const f = evidenceFixture(); await expect(reconcile(f, {toolBinding})).rejects.toThrow();
    expect(f.provider.snapshot).not.toHaveBeenCalled(); noMutation(f);
  });

  it.each([
    operationRecord({name: `${PREFIX}/operations/other`, done: true}),
    operationRecord({metadata: {target: `${PREFIX}/functions/existingSender`, verb: "update"}, done: true}),
    operationRecord({metadata: {target: TARGET_NAME, verb: "create"}, done: true}),
    {name: OPERATION, done: true},
    operationRecord({done: "true"}),
  ])("rejects mismatched completed operation scope", async operation => {
    const f = evidenceFixture(); f.provider.operation.mockResolvedValue(operation);
    await expect(reconcile(f)).rejects.toThrow();
    expect(f.provider.provenance).not.toHaveBeenCalled(); noMutation(f);
  });

  it.each([
    ["unrelated Function label", f => {f.f.snapshot.functions[1].labels.extra = "different";}],
    ["unrelated Function environment", f => {f.f.snapshot.functions[1].serviceConfig.environmentVariables.PRIVATE_LEGACY_VALUE = "different";}],
    ["invoker policy", f => {f.f.snapshot.invokerPolicies[TARGET].bindings = [];}],
    ["Scheduler cadence", f => {f.f.snapshot.schedulers[0].schedule = "*/10 * * * *";}],
    ["Scheduler time zone", f => {f.f.snapshot.schedulers[0].timeZone = "UTC";}],
    ["Scheduler retry", f => {f.f.snapshot.schedulers[0].retryConfig = {retryCount: 3};}],
    ["secret policy", f => {f.f.snapshot.secretPolicies[NOTIFY_KEYS[0]].bindings[0].members.push("user:other@example.invalid");}],
    ["target maximum instances", f => {f.target.serviceConfig.maxInstanceCount = 19;}],
    ["target runtime identity", f => {f.target.serviceConfig.serviceAccountEmail = "other@example.invalid";}],
    ["target generation", f => {f.target.environment = "GEN_1";}],
    ["target runtime", f => {f.target.buildConfig.runtime = "nodejs22";}],
    ["target binding removed", f => {f.target.serviceConfig.secretEnvironmentVariables.pop();}],
    ["target binding added", f => {f.target.serviceConfig.secretEnvironmentVariables.push({key: "OTHER_SECRET", secret: "OTHER_SECRET", version: "1", projectId: "sodc-web"});}],
    ["runtime grant removed", f => {f.f.snapshot.secretPolicies[NOTIFY_KEYS[0]].bindings = [];}],
  ])("reports BLOCKED_DRIFT for %s without treating rebuilds as blanket exceptions", async (_label, change) => {
    const f = evidenceFixture(); change(f);
    const report = await reconcile(f);
    expect(report.status).toBe("BLOCKED_DRIFT"); neverAuthorizes(report);
    expect(f.provider.provenance).not.toHaveBeenCalled(); noMutation(f);
  });

  it("blocks a newly enabled, consistently bound secret version that was not in the approved change", async () => {
    const f = evidenceFixture(); const key = NOTIFY_KEYS[0];
    for (const fn of f.f.snapshot.functions) for (const ref of fn.serviceConfig.secretEnvironmentVariables) if (ref.key === key) ref.version = "3";
    for (const kind of ["numeric", "latest"]) f.f.snapshot.secretVersions[key][kind].name = `projects/sodc-web/secrets/${key}/versions/3`;
    const report = await reconcile(f);
    expect(report.status).toBe("BLOCKED_DRIFT"); neverAuthorizes(report); noMutation(f);
    expect(f.provider.provenance).not.toHaveBeenCalled();
  });

  it("does not expose environment values, IAM members, raw operations, keys or unknown artifact fields", async () => {
    const f = evidenceFixture();
    const provenance = emptyProvenance();
    provenance.unexpected = "PRIVATE_PROVENANCE_CANARY";
    provenance.currentRevision = {state: "UNAVAILABLE", reason: "PRIVATE_REASON_CANARY", raw: {env: "PRIVATE_RAW_ENV"}};
    f.provider.provenance.mockResolvedValue(provenance);
    f.provider.operation.mockResolvedValue(operationRecord({done: true, response: {secret: "PRIVATE_OPERATION_RESPONSE"},
      metadata: {target: TARGET_NAME, verb: "update", requestResource: {secret: "PRIVATE_REQUEST_RESOURCE"}, sourceToken: "PRIVATE_SOURCE_TOKEN"}}));
    const report = await reconcile(f); const json = JSON.stringify(report);
    for (const value of ["PRIVATE_ENV_VALUE_744", "ops-fixture@example.invalid", "PRIVATE_PROVENANCE_CANARY", "PRIVATE_REASON_CANARY",
      "PRIVATE_RAW_ENV", "PRIVATE_OPERATION_RESPONSE", "PRIVATE_REQUEST_RESOURCE", "PRIVATE_SOURCE_TOKEN", KEY.toString("hex"), KEY.toString("base64"),
      JSON.stringify([...KEY]), '"comparisonKey"', '"type":"Buffer"']) expect(json).not.toContain(value);
    neverAuthorizes(report); noMutation(f);
  });

  it("does not promote matching new-build source hashes into missing historical source proof", async () => {
    const f = evidenceFixture();
    const provenance = emptyProvenance();
    const source = {bucket: "gcf-v2-sources-123-europe-west2", object: `${TARGET}/function-source.zip`, generation: "9"};
    const build = {name: NEW_BUILD, id: "01234567-89ab-cdef-0123-456789abcdef", status: "SUCCESS",
      createTime: new Date(NOW).toISOString(), startTime: new Date(NOW).toISOString(), finishTime: new Date(NOW + 1000).toISOString(),
      source, resolvedSource: clone(source), archiveSha256: "a".repeat(64), images: [],
      steps: [{env: ["PRIVATE_BUILD_STEP_TOKEN"]}], substitutions: {secret: "PRIVATE_BUILD_SUBSTITUTION"}, secrets: ["PRIVATE_BUILD_SECRET"]};
    provenance.functionBuild = {state: "AVAILABLE", value: build};
    provenance.operationBuild = {state: "AVAILABLE", value: clone(build)};
    provenance.currentRevision = {state: "AVAILABLE", value: {
      name: `${PREFIX}/services/${TARGET.toLowerCase()}/revisions/${f.target.serviceConfig.revision}`,
      createTime: new Date(NOW + 1000).toISOString(), images: [{name: "worker", image: `europe-west2-docker.pkg.dev/sodc-web/gcf-artifacts/fixture@sha256:${"b".repeat(64)}`}],
      buildAnnotations: {}, containers: [{env: "PRIVATE_REVISION_ENV"}], annotations: {token: "PRIVATE_ARBITRARY_ANNOTATION"}}};
    f.provider.provenance.mockResolvedValue(provenance);
    f.provider.operation.mockResolvedValue(operationRecord({done: true, metadata: {target: TARGET_NAME, verb: "update", buildName: NEW_BUILD}}));
    const report = await reconcile(f); const json = JSON.stringify(report);
    expect(report.sourceArchiveEquality).toBe("UNPROVEN");
    expect(report.historicalTargetPreservation).toBe("UNKNOWN"); neverAuthorizes(report);
    for (const canary of ["PRIVATE_BUILD_STEP_TOKEN", "PRIVATE_BUILD_SUBSTITUTION", "PRIVATE_BUILD_SECRET", "PRIVATE_REVISION_ENV", "PRIVATE_ARBITRARY_ANNOTATION"]) expect(json).not.toContain(canary);
    noMutation(f);
  });

  it("blocks a current Function build that does not belong to the acknowledged operation", async () => {
    const f = evidenceFixture();
    f.provider.operation.mockResolvedValue(operationRecord({done: true, metadata: {target: TARGET_NAME, verb: "update",
      buildName: `${PREFIX}/builds/fedcba98-7654-3210-fedc-ba9876543210`}}));
    const report = await reconcile(f);
    expect(report).toMatchObject({status: "BLOCKED_DRIFT", issues: ["operation-build-not-current"]});
    neverAuthorizes(report); noMutation(f);
    expect(f.provider.provenance).not.toHaveBeenCalled();
  });

  it("does not confirm a rebuild when the current Function has no correlated build reference", async () => {
    const f = evidenceFixture(); const provenance = emptyProvenance();
    delete f.target.buildConfig.build;
    provenance.operationBuild = {state: "AVAILABLE", value: {name: NEW_BUILD,id: "01234567-89ab-cdef-0123-456789abcdef",status: "SUCCESS",
      createTime: new Date(NOW).toISOString(), source: null,resolvedSource: null,archiveSha256: null,images: []}};
    f.provider.provenance.mockResolvedValue(provenance);
    f.provider.operation.mockResolvedValue(operationRecord({done: true,metadata: {target: TARGET_NAME,verb: "update",buildName: NEW_BUILD}}));
    const report = await reconcile(f);
    expect(report.providerRebuild).toBe("UNKNOWN");
    expect(report.issues).toContain("current-build-reference-missing");
    expect(report.sourceArchiveEquality).toBe("UNPROVEN"); neverAuthorizes(report); noMutation(f);
  });

  it.each([
    ["equal immutable images", "a".repeat(64), "a".repeat(64), "MATCHED"],
    ["different immutable images", "a".repeat(64), "b".repeat(64), "DIFFERENT"],
    ["mutable image tags", null, null, "UNKNOWN"],
  ])("reports %s without granting source identity", async (_label, oldDigest, newDigest, expected) => {
    const f = evidenceFixture(); const provenance = emptyProvenance();
    const image = digest => `europe-west2-docker.pkg.dev/sodc-web/gcf-artifacts/fixture${digest ? `@sha256:${digest}` : ":latest"}`;
    provenance.previousRevision = {state: "AVAILABLE", value: {name: `${PREFIX}/services/${TARGET.toLowerCase()}/revisions/${f.original.proposal.baseline.targetObservation.revision}`,
      createTime: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(), images: [{name: "worker", image: image(oldDigest)}], buildAnnotations: {}}};
    provenance.currentRevision = {state: "AVAILABLE", value: {name: `${PREFIX}/services/${TARGET.toLowerCase()}/revisions/${f.target.serviceConfig.revision}`,
      createTime: new Date(NOW).toISOString(), images: [{name: "worker", image: image(newDigest)}], buildAnnotations: {}}};
    f.provider.provenance.mockResolvedValue(provenance);
    const report = await reconcile(f);
    expect(report.imageEquality).toBe(expected);
    expect(report.sourceArchiveEquality).toBe("UNPROVEN"); neverAuthorizes(report); noMutation(f);
  });

  it.each(["currentRevision", "previousRevision"])("rejects an available %s from another revision of the same service", async name => {
    const f = evidenceFixture(); const provenance = emptyProvenance();
    provenance[name] = {state: "AVAILABLE", value: {name: `${PREFIX}/services/${TARGET.toLowerCase()}/revisions/${TARGET.toLowerCase()}-unrelated`,
      images: [{name: "worker", image: `europe-west2-docker.pkg.dev/sodc-web/gcf-artifacts/fixture@sha256:${"a".repeat(64)}`}], buildAnnotations: {}}};
    f.provider.provenance.mockResolvedValue(provenance);
    await expect(reconcile(f)).rejects.toThrow(); noMutation(f);
  });

  it("rejects available current build evidence for a different valid build in the same project", async () => {
    const f = evidenceFixture(); const provenance = emptyProvenance();
    provenance.functionBuild = {state: "AVAILABLE", value: {name: `${PREFIX}/builds/fedcba98-7654-3210-fedc-ba9876543210`,
      id: "fedcba98-7654-3210-fedc-ba9876543210", status: "SUCCESS", source: null, resolvedSource: null, archiveSha256: null, images: []}};
    f.provider.provenance.mockResolvedValue(provenance);
    await expect(reconcile(f)).rejects.toThrow(); noMutation(f);
  });

  it("rejects available operation-build evidence belonging to another valid build", async () => {
    const f = evidenceFixture(); const provenance = emptyProvenance();
    provenance.operationBuild = {state: "AVAILABLE", value: {name: `${PREFIX}/builds/fedcba98-7654-3210-fedc-ba9876543210`,
      id: "fedcba98-7654-3210-fedc-ba9876543210", status: "SUCCESS", source: null, resolvedSource: null, archiveSha256: null, images: []}};
    f.provider.provenance.mockResolvedValue(provenance);
    f.provider.operation.mockResolvedValue(operationRecord({done: true, metadata: {target: TARGET_NAME, verb: "update", buildName: NEW_BUILD}}));
    await expect(reconcile(f)).rejects.toThrow(); noMutation(f);
  });

  it("leaves every original record unchanged after a provider failure", async () => {
    const f = evidenceFixture(); const before = JSON.stringify(f.original);
    f.provider.snapshot.mockRejectedValue(new Error("PRIVATE_PROVIDER_FAILURE"));
    await expect(reconcile(f)).rejects.toThrow();
    expect(JSON.stringify(f.original)).toBe(before); noMutation(f);
  });
});

describe("prospective capture is an observation, never an authorization", () => {
  it("captures component evidence without exposing private environment or comparison material", () => {
    const f = evidenceFixture(); const input = f.captureOptions(); const before = JSON.stringify(input);
    const report = captureBindingEvidence(input);
    expect(report).toMatchObject({schemaVersion: "sodc-notify-binding-capture/v1", status: "CAPTURED_OBSERVATION_NOT_APPROVAL"});
    expect(report.observationOnly).toBe(true);
    expect(report.targetBindingState).toBe("FOUR_BINDINGS");
    expect(Object.keys(report.targetComponents.fieldHmacs).length).toBeGreaterThan(20);
    neverAuthorizes(report);
    const json = JSON.stringify(report);
    for (const value of ["PRIVATE_ENV_VALUE_744", "ops-fixture@example.invalid", KEY.toString("hex"), KEY.toString("base64"),
      JSON.stringify([...KEY]), '"comparisonKey"', '"type":"Buffer"']) expect(json).not.toContain(value);
    expect(JSON.stringify(input)).toBe(before); noMutation(f);
  });

  it.each([
    ["unknown root field", target => {target.futureField = {opaque: "new"};}],
    ["unknown runtime field", target => {target.serviceConfig.futureRuntimeField = "new";}],
    ["unknown build option", target => {target.buildConfig.futureBuildOption = "new";}],
    ["new private environment entry", target => {target.serviceConfig.environmentVariables.NEW_PRIVATE_KEY = "NEW_PRIVATE_VALUE";}],
    ["changed private environment entry", target => {target.serviceConfig.environmentVariables.PRIVATE_LEGACY_VALUE = "NEW_PRIVATE_VALUE";}],
    ["empty field", target => {target.buildConfig.futureField = "";}],
    ["null field", target => {target.buildConfig.futureField = null;}],
  ])("captures a changed %s without treating unknown data as ignorable", (_label, change) => {
    const f = evidenceFixture();
    const first = captureBindingEvidence(f.captureOptions());
    change(f.target);
    const second = captureBindingEvidence(f.captureOptions());
    expect(digest(second)).not.toBe(digest(first));
    expect(digest(second.targetComponents)).not.toBe(digest(first.targetComponents));
    expect(digest(second.targetComponents.fieldHmacs)).not.toBe(digest(first.targetComponents.fieldHmacs));
    expect(JSON.stringify(second)).not.toContain("NEW_PRIVATE_VALUE"); neverAuthorizes(second); noMutation(f);
  });

  it("records new environment keys as opaque identities with separate value fingerprints", () => {
    const f = evidenceFixture();
    const before = captureBindingEvidence(f.captureOptions());
    f.target.serviceConfig.environmentVariables.PRIVATE_NEW_ENV_KEY = "PRIVATE_NEW_ENV_VALUE";
    const after = captureBindingEvidence(f.captureOptions());
    expect(after.targetComponents.environment.service.entries).toHaveLength(before.targetComponents.environment.service.entries.length + 1);
    expect(after.targetComponents.environment.service.keySetHmac).not.toBe(before.targetComponents.environment.service.keySetHmac);
    for (const entry of after.targetComponents.environment.service.entries) {
      expect(entry).toEqual({keyHmac: expect.stringMatching(/^[a-f0-9]{64}$/), valueHmac: expect.stringMatching(/^[a-f0-9]{64}$/)});
    }
    const json = JSON.stringify(after);
    expect(json).not.toContain("PRIVATE_NEW_ENV_KEY");
    expect(json).not.toContain("PRIVATE_NEW_ENV_VALUE");
  });

  it("keeps an environment key identity stable while detecting its changed value", () => {
    const f = evidenceFixture();
    const before = captureBindingEvidence(f.captureOptions());
    f.target.serviceConfig.environmentVariables.PRIVATE_LEGACY_VALUE = "PRIVATE_CHANGED_ENV_VALUE";
    const after = captureBindingEvidence(f.captureOptions());
    const oldEntries = new Map(before.targetComponents.environment.service.entries.map(entry => [entry.keyHmac, entry.valueHmac]));
    const newEntries = new Map(after.targetComponents.environment.service.entries.map(entry => [entry.keyHmac, entry.valueHmac]));
    expect([...newEntries.keys()].sort()).toEqual([...oldEntries.keys()].sort());
    expect([...newEntries].filter(([key, value]) => oldEntries.get(key) !== value)).toHaveLength(1);
    expect(after.targetComponents.environment.service.keySetHmac).toBe(before.targetComponents.environment.service.keySetHmac);
    expect(JSON.stringify(after)).not.toContain("PRIVATE_CHANGED_ENV_VALUE");
  });

  it("records an observation of a Stripe-only target without constructing a mutation proposal", () => {
    const f = evidenceFixture();
    f.target.serviceConfig.secretEnvironmentVariables = clone(f.original.proposal.before);
    const report = captureBindingEvidence(f.captureOptions());
    expect(report.targetBindingState).toBe("STRIPE_ONLY");
    expect(report.observationOnly).toBe(true); neverAuthorizes(report);
    expect(report).not.toHaveProperty("updateMask");
    expect(report).not.toHaveProperty("after");
    noMutation(f);
  });

  it("rejects captured revision evidence that is not the observed current revision", () => {
    const f = evidenceFixture(); const options = f.captureOptions();
    options.provenance.currentRevision = {state: "AVAILABLE", value: {
      name: `${PREFIX}/services/${TARGET.toLowerCase()}/revisions/${TARGET.toLowerCase()}-unrelated`, images: [], buildAnnotations: {}}};
    expect(() => captureBindingEvidence(options)).toThrow(); noMutation(f);
  });

  it("rejects source-object metadata for a different immutable generation", () => {
    const f = evidenceFixture(); const options = f.captureOptions();
    options.snapshot.functions[0].buildConfig.source.storageSource = {
      bucket: "gcf-v2-sources-123-europe-west2", object: `${TARGET}/function-source.zip`, generation: "9"};
    options.provenance.sourceObject = {state: "AVAILABLE", value: {
      bucket: "gcf-v2-sources-123-europe-west2", name: `${TARGET}/function-source.zip`, generation: "10", size: "100", md5Hash: null, crc32c: null}};
    expect(() => captureBindingEvidence(options)).toThrow(); noMutation(f);
  });

  it("permits explicitly selected Production metadata capture without authorizing Production changes", () => {
    const f = evidenceFixture();
    const input = JSON.parse(JSON.stringify(f.captureOptions()).replaceAll("sodc-web", "sodc-web-production"));
    input.environment = "prod"; input.comparisonKey = KEY;
    const report = captureBindingEvidence(input);
    expect(report.status).toBe("CAPTURED_OBSERVATION_NOT_APPROVAL");
    expect(report.observationOnly).toBe(true); neverAuthorizes(report);
    noMutation(f);
  });

  it("distinguishes absent, empty and null components", () => {
    const f = evidenceFixture();
    const absent = captureBindingEvidence(f.captureOptions());
    f.target.buildConfig.futureField = "";
    const empty = captureBindingEvidence(f.captureOptions());
    f.target.buildConfig.futureField = null;
    const nil = captureBindingEvidence(f.captureOptions());
    expect(new Set([absent, empty, nil].map(value => digest(value))).size).toBe(3);
    expect(new Set([absent, empty, nil].map(value => digest(value.targetComponents.fieldHmacs))).size).toBe(3);
  });

  it("cannot substitute a post-operation capture for the original v1 proposal", async () => {
    const f = evidenceFixture(); const capture = captureBindingEvidence(f.captureOptions());
    f.original.proposal = capture;
    await expect(reconcile(f)).rejects.toThrow();
    expect(f.provider.snapshot).not.toHaveBeenCalled(); noMutation(f);
  });

  it.each([0, 31, 33])("rejects an invalid %i-byte key", length => {
    const f = evidenceFixture(); expect(() => captureBindingEvidence({...f.captureOptions(), comparisonKey: Buffer.alloc(length)})).toThrow();
  });

  it.each(["beta", "production", "", undefined])("rejects unsupported capture environment %j", environment => {
    const f = evidenceFixture(); expect(() => captureBindingEvidence({...f.captureOptions(), environment})).toThrow();
  });
});
