import {vi} from "vitest";
import {digest} from "../functions-config-guard-lib.mjs";
import {ACCOUNT_ID, BEFORE_EVENTS, ENDPOINT_ID, ENDPOINT_URL, PROJECT_ID, PROJECT_NUMBER, REGION, SECRET_KEY, SECRET_KEYS,
  TARGET, TARGET_NAME, prepareRepair, reviewTemplate} from "../dev-stripe-webhook-repair-lib.mjs";

export const NOW = Date.parse("2026-11-20T12:00:00.000Z");
export const KEY = Buffer.alloc(32, 0x75);
// Deliberately short, synthetic input: valid for the parser, never a Stripe key.
export const CANDIDATE = "whsec_TESTONLY1234";
export const PREFIX = `projects/${PROJECT_ID}/locations/${REGION}`;
export const OPERATION = `${PREFIX}/operations/webhook-repair-fixture`;
export const OLD_BUILD = `${PREFIX}/builds/original-webhook-build`;
export const NEW_BUILD = `${PREFIX}/builds/rebuilt-webhook-build`;
export const SA = `${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`;
export const clone = value => structuredClone(value);
export const binding = (key, version = "1") => ({key, secret: key, projectId: PROJECT_ID, version});
export const version = (id, created = "2026-05-04T00:00:00.000Z") => ({name: `projects/${PROJECT_ID}/secrets/${SECRET_KEY}/versions/${id}`,
  state: "ENABLED", createTime: created, etag: `version-${id}`, clientSpecifiedPayloadChecksum: true});
export const operation = (extra = {}) => ({name: OPERATION, done: true, metadata: {target: TARGET_NAME, verb: "update", buildName: NEW_BUILD}, ...extra});
const archive = (objectName, generation) => ({bucket: "fixture-source-bucket", object: objectName, generation, sha256: "7".repeat(64), size: "512"});
const sourceRef = value => ({bucket: value.bucket, object: value.object, generation: value.generation});

export function functionRecord(name, refs) {
  return {name: `${PREFIX}/functions/${name}`, environment: "GEN_2", state: "ACTIVE", buildConfig: {runtime: "nodejs24", entryPoint: name,
    build: OLD_BUILD, source: {storageSource: sourceRef(archive("original.zip", "3"))},
    sourceProvenance: {resolvedStorageSource: sourceRef(archive("original.zip", "3"))},
    environmentVariables: {PRIVATE_BUILD_VALUE: "private-build-env-fixture"}, serviceAccount: "private-build-identity@example.invalid"},
  serviceConfig: {service: `${PREFIX}/services/${name.toLowerCase()}`, serviceAccountEmail: SA, maxInstanceCount: 20, minInstanceCount: 0,
    timeoutSeconds: 60, availableMemory: "256Mi", availableCpu: "1", maxInstanceRequestConcurrency: 80, allTrafficOnLatestRevision: true,
    revision: `${name.toLowerCase()}-old`, environmentVariables: {GOV_NOTIFY_DELIVERY_MODE: "SIMULATION", PRIVATE_ENV: "private-environment-fixture"},
    secretEnvironmentVariables: refs, uri: `https://${name.toLowerCase()}.a.run.app`}, labels: {"deployment-tool": "cli-firebase"},
  createTime: "2026-04-20T00:00:00.000Z", updateTime: "2026-11-16T00:00:00.000Z"};
}

