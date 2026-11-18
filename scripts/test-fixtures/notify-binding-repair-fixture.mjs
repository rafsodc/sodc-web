import { vi } from "vitest";
import { digest } from "../functions-config-guard-lib.mjs";
import { TARGET, REGION, NOTIFY_KEYS, prepareRepair, reviewTemplate } from "../notify-secret-binding-repair-lib.mjs";

const PROJECT = "sodc-web";
const NUMBER = "123";
const PREFIX = `projects/${PROJECT}/locations/${REGION}`;
const TARGET_NAME = `${PREFIX}/functions/${TARGET}`;
const SA = `${NUMBER}-compute@developer.gserviceaccount.com`;
const OPERATION = `${PREFIX}/operations/binding-fixture`;
const NOW = Date.parse("2026-11-18T10:00:00.000Z");
const KEY = Buffer.alloc(32, 0x74);
const ALL_KEYS = ["STRIPE_SECRET", ...NOTIFY_KEYS];
const clone = (value) => structuredClone(value);
const operationRecord = (extra = {}) => ({ name: OPERATION, metadata: { target: TARGET_NAME, verb: "update" }, ...extra });
const binding = (key) => ({ key, secret: key, projectId: PROJECT, version: key === "STRIPE_SECRET" ? "2" : "1" });
const refs = (keys) => keys.map(binding);

function functionRecord(name, keys) {
  return {
    name: `${PREFIX}/functions/${name}`, environment: "GEN_2", state: "ACTIVE",
    buildConfig: { runtime: "nodejs24", entryPoint: name, build: `${PREFIX}/builds/original-${name}`,
      source: { storageSource: { bucket: "fixture-source", object: `${name}.zip`, generation: "7" } },
      sourceProvenance: { resolvedStorageSource: { bucket: "fixture-source", object: `${name}.zip`, generation: "7" } } },
    serviceConfig: { service: `${PREFIX}/services/${name.toLowerCase()}`, serviceAccountEmail: SA,
      availableMemory: "256Mi", timeoutSeconds: 60, maxInstanceCount: 20, minInstanceCount: 0,
      maxInstanceRequestConcurrency: 80, availableCpu: "1", ingressSettings: "ALLOW_ALL",
      uri: `https://${name.toLowerCase()}.a.run.app`, allTrafficOnLatestRevision: true,
      revision: `${name.toLowerCase()}-original`,
      environmentVariables: { APP_BASE_URL: "https://sodc-web.web.app", GOV_NOTIFY_DELIVERY_MODE: "SIMULATION",
        PAYMENT_OPS_ALERT_EMAILS: "ops-fixture@example.invalid", PRIVATE_LEGACY_VALUE: "PRIVATE_ENV_VALUE_744" },
      secretEnvironmentVariables: refs(keys) },
    labels: { "deployment-callable": "true", "firebase-functions-hash": `source-${name}` },
    createTime: "2026-10-01T00:00:00.000Z", updateTime: "2026-11-17T00:00:00.000Z",
  };
}

function fixture() {
  const functions = [functionRecord(TARGET, ["STRIPE_SECRET"]), functionRecord("existingSender", NOTIFY_KEYS)];
  const manifest = { specVersion: "v1alpha1", params: ALL_KEYS.map((name) => ({ name, type: "secret" })),
    endpoints: Object.fromEntries([[TARGET, ALL_KEYS], ["existingSender", NOTIFY_KEYS]].map(([name, keys]) => [name,
      { platform: "gcfv2", region: [REGION], entryPoint: name, labels: {}, callableTrigger: {},
        secretEnvironmentVariables: keys.map((key) => ({ key })) }])) };
  const source = { binding: { gitSha: "a".repeat(40), tree: "b".repeat(40), trackedSha256: "c".repeat(64),
    buildSha256: "d".repeat(64), manifestSha256: digest(manifest),
    sdk: { version: "7.2.5", binarySha256: "e".repeat(64), packageSha256: "f".repeat(64) } }, manifest };
  const snapshot = { project: { projectId: PROJECT, projectNumber: NUMBER }, functions,
    schedulers: Array.from({ length: 5 }, (_, index) => ({ name: `${PREFIX}/jobs/job-${index}`, state: "ENABLED",
      schedule: "*/5 * * * *", timeZone: "Europe/London", attemptDeadline: "180s", retryConfig: {},
      httpTarget: { uri: `https://fixture.example.invalid/task-${index}`, httpMethod: "POST", oidcToken: { serviceAccountEmail: SA } },
      lastAttemptTime: "2026-11-18T09:55:00Z", scheduleTime: "2026-11-18T10:00:00Z", status: {} })),
    invokerPolicies: Object.fromEntries([TARGET, "existingSender"].map((name) => [name,
      { version: 3, etag: `invoker-${name}`, bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }] }])),
    secretVersions: Object.fromEntries(ALL_KEYS.map((name) => {
      const value = { name: `projects/${PROJECT}/secrets/${name}/versions/${binding(name).version}`, state: "ENABLED",
        createTime: "2026-10-01T00:00:00.000Z", etag: `version-${name}` };
      return [name, { numeric: clone(value), latest: clone(value) }];
    })),
    secretPolicies: Object.fromEntries(ALL_KEYS.map((name) => [name,
      { version: 3, etag: `secret-policy-${name}`, bindings: [{ role: "roles/secretmanager.secretAccessor", members: [`serviceAccount:${SA}`] }] }])) };
  const events = [];
  const files = new Map();
  const store = { read: vi.fn(async (name) => files.has(name) ? clone(files.get(name)) : null),
    writeOnce: vi.fn(async (name, value) => {
      events.push(`durable:${name}`);
      if (files.has(name)) throw new Error("Local record already exists");
      files.set(name, clone(value));
    }) };
  const provider = { snapshot: vi.fn(async () => clone(snapshot)),
    patchBindings: vi.fn(async () => { events.push("PATCH"); return { name: OPERATION, done: false,
      metadata: { target: TARGET_NAME, verb: "update", requestResource: { PRIVATE_OPERATION_VALUE: "PRIVATE_OPERATION_VALUE" } } }; }),
    operation: vi.fn(async () => operationRecord({ done: true,
      response: { PRIVATE_OPERATION_RESPONSE: "PRIVATE_OPERATION_RESPONSE" } })) };
  const readSource = vi.fn(async () => clone(source));
  const f = { source, snapshot, provider, store, files, events, readSource,
    prepare: () => prepareRepair({ environment: "dev", source: clone(source), snapshot: clone(snapshot), comparisonKey: KEY, now: NOW }),
    commit: () => { snapshot.functions[0].serviceConfig.secretEnvironmentVariables = refs(ALL_KEYS);
      snapshot.functions[0].serviceConfig.revision = "reconcile-new-revision";
      snapshot.functions[0].updateTime = "2026-11-18T10:00:30.000Z"; },
    updateManifest: (change) => { change(manifest); source.binding.manifestSha256 = digest(manifest); } };
  return f;
}

function approved(proposal) {
  return { ...reviewTemplate(proposal), decision: "APPROVED", reviewedBy: "Fixture reviewer",
    reason: "Reviewed the exact target-only existing-secret addition" };
}

export { PROJECT, NUMBER, PREFIX, TARGET_NAME, SA, OPERATION, NOW, KEY, ALL_KEYS, clone, operationRecord, binding, refs, functionRecord, fixture, approved };
