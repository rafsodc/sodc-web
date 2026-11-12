#!/usr/bin/env node
import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

export const DISPOSAL_VALIDATION_PROJECTS = Object.freeze(["sodc-web", "sodc-web-production"]);
export const DISPOSAL_VALIDATION_REGION = "europe-west2";
export const DISPOSAL_VALIDATION_POLL_MS = 600000;
const worker = "reconcilePendingSecurityTransitions";
const roles = Object.freeze(["eligible", "held", "incomplete"]);
const decisionFields = "userId generation version internalQuiescedAt taskSafeAt providerSafeAt evidenceReference holdCode reviewDueAt nextAttemptAt lastReason updatedAt";
const compact = value => typeof value === "string" ? value.replaceAll("-", "") : "";
const failure = code => Object.assign(new Error("Hosted disposal validation did not complete."), {code});

/** Validate before SDK imports, credentials, fixture creation or network access. */
export function validateAccountErasureDisposalEnvironment(env, args = []) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) throw new Error("Only --check is supported; all resources and fixtures are fixed.");
  const projectId = env.ACCOUNT_ERASURE_DISPOSAL_PROJECT;
  if (env.RUN_ACCOUNT_ERASURE_DISPOSAL_VALIDATION !== "1" || !DISPOSAL_VALIDATION_PROJECTS.includes(projectId) || env.ACCOUNT_ERASURE_DISPOSAL_CONFIRM !== projectId) throw new Error("Explicit opt-in and exact fixed Dev or production confirmation required.");
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (/_EMULATOR_(HOST|PORT)$/.test(key) || key === "FIREBASE_EMULATORS_HUB") throw new Error("Emulator overrides forbidden for hosted validation.");
    if (["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "VITE_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID", "CLOUDSDK_CORE_PROJECT"].includes(key) && value !== projectId) throw new Error("Conflicting project context forbidden.");
    if (/(?:ENDPOINT|ENDPOINTS)(?:_|$)/.test(key) || key.startsWith("CLOUDSDK_API_ENDPOINT_OVERRIDES_") || ["FIREBASE_CONFIG", "GCE_METADATA_HOST", "GCE_METADATA_IP", "GCE_METADATA_ROOT", "GOOGLE_GCE_METADATA_IP"].includes(key) || (key.startsWith("ACCOUNT_ERASURE_DISPOSAL_") && !["ACCOUNT_ERASURE_DISPOSAL_PROJECT", "ACCOUNT_ERASURE_DISPOSAL_CONFIRM"].includes(key))) throw new Error("Endpoint, source and externally supplied fixture overrides forbidden.");
  }
  return {projectId, region: DISPOSAL_VALIDATION_REGION, checkOnly: args[0] === "--check"};
}

export function accountErasureDisposalCloudResources(projectId) {
  if (!DISPOSAL_VALIDATION_PROJECTS.includes(projectId)) throw failure("TARGET_INVALID");
  const base = `projects/${projectId}/locations/${DISPOSAL_VALIDATION_REGION}`;
  return {
    functionName: `${base}/functions/${worker}`,
    functionUrl: `https://${DISPOSAL_VALIDATION_REGION}-${projectId}.cloudfunctions.net/${worker}`,
    jobName: `${base}/jobs/firebase-schedule-${worker}-${DISPOSAL_VALIDATION_REGION}`,
  };
}

