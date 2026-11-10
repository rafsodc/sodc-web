import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  GUARD_SCHEMA, REVIEW_SCHEMA, applicationEnvironment, assertScheduledTarget, assertSecretMetadata, assertSupportedManifest,
  bytesDigest, configurationProposal, digest, environmentDelta, environmentProjection, evaluateConfiguration, verifyGuardReceipt,
} from "./functions-config-guard-lib.mjs";
import { collectAssessment, guardPath, loadPinnedCli, metadataProvider, runFunctionsConfigGuard } from "./functions-config-guard.mjs";
import { applyFromStage, createDeploymentPlan, runDeploymentPlan } from "./deploy-environment-lib.mjs";
import { deployGuardedFunctions } from "./functions-deploy.mjs";

const projectId = "sodc-web";
const region = "europe-west2";
const directories = [];
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((file) => rm(file, { recursive: true, force: true })));
});

function baseDecision() {
  const environment = environmentProjection({ APP_BASE_URL: "https://sodc-web.web.app", OPTIONAL: "" });
  return { binding: { gitSha: "a".repeat(40), projectId, mode: "dotenv", inputs: { ".env": "hash" } },
    endpoints: [{ name: "example", before: environment, after: structuredClone(environment) }],
    policy: { requiredEnvironmentKeys: ["APP_BASE_URL"], allowedEmptyEnvironmentKeys: ["OPTIONAL"] },
    baseline: { functions: ["example"], secrets: [], schedulers: ["job"] } };
}

function reviewFor(decision, mode = "change-environment") {
  return { ...configurationProposal(decision), mode, reviewedBy: "operator", reason: "Reviewed exact scoped hashes" };
}

describe("configuration decisions and sanitized reports", () => {
  it("preserves exact values and distinguishes an empty value from an absent key", () => {
    const decision = baseDecision();
    expect(evaluateConfiguration(decision).environmentChanges).toEqual([]);
    delete decision.endpoints[0].after.OPTIONAL;
    expect(configurationProposal(decision).environmentChanges[0]).toMatchObject({ key: "OPTIONAL", before: { state: "empty" }, after: { state: "absent" } });
    expect(() => evaluateConfiguration(decision)).toThrow("unreviewed-application-environment-change");
  });
  it("rejects a common placeholder plus a partial project file that removes endpoint-scoped keys", () => {
    const decision = baseDecision();
    decision.endpoints.push({ name: "fileOnly", before: environmentProjection({ BUCKET: "private", APP_BASE_URL: "" }),
      after: environmentProjection({ APP_BASE_URL: "" }) });
    expect(() => evaluateConfiguration(decision)).toThrow("unreviewed-application-environment-change");
    expect(configurationProposal(decision).environmentChanges.some((change) => change.endpoint === "fileOnly" && change.key === "BUCKET")).toBe(true);
  });
  it("requires explicit reviewed preservation and reports existing deviations without endorsing them", () => {
    const decision = baseDecision();
    decision.binding.mode = "preserve-existing";
    decision.endpoints[0].before = decision.endpoints[0].after = environmentProjection({ APP_BASE_URL: "" });
    expect(() => evaluateConfiguration(decision)).toThrow("preservation-requires-explicit-review");
    const review = reviewFor(decision, "preserve-existing");
    expect(evaluateConfiguration({ ...decision, review }).policyDeviations).toEqual([{ endpoint: "example", key: "APP_BASE_URL", reason: "required-nonempty" }]);
  });
  it("allows only the reviewed exact environment delta, never an additional key or broader endpoint scope", () => {
    const decision = baseDecision();
    decision.endpoints[0].after.APP_BASE_URL = environmentProjection({ APP_BASE_URL: "https://new.example" }).APP_BASE_URL;
    const review = reviewFor(decision);
    expect(evaluateConfiguration({ ...decision, review }).environmentChanges).toHaveLength(1);
    decision.endpoints.push({ ...decision.endpoints[0], name: "another" });
    expect(() => evaluateConfiguration({ ...decision, review })).toThrow("review-does-not-match-exact-proposal");
  });
  it.each(["reviewedBy", "reason"])("rejects an unedited proposal sentinel in %s", (key) => {
    const decision = baseDecision();
    const review = { ...reviewFor(decision), [key]: "REPLACE_AFTER_REVIEW" };
    expect(() => evaluateConfiguration({ ...decision, review })).toThrow("invalid-review-record");
    review[key] = "  replace_after_review  ";
    expect(() => evaluateConfiguration({ ...decision, review })).toThrow("invalid-review-record");
  });
  it("never permits preservation to authorize a changed value", () => {
    const decision = baseDecision();
    decision.endpoints[0].after.OPTIONAL = environmentProjection({ OPTIONAL: "new" }).OPTIONAL;
    expect(() => evaluateConfiguration({ ...decision, review: reviewFor(decision, "preserve-existing") })).toThrow("preservation-cannot-change-environment");
  });
  it("requires explicit exact review of provider-dependent resets rather than predicting quota defaults", () => {
    const decision = { ...baseDecision(), providerDefaultResets: [{ endpoint: "example", field: "maxInstanceCount", currentSha256: digest(20), reason: "provider-dependent-reset" }] };
    expect(() => evaluateConfiguration(decision)).toThrow("provider-default-resets-require-review");
    const review = reviewFor(decision, "preserve-existing");
    expect(evaluateConfiguration({ ...decision, review }).providerDefaultResets).toHaveLength(1);
    decision.providerDefaultResets[0].currentSha256 = digest(21);
    expect(() => evaluateConfiguration({ ...decision, review })).toThrow("unreviewed-provider-default-resets");
  });
  it("binds review to both local inputs and provider baseline", () => {
    const decision = baseDecision();
    const review = reviewFor(decision);
    expect(() => evaluateConfiguration({ ...decision, binding: { ...decision.binding, projectId: "other" }, review })).toThrow("review-does-not-match");
    expect(() => evaluateConfiguration({ ...decision, baseline: { ...decision.baseline, secrets: ["changed"] }, review })).toThrow("review-does-not-match");
  });
  it("reports only hashes/states and filters the explicit managed-key allowlist", () => {
    const secretLikeValue = "PRIVATE_DO_NOT_PRINT_12345";
    expect(JSON.stringify(environmentProjection({ VALUE: secretLikeValue }))).not.toContain(secretLikeValue);
    expect(applicationEnvironment({ VALUE: "", GCLOUD_PROJECT: projectId, FUTURE_MANAGED_KEY: "keep" })).toEqual({ VALUE: "", FUTURE_MANAGED_KEY: "keep" });
    expect(digest("")).toBe("12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126");
    expect(() => environmentProjection({ "invalid-key": secretLikeValue })).toThrow("invalid-environment-shape");
  });
});