export function fixture() {
  const manifest = {specVersion: "v1alpha1", params: SECRET_KEYS.map(name => ({name, type: "secret"})), endpoints: {
    [TARGET]: {platform: "gcfv2", region: [REGION], entryPoint: TARGET, httpsTrigger: {}, secretEnvironmentVariables: SECRET_KEYS.map(key => ({key}))},
    // Deliberate #745 difference: source one binding, deployed four. This operation
    // must preserve that state, without pretending to resolve the unrelated PR.
    reconcileMyCheckoutSessionOrders: {platform: "gcfv2", region: [REGION], entryPoint: "reconcileMyCheckoutSessionOrders", callableTrigger: {},
      secretEnvironmentVariables: [{key: "STRIPE_SECRET"}]},
  }};
  const source = {binding: {gitSha: "a".repeat(40), tree: "b".repeat(40), trackedSha256: "c".repeat(64), buildSha256: "d".repeat(64),
    manifestSha256: digest(manifest), sdk: {version: "7.2.5", binarySha256: "e".repeat(64), packageSha256: "f".repeat(64)}}, manifest};
  const functions = [functionRecord(TARGET, SECRET_KEYS.map(key => binding(key))),
    functionRecord("reconcileMyCheckoutSessionOrders", SECRET_KEYS.filter(key => key !== SECRET_KEY).map(key => binding(key)))];
  const endpoint = {id: ENDPOINT_ID, object: "webhook_endpoint", url: ENDPOINT_URL, api_version: "2026-03-25.dahlia", application: null,
    created: 1_776_729_600, description: "", enabled_events: [...BEFORE_EVENTS], livemode: false, metadata: {}, status: "enabled"};
  const snapshot = {project: {projectId: PROJECT_ID, projectNumber: PROJECT_NUMBER}, functions,
    schedulers: [{name: `${PREFIX}/jobs/fixture-job`, state: "ENABLED", schedule: "*/5 * * * *", timeZone: "Europe/London",
      retryConfig: {retryCount: 3}, httpTarget: {uri: "https://fixture.example.invalid/task", oidcToken: {serviceAccountEmail: SA}},
      lastAttemptTime: "2026-11-20T11:55:00Z", scheduleTime: "2026-11-20T12:00:00Z", status: {}}],
    invokerPolicies: Object.fromEntries(functions.map(fn => [fn.name.split("/").at(-1), {version: 3, etag: "changing-etag",
      bindings: [{role: "roles/run.invoker", members: ["allUsers"]}]}])),
    secretVersions: {[SECRET_KEY]: {numeric: version("1"), latest: version("1")},
      STRIPE_SECRET: {numeric: {name: `projects/${PROJECT_ID}/secrets/STRIPE_SECRET/versions/1`, state: "ENABLED"},
        latest: {name: `projects/${PROJECT_ID}/secrets/STRIPE_SECRET/versions/1`, state: "ENABLED"}}},
    secretPolicies: {STRIPE_SECRET: {version: 3, bindings: [{role: "roles/secretmanager.secretAccessor", members: [`serviceAccount:${SA}`]}]}},
    signingVersions: [version("1")], signingPolicy: {version: 3, etag: "signing-etag", bindings: [{role: "roles/secretmanager.secretAccessor", members: [`serviceAccount:${SA}`]}]},
    stripe: {account: {id: ACCOUNT_ID}, endpoint, endpoints: [clone(endpoint)]}, targetSourceArchive: archive("original.zip", "3"),
    targetBuildArchive: archive("original.zip", "3"), targetBuild: {name: OLD_BUILD, status: "SUCCESS", createTime: "2026-11-16T00:00:00.000Z",
      startTime: "2026-11-16T00:00:01.000Z", finishTime: "2026-11-16T00:00:40.000Z", resolvedSource: sourceRef(archive("original.zip", "3"))}};
  const files = new Map(), events = [];
  const store = {read: vi.fn(async name => files.has(name) ? clone(files.get(name)) : null), claim: vi.fn(async () => {events.push("claim");}),
    writeOnce: vi.fn(async (name, value) => {events.push(`durable:${name}`); if (files.has(name)) throw Error("Fixture duplicate record"); files.set(name, clone(value));})};
  const provider = {snapshot: vi.fn(async () => clone(snapshot)),
    addSecretVersion: vi.fn(async () => {events.push("add-version"); const metadata = version("2", new Date(NOW + 1000).toISOString());
      snapshot.signingVersions.push(clone(metadata)); snapshot.secretVersions[SECRET_KEY].latest = clone(metadata); return metadata;}),
    accessSecretVersion: vi.fn(async () => CANDIDATE),
    patchFunctionBindings: vi.fn(async () => {events.push("patch-function"); return operation({done: false});}),
    operation: vi.fn(async () => operation()),
    updateSubscriptions: vi.fn(async ({enabledEvents}) => {events.push("update-stripe"); snapshot.stripe.endpoint.enabled_events = [...enabledEvents];
      snapshot.stripe.endpoints[0].enabled_events = [...enabledEvents]; return clone(snapshot.stripe.endpoint);})};
  const f = {source, snapshot, files, events, store, provider, readSource: vi.fn(async () => clone(source)),
    prepare: () => prepareRepair({source: clone(source), snapshot: clone(snapshot), comparisonKey: KEY, candidateSecret: CANDIDATE, now: NOW}),
    updateManifest: change => {change(manifest); source.binding.manifestSha256 = digest(manifest);},
    rebuild: () => {
      const fn = snapshot.functions[0]; fn.serviceConfig.secretEnvironmentVariables = fn.serviceConfig.secretEnvironmentVariables.map(value =>
        value.key === SECRET_KEY ? {...value, version: "2"} : {...value});
      snapshot.secretVersions[SECRET_KEY].numeric = clone(snapshot.signingVersions.find(value => value.name.endsWith("/2")));
      fn.serviceConfig.revision = "stripewebhookpayments-rebuilt"; fn.updateTime = new Date(NOW + 20_000).toISOString(); fn.buildConfig.build = NEW_BUILD;
      snapshot.targetSourceArchive = archive("rebuilt.zip", "4"); snapshot.targetBuildArchive = archive("rebuilt.zip", "4");
      fn.buildConfig.source = {storageSource: sourceRef(snapshot.targetSourceArchive)};
      fn.buildConfig.sourceProvenance = {resolvedStorageSource: sourceRef(snapshot.targetSourceArchive)};
      snapshot.targetBuild = {name: NEW_BUILD, status: "SUCCESS", createTime: new Date(NOW + 1000).toISOString(),
        startTime: new Date(NOW + 2000).toISOString(), finishTime: new Date(NOW + 15_000).toISOString(), resolvedSource: sourceRef(snapshot.targetBuildArchive)};
    }};
  return f;
}
export const approved = proposal => ({...reviewTemplate(proposal), decision: "APPROVED", reviewedBy: "Fixture reviewer", reason: "Reviewed exact Dev-only correction"});
export const context = (f, proposal, extra = {}) => ({proposal, review: approved(proposal), comparisonKey: KEY, candidateSecret: CANDIDATE,
  provider: f.provider, store: f.store, readSource: f.readSource, now: NOW, ...extra});