export function validateAccountErasureDisposalScheduler(projectId, metadata, job) {
  const resources = accountErasureDisposalCloudResources(projectId);
  assert.equal(metadata?.name, resources.functionName);
  assert.equal(metadata?.state, "ACTIVE");
  assert.equal(metadata?.buildConfig?.runtime, "nodejs24");
  assert.equal(metadata?.buildConfig?.entryPoint, worker);
  assert.equal(Number(metadata?.serviceConfig?.timeoutSeconds), 540);
  assert.equal(job?.name, resources.jobName);
  assert.equal(job?.state, "ENABLED");
  assert.equal(job?.httpTarget?.httpMethod, "POST");
  const uri = job.httpTarget.uri;
  const parsed = new URL(uri);
  const liveUri = typeof metadata.serviceConfig.uri === "string" ? new URL(metadata.serviceConfig.uri).href : undefined;
  assert.ok(parsed.href === resources.functionUrl || parsed.href === liveUri);
  assert.ok(parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && (uri === resources.functionUrl || (parsed.hostname.endsWith(".run.app") && parsed.pathname === "/")));
  assert.equal(job.httpTarget.oidcToken?.audience, uri);
  assert.ok(typeof job.httpTarget.oidcToken?.serviceAccountEmail === "string" && job.httpTarget.oidcToken.serviceAccountEmail.endsWith(".gserviceaccount.com"));
}

export function createAccountErasureDisposalFixtures() {
  const prefix = `disposal-validation-${randomUUID()}`;
  return {prefix, fixtures: roles.map(role => {
    const uid = `${prefix}-${role}`;
    return {role, uid, generation: randomUUID(), hashes: [0, 1].map(index => createHash("sha256").update(`${uid}-${index}@example.invalid`).digest("hex"))};
  })};
}
function assertOwned(set, fixture) {
  assert.ok(set.fixtures.includes(fixture) && /^disposal-validation-[a-f0-9-]{36}$/.test(set.prefix) && fixture.uid === `${set.prefix}-${fixture.role}` && roles.includes(fixture.role));
  assert.ok(/^[a-f0-9-]{36}$/.test(fixture.generation) && fixture.hashes.length === 2 && new Set(fixture.hashes).size === 2 && fixture.hashes.every(hash => /^[a-f0-9]{64}$/.test(hash)));
}
export function accountErasureDisposalSeed(set) {
  assert.equal(set.fixtures.length, 3);
  assert.deepEqual(set.fixtures.map(item => item.role), roles);
  const variables = {}, declarations = [], decisions = [], markers = [];
  for (const fixture of set.fixtures) {
    assertOwned(set, fixture);
    const role = fixture.role;
    declarations.push(`$${role}Uid: String!`, `$${role}Generation: UUID!`, `$${role}First: String!`, `$${role}Second: String!`);
    Object.assign(variables, {[`${role}Uid`]: fixture.uid, [`${role}Generation`]: fixture.generation, [`${role}First`]: fixture.hashes[0], [`${role}Second`]: fixture.hashes[1]});
    decisions.push(`{userId: $${role}Uid, generation: $${role}Generation, internalQuiescedAt_expr: "request.time - duration('3456000s')", taskSafeAt_expr: "request.time - duration('3456000s')", providerSafeAt_expr: "request.time - duration('864000s')", evidenceReference: "SYNTHETIC_HOSTED_VALIDATION", nextAttemptAt_expr: "request.time - duration('3456000s')"${role === "held" ? ", holdCode: \"OPERATOR_REVIEW\", reviewDueAt_expr: \"request.time + duration('2160000s')\"" : ""}}`);
    for (const [index, key] of ["First", "Second"].entries()) markers.push(`{userId: $${role}Uid, emailHash: $${role}${key}, startedAt_expr: "request.time - duration('3456330s')", profileDeletedAt_expr: "request.time - duration('3456000s')", ${role === "incomplete" && index === 1 ? "completedAt: null" : "completedAt_expr: \"request.time - duration('3456000s')\""}}`);
  }
  return {query: `mutation SeedOwnedDisposalValidation(${declarations.join(", ")}) @transaction {
    accountErasureDisposal_insertMany(data: [${decisions.join(", ")}])
    accountErasure_insertMany(data: [${markers.join(", ")}])
  }`, variables};
}