describe("SDK parameter and trigger boundaries", () => {
  const manifest = () => ({ specVersion: "v1alpha1", endpoints: { example: { platform: "gcfv2", region: [region], labels: {}, callableTrigger: {} } },
    params: [{ name: "SECRET", type: "secret" }] });
  it("accepts the SDK empty-label/reset shape", () => expect(() => assertSupportedManifest(manifest(), region)).not.toThrow());
  it.each(["string", "int", "boolean", "list"])("rejects discovered %s params regardless of how they were declared", (type) => {
    const value = manifest(); value.params.push({ name: "ALIASED_UNUSED_PARAMETER", type });
    expect(() => assertSupportedManifest(value, region)).toThrow("non-secret-or-unsupported-parameter");
  });
  it("rejects event triggers, new platforms and multi-region endpoint scope", () => {
    const value = manifest(); value.endpoints.example.region.push("us-central1");
    expect(() => assertSupportedManifest(value, region)).toThrow("unsupported-platform-or-region");
    value.endpoints.example.region = [region]; value.endpoints.example = { platform: "gcfv2", region: [region], eventTrigger: {} };
    expect(() => assertSupportedManifest(value, region)).toThrow("unsupported-endpoint-option");
  });
  it("rejects schedule retry/unknown options and task invoker changes, including reset-null", () => {
    const value = manifest(); delete value.endpoints.example.callableTrigger;
    value.endpoints.example.scheduleTrigger = { schedule: "every 5 minutes", retryConfig: { retryCount: 10 } };
    expect(() => assertSupportedManifest(value, region)).toThrow("schedule-retry-or-unknown-options");
    delete value.endpoints.example.scheduleTrigger;
    for (const invoker of [["public"], null]) {
      value.endpoints.example.taskQueueTrigger = { invoker };
      expect(() => assertSupportedManifest(value, region)).toThrow("task-invoker-or-unknown-options");
    }
  });
});

describe("exact secret version metadata", () => {
  const endpoints = [{ secretEnvironmentVariables: [{ projectId, key: "SECRET", secret: "SECRET", version: "1" }] }];
  const metadata = () => ({ SECRET: { name: `projects/${projectId}/secrets/SECRET/versions/1`, state: "ENABLED" } });
  it("accepts exact same-project pinned/latest enabled metadata without any payload", () => {
    expect(assertSecretMetadata(endpoints, ["SECRET"], metadata(), projectId)).toEqual([metadata().SECRET && { name: "SECRET", resource: metadata().SECRET.name, state: "ENABLED" }]);
  });
  it.each(["DISABLED", "DESTROYED"])("blocks literal latest in %s state even if an older enabled pin exists", (state) => {
    const value = metadata(); value.SECRET = { ...value.SECRET, state, name: `projects/${projectId}/secrets/SECRET/versions/2` };
    expect(() => assertSecretMetadata(endpoints, ["SECRET"], value, projectId)).toThrow("secret-latest-version-or-state-drift");
  });
  it.each(["DISABLED", "DESTROYED"])("blocks a %s version even when latest still matches its pin", (state) => {
    const value = metadata(); value.SECRET.state = state;
    expect(() => assertSecretMetadata(endpoints, ["SECRET"], value, projectId)).toThrow("secret-latest-version-or-state-drift");
  });
  it.each(["latest", "not-numeric", ""])("rejects the unpinned secret version %s even if metadata matches", (version) => {
    const value = structuredClone(endpoints); value[0].secretEnvironmentVariables[0].version = version;
    const matching = metadata(); matching.SECRET.name = `projects/${projectId}/secrets/SECRET/versions/${version}`;
    expect(() => assertSecretMetadata(value, ["SECRET"], matching, projectId)).toThrow("cross-project-or-unpinned-secret");
  });
  it("blocks a newer enabled latest, missing metadata, cross-project refs, mixed pins, and unused new params", () => {
    const newer = metadata(); newer.SECRET.name = `projects/${projectId}/secrets/SECRET/versions/2`;
    expect(() => assertSecretMetadata(endpoints, ["SECRET"], newer, projectId)).toThrow("secret-latest");
    expect(() => assertSecretMetadata(endpoints, ["SECRET"], {}, projectId)).toThrow("secret-latest");
    const cross = structuredClone(endpoints); cross[0].secretEnvironmentVariables[0].projectId = "other";
    expect(() => assertSecretMetadata(cross, ["SECRET"], metadata(), projectId)).toThrow("cross-project");
    const mixed = [...endpoints, { secretEnvironmentVariables: [{ ...endpoints[0].secretEnvironmentVariables[0], version: "2" }] }];
    expect(() => assertSecretMetadata(mixed, ["SECRET"], metadata(), projectId)).toThrow("secret-latest");
    expect(() => assertSecretMetadata(endpoints, ["UNUSED"], metadata(), projectId)).toThrow("unbound-secret");
  });
});

