import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TARGET, REGION, NOTIFY_KEYS, prepareRepair, reviewTemplate, applyRepair, verifyRepair,
} from "./notify-secret-binding-repair-lib.mjs";

import { PROJECT, PREFIX, TARGET_NAME, OPERATION, NOW, KEY, ALL_KEYS, clone, operationRecord, binding, refs, functionRecord, fixture, approved } from "./test-fixtures/notify-binding-repair-fixture.mjs";

function apply(f, proposal, review = approved(proposal), extra = {}) {
  return applyRepair({ proposal, review, comparisonKey: KEY, provider: f.provider, readSource: f.readSource,
    store: f.store, now: NOW, ...extra });
}

function verify(f, proposal, extra = {}) {
  return verifyRepair({ proposal, comparisonKey: KEY, provider: f.provider, readSource: f.readSource,
    store: f.store, now: NOW + 60_000, ...extra });
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("exact existing Notify-binding repair proposal", () => {
  it("proposes only the three existing additions and does not expose raw environment, IAM or comparison-key data", () => {
    const f = fixture(); const proposal = f.prepare();
    expect(reviewTemplate(proposal)).toMatchObject({ decision: "REVIEW_REQUIRED" });
    const serialized = JSON.stringify(proposal);
    for (const value of ["PRIVATE_ENV_VALUE_744", "ops-fixture@example.invalid", KEY.toString("hex"), KEY.toString("base64")]) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).toContain(TARGET);
    for (const key of ALL_KEYS) expect(serialized).toContain(key);
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
    expect(f.store.writeOnce).not.toHaveBeenCalled();
  });

  it.each(["beta", "production", "", undefined])("rejects unsupported/implicit environment %j", (environment) => {
    const f = fixture(); expect(() => f.prepare()).not.toThrow();
    expect(() => prepareRepair({ environment, source: f.source, snapshot: f.snapshot, comparisonKey: KEY, now: NOW })).toThrow();
  });

  it.each([
    ["missing Notify source declaration", (f) => f.updateManifest((m) => { m.endpoints[TARGET].secretEnvironmentVariables.pop(); })],
    ["unrelated declared secret", (f) => f.updateManifest((m) => { m.endpoints[TARGET].secretEnvironmentVariables.push({ key: "OTHER_SECRET" }); })],
    ["duplicate source key", (f) => f.updateManifest((m) => { m.endpoints[TARGET].secretEnvironmentVariables.push({ key: "STRIPE_SECRET" }); })],
    ["source descriptor extra field", (f) => f.updateManifest((m) => { m.endpoints[TARGET].secretEnvironmentVariables[0].extra = true; })],
    ["source descriptor version override", (f) => f.updateManifest((m) => { m.endpoints[TARGET].secretEnvironmentVariables[0].version = "99"; })],
    ["source descriptor secret alias", (f) => f.updateManifest((m) => { m.endpoints[TARGET].secretEnvironmentVariables[0].secret = "OTHER_SECRET"; })],
    ["source descriptor project override", (f) => f.updateManifest((m) => { m.endpoints[TARGET].secretEnvironmentVariables[0].projectId = "other-project"; })],
    ["unused secret parameter", (f) => f.updateManifest((m) => { m.params.push({ name: "UNUSED_SECRET", type: "secret" }); })],
    ["wrong source region", (f) => f.updateManifest((m) => { m.endpoints[TARGET].region = ["us-central1"]; })],
    ["HTTP source trigger", (f) => f.updateManifest((m) => { delete m.endpoints[TARGET].callableTrigger; m.endpoints[TARGET].httpsTrigger = {}; })],
    ["another source endpoint missing Notify", (f) => f.updateManifest((m) => { m.endpoints.existingSender.secretEnvironmentVariables.pop(); })],
    ["source manifest hash mismatch", (f) => { f.source.binding.manifestSha256 = "0".repeat(64); }],
    ["unsupported SDK version", (f) => { f.source.binding.sdk.version = "7.2.4"; }],
    ["unbound source revision", (f) => { f.source.binding.gitSha = "not-a-commit"; }],
    ["unbound compiled hash", (f) => { f.source.binding.buildSha256 = "short"; }],
    ["missing live endpoint", (f) => f.snapshot.functions.pop()],
    ["unexpected live endpoint", (f) => f.snapshot.functions.push(functionRecord("unexpectedEndpoint", []))],
    ["duplicate live endpoint", (f) => f.snapshot.functions.push(clone(f.snapshot.functions[0]))],
    ["empty schedulers", (f) => { f.snapshot.schedulers = []; }],
    ["duplicate scheduler", (f) => { f.snapshot.schedulers.push(clone(f.snapshot.schedulers[0])); }],
    ["missing invoker policy", (f) => { delete f.snapshot.invokerPolicies.existingSender; }],
    ["target not active", (f) => { f.snapshot.functions[0].state = "FAILED"; }],
    ["target live generation", (f) => { f.snapshot.functions[0].environment = "GEN_1"; }],
    ["unrelated live generation", (f) => { f.snapshot.functions[1].environment = "GEN_1"; }],
    ["missing target live generation", (f) => { delete f.snapshot.functions[0].environment; }],
    ["missing unrelated live generation", (f) => { delete f.snapshot.functions[1].environment; }],
    ["wrong target runtime", (f) => { f.snapshot.functions[0].buildConfig.runtime = "nodejs22"; }],
    ["wrong live entry point", (f) => { f.snapshot.functions[0].buildConfig.entryPoint = "other"; }],
    ["foreign project", (f) => { f.snapshot.project.projectId = "other-project"; }],
    ["foreign function name", (f) => { f.snapshot.functions[0].name = `projects/other/locations/${REGION}/functions/${TARGET}`; }],
    ["unexpected runtime identity", (f) => { f.snapshot.functions[0].serviceConfig.serviceAccountEmail = "other@example.invalid"; }],
    ["target max differs from reviewed20", (f) => { f.snapshot.functions[0].serviceConfig.maxInstanceCount = 21; }],
    ["target Stripe renamed", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables[0].key = "OTHER_SECRET"; }],
    ["target Stripe absent", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables = []; }],
    ["target already contains a Notify binding", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.push(binding(NOTIFY_KEYS[0])); }],
    ["target Stripe unpinned", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables[0].version = "latest"; }],
    ["target Stripe wrong project", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables[0].projectId = "other"; }],
    ["Notify alias", (f) => { f.snapshot.functions[1].serviceConfig.secretEnvironmentVariables[0].secret = "OTHER_SECRET"; }],
    ["Notify mixed globally bound versions", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.push({ ...binding(NOTIFY_KEYS[0]), version: "3" }); }],
  ])("fails closed for %s", (_label, change) => {
    const f = fixture(); expect(() => f.prepare()).not.toThrow(); change(f);
    expect(() => f.prepare()).toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it.each(ALL_KEYS)("requires enabled exact numeric/latest metadata and existing runtime access for %s", (key) => {
    const changes = [
      (f) => { delete f.snapshot.secretVersions[key]; },
      (f) => { f.snapshot.secretVersions[key].numeric.state = "DISABLED"; },
      (f) => { f.snapshot.secretVersions[key].latest.state = "DESTROYED"; },
      (f) => { f.snapshot.secretVersions[key].latest.name = `projects/${PROJECT}/secrets/${key}/versions/99`; },
      (f) => { f.snapshot.secretVersions[key].numeric.name = `projects/other/secrets/${key}/versions/${binding(key).version}`; },
      (f) => { f.snapshot.secretPolicies[key].bindings = []; },
      (f) => { f.snapshot.secretPolicies[key].bindings[0].members = ["serviceAccount:someone-else@example.invalid"]; },
      (f) => { f.snapshot.secretPolicies[key].bindings[0].condition = { expression: "true" }; },
      (f) => { f.snapshot.secretPolicies[key].bindings[0].condition = null; },
      (f) => { f.snapshot.secretPolicies[key].bindings[0].role = "roles/secretmanager.secretAccessor_withcond_hidden"; },
    ];
    for (const change of changes) {
      const f = fixture(); expect(() => f.prepare()).not.toThrow(); change(f);
      expect(() => f.prepare()).toThrow();
    }
  });
});