function intactFixture(fixture, snapshot) {
  assert.ok(snapshot && Array.isArray(snapshot.markers) && snapshot.markers.length === 2 && snapshot.decision);
  assert.deepEqual(snapshot.markers.map(row => row.emailHash).sort(), [...fixture.hashes].sort());
  assert.ok(snapshot.markers.every(row => row.userId === fixture.uid && typeof row.startedAt === "string" && typeof row.profileDeletedAt === "string" && Number.isFinite(Date.parse(row.startedAt)) && Number.isFinite(Date.parse(row.profileDeletedAt))));
  assert.equal(snapshot.decision.userId, fixture.uid);
  assert.equal(compact(snapshot.decision.generation), compact(fixture.generation));
  assert.ok(Number.isSafeInteger(snapshot.decision.version) && snapshot.decision.version >= 1);
  const deleted = Date.parse(snapshot.markers[0].profileDeletedAt);
  assert.ok(snapshot.markers.every(row => Date.parse(row.profileDeletedAt) === deleted && deleted - Date.parse(row.startedAt) === 330000 && (row.completedAt === null || Date.parse(row.completedAt) === deleted)));
  assert.equal(Date.parse(snapshot.decision.internalQuiescedAt), deleted);
  assert.equal(Date.parse(snapshot.decision.taskSafeAt), deleted);
  assert.equal(Date.parse(snapshot.decision.providerSafeAt) - deleted, 2592000000);
  assert.equal(snapshot.decision.evidenceReference, "SYNTHETIC_HOSTED_VALIDATION");
}
/** Only hosted worker writes can produce the required version/reason or purge. */
export function accountErasureDisposalHostedOutcome(projectId, set, snapshots) {
  accountErasureDisposalCloudResources(projectId);
  const held = set.fixtures.find(item => item.role === "held"), incomplete = set.fixtures.find(item => item.role === "incomplete"), eligible = set.fixtures.find(item => item.role === "eligible");
  for (const fixture of [held, incomplete, eligible]) assertOwned(set, fixture);
  const heldState = snapshots.held, incompleteState = snapshots.incomplete, eligibleState = snapshots.eligible;
  intactFixture(held, heldState); intactFixture(incomplete, incompleteState);
  assert.equal(heldState.decision.holdCode, "OPERATOR_REVIEW");
  assert.equal(heldState.decision.version, 1);
  assert.equal(heldState.decision.lastReason, null);
  assert.ok(heldState.markers.every(row => typeof row.completedAt === "string"));
  assert.equal(incompleteState.markers.filter(row => row.completedAt === null).length, 1);
  assert.equal(incompleteState.decision.holdCode, null);
  const incompleteProcessed = incompleteState.decision.version > 1 && incompleteState.decision.lastReason === "INCOMPLETE";
  if (projectId === "sodc-web-production") return incompleteProcessed && eligibleState?.markers?.length === 0 && eligibleState.decision === null;
  intactFixture(eligible, eligibleState);
  assert.equal(eligibleState.decision.holdCode, null);
  return incompleteProcessed && eligibleState.decision.version > 1 && eligibleState.decision.lastReason === "RESTORE_HORIZON_PENDING";
}

