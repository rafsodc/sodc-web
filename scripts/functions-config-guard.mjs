#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEPLOYMENT_ENVIRONMENTS, validateFirebaseAlias } from "./deploy-environment-lib.mjs";
import {
  GUARD_SCHEMA, GuardError, applicationEnvironment, assertScheduledTarget, assertSecretMetadata, assertSupportedManifest,
  bytesDigest, canonical, configurationProposal, digest, environmentProjection, evaluateConfiguration, requireGuard, verifyGuardReceipt,
} from "./functions-config-guard-lib.mjs";

const require = createRequire(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVICE_KEYS = ["availableCpu", "availableMemory", "ingressSettings", "minInstanceCount", "maxInstanceCount",
  "maxInstanceRequestConcurrency", "serviceAccountEmail", "timeoutSeconds", "secretEnvironmentVariables"];
const OUTPUT_SERVICE_KEYS = ["environmentVariables", "uri", "service", "revision", "allTrafficOnLatestRevision"];

function command(commandName, args, options = {}) {
  let result;
  try {
    result = execFileSync(commandName, args, { encoding: "utf8", timeout: 30_000, maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"], ...options });
  } catch {
    throw new GuardError("local-command-failed");
  }
  return result;
}

async function json(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { throw new GuardError("invalid-json-input"); }
}

export async function hashDirectory(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      requireGuard(!entry.isSymbolicLink(), "symlink-in-compiled-build");
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(file);
      else files.push([path.relative(directory, file), bytesDigest(await readFile(file))]);
    }
  }
  try { await visit(directory); } catch (error) {
    if (error instanceof GuardError) throw error;
    throw new GuardError("missing-functions-build");
  }
  requireGuard(files.length > 0, "missing-functions-build");
  return digest(files);
}

async function reviewedSourceFingerprint(root) {
  const entries = command("git", ["ls-tree", "-r", "-z", "HEAD"], { cwd: root }).split("\0").filter(Boolean);
  const hashes = [];
  for (const entry of entries) {
    const [metadata, file] = entry.split("\t");
    const [mode, type, expected] = metadata.split(" ");
    requireGuard(type === "blob" && ["100644", "100755"].includes(mode), "unsupported-tracked-source-entry");
    let bytes;
    try { bytes = await readFile(path.join(root, file)); } catch { throw new GuardError("tracked-source-file-unavailable"); }
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    requireGuard(actual === expected, "tracked-source-does-not-match-reviewed-commit");
    hashes.push([mode, file, actual]);
  }
  return digest(hashes);
}

async function assertInputsStillMatch(root, binding, selectedCli, policy, manifestResult, firebaseConfig) {
  requireGuard(command("git", ["rev-parse", "HEAD"], { cwd: root }).trim() === binding.gitSha &&
    !command("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root }).trim(),
  "source-changed-during-guard");
  requireGuard(await reviewedSourceFingerprint(root) === binding.trackedSourceSha256, "source-changed-during-guard");
  for (const [file, expected] of Object.entries(binding.inputs)) {
    const current = existsSync(path.join(root, file)) ? bytesDigest(await readFile(path.join(root, file))) : null;
    requireGuard(current === expected, "configuration-input-changed-during-guard");
  }
  requireGuard(await hashDirectory(path.join(root, "functions/lib")) === binding.buildSha256, "build-changed-during-guard");
  if (!manifestResult) {
    const currentCli = loadPinnedCli(policy);
    requireGuard(digest(currentCli.identity) === digest(selectedCli.identity), "cli-changed-during-guard");
    const currentSdk = await discoverManifest(path.join(root, "functions"), binding.projectId, firebaseConfig);
    requireGuard(digest(currentSdk.manifest) === binding.manifestSha256 && digest(currentSdk.sdk) === digest(binding.sdk),
      "sdk-changed-during-guard");
  }
}

export function loadPinnedCli(policy, executable = "firebase") {
  const resolved = executable.includes(path.sep) ? executable : process.env.PATH?.split(path.delimiter)
    .map((directory) => path.join(directory, executable)).find((file) => existsSync(file));
  requireGuard(resolved, "firebase-cli-not-found");
  let cliRoot, modules, packageJson, entrypoint;
  try {
    entrypoint = realpathSync(resolved);
    cliRoot = path.resolve(path.dirname(entrypoint), "../..");
    packageJson = JSON.parse(readFileSync(path.join(cliRoot, "package.json"), "utf8"));
    requireGuard(packageJson.name === "firebase-tools" && packageJson.version === policy.firebaseToolsVersion,
      "unsupported-firebase-cli-version");
    requireGuard(bytesDigest(readFileSync(entrypoint)) === policy.firebaseToolsEntrypointSha256, "unsupported-firebase-cli-entrypoint");
    modules = Object.fromEntries(Object.entries(policy.firebaseToolsModules).map(([name, expected]) => {
      const actual = bytesDigest(readFileSync(path.join(cliRoot, name)));
      requireGuard(actual === expected, "unsupported-firebase-cli-semantics");
      return [name, actual];
    }));
  } catch (error) {
    if (error instanceof GuardError) throw error;
    throw new GuardError("unsupported-firebase-cli-installation");
  }
  const module = (name) => require(path.join(cliRoot, name));
  const environment = module("lib/functions/env.js");
  const logger = module("lib/logger.js").logger;
  const loadUserEnvs = (options) => {
    const wasSilent = logger.silent;
    logger.silent = true;
    try { return environment.loadUserEnvs(options); } finally { logger.silent = wasSilent; }
  };
  return { executable: entrypoint, identity: { executable: entrypoint, version: packageJson.version, entrypointSha256: bytesDigest(readFileSync(entrypoint)), modules },
    env: { loadUserEnvs, hasUserEnvs: environment.hasUserEnvs }, build: module("lib/deploy/functions/build.js"),
    backend: module("lib/deploy/functions/backend.js"), prepare: module("lib/deploy/functions/prepare.js"),
    discovery: module("lib/deploy/functions/runtimes/discovery/v1alpha1.js"),
    functions: module("lib/gcp/cloudfunctionsv2.js"), scheduler: module("lib/gcp/cloudscheduler.js") };
}

export async function discoverManifest(functionsSource, projectId, firebaseConfig = { projectId }) {
  const directory = await mkdtemp(path.join(tmpdir(), "sodc-functions-manifest-"));
  try {
    const sdkRoot = path.join(functionsSource, "node_modules/firebase-functions");
    const sdkPackage = await json(path.join(sdkRoot, "package.json"));
    requireGuard(sdkPackage.version === "7.2.5", "unsupported-functions-sdk-version");
    const output = path.join(directory, "manifest.json");
    const binary = path.resolve(sdkRoot, sdkPackage.bin?.["firebase-functions"] ?? "missing");
    requireGuard(binary.startsWith(`${sdkRoot}${path.sep}`), "unsupported-functions-sdk-binary");
    // Same local SDK manifest-output mode as the pinned CLI. No server, deploy/prepare,
    // user dotenv, ADC path, inherited token or Secret Manager payload operation is used.
    const child = spawnSync(process.execPath, [binary], { cwd: functionsSource, timeout: 30_000,
      encoding: "utf8", maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: process.env.PATH, GCLOUD_PROJECT: projectId, GOOGLE_CLOUD_QUOTA_PROJECT: projectId, FUNCTIONS_CONTROL_API: "true",
        FIREBASE_CONFIG: JSON.stringify(firebaseConfig), FUNCTIONS_MANIFEST_OUTPUT_PATH: output } });
    requireGuard(!child.error && child.status === 0, "sdk-manifest-discovery-failed");
    return { manifest: await json(output), sdk: { version: sdkPackage.version,
      binarySha256: bytesDigest(await readFile(binary)), packageSha256: bytesDigest(await readFile(path.join(sdkRoot, "package.json"))) } };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function metadataProvider(projectId, region) {
  // Authentication is held only in this closure. Never inherit gcloud stderr or persist bodies.
  const token = command("gcloud", ["auth", "print-access-token"]).trim();
  async function get(host, resource) {
    requireGuard(["cloudfunctions.googleapis.com", "cloudscheduler.googleapis.com", "secretmanager.googleapis.com",
      "run.googleapis.com", "cloudresourcemanager.googleapis.com", "firebase.googleapis.com"].includes(host) &&
      resource.includes(`/projects/${projectId}`) && !resource.includes(":access"), "metadata-resource-not-allowed");
    try {
      const response = await fetch(`https://${host}${resource}`, { method: "GET", redirect: "error",
        headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": projectId }, signal: AbortSignal.timeout(30_000) });
      requireGuard(response.ok, "provider-metadata-read-failed");
      return await response.json();
    } catch { throw new GuardError("provider-metadata-read-failed"); }
  }
  async function list(host, resource, key) {
    const items = [];
    const seen = new Set();
    let pageToken;
    do {
      const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const page = await get(host, `${resource}${suffix}`);
      requireGuard(Array.isArray(page[key] ?? []) && !page.unreachable?.length, "incomplete-provider-list");
      items.push(...(page[key] ?? []));
      pageToken = page.nextPageToken;
      requireGuard(!pageToken || !seen.has(pageToken), "invalid-provider-pagination");
      seen.add(pageToken);
    } while (pageToken);
    return items;
  }
  return {
    functions: () => list("cloudfunctions.googleapis.com", `/v2/projects/${projectId}/locations/${region}/functions?pageSize=1000`, "functions"),
    schedulers: () => list("cloudscheduler.googleapis.com", `/v1/projects/${projectId}/locations/${region}/jobs?pageSize=500`, "jobs"),
    latestSecret: (name) => get("secretmanager.googleapis.com", `/v1/projects/${projectId}/secrets/${name}/versions/latest`),
    project: () => get("cloudresourcemanager.googleapis.com", `/v1/projects/${projectId}`),
    firebaseConfig: () => get("firebase.googleapis.com", `/v1beta1/projects/${projectId}/adminSdkConfig`),
    invokerPolicy: (service) => {
      requireGuard(service.startsWith(`projects/${projectId}/locations/${region}/services/`) && /^[a-z0-9-]+$/.test(service.split("/").at(-1)),
        "invalid-cloud-run-service");
      return get("run.googleapis.com", `/v1/${service}:getIamPolicy?options.requestedPolicyVersion=3`);
    },
  };
}

function sortedSecrets(secrets = []) {
  return [...secrets].sort((a, b) => `${a.key}/${a.secret}`.localeCompare(`${b.key}/${b.secret}`));
}

function schedulerProjection(jobs) {
  return jobs.map((job) => {
    const { name, schedule, timeZone, state, attemptDeadline, retryConfig } = job;
    const targets = {};
    for (const key of ["httpTarget", "pubsubTarget", "appEngineHttpTarget"]) {
      if (job[key]) targets[key] = digest(job[key]);
    }
    return canonical({ name, schedule, timeZone, state, attemptDeadline, retryConfig, targets });
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function collectAssessment({ root, environment, mode = "dotenv", cli, provider, manifestResult, reviewPath }) {
  requireGuard(process.versions.node.split(".")[0] === "24", "node-24-required");
  const policy = await json(path.join(root, "config/functions-config-guard.json"));
  const firebaseRc = await json(path.join(root, ".firebaserc"));
  const projectId = validateFirebaseAlias(firebaseRc, environment);
  const config = await json(path.join(root, "firebase.json"));
  const auditConfig = await json(path.join(root, "config/deployment-check.json"));
  const region = auditConfig.region;
  const local = config.functions;
  requireGuard(Array.isArray(local) && local.length === 1 && local[0].source === "functions" &&
    Object.keys(local[0]).every((key) => ["source", "codebase", "disallowLegacyRuntimeConfig", "ignore", "predeploy"].includes(key)) &&
    (local[0].codebase ?? "default") === "default" && local[0].disallowLegacyRuntimeConfig === true &&
    !local[0].configDir && !local[0].additionalSources && !local[0].runtime && !local[0].postdeploy &&
    digest(local[0].predeploy ?? []) === digest(['npm --prefix "$RESOURCE_DIR" run build']),
  "unsupported-functions-config");
  requireGuard(["dotenv", "preserve-existing"].includes(mode), "unsupported-configuration-mode");
  const gitSha = command("git", ["rev-parse", "HEAD"], { cwd: root }).trim();
  const tree = command("git", ["rev-parse", "HEAD^{tree}"], { cwd: root }).trim();
  requireGuard(!command("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root }).trim(), "checkout-not-clean");
  const trackedSourceSha256 = await reviewedSourceFingerprint(root);
  const functionsSource = path.join(root, "functions");
  const functionsPackage = await json(path.join(functionsSource, "package.json"));
  requireGuard(functionsPackage.engines?.node === "24" && functionsPackage.main === "lib/index.js" &&
    [undefined, "commonjs"].includes(functionsPackage.type), "unsupported-functions-package-runtime-or-entrypoint");
  const buildSha256 = await hashDirectory(path.join(functionsSource, "lib"));
  const selectedCli = cli ?? loadPinnedCli(policy);
  const selectedProvider = provider ?? metadataProvider(projectId, region);
  const firebaseConfig = await selectedProvider.firebaseConfig();
  requireGuard(firebaseConfig.projectId === projectId, "firebase-admin-config-project-mismatch");
  const discovered = manifestResult ?? await discoverManifest(functionsSource, projectId, firebaseConfig);
  assertSupportedManifest(discovered.manifest, region);
  const taskQueueSourceContracts = Object.entries(discovered.manifest.endpoints).filter(([, endpoint]) => endpoint.taskQueueTrigger)
    .map(([name, endpoint]) => ({ name, triggerSha256: digest(endpoint.taskQueueTrigger) })).sort((a, b) => a.name.localeCompare(b.name));
  requireGuard(digest(Object.fromEntries(taskQueueSourceContracts.map(({ name, triggerSha256 }) => [name, triggerSha256]))) ===
    digest(policy.supportedTaskQueueTriggers), "task-queue-source-contract-not-reviewed");
  const inputFiles = ["firebase.json", ".firebaserc", "config/functions-config-guard.json", "config/deployment-check.json",
    "functions/package.json", "functions/package-lock.json", "package-lock.json"];
  const envFiles = [".env", `.env.${projectId}`, `.env.${environment}`];
  const inputs = {};
  for (const file of [...inputFiles, ...envFiles.map((name) => `functions/${name}`)]) {
    inputs[file] = existsSync(path.join(root, file)) ? bytesDigest(await readFile(path.join(root, file))) : null;
  }
  const hasTargetFile = envFiles.slice(1).some((name) => existsSync(path.join(functionsSource, name)));
  requireGuard(!envFiles.slice(1).every((name) => existsSync(path.join(functionsSource, name))), "conflicting-project-alias-dotenv");
  requireGuard(mode !== "dotenv" || hasTargetFile, "missing-target-project-dotenv");
  let userEnvs, usesDotenv;
  try {
    if (mode === "preserve-existing") {
      const configDir = await mkdtemp(path.join(tmpdir(), "sodc-empty-functions-config-"));
      try {
        const options = { functionsSource, configDir, projectId, projectAlias: environment, isEmulator: false };
        userEnvs = selectedCli.env.loadUserEnvs(options);
        usesDotenv = selectedCli.env.hasUserEnvs(options);
        requireGuard(Object.keys(userEnvs).length === 0 && !usesDotenv, "empty-config-directory-resolution-mismatch");
      } finally { await rm(configDir, { recursive: true, force: true }); }
    }
    else {
      const options = { functionsSource, projectId, projectAlias: environment, isEmulator: false };
      userEnvs = selectedCli.env.loadUserEnvs(options);
      usesDotenv = selectedCli.env.hasUserEnvs(options);
    }
  } catch { throw new GuardError("dotenv-resolution-failed"); }
  const bindings = { projectId, environment, gitSha, tree, trackedSourceSha256, mode, inputs, buildSha256,
    manifestSha256: digest(discovered.manifest), firebaseConfigSha256: digest(firebaseConfig), sdk: discovered.sdk, cli: selectedCli.identity };
  const [functions, jobs, project] = await Promise.all([selectedProvider.functions(), selectedProvider.schedulers(), selectedProvider.project()]);
  requireGuard(project.projectId === projectId && /^\d+$/.test(String(project.projectNumber)), "project-metadata-mismatch");
  requireGuard(functions.length > 0 && jobs.length > 0, "empty-provider-inventory");
  const manifestIds = Object.keys(discovered.manifest.endpoints).sort();
  requireGuard(digest(functions.map((fn) => fn.name?.split("/").at(-1)).sort()) === digest(manifestIds),
    "endpoint-inventory-or-scope-change");
  for (const fn of functions) {
    requireGuard(fn.name === `projects/${projectId}/locations/${region}/functions/${fn.name.split("/").at(-1)}` &&
      fn.state === "ACTIVE" && fn.buildConfig?.runtime === "nodejs24" && fn.serviceConfig?.allTrafficOnLatestRevision === true,
    "endpoint-not-active-or-runtime-mismatch");
    requireGuard(Object.keys(fn.serviceConfig).every((key) => [...SERVICE_KEYS, ...OUTPUT_SERVICE_KEYS].includes(key)),
      "unsupported-live-service-configuration");
  }
  const expectedJobs = [...Object.entries(discovered.manifest.endpoints).filter(([, endpoint]) => endpoint.scheduleTrigger)
    .map(([name]) => `firebase-schedule-${name}-${region}`), ...policy.externalSchedulerJobs].sort();
  requireGuard(digest(jobs.map((job) => job.name?.split("/").at(-1)).sort()) === digest(expectedJobs) &&
    jobs.every((job) => job.name?.startsWith(`projects/${projectId}/locations/${region}/jobs/`) && job.state === "ENABLED"),
    "scheduler-inventory-or-state-invalid");
  const existingEndpoints = functions.map((fn) => selectedCli.functions.endpointFromFunction(fn));
  const secretNames = [...new Set(existingEndpoints.flatMap((endpoint) => (endpoint.secretEnvironmentVariables ?? []).map((secret) => secret.secret)))];
  const secretMetadata = {};
  for (const name of secretNames) {
    requireGuard(/^[A-Z_][A-Z0-9_]*$/.test(name), "invalid-secret-name");
    const metadata = await selectedProvider.latestSecret(name);
    const parts = metadata.name?.split("/") ?? [];
    requireGuard(parts.length === 6 && parts[0] === "projects" && [projectId, String(project.projectNumber)].includes(parts[1]) &&
      parts[2] === "secrets" && parts[3] === name && parts[4] === "versions", "secret-resource-project-mismatch");
    secretMetadata[name] = { name: `projects/${projectId}/secrets/${name}/versions/${parts[5]}`, state: metadata.state };
  }
  const secrets = assertSecretMetadata(existingEndpoints, (discovered.manifest.params ?? []).map((param) => param.name), secretMetadata, projectId);
  let candidate;
  try {
    const build = selectedCli.discovery.buildFromV1Alpha1(discovered.manifest, projectId, region, "nodejs24");
    // Supported manifests contain only secret parameters. Their metadata is checked above;
    // no parameter resolver, prompt, dotenv writer, deployment prepare or secret accessor runs.
    candidate = selectedCli.build.toBackend(build, {});
    for (const endpoint of selectedCli.backend.allEndpoints(candidate)) {
      endpoint.environmentVariables = { ...userEnvs };
    }
    selectedCli.prepare.inferDetailsFromExisting(candidate, selectedCli.backend.of(...existingEndpoints), usesDotenv);
    selectedCli.prepare.resolveCpuAndConcurrency(candidate);
    selectedCli.prepare.resolveDefaultTimeout(candidate);
  } catch { throw new GuardError("unsupported-sdk-contract-resolution"); }
  const rows = [];
  const liveContracts = [];
  const providerDefaultResets = [];
  for (const endpoint of selectedCli.backend.allEndpoints(candidate).sort((a, b) => a.id.localeCompare(b.id))) {
    const fn = functions.find((item) => item.name.endsWith(`/${endpoint.id}`));
    const before = applicationEnvironment(fn.serviceConfig.environmentVariables ?? {});
    const after = applicationEnvironment(endpoint.environmentVariables ?? {});
    // Preservation inherits endpoint-scoped values, but cannot authorize a configured
    // bucket/origin for another environment. Absent/empty inherited values remain
    // visible as required-nonempty deviations for exact review below.
    if (mode === "dotenv" || (Object.hasOwn(after, "SECTION_FILES_BUCKET") && after.SECTION_FILES_BUCKET !== "")) {
      requireGuard(after.SECTION_FILES_BUCKET === `${projectId}.firebasestorage.app`, "wrong-project-bucket");
    }
    if (mode === "dotenv" || (Object.hasOwn(after, "APP_BASE_URL") && after.APP_BASE_URL !== "")) {
      requireGuard(after.APP_BASE_URL === policy.appBaseUrls[environment], "wrong-environment-app-base-url");
    }
    requireGuard(!secretNames.some((name) => Object.hasOwn(after, name)), "secret-name-in-application-dotenv");
    const want = selectedCli.functions.functionFromEndpoint(endpoint);
    requireGuard(want.buildConfig.entryPoint === fn.buildConfig.entryPoint, "entrypoint-contract-change");
    for (const [key, value] of Object.entries(want.serviceConfig)) {
      if (["environmentVariables", "secretEnvironmentVariables"].includes(key)) continue;
      const before = fn.serviceConfig[key];
      if (value === null && key === "maxInstanceCount") {
        providerDefaultResets.push({ endpoint: endpoint.id, field: key, currentSha256: digest(before ?? null), reason: "provider-dependent-reset" });
        continue;
      }
      const defaults = { ingressSettings: "ALLOW_ALL", serviceAccountEmail: `${project.projectNumber}-compute@developer.gserviceaccount.com`,
        timeoutSeconds: 60, minInstanceCount: 0, vpcConnector: null, vpcConnectorEgressSettings: null,
        directVpcNetworkInterface: null, directVpcEgress: null };
      const desired = value === null && Object.hasOwn(defaults, key) ? defaults[key] : value;
      const existing = before ?? (Object.hasOwn(defaults, key) ? defaults[key] : null);
      requireGuard(digest(desired) === digest(existing), "runtime-or-identity-contract-change");
    }
    requireGuard(digest(sortedSecrets(want.serviceConfig.secretEnvironmentVariables).map(({ key, secret, projectId: id }) => ({ key, secret, projectId: id }))) ===
      digest(sortedSecrets(fn.serviceConfig.secretEnvironmentVariables).map(({ key, secret, projectId: id }) => ({ key, secret, projectId: id }))),
    "secret-binding-contract-change");
    const isScheduled = Object.hasOwn(endpoint, "scheduleTrigger");
    const isTask = Object.hasOwn(endpoint, "taskQueueTrigger");
    const isCallable = Object.hasOwn(endpoint, "callableTrigger");
    requireGuard(Boolean(fn.labels?.["deployment-scheduled"]) === isScheduled &&
      Boolean(fn.labels?.["deployment-taskqueue"]) === isTask && Boolean(fn.labels?.["deployment-callable"]) === isCallable && !fn.eventTrigger,
    "trigger-contract-change");
    if (isScheduled) {
      const job = jobs.find((item) => item.name.endsWith(`/firebase-schedule-${endpoint.id}-${region}`));
      const desired = await selectedCli.scheduler.jobFromEndpoint({ ...endpoint, uri: fn.serviceConfig.uri,
        serviceAccount: endpoint.serviceAccount ?? `${project.projectNumber}-compute@developer.gserviceaccount.com` }, region, project.projectNumber);
      requireGuard(job && ["name", "schedule", "timeZone", "attemptDeadline"].every((key) =>
        digest(desired[key] ?? null) === digest(job[key] ?? null)),
      "schedule-contract-change");
      assertScheduledTarget(job.httpTarget, { projectId, region, endpointId: endpoint.id, runUri: fn.serviceConfig.uri,
        serviceAccount: desired.httpTarget.oidcToken.serviceAccountEmail });
    }
    const iam = await selectedProvider.invokerPolicy(fn.serviceConfig.service);
    // A v1 policy can conceal a condition by renaming the role. Reject that legacy
    // shape as well as explicit v3 conditions, before filtering/recording invokers.
    const invokerBindings = (iam.bindings ?? []).filter((item) => item.role === "roles/run.invoker" ||
      item.role?.startsWith("roles/run.invoker_withcond_"));
    requireGuard(invokerBindings.every((item) => item.role === "roles/run.invoker" && !Object.hasOwn(item, "condition")),
      "conditional-invoker-policy-not-supported");
    const invokers = invokerBindings
      .map((item) => ({ ...item, members: [...(item.members ?? [])].sort() })).sort((a, b) => digest(a).localeCompare(digest(b)));
    const publicMembers = invokers.flatMap((item) => item.members).filter((member) => ["allUsers", "allAuthenticatedUsers"].includes(member));
    const expectedPublic = auditConfig.expectedPublicInvokerFunctions.includes(endpoint.id);
    requireGuard(expectedPublic ? publicMembers.includes("allUsers") && !publicMembers.includes("allAuthenticatedUsers") : publicMembers.length === 0,
      "invoker-contract-mismatch");
    const explicitInvoker = endpoint.httpsTrigger?.invoker;
    requireGuard(explicitInvoker === undefined || digest(explicitInvoker) === digest(expectedPublic ? ["public"] : ["private"]),
      "unsupported-explicit-invoker-contract");
    rows.push({ name: endpoint.id, before: environmentProjection(before), after: environmentProjection(after) });
    liveContracts.push({ name: endpoint.id, runtime: fn.buildConfig.runtime, entryPoint: fn.buildConfig.entryPoint,
      environment: environmentProjection(before), serviceConfigurationSha256: digest(Object.fromEntries(SERVICE_KEYS
        .filter((key) => Object.hasOwn(fn.serviceConfig, key)).map((key) => [key, fn.serviceConfig[key]]))),
      eventTriggerSha256: digest(fn.eventTrigger ?? null), invokersSha256: digest(invokers),
      managedEnvironment: environmentProjection(Object.fromEntries(Object.entries(fn.serviceConfig.environmentVariables ?? {})
        .filter(([key]) => !Object.hasOwn(before, key)))),
      deployedRevisionSha256: digest({ source: fn.buildConfig.source, build: fn.buildConfig.build,
        revision: fn.serviceConfig.revision, updateTime: fn.updateTime }),
      trigger: isScheduled ? "schedule" : isTask ? "task" : isCallable ? "callable" : "https" });
  }
  const baseline = { functions: liveContracts, schedulers: schedulerProjection(jobs), taskQueueSourceContracts, liveTaskQueuesChecked: false, secrets };
  const assertUnchanged = () => assertInputsStillMatch(root, bindings, selectedCli, policy, manifestResult, firebaseConfig);
  await assertUnchanged();
  const review = reviewPath ? await json(reviewPath) : undefined;
  const proposal = { bindingSha256: digest(bindings), baselineSha256: digest(baseline) };
  return { binding: bindings, baseline, rows, policy, review, proposal, providerDefaultResets, assertUnchanged };
}

export function guardPath(root, environment) {
  return path.join(root, ".firebase/functions-config-guard", `${environment}.json`);
}

export async function runFunctionsConfigGuard(root, environment, { verify = false, propose = false,
  mode = process.env.SODC_FUNCTIONS_CONFIG_MODE ?? "dotenv", reviewPath = process.env.SODC_FUNCTIONS_CONFIG_REVIEW,
  ...dependencies } = {}) {
  try {
    const assessment = await collectAssessment({ root, environment, mode, reviewPath, ...dependencies });
    // A proposal is not an approval or passing attestation. It deliberately records exact
    // key/hash deltas, even when the ordinary decision would block.
    let proposal;
    if (propose) {
      const recorder = { ...configurationProposal({ binding: assessment.binding, endpoints: assessment.rows, policy: assessment.policy,
        baseline: assessment.baseline, providerDefaultResets: assessment.providerDefaultResets }), mode: mode === "preserve-existing" ? mode : "change-environment",
        reviewedBy: "REPLACE_AFTER_REVIEW", reason: "REPLACE_AFTER_REVIEW" };
      return { status: "REVIEW_REQUIRED", ...recorder };
    }
    proposal = evaluateConfiguration({ binding: assessment.binding, endpoints: assessment.rows, policy: assessment.policy,
      baseline: assessment.baseline, review: assessment.review, providerDefaultResets: assessment.providerDefaultResets });
    const receipt = { schemaVersion: GUARD_SCHEMA, status: "PASS", checkedAt: new Date().toISOString(),
      binding: assessment.binding, baseline: assessment.baseline, reviewSha256: assessment.review ? digest(assessment.review) : null,
      outcome: { mode, environmentChanges: proposal.environmentChanges, policyDeviations: proposal.policyDeviations,
        providerDefaultResets: proposal.providerDefaultResets },
      secretPayloadsRead: false, providerWrites: false, environmentValuesPersisted: false };
    if (verify) verifyGuardReceipt(await json(guardPath(root, environment)), receipt);
    else {
      await mkdir(path.dirname(guardPath(root, environment)), { recursive: true, mode: 0o700 });
      await writeFile(guardPath(root, environment), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    }
    Object.defineProperty(receipt, "assertUnchanged", { value: assessment.assertUnchanged });
    return receipt;
  } catch (error) {
    if (error instanceof GuardError) throw error;
    throw new GuardError("unsupported-or-invalid-input");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const environment = args[args.indexOf("--env") + 1];
  requireGuard(args.includes("--env") && Object.hasOwn(DEPLOYMENT_ENVIRONMENTS, environment), "explicit-environment-required");
  requireGuard(args.every((argument, index) => ["--env", "--verify", "--propose"].includes(argument) || args[index - 1] === "--env"), "unsupported-argument");
  const receipt = await runFunctionsConfigGuard(repositoryRoot, environment, { verify: args.includes("--verify"), propose: args.includes("--propose") });
  console.log(JSON.stringify(receipt.status === "REVIEW_REQUIRED" ? receipt : {
    status: receipt.status, environment, projectId: receipt.binding.projectId, gitSha: receipt.binding.gitSha,
    endpoints: receipt.baseline.functions.length, schedulers: receipt.baseline.schedulers.length,
    secretBindings: receipt.baseline.secrets.length, mode: receipt.binding.mode }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof GuardError ? error.message : "Functions configuration guard blocked: unexpected-failure.");
    process.exitCode = 1;
  });
}