describe("existing Scheduler endpoint aliases", () => {
  const contract = { projectId, region, endpointId: "reconcileSectionFiles", runUri: "https://reconcilesectionfiles-example.a.run.app",
    serviceAccount: "123-compute@developer.gserviceaccount.com" };
  it.each(["https://reconcilesectionfiles-example.a.run.app", "https://reconcilesectionfiles-example.a.run.app/",
    `https://${region}-${projectId}.cloudfunctions.net/reconcileSectionFiles`])("accepts only the verified same-endpoint target %s", (uri) => {
    expect(() => assertScheduledTarget({ uri, httpMethod: "POST", oidcToken: { serviceAccountEmail: contract.serviceAccount, audience: uri } }, contract)).not.toThrow();
  });
  it.each(["https://unrelated.run.app", `https://${region}-other-project.cloudfunctions.net/reconcileSectionFiles`,
    `https://${region}-${projectId}.cloudfunctions.net/anotherFunction`, "https://reconcilesectionfiles-example.a.run.app/?query=1"])("rejects target %s", (uri) => {
    expect(() => assertScheduledTarget({ uri, httpMethod: "POST", oidcToken: { serviceAccountEmail: contract.serviceAccount, audience: uri } }, contract)).toThrow("schedule-target-or-identity");
  });
  it("rejects changed identity/audience even on an accepted URI", () => {
    expect(() => assertScheduledTarget({ uri: contract.runUri, httpMethod: "POST", oidcToken: { serviceAccountEmail: "other", audience: contract.runUri } }, contract)).toThrow("schedule-target-or-identity");
    expect(() => assertScheduledTarget({ uri: contract.runUri, httpMethod: "POST", oidcToken: { serviceAccountEmail: contract.serviceAccount, audience: "https://other" } }, contract)).toThrow("schedule-target-or-identity");
  });
});

describe("attestation and resumed deployment ordering", () => {
  const receipt = () => ({ schemaVersion: GUARD_SCHEMA, status: "PASS", binding: baseDecision().binding, baseline: baseDecision().baseline, reviewSha256: null });
  it.each(["gitSha", "inputs", "cli", "buildSha256"])("rejects changed %s after preflight", (key) => {
    const saved = receipt(); const current = structuredClone(saved); current.binding[key] = "changed";
    expect(() => verifyGuardReceipt(saved, current)).toThrow("local-inputs-changed");
  });
  it("rejects provider/review drift and missing prior receipt", () => {
    const saved = receipt();
    expect(() => verifyGuardReceipt(saved, { ...saved, baseline: {} })).toThrow("provider-contract-changed");
    expect(() => verifyGuardReceipt(saved, { ...saved, reviewSha256: "new" })).toThrow("review-changed");
    expect(() => verifyGuardReceipt(null, saved)).toThrow("missing-passing");
  });
  it.each([undefined, "dataconnect", "functions"])("checks config before any remote mutation when resuming from %s", async (from) => {
    const plan = applyFromStage(createDeploymentPlan("dev", "a".repeat(40)), from);
    const steps = [];
    await expect(runDeploymentPlan(plan, async (step) => {
      steps.push(step.id);
      if (["functions-config-record", "functions-config-verify", "guarded-functions-deploy"].includes(step.kind)) throw new Error("BLOCKED");
      return { stdout: "" };
    })).rejects.toThrow("BLOCKED");
    expect(steps).not.toContain("deploy-dataconnect");
    expect(steps).not.toContain("deploy-hosting");
  });
});