export function accountErasureDisposalCleanup(set, fixture, snapshot) {
  assertOwned(set, fixture);
  assert.ok(Array.isArray(snapshot.markers) && snapshot.markers.length <= 2 && snapshot.markers.every(row => row.userId === fixture.uid && fixture.hashes.includes(row.emailHash)));
  const decision = snapshot.decision;
  if (decision) assert.ok(decision.userId === fixture.uid && compact(decision.generation) === compact(fixture.generation) && Number.isSafeInteger(decision.version) && decision.version >= 1);
  const variables = {uid: fixture.uid, hashes: fixture.hashes, count: snapshot.markers.length, ...(decision ? {generation: fixture.generation, version: decision.version} : {})};
  const query = `mutation CleanupOwnedDisposalValidation($uid: String!, $hashes: [String!]!, $count: Int!${decision ? ", $generation: UUID!, $version: Int!" : ""}) @transaction {
    query @redact @check(expr: "response.query.profile == null && response.query.markers.size() == vars.count && response.query.markers.all(e, e.emailHash in vars.hashes) && ${decision ? "response.query.decision != null && response.query.decision.generation == vars.generation && response.query.decision.version == vars.version" : "response.query.decision == null"}", message: "DISPOSAL_VALIDATION_CLEANUP_CONFLICT") {
      profile: user(id: $uid) {id}
      markers: accountErasures(where: {userId: {eq: $uid}}, limit: 3) {emailHash}
      decision: accountErasureDisposal(key: {userId: $uid}) {generation version}
    }
    ${decision ? "fence: accountErasureDisposal_updateMany(where: {userId: {eq: $uid}, generation: {eq: $generation}, version: {eq: $version}}, data: {version_update: {inc: 1}}) @check(expr: \"this == 1\", message: \"DISPOSAL_VALIDATION_CLEANUP_CONFLICT\")" : ""}
    accountErasure_deleteMany(where: {userId: {eq: $uid}}) @check(expr: "this == vars.count", message: "DISPOSAL_VALIDATION_CLEANUP_CONFLICT")
    ${decision ? "accountErasureDisposal_deleteMany(where: {userId: {eq: $uid}, generation: {eq: $generation}}) @check(expr: \"this == 1\", message: \"DISPOSAL_VALIDATION_CLEANUP_CONFLICT\")" : ""}
  }`;
  return {query, variables};
}

async function boundedJson(response) {
  assert.ok(response.ok && Number(response.headers.get("content-length") ?? 0) <= 131072);
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 131072) throw failure("CLOUD_RESPONSE_INVALID");
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
  } finally {await reader.cancel().catch(() => undefined);}
}
async function defaultRuntime(options) {
  const require = createRequire(import.meta.url);
  const {initializeApp, applicationDefault, getApps, deleteApp} = require("firebase-admin/app");
  const {getAuth} = require("firebase-admin/auth");
  const {getDataConnect} = require("firebase-admin/data-connect");
  assert.equal(getApps().length, 0, "Existing SDK context forbidden");
  const credential = applicationDefault();
  initializeApp({projectId: options.projectId, credential});
  const close = async () => {await Promise.all(getApps().map(app => deleteApp(app)));};
  try {
    const auth = getAuth(), dc = getDataConnect({connector: "api", serviceId: "sodc-web-service", location: options.region});
    const security = require("../lib/securityRepository.js");
    const resources = accountErasureDisposalCloudResources(options.projectId);
    async function cloud(operation) {
      let url, method = "GET";
      if (operation === "function") url = `https://cloudfunctions.googleapis.com/v2/${resources.functionName}?fields=name,state,buildConfig/runtime,buildConfig/entryPoint,serviceConfig/timeoutSeconds,serviceConfig/uri`;
      else if (operation === "job") url = `https://cloudscheduler.googleapis.com/v1/${resources.jobName}`;
      else if (operation === "run") {url = `https://cloudscheduler.googleapis.com/v1/${resources.jobName}:run`; method = "POST";}
      else throw failure("TARGET_INVALID");
      const access = await credential.getAccessToken();
      return boundedJson(await fetch(url, {method, redirect: "error", signal: AbortSignal.timeout(30000), headers: {Authorization: `Bearer ${access.access_token}`, "x-goog-user-project": options.projectId, "Content-Type": "application/json"}, ...(method === "POST" ? {body: "{}"} : {})}));
    }
    return {auth, dc, security, cloud, close};
  } catch (error) {await close(); throw error;}
}
async function authAbsent(auth, uid) {
  try {await auth.getUser(uid);} catch (error) {if (error?.code === "auth/user-not-found") return; throw failure("AUTH_READ_FAILED");}
  throw failure("UNEXPECTED_AUTH_IDENTITY");
}
async function readFixture(dc, fixture) {
  const result = await dc.executeGraphqlRead(`query OwnedDisposalValidationState($uid: String!) {
    profile: user(id: $uid) {id}
    markers: accountErasures(where: {userId: {eq: $uid}}, limit: 3) {userId emailHash startedAt profileDeletedAt completedAt}
    decision: accountErasureDisposal(key: {userId: $uid}) {${decisionFields}}
  }`, {variables: {uid: fixture.uid}});
  assert.equal(result.data?.profile, null);
  return result.data;
}
async function baselineHealth(runtime) {
  const [control, roster] = await Promise.all([runtime.security.getAdminSafetyControl(), runtime.security.listReadyAdministrators()]);
  assert.equal(control.data?.adminSafetyControl?.status, "READY");
  const count = control.data.adminSafetyControl.readyAdminCount, rows = roster.data?.userSecurityStates;
  assert.ok(Number.isSafeInteger(count) && count > 0 && count <= 1000 && Array.isArray(rows) && rows.length === count);
  for (const row of rows) {
    const identity = await runtime.auth.getUser(row.userId);
    assert.ok(row.accessReady && row.adminReady && row.syncStatus === "READY" && row.desiredAdmin && row.desiredEnabled && !row.verificationEmail && row.membershipStatus === row.user?.membershipStatus && !identity.disabled && identity.emailVerified && identity.customClaims?.admin === true && identity.customClaims?.enabled === true && identity.customClaims?.securityVersion === row.securityVersion);
  }
  return {count, ids: rows.map(row => row.userId).sort()};
}
async function readPolicy(dc) {
  const result = await dc.executeGraphqlRead("query HostedDisposalValidationPolicy {accountErasureDisposalPolicy(key: {id: \"site-wide\"}) {version externalReplayReviewed reviewReference}}");
  const policy = result.data?.accountErasureDisposalPolicy;
  assert.ok(policy && policy.externalReplayReviewed === true && Number.isSafeInteger(policy.version) && policy.version >= 1 && typeof policy.reviewReference === "string" && policy.reviewReference.length > 0);
  return policy;
}
function boundedRead(operation, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(failure("HOSTED_OUTCOME_TIMEOUT")), Math.max(0, milliseconds));
    operation.then(value => {clearTimeout(timer); resolve(value);}, error => {clearTimeout(timer); reject(error);});
  });
}