describe("review, fresh baseline and durable one-shot handoff", () => {
  it("writes a durable intent before the single exact PATCH and returns only an acknowledgement", async () => {
    const f = fixture(); const proposal = f.prepare();
    await expect(apply(f, proposal)).resolves.toMatchObject({ status: "APPLY_ACCEPTED_VERIFY_REQUIRED" });
    expect(f.provider.patchBindings).toHaveBeenCalledExactlyOnceWith({ name: TARGET_NAME, bindings: expect.arrayContaining(refs(ALL_KEYS)) });
    expect(f.provider.patchBindings.mock.calls[0][0].bindings).toHaveLength(4);
    expect(f.events.indexOf("durable:intent.json")).toBeGreaterThanOrEqual(0);
    expect(f.events.indexOf("durable:intent.json")).toBeLessThan(f.events.indexOf("PATCH"));
    expect(f.files.has("intent.json")).toBe(true);
    expect(JSON.stringify([...f.files.values()])).not.toContain("PRIVATE_OPERATION_VALUE");
  });

  it("accepts a name-only operation acknowledgement without inferring completion", async () => {
    const f = fixture(); const proposal = f.prepare();
    f.provider.patchBindings.mockResolvedValue({ name: OPERATION });
    await expect(apply(f, proposal)).resolves.toMatchObject({ status: "APPLY_ACCEPTED_VERIFY_REQUIRED" });
    expect(f.files.get("operation.json")).toEqual({ name: OPERATION });
    expect(f.provider.operation).not.toHaveBeenCalled();
  });

  it("never replays an already-started request", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal);
    await expect(apply(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("lets only one concurrent apply acquire the durable intent", async () => {
    const f = fixture(); const proposal = f.prepare();
    const results = await Promise.allSettled([apply(f, proposal), apply(f, proposal)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch when the intent cannot be made durable", async () => {
    const f = fixture(); const proposal = f.prepare();
    f.store.writeOnce.mockRejectedValue(new Error("Private local disk failure"));
    await expect(apply(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("does not dispatch when prior intent state cannot be read", async () => {
    const f = fixture(); const proposal = f.prepare(); f.store.read.mockRejectedValue(new Error("Local state unreadable"));
    await expect(apply(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it.each([
    ["missing review", () => null],
    ["unapproved review", (p) => reviewTemplate(p)],
    ["wrong schema", (p) => ({ ...approved(p), schemaVersion: "other" })],
    ["different proposal", (p) => ({ ...approved(p), proposalSha256: "0".repeat(64) })],
    ["blank reviewer", (p) => ({ ...approved(p), reviewedBy: " " })],
    ["placeholder reviewer", (p) => ({ ...approved(p), reviewedBy: " replace_after_review " })],
    ["blank reason", (p) => ({ ...approved(p), reason: " " })],
    ["placeholder reason", (p) => ({ ...approved(p), reason: "REPLACE_AFTER_REVIEW" })],
    ["wrong decision case", (p) => ({ ...approved(p), decision: "approved" })],
    ["unexpected approval fields", (p) => ({ ...approved(p), waiveOtherBindings: true })],
  ])("does not dispatch for %s", async (_label, review) => {
    const f = fixture(); const proposal = f.prepare();
    await expect(apply(f, proposal, review(proposal))).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
    expect(f.files.has("intent.json")).toBe(false);
  });

  it.each([
    ["different endpoint", (p) => { p.target = `${PREFIX}/functions/existingSender`; }],
    ["different project", (p) => { p.projectId = "sodc-web-production"; }],
    ["different environment", (p) => { p.environment = "prod"; }],
    ["broader update mask", (p) => { p.updateMask = "serviceConfig"; }],
    ["removed Stripe", (p) => { p.after = p.after.filter((x) => x.key !== "STRIPE_SECRET"); }],
    ["renamed secret", (p) => { p.after[0].secret = "OTHER_SECRET"; }],
    ["extra secret", (p) => { p.after.push(binding("OTHER_SECRET")); }],
    ["duplicate secret", (p) => { p.after.push(clone(p.after[0])); }],
    ["unreviewed Notify version", (p) => { p.after.find((x) => x.key === NOTIFY_KEYS[0]).version = "99"; }],
    ["unreviewed source binding", (p) => { p.sourceBinding.gitSha = "0".repeat(40); }],
    ["unknown proposal field", (p) => { p.waiveOtherChanges = true; }],
  ])("rejects a changed proposal scope (%s) even if a new review hash is supplied", async (_label, change) => {
    const f = fixture(); const proposal = f.prepare(); change(proposal);
    let review;
    try { review = approved(proposal); } catch {
      expect(f.provider.patchBindings).not.toHaveBeenCalled();
      return;
    }
    await expect(apply(f, proposal, review)).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("rejects expiry before a write, but permits later read-only completion of an already-started operation", async () => {
    const f = fixture(); const proposal = f.prepare();
    await expect(apply(f, proposal, approved(proposal), { now: NOW + 2 * 60 * 60 * 1000 })).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
    await apply(f, proposal); f.commit();
    await expect(verify(f, proposal, { now: NOW + 2 * 60 * 60 * 1000 })).resolves.toMatchObject({ status: "PASS" });
  });

  it.each([
    ["source revision", (f) => { f.source.binding.gitSha = "0".repeat(40); }],
    ["compiled source", (f) => { f.source.binding.buildSha256 = "0".repeat(64); }],
    ["target environment", (f) => { f.snapshot.functions[0].serviceConfig.environmentVariables.PRIVATE_LEGACY_VALUE = "changed"; }],
    ["target revision", (f) => { f.snapshot.functions[0].serviceConfig.revision = "other"; }],
    ["target update time", (f) => { f.snapshot.functions[0].updateTime = "2026-11-18T09:59:00Z"; }],
    ["target limit", (f) => { f.snapshot.functions[0].serviceConfig.maxInstanceCount = 19; }],
    ["unrelated function", (f) => { f.snapshot.functions[1].labels.changed = "true"; }],
    ["scheduler", (f) => { f.snapshot.schedulers[0].state = "PAUSED"; }],
    ["scheduler schedule", (f) => { f.snapshot.schedulers[0].schedule = "*/10 * * * *"; }],
    ["scheduler time zone", (f) => { f.snapshot.schedulers[0].timeZone = "UTC"; }],
    ["scheduler retry policy", (f) => { f.snapshot.schedulers[0].retryConfig = {retryCount: 3}; }],
    ["invoker", (f) => { f.snapshot.invokerPolicies[TARGET].bindings = []; }],
    ["secret IAM", (f) => { f.snapshot.secretPolicies[NOTIFY_KEYS[0]].bindings[0].members.push("user:other@example.invalid"); }],
    ["secret latest", (f) => { f.snapshot.secretVersions[NOTIFY_KEYS[0]].latest.name = `projects/${PROJECT}/secrets/${NOTIFY_KEYS[0]}/versions/99`; }],
  ])("refuses %s drift before PATCH", async (_label, change) => {
    const f = fixture(); const proposal = f.prepare(); change(f);
    await expect(apply(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("rechecks source after awaited provider reads before dispatch", async () => {
    const f = fixture(); const proposal = f.prepare();
    f.provider.snapshot.mockImplementation(async () => { f.source.binding.gitSha = "0".repeat(40); return clone(f.snapshot); });
    await expect(apply(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("rejects a changed comparison key instead of accepting a newly hashed baseline", async () => {
    const f = fixture(); const proposal = f.prepare();
    await expect(apply(f, proposal, approved(proposal), { comparisonKey: Buffer.alloc(32, 0x75) })).rejects.toThrow();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("preserves an unknown transport outcome and never retries or calls it complete", async () => {
    const f = fixture(); const proposal = f.prepare();
    f.provider.patchBindings.mockImplementation(async () => { throw new Error("PRIVATE_TOKEN PRIVATE_PROVIDER_RESPONSE"); });
    await expect(apply(f, proposal)).resolves.toMatchObject({ status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED" });
    expect(f.files.has("intent.json")).toBe(true);
    f.commit();
    await expect(verify(f, proposal)).resolves.toMatchObject({ status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED" });
    await expect(apply(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...f.files.values()])).not.toMatch(/PRIVATE_TOKEN|PRIVATE_PROVIDER_RESPONSE/);
  });

  it.each([
    { name: "projects/other/locations/europe-west2/operations/foreign", metadata: { target: TARGET_NAME, verb: "update" } },
    operationRecord({ metadata: { target: `${PREFIX}/functions/existingSender`, verb: "update" } }),
    operationRecord({ metadata: { target: TARGET_NAME, verb: "delete" } }),
    { done: true, response: { PRIVATE_OPERATION_VALUE: "PRIVATE_OPERATION_VALUE" } },
  ])("retains a one-shot unknown outcome for an invalid acknowledgement %j", async (ack) => {
    const f = fixture(); const proposal = f.prepare(); f.provider.patchBindings.mockResolvedValue(clone(ack));
    await expect(apply(f, proposal)).resolves.toMatchObject({ status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED" });
    await expect(apply(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
    expect(f.files.has("intent.json")).toBe(true);
    expect(JSON.stringify([...f.files.values()])).not.toContain("PRIVATE_OPERATION_VALUE");
  });
});

describe("operation and complete-inventory read-back", () => {
  it("verifies only completed ACTIVE exact bindings with unchanged build/config/other endpoints and jobs", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    await expect(verify(f, proposal)).resolves.toMatchObject({ status: "PASS" });
    expect(f.provider.operation).toHaveBeenCalledWith(OPERATION);
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...f.files.values()])).not.toMatch(/PRIVATE_ENV_VALUE|PRIVATE_OPERATION_RESPONSE|ops-fixture@example/);
  });

  it("does not infer success while the acknowledged operation is pending", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    f.provider.operation.mockResolvedValue(operationRecord({ done: false }));
    const result = await verify(f, proposal);
    expect(result.status).not.toBe("PASS");
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("accepts a name-only pending operation read without reading the provider inventory", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal);
    f.provider.operation.mockResolvedValue({ name: OPERATION });
    f.provider.snapshot.mockClear();
    await expect(verify(f, proposal)).resolves.toEqual({ status: "PENDING", operationName: OPERATION });
    expect(f.provider.snapshot).not.toHaveBeenCalled();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("refuses a done operation with no target and verb before accepting the changed inventory", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    f.provider.operation.mockResolvedValue({ name: OPERATION, done: true });
    f.provider.snapshot.mockClear();
    await expect(verify(f, proposal)).rejects.toMatchObject({ code: "operation-target-or-verb-mismatch" });
    expect(f.provider.snapshot).not.toHaveBeenCalled();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("does not treat an errored operation as success or persist private provider messages", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    f.provider.operation.mockResolvedValue(operationRecord({ done: true, error: { code: 7, message: "PRIVATE_OPERATION_ERROR" } }));
    let result;
    try { result = await verify(f, proposal); } catch (error) { result = { status: "REJECTED", error: String(error) }; }
    expect(result.status).not.toBe("PASS");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_OPERATION_ERROR");
    expect(JSON.stringify([...f.files.values()])).not.toContain("PRIVATE_OPERATION_ERROR");
  });

  it("requires an existing intent before read-back", async () => {
    const f = fixture(); const proposal = f.prepare();
    await expect(verify(f, proposal)).rejects.toThrow();
    expect(f.provider.operation).not.toHaveBeenCalled();
    expect(f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("refuses read-back acceptance after local source changes", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    f.source.binding.buildSha256 = "0".repeat(64);
    await expect(verify(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("refuses a corrupted comparison key during read-back", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    await expect(verify(f, proposal, { comparisonKey: Buffer.alloc(32, 0x75) })).rejects.toThrow();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it.each([
    operationRecord({ name: `${PREFIX}/operations/different-operation`, done: true }),
    operationRecord({ metadata: { target: `${PREFIX}/functions/existingSender`, verb: "update" }, done: true }),
    operationRecord({ metadata: { target: TARGET_NAME, verb: "create" }, done: true }),
  ])("does not accept an operation read with a different identity or scope", async (operation) => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    f.provider.operation.mockResolvedValue(operation);
    await expect(verify(f, proposal)).rejects.toThrow();
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing target binding", (f) => f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.pop()],
    ["unrelated binding", (f) => f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.push(binding("OTHER_SECRET"))],
    ["changed Stripe version", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.find((x) => x.key === "STRIPE_SECRET").version = "99"; }],
    ["changed Notify version", (f) => { f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.find((x) => x.key === NOTIFY_KEYS[0]).version = "99"; }],
    ["target still deploying", (f) => { f.snapshot.functions[0].state = "DEPLOYING"; }],
    ["source build changed", (f) => { f.snapshot.functions[0].buildConfig.build = `${PREFIX}/builds/unreviewed`; }],
    ["source provenance changed", (f) => { f.snapshot.functions[0].buildConfig.sourceProvenance.resolvedStorageSource.generation = "8"; }],
    ["target environment changed", (f) => { f.snapshot.functions[0].serviceConfig.environmentVariables.PRIVATE_LEGACY_VALUE = "changed"; }],
    ["target identity changed", (f) => { f.snapshot.functions[0].serviceConfig.serviceAccountEmail = "different@example.invalid"; }],
    ["target max reset", (f) => { delete f.snapshot.functions[0].serviceConfig.maxInstanceCount; }],
    ["unrelated revision changed", (f) => { f.snapshot.functions[1].serviceConfig.revision = "unrelated-new"; }],
    ["unrelated env changed", (f) => { f.snapshot.functions[1].serviceConfig.environmentVariables.newKey = "new"; }],
    ["unrelated binding changed", (f) => f.snapshot.functions[1].serviceConfig.secretEnvironmentVariables.pop()],
    ["scheduler paused", (f) => { f.snapshot.schedulers[0].state = "PAUSED"; }],
    ["scheduler target changed", (f) => { f.snapshot.schedulers[0].httpTarget.uri = "https://other.example.invalid"; }],
    ["scheduler schedule changed", (f) => { f.snapshot.schedulers[0].schedule = "*/10 * * * *"; }],
    ["scheduler time zone changed", (f) => { f.snapshot.schedulers[0].timeZone = "UTC"; }],
    ["scheduler retry policy changed", (f) => { f.snapshot.schedulers[0].retryConfig = {retryCount: 3}; }],
    ["invoker access changed", (f) => { f.snapshot.invokerPolicies[TARGET].bindings = []; }],
    ["secret IAM changed", (f) => { f.snapshot.secretPolicies[NOTIFY_KEYS[0]].bindings[0].members.push("allUsers"); }],
  ])("does not PASS if %s after the operation", async (_label, change) => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit(); change(f);
    let result;
    try { result = await verify(f, proposal); } catch (error) { result = { status: "REJECTED", error: String(error) }; }
    expect(result.status).not.toBe("PASS");
    expect(f.provider.patchBindings).toHaveBeenCalledTimes(1);
  });

  it("ignores only scheduler attempt telemetry and IAM etag churn", async () => {
    const f = fixture(); const proposal = f.prepare(); await apply(f, proposal); f.commit();
    f.snapshot.schedulers[0].lastAttemptTime = "2026-11-18T10:05:00Z";
    f.snapshot.schedulers[0].scheduleTime = "2026-11-18T10:10:00Z";
    f.snapshot.schedulers[0].status = { code: 0 };
    f.snapshot.invokerPolicies[TARGET].etag = "new-etag";
    f.snapshot.secretPolicies[NOTIFY_KEYS[0]].etag = "new-etag";
    await expect(verify(f, proposal)).resolves.toMatchObject({ status: "PASS" });
  });
});