// Each test creates a clean, self-contained repository. No ignored real project files,
// installed global CLI, credentials, internet, SDK, or provider are needed in CI.
async function fixture({ publicInvoker = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "functions-guard-test-")); directories.push(root);
  for (const directory of ["config", "functions/lib"]) await mkdir(path.join(root, directory), { recursive: true });
  const policy = { requiredEnvironmentKeys: ["APP_BASE_URL", "SECTION_FILES_BUCKET"], allowedEmptyEnvironmentKeys: ["OPTIONAL"],
    supportedTaskQueueTriggers: {}, externalSchedulerJobs: ["scanner"], appBaseUrls: { dev: "https://sodc-web.web.app" } };
  const values = { APP_BASE_URL: policy.appBaseUrls.dev, SECTION_FILES_BUCKET: `${projectId}.firebasestorage.app`, OPTIONAL: "" };
  const files = { ".gitignore": ".firebase\nfunctions/.env*\nfunctions/lib\n", ".firebaserc": { projects: { dev: projectId } },
    "firebase.json": { functions: [{ source: "functions", disallowLegacyRuntimeConfig: true, predeploy: ['npm --prefix "$RESOURCE_DIR" run build'] }] },
    "config/functions-config-guard.json": policy, "config/deployment-check.json": { region, expectedPublicInvokerFunctions: publicInvoker ? ["example"] : [] },
    "functions/package.json": { main: "lib/index.js", engines: { node: "24" } }, "functions/package-lock.json": {}, "package-lock.json": {}, "functions/lib/index.js": "test" };
  for (const [file, value] of Object.entries(files)) await writeFile(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value));
  const projectFile = path.join(root, `functions/.env.${projectId}`);
  await writeFile(projectFile, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n"));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init", "-q"); git("add", "."); git("-c", "user.name=Guard Test", "-c", "user.email=guard@synthetic.invalid", "commit", "-qm", "fixture");
  const manifestResult = { manifest: { specVersion: "v1alpha1", endpoints: { example: { region: [region], platform: "gcfv2", callableTrigger: {} } },
    params: [{ name: "SECRET", type: "secret" }] }, sdk: { version: "fake" } };
  const sc = { availableCpu: "1", availableMemory: "256Mi", ingressSettings: "ALLOW_ALL", timeoutSeconds: 60,
    maxInstanceRequestConcurrency: 80, serviceAccountEmail: "123-compute@developer.gserviceaccount.com", allTrafficOnLatestRevision: true,
    service: `projects/${projectId}/locations/${region}/services/example`, uri: "https://example.run.app", revision: "revision",
    environmentVariables: { ...values }, secretEnvironmentVariables: [{ key: "SECRET", secret: "SECRET", projectId, version: "1" }] };
  const functions = [{ name: `projects/${projectId}/locations/${region}/functions/example`, state: "ACTIVE", buildConfig: { runtime: "nodejs24", entryPoint: "example" },
    serviceConfig: sc, labels: { "deployment-callable": "true" } }];
  const provider = { functions: vi.fn(async () => functions), schedulers: vi.fn(async () => [{ name: `projects/${projectId}/locations/${region}/jobs/scanner`, state: "ENABLED" }]),
    project: vi.fn(async () => ({ projectId, projectNumber: "123" })), firebaseConfig: vi.fn(async () => ({ projectId })),
    latestSecret: vi.fn(async () => ({ name: "projects/123/secrets/SECRET/versions/1", state: "ENABLED" })),
    invokerPolicy: vi.fn(async () => ({ version: 1, bindings: [{ role: "roles/run.invoker",
      members: [publicInvoker ? "allUsers" : "serviceAccount:123-compute@developer.gserviceaccount.com"] }] })) };
  const cli = { identity: { version: "fake" }, env: { hasUserEnvs: vi.fn((options) => !options.configDir), loadUserEnvs: vi.fn((options) => options.configDir ? {} : ({ ...values })) },
    discovery: { buildFromV1Alpha1: vi.fn((manifest) => manifest) },
    build: { toBackend: vi.fn(() => ({ endpoints: [{ id: "example", callableTrigger: {}, environmentVariables: {}, secretEnvironmentVariables: [{ key: "SECRET", secret: "SECRET", projectId }] }] })) },
    backend: { allEndpoints: (backend) => backend.endpoints, of: (...endpoints) => ({ endpoints }) },
    prepare: { inferDetailsFromExisting: (want, have, usedDotenv) => { if (!usedDotenv) want.endpoints[0].environmentVariables = { ...have.endpoints[0].environmentVariables, ...want.endpoints[0].environmentVariables }; },
      resolveCpuAndConcurrency: () => {}, resolveDefaultTimeout: () => {} },
    functions: { endpointFromFunction: (fn) => ({ ...fn.serviceConfig, environmentVariables: fn.serviceConfig.environmentVariables, secretEnvironmentVariables: fn.serviceConfig.secretEnvironmentVariables }),
      functionFromEndpoint: (endpoint) => ({ buildConfig: { entryPoint: "example" }, serviceConfig: {
        availableCpu: "1", availableMemory: "256Mi", ingressSettings: "ALLOW_ALL", timeoutSeconds: 60,
        maxInstanceRequestConcurrency: 80, serviceAccountEmail: "123-compute@developer.gserviceaccount.com",
        environmentVariables: endpoint.environmentVariables, secretEnvironmentVariables: endpoint.secretEnvironmentVariables } }) } };
  return { root, policy, values, files, projectFile, provider, cli, manifestResult, functions,
    assess: (options = {}) => collectAssessment({ root, environment: "dev", cli, provider, manifestResult, ...options }) };
}