export async function runAccountErasureDisposalValidation(env = process.env, args = process.argv.slice(2), {createRuntime = defaultRuntime, now = Date.now, wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))} = {}) {
  const options = validateAccountErasureDisposalEnvironment(env, args);
  if (options.checkOnly) {console.log("PASS DISPOSAL_VALIDATION_TARGETING_ONLY"); return;}
  const runtime = await createRuntime(options);
  const set = createAccountErasureDisposalFixtures();
  let stage = "PREFLIGHT", baseline, policy, seeded = false, seedConfirmed = false, failed = false;
  const mark = value => {stage = value; console.log(`DISPOSAL_VALIDATION_STAGE ${value}`);};
  try {
    mark("PREFLIGHT");
    const [metadata, job] = await Promise.all([runtime.cloud("function"), runtime.cloud("job")]);
    validateAccountErasureDisposalScheduler(options.projectId, metadata, job);
    baseline = await baselineHealth(runtime);
    policy = await readPolicy(runtime.dc);
    mark("VERIFY_EMPTY_SYNTHETIC_NAMESPACE");
    for (const fixture of set.fixtures) {
      assertOwned(set, fixture);
      await authAbsent(runtime.auth, fixture.uid);
      const existing = await readFixture(runtime.dc, fixture);
      assert.equal(existing.markers.length, 0); assert.equal(existing.decision, null);
    }
    mark("SEED_THREE_OWNED_METADATA_FIXTURES");
    const seed = accountErasureDisposalSeed(set);
    seeded = true;
    await runtime.dc.executeGraphql(seed.query, {variables: seed.variables});
    seedConfirmed = true;
    mark("RUN_EXISTING_SCHEDULER");
    await runtime.cloud("run");
    mark("AWAIT_HOSTED_DISPOSAL_OUTCOME");
    const deadline = now() + DISPOSAL_VALIDATION_POLL_MS;
    let complete = false, lastProgress = now();
    while (now() < deadline) {
      const snapshots = Object.fromEntries(await boundedRead(Promise.all(set.fixtures.map(async fixture => [fixture.role, await readFixture(runtime.dc, fixture)])), Math.min(30000, deadline - now())));
      if (accountErasureDisposalHostedOutcome(options.projectId, set, snapshots)) {complete = true; break;}
      if (now() - lastProgress >= 30000) {console.log("DISPOSAL_VALIDATION_STAGE HOSTED_WORKER_PENDING"); lastProgress = now();}
      await wait(Math.min(5000, Math.max(0, deadline - now())));
    }
    if (!complete) throw failure("HOSTED_OUTCOME_TIMEOUT");
    assert.deepEqual(await readPolicy(runtime.dc), policy);
    console.log(options.projectId === "sodc-web-production" ? "PASS HOSTED_PRODUCTION_DISPOSAL_AND_HOLDS" : "PASS HOSTED_DEV_FAIL_CLOSED_RETENTION_AND_HOLDS");
  } catch (error) {
    failed = true;
    const category = ["HOSTED_OUTCOME_TIMEOUT", "AUTH_READ_FAILED", "UNEXPECTED_AUTH_IDENTITY", "TARGET_INVALID", "CLOUD_RESPONSE_INVALID"].includes(error?.code) ? error.code : "CHECK_FAILED";
    console.error(`DISPOSAL_VALIDATION_FAILED ${stage} ${category}`);
  } finally {
    mark("CLEANUP_OWNED_METADATA");
    let cleanupFailed = false;
    if (seeded) for (const fixture of set.fixtures) {
      try {
        assertOwned(set, fixture);
        await authAbsent(runtime.auth, fixture.uid);
        let removed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const snapshot = await readFixture(runtime.dc, fixture);
          if (!snapshot.markers.length && snapshot.decision === null) {removed = true; break;}
          const cleanup = accountErasureDisposalCleanup(set, fixture, snapshot);
          try {await runtime.dc.executeGraphql(cleanup.query, {variables: cleanup.variables});}
          catch (error) {if (attempt === 2 || !String(error).includes("DISPOSAL_VALIDATION_CLEANUP_CONFLICT")) break;}
          const absent = await readFixture(runtime.dc, fixture);
          if (!absent.markers.length && absent.decision === null) {removed = true; break;}
        }
        assert.ok(removed);
      } catch {cleanupFailed = true;}
    }
    try {if (baseline) assert.deepEqual(await baselineHealth(runtime), baseline);} catch {cleanupFailed = true;}
    try {if (policy) assert.deepEqual(await readPolicy(runtime.dc), policy);} catch {cleanupFailed = true;}
    // Data Connect's Admin SDK exposes no server execution deadline. A rejected
    // seed response cannot prove that a late insert-only transaction is over,
    // even if every scope-checked cleanup read currently observes absence.
    if (seeded && !seedConfirmed) {cleanupFailed = true; console.error("DISPOSAL_VALIDATION_FAILED SEED_OUTCOME_UNCERTAIN CLEANUP_UNCONFIRMED");}
    if (cleanupFailed) {failed = true; console.error("DISPOSAL_VALIDATION_FAILED CLEANUP_OR_BASELINE CHECK_FAILED");}
    else console.log(seeded ? "PASS OWNED_METADATA_REMOVED_AND_BASELINE_PRESERVED" : "PASS NO_SYNTHETIC_WRITES");
    await runtime.close();
  }
  if (failed) throw failure("VALIDATION_FAILED");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runAccountErasureDisposalValidation().catch(() => {console.error("DISPOSAL_VALIDATION_FAILED"); process.exitCode = 1;});
}