describe("offline actual guard orchestration with injected CLI/provider", () => {
  it("records and freshly verifies sanitized input-bound receipt using numeric same-project secrets", async () => {
    const f = await fixture();
    const options = { cli: f.cli, provider: f.provider, manifestResult: f.manifestResult };
    const first = await runFunctionsConfigGuard(f.root, "dev", options);
    expect(first.status).toBe("PASS");
    expect(first.baseline.secrets[0].resource).toContain(`projects/${projectId}/`);
    expect(JSON.stringify(first)).not.toContain(f.values.APP_BASE_URL);
    await expect(runFunctionsConfigGuard(f.root, "dev", { ...options, verify: true })).resolves.toHaveProperty("status", "PASS");
    expect(f.provider.functions).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(guardPath(f.root, "dev"), "utf8")).binding.inputs[`functions/.env.${projectId}`]).toBe(bytesDigest(await readFile(f.projectFile)));
  });
  it("rejects foreign numeric secret project and disabled latest metadata", async () => {
    const f = await fixture(); f.provider.latestSecret.mockResolvedValue({ name: "projects/999/secrets/SECRET/versions/1", state: "ENABLED" });
    await expect(f.assess()).rejects.toThrow("secret-resource-project-mismatch");
    f.provider.latestSecret.mockResolvedValue({ name: "projects/123/secrets/SECRET/versions/2", state: "DISABLED" });
    await expect(f.assess()).rejects.toThrow("secret-latest-version-or-state-drift");
  });
  it("rejects missing project file even if an empty/common placeholder file exists", async () => {
    const f = await fixture(); await rm(f.projectFile); await writeFile(path.join(f.root, "functions/.env"), "");
    await expect(f.assess()).rejects.toThrow("missing-target-project-dotenv");
    expect(f.provider.functions).not.toHaveBeenCalled();
  });
  it("rejects simultaneous alias/project files before reading provider inventory", async () => {
    const f = await fixture(); await writeFile(path.join(f.root, "functions/.env.dev"), "APP_BASE_URL=PRIVATE");
    await expect(f.assess()).rejects.toThrow("conflicting-project-alias-dotenv");
    expect(f.provider.functions).not.toHaveBeenCalled();
  });
  it("uses the CLI file-existence result, including empty files, instead of counting parsed keys", async () => {
    const f = await fixture(); f.cli.env.loadUserEnvs.mockReturnValue({});
    const result = await f.assess({ mode: "preserve-existing" });
    expect(result.rows[0].after).toEqual(result.rows[0].before);
    expect(f.cli.env.hasUserEnvs).toHaveBeenCalledWith(expect.objectContaining({ configDir: expect.any(String) }));
    await expect(f.assess()).rejects.toThrow("wrong-project-bucket");
  });
  it("rejects a wrong environment origin with otherwise matching bucket", async () => {
    const f = await fixture(); f.cli.env.loadUserEnvs.mockReturnValue({ ...f.values, APP_BASE_URL: "https://www.sodc.net" });
    await expect(f.assess()).rejects.toThrow("wrong-environment-app-base-url");
  });
  it.each([
    ["SECTION_FILES_BUCKET", "sodc-web-production.firebasestorage.app", "wrong-project-bucket"],
    ["APP_BASE_URL", "https://www.sodc.net", "wrong-environment-app-base-url"],
    ["SECTION_FILES_BUCKET", " ", "wrong-project-bucket"],
    ["APP_BASE_URL", " ", "wrong-environment-app-base-url"],
  ])("blocks preservation proposals for a wrong inherited %s value %j", async (key, value, reason) => {
    const f = await fixture();
    const options = { cli: f.cli, provider: f.provider, manifestResult: f.manifestResult, mode: "preserve-existing" };
    const proposal = await runFunctionsConfigGuard(f.root, "dev", { ...options, propose: true });
    const reviewPath = path.join(f.root, ".firebase/review.json"); await mkdir(path.dirname(reviewPath), { recursive: true });
    await writeFile(reviewPath, JSON.stringify({ ...proposal, reviewedBy: "operator", reason: "Preserve the reviewed environment" }));
    f.functions[0].serviceConfig.environmentVariables[key] = value;
    await expect(runFunctionsConfigGuard(f.root, "dev", { ...options, propose: true })).rejects.toThrow(reason);
    await expect(runFunctionsConfigGuard(f.root, "dev", { ...options, reviewPath })).rejects.toThrow(reason);
  });
  it.each(["APP_BASE_URL", "SECTION_FILES_BUCKET"])("keeps absent/empty inherited %s visible and reviewable", async (key) => {
    const f = await fixture();
    const options = { cli: f.cli, provider: f.provider, manifestResult: f.manifestResult, mode: "preserve-existing" };
    for (const value of [undefined, ""]) {
      if (value === undefined) delete f.functions[0].serviceConfig.environmentVariables[key];
      else f.functions[0].serviceConfig.environmentVariables[key] = value;
      const proposal = await runFunctionsConfigGuard(f.root, "dev", { ...options, propose: true });
      expect(proposal.environmentChanges).toEqual([]);
      expect(proposal.policyDeviations).toEqual([{ endpoint: "example", key, reason: "required-nonempty" }]);
      await expect(runFunctionsConfigGuard(f.root, "dev", options)).rejects.toThrow("preservation-requires-explicit-review");
      const reviewPath = path.join(f.root, ".firebase/review.json"); await mkdir(path.dirname(reviewPath), { recursive: true });
      await writeFile(reviewPath, JSON.stringify({ ...proposal, reviewedBy: "operator", reason: "Keep this existing missing value" }));
      await expect(runFunctionsConfigGuard(f.root, "dev", { ...options, reviewPath })).resolves.toHaveProperty("status", "PASS");
    }
  });
  it("checks the inherited environment rather than unused local dotenv values in preservation mode", async () => {
    const f = await fixture();
    f.cli.env.loadUserEnvs.mockImplementation((options) => options.configDir ? {} : ({
      ...f.values, APP_BASE_URL: "https://www.sodc.net", SECTION_FILES_BUCKET: "sodc-web-production.firebasestorage.app" }));
    await expect(f.assess({ mode: "preserve-existing" })).resolves.toHaveProperty("rows.0.after", environmentProjection(f.values));
  });
  it("does not leak parser values or raw provider errors", async () => {
    const f = await fixture(); f.cli.env.loadUserEnvs.mockImplementation(() => { throw new Error("PRIVATE_VALUE=should-not-print"); });
    await expect(f.assess()).rejects.toThrow(/^Functions configuration guard blocked: dotenv-resolution-failed\.$/);
    f.cli.env.loadUserEnvs.mockReturnValue(f.values); f.provider.functions.mockRejectedValue(new Error("Bearer PRIVATE_TOKEN"));
    await expect(runFunctionsConfigGuard(f.root, "dev", { cli: f.cli, provider: f.provider, manifestResult: f.manifestResult })).rejects.toThrow(/^Functions configuration guard blocked: unsupported-or-invalid-input\.$/);
  });
  it("rejects empty or changed per-endpoint inventories", async () => {
    const f = await fixture(); f.provider.functions.mockResolvedValue([]);
    await expect(f.assess()).rejects.toThrow("empty-provider-inventory");
    f.provider.functions.mockResolvedValue([...f.functions, { ...f.functions[0], name: f.functions[0].name + "extra" }]);
    await expect(f.assess()).rejects.toThrow("endpoint-inventory-or-scope-change");
  });
  it("rejects runtime identity and invoker drift", async () => {
    const f = await fixture(); f.functions[0].serviceConfig.serviceAccountEmail = "custom@example.iam.gserviceaccount.com";
    await expect(f.assess()).rejects.toThrow("runtime-or-identity-contract-change");
    f.functions[0].serviceConfig.serviceAccountEmail = "123-compute@developer.gserviceaccount.com";
    f.provider.invokerPolicy.mockResolvedValue({ bindings: [] });
    await expect(f.assess()).rejects.toThrow("invoker-contract-mismatch");
  });
  it("normalizes only known reset defaults and requires exact review for provider-dependent maxima", async () => {
    const f = await fixture(); const convert = f.cli.functions.functionFromEndpoint;
    f.functions[0].serviceConfig.maxInstanceCount = 20;
    f.cli.functions.functionFromEndpoint = (endpoint) => {
      const value = convert(endpoint);
      Object.assign(value.serviceConfig, { ingressSettings: null, serviceAccountEmail: null, timeoutSeconds: null,
        minInstanceCount: null, maxInstanceCount: null, vpcConnector: null, vpcConnectorEgressSettings: null,
        directVpcNetworkInterface: null, directVpcEgress: null });
      return value;
    };
    const assessment = await f.assess();
    expect(assessment.providerDefaultResets).toEqual([{ endpoint: "example", field: "maxInstanceCount", currentSha256: digest(20), reason: "provider-dependent-reset" }]);
    expect(() => evaluateConfiguration({ binding: assessment.binding, endpoints: assessment.rows, policy: assessment.policy,
      baseline: assessment.baseline, providerDefaultResets: assessment.providerDefaultResets })).toThrow("provider-default-resets-require-review");
    f.functions[0].serviceConfig.timeoutSeconds = 120;
    await expect(f.assess()).rejects.toThrow("runtime-or-identity-contract-change");
  });
  it("rejects conditional public invoker bindings instead of treating them as unconditional", async () => {
    const f = await fixture(); f.provider.invokerPolicy.mockResolvedValue({ bindings: [{ role: "roles/run.invoker", members: ["allUsers"], condition: { expression: "false" } }] });
    await expect(f.assess()).rejects.toThrow("conditional-invoker-policy-not-supported");
  });
  it.each(["allUsers", "allAuthenticatedUsers"])("rejects downgraded conditional invoker aliases containing %s on a private Function", async (member) => {
    const f = await fixture({ publicInvoker: false });
    f.provider.invokerPolicy.mockResolvedValue({ version: 1, bindings: [
      { role: "roles/run.invoker", members: ["serviceAccount:123-compute@developer.gserviceaccount.com"] },
      { role: "roles/run.invoker_withcond_0123456789abcdef", members: [member] },
    ] });
    await expect(f.assess()).rejects.toThrow("conditional-invoker-policy-not-supported");
  });
  it.each([true, false])("accepts an unconditional version-1 invoker policy (public=%s)", async (publicInvoker) => {
    const f = await fixture({ publicInvoker });
    await expect(f.assess()).resolves.toHaveProperty("rows.0.name", "example");
  });
  it("blocks custom build/postdeploy hooks and unknown config fields before any provider inventory read", async () => {
    const f = await fixture();
    const file = path.join(f.root, "firebase.json");
    const config = JSON.parse(await readFile(file, "utf8"));
    config.functions[0].predeploy.push("node mutate-built-artifact.js");
    await writeFile(file, JSON.stringify(config));
    await expect(f.assess()).rejects.toThrow("unsupported-functions-config");
    expect(f.provider.functions).not.toHaveBeenCalled();
  });
  it("does not hide changed tracked source behind git assume-unchanged", async () => {
    const f = await fixture();
    execFileSync("git", ["update-index", "--assume-unchanged", "firebase.json"], { cwd: f.root });
    const configuration = JSON.parse(await readFile(path.join(f.root, "firebase.json"), "utf8"));
    configuration.ignoredByGit = true;
    await writeFile(path.join(f.root, "firebase.json"), JSON.stringify(configuration));
    await expect(f.assess()).rejects.toThrow("tracked-source-does-not-match-reviewed-commit");
  });
  it.each(["dotenv", "compiled", "source"])("rejects %s TOCTOU changes during read-only metadata collection", async (kind) => {
    const f = await fixture();
    f.provider.invokerPolicy.mockImplementation(async () => {
      const file = kind === "dotenv" ? f.projectFile : path.join(f.root, kind === "compiled" ? "functions/lib/index.js" : "firebase.json");
      await writeFile(file, "changed-after-initial-check");
      return { bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }] };
    });
    await expect(f.assess()).rejects.toThrow(kind === "dotenv" ? "configuration-input-changed-during-guard" : kind === "compiled" ? "build-changed-during-guard" : "source-changed-during-guard");
  });
  it("rejects source and ignored dotenv changes between attestation and fresh resume", async () => {
    const f = await fixture(); const options = { cli: f.cli, provider: f.provider, manifestResult: f.manifestResult };
    await runFunctionsConfigGuard(f.root, "dev", options);
    await writeFile(f.projectFile, "ignored-changed-input");
    await expect(runFunctionsConfigGuard(f.root, "dev", { ...options, verify: true })).rejects.toThrow("local-inputs-changed-since-preflight");
  });
  it("records REVIEW_REQUIRED without writing a passing receipt and rejects its placeholder review", async () => {
    const f = await fixture(); const options = { cli: f.cli, provider: f.provider, manifestResult: f.manifestResult, mode: "preserve-existing" };
    const proposal = await runFunctionsConfigGuard(f.root, "dev", { ...options, propose: true });
    expect(proposal.status).toBe("REVIEW_REQUIRED");
    await expect(readFile(guardPath(f.root, "dev"))).rejects.toThrow();
    const reviewPath = path.join(f.root, ".firebase/review.json"); await mkdir(path.dirname(reviewPath), { recursive: true }); await writeFile(reviewPath, JSON.stringify(proposal));
    await expect(runFunctionsConfigGuard(f.root, "dev", { ...options, reviewPath })).rejects.toThrow("invalid-review-record");
  });
});

// These imports are intentionally exercised by fixture-only tests, never against PATH
// credentials. The production provider uses only explicit-project metadata GET resources.
describe("metadata and CLI boundary", () => {
  async function providerFixture() {
    const bin = await mkdtemp(path.join(tmpdir(), "functions-metadata-test-")); directories.push(bin);
    await writeFile(path.join(bin, "gcloud"), "#!/bin/sh\nprintf '%s' SYNTHETIC_TEST_TOKEN\n", { mode: 0o700 });
    vi.stubEnv("PATH", `${bin}${path.delimiter}${process.env.PATH}`);
    const fetch = vi.fn(async () => Response.json({})); vi.stubGlobal("fetch", fetch);
    return { fetch, provider: metadataProvider(projectId, region) };
  }
  it("uses the selected project for metadata quota without changing the read-only boundary", async () => {
    const { fetch, provider } = await providerFixture();
    await provider.firebaseConfig();
    await provider.project();
    for (const [url, options] of fetch.mock.calls) {
      expect(url).toContain(`/projects/${projectId}`);
      expect(options).toMatchObject({method: "GET", redirect: "error", headers: {"x-goog-user-project": projectId}});
      expect(options).not.toHaveProperty("body");
    }
    fetch.mockResolvedValueOnce(Response.json({error: {message: "private provider detail"}}, {status: 403}));
    await expect(provider.firebaseConfig()).rejects.toThrow("provider-metadata-read-failed");
  });
  it("requests IAM policy version 3 so conditional invoker bindings retain their conditions", async () => {
    const { fetch, provider } = await providerFixture();
    await provider.invokerPolicy(`projects/${projectId}/locations/${region}/services/example`);
    expect(fetch).toHaveBeenCalledWith(
      `https://run.googleapis.com/v1/projects/${projectId}/locations/${region}/services/example:getIamPolicy?options.requestedPolicyVersion=3`,
      expect.objectContaining({ method: "GET", redirect: "error" }));
    expect(fetch.mock.calls[0][1]).not.toHaveProperty("body");
  });
  it("collects every Functions page and encodes provider page tokens", async () => {
    const { fetch, provider } = await providerFixture();
    fetch.mockResolvedValueOnce(Response.json({ functions: [{ name: "first" }], nextPageToken: "next/+=" }))
      .mockResolvedValueOnce(Response.json({ functions: [{ name: "second" }] }));
    await expect(provider.functions()).resolves.toEqual([{ name: "first" }, { name: "second" }]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${region}/functions?pageSize=1000`,
      `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${region}/functions?pageSize=1000&pageToken=next%2F%2B%3D`,
    ]);
  });
  it.each(["functions", "schedulers"])("blocks repeated %s page tokens without making a third request", async (inventory) => {
    const { fetch, provider } = await providerFixture();
    const key = inventory === "functions" ? "functions" : "jobs";
    fetch.mockImplementation(async () => {
      if (fetch.mock.calls.length > 2) throw new Error("bounded pagination fixture exhausted");
      return Response.json({ [key]: [], nextPageToken: "repeated" });
    });
    await expect(provider[inventory]()).rejects.toThrow("invalid-provider-pagination");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["functions", "schedulers"])("blocks an incomplete %s inventory even when the page contains results", async (inventory) => {
    const { fetch, provider } = await providerFixture();
    const key = inventory === "functions" ? "functions" : "jobs";
    fetch.mockResolvedValue(Response.json({ [key]: [{ name: "example" }], unreachable: [region] }));
    await expect(provider[inventory]()).rejects.toThrow("incomplete-provider-list");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("blocks a secret payload resource before fetch and permits only metadata", async () => {
    const { fetch, provider } = await providerFixture();
    await expect(provider.latestSecret("SECRET/versions/1:access")).rejects.toThrow("metadata-resource-not-allowed");
    expect(fetch).not.toHaveBeenCalled();
    await provider.latestSecret("SECRET");
    expect(fetch.mock.calls[0][0]).toBe(`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/SECRET/versions/latest`);
  });
  it("requires a supported installed CLI before any provider operation", () => {
    expect(() => loadPinnedCli({ firebaseToolsVersion: "unsupported", firebaseToolsModules: {} }, "/does/not/exist/firebase")).toThrow("unsupported-firebase-cli-installation");
    expect(typeof metadataProvider).toBe("function");
    expect(REVIEW_SCHEMA).toBe("sodc-functions-config-review/v1");
    expect(environmentDelta({}, {})).toEqual([]);
  });
});

describe("guarded direct Functions mutation boundary", () => {
  async function readyRunner(mode = "dotenv") {
    const f = await fixture();
    const options = { cli: f.cli, provider: f.provider, manifestResult: f.manifestResult, mode };
    if (mode === "preserve-existing") {
      const proposal = await runFunctionsConfigGuard(f.root, "dev", { ...options, propose: true });
      const reviewPath = path.join(f.root, ".firebase/review.json"); await mkdir(path.dirname(reviewPath), { recursive: true });
      await writeFile(reviewPath, JSON.stringify({ ...proposal, reviewedBy: "operator", reason: "Preserve reviewed existing scope" }));
      options.reviewPath = reviewPath;
    }
    await runFunctionsConfigGuard(f.root, "dev", options);
    const dependencies = { guard: (root, environment, args) => runFunctionsConfigGuard(root, environment, { ...options, ...args }),
      cliLoader: () => ({ identity: f.cli.identity, executable: "/fake/firebase.js" }),
      verifyPreflight: vi.fn(async () => {}), verifyMigration: vi.fn(async () => {}), execute: vi.fn(async () => ({ status: 0 })) };
    return { ...f, dependencies };
  }
  it("uses the reviewed project alias, copies its RC, freezes exact dotenv inputs and awaits one Functions-only command", async () => {
    const f = await readyRunner(); let externalDirectory;
    f.dependencies.execute.mockImplementation(async (binary, args) => {
      expect(binary).toBe("/fake/firebase.js");
      expect(args.slice(0, 5)).toEqual(["deploy", "--only", "functions", "--project", "dev"]);
      expect(args).toContain("--non-interactive"); expect(args).not.toContain("hosting");
      const configPath = args[args.indexOf("--config") + 1]; externalDirectory = path.dirname(configPath);
      const rc = JSON.parse(await readFile(path.join(externalDirectory, ".firebaserc"), "utf8"));
      expect(rc.projects.dev).toBe(projectId);
      const config = JSON.parse(await readFile(configPath, "utf8"));
      expect(config.functions[0].source).toBe(path.join(f.root, "functions"));
      expect(config.functions[0]).not.toHaveProperty("predeploy");
      expect(await readFile(path.join(config.functions[0].configDir, `.env.${projectId}`), "utf8")).toBe(await readFile(f.projectFile, "utf8"));
      return { status: 0 };
    });
    await deployGuardedFunctions(f.root, "dev", f.dependencies);
    expect(f.dependencies.execute).toHaveBeenCalledTimes(1); expect(f.dependencies.verifyPreflight).toHaveBeenCalledTimes(1);
    await expect(readFile(path.join(externalDirectory, "firebase.json"))).rejects.toThrow();
  });
  it("preserves via an actually empty configDir without deleting the tracked or ignored inputs", async () => {
    const f = await readyRunner("preserve-existing"); const before = await readFile(f.projectFile);
    f.dependencies.execute.mockImplementation(async (_binary, args) => {
      const config = JSON.parse(await readFile(args[args.indexOf("--config") + 1], "utf8"));
      const { readdir } = await import("node:fs/promises");
      expect(await readdir(config.functions[0].configDir)).toEqual([]);
      return { status: 0 };
    });
    await deployGuardedFunctions(f.root, "dev", f.dependencies);
    expect(await readFile(f.projectFile)).toEqual(before);
  });
  it("never executes after a failed guard or failed preflight/migration receipt", async () => {
    const f = await readyRunner(); f.dependencies.verifyMigration.mockRejectedValue(new Error("migration missing"));
    await expect(deployGuardedFunctions(f.root, "dev", f.dependencies)).rejects.toThrow("migration missing");
    expect(f.dependencies.execute).not.toHaveBeenCalled();
    f.dependencies.guard = vi.fn(async () => { throw new Error("guard block"); });
    await expect(deployGuardedFunctions(f.root, "dev", f.dependencies)).rejects.toThrow("guard block");
    expect(f.dependencies.execute).not.toHaveBeenCalled();
  });
  it("blocks ignored dotenv changes during the handoff after a successful fresh guard", async () => {
    const f = await readyRunner(); const guard = f.dependencies.guard;
    f.dependencies.guard = async (...args) => { const receipt = await guard(...args); await writeFile(f.projectFile, "PRIVATE_CHANGED"); return receipt; };
    await expect(deployGuardedFunctions(f.root, "dev", f.dependencies)).rejects.toThrow("dotenv-changed-before-functions-command");
    expect(f.dependencies.execute).not.toHaveBeenCalled();
  });
  it("blocks source changes and a switched CLI immediately before the command", async () => {
    const f = await readyRunner();
    f.dependencies.cliLoader = () => ({ executable: "/fake/firebase.js", identity: { version: "changed" } });
    await expect(deployGuardedFunctions(f.root, "dev", f.dependencies)).rejects.toThrow("cli-changed-before-functions-command");
    expect(f.dependencies.execute).not.toHaveBeenCalled();
  });
  it("blocks an ignored build change after the fresh guard and before the final command", async () => {
    const f = await readyRunner();
    f.dependencies.verifyMigration.mockImplementation(async () => {
      await writeFile(path.join(f.root, "functions/lib/index.js"), "changed-after-guard");
    });
    await expect(deployGuardedFunctions(f.root, "dev", f.dependencies)).rejects.toThrow("build-changed-during-guard");
    expect(f.dependencies.execute).not.toHaveBeenCalled();
  });
  it("blocks alias changes before copying the private snapshot", async () => {
    const f = await readyRunner();
    f.dependencies.verifyMigration.mockImplementation(async () => {
      await writeFile(path.join(f.root, ".firebaserc"), JSON.stringify({ projects: { dev: "different-project" } }));
    });
    await expect(deployGuardedFunctions(f.root, "dev", f.dependencies)).rejects.toThrow("alias-changed-before-functions-command");
    expect(f.dependencies.execute).not.toHaveBeenCalled();
  });
  it("cleans private snapshots on command failure and performs no retry", async () => {
    const f = await readyRunner(); let configPath;
    f.dependencies.execute.mockImplementation(async (_binary, args) => { configPath = args[args.indexOf("--config") + 1]; return { status: 1 }; });
    await expect(deployGuardedFunctions(f.root, "dev", f.dependencies)).rejects.toThrow("functions-command-failed");
    expect(f.dependencies.execute).toHaveBeenCalledTimes(1);
    await expect(readFile(configPath)).rejects.toThrow();
  });
});
