#!/usr/bin/env node
import assert from "node:assert/strict";
import {randomBytes, randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {request as httpsRequest} from "node:https";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

export const SELF_DELETION_PROJECT = "sodc-web";
export const SELF_DELETION_REGION = "europe-west2";
export const SELF_DELETION_CALLABLES = Object.freeze(["deleteMyAccount", "deleteAccount"]);
export const SELF_DELETION_CALLABLE_TIMEOUT_MS = 540000;
const MAX_CALLABLE_REQUEST_BYTES = 16384;
const MAX_CALLABLE_RESPONSE_BYTES = 65536;
const ROOT = `https://${SELF_DELETION_REGION}-${SELF_DELETION_PROJECT}.cloudfunctions.net`;
const TYPE = "SELF_ACCOUNT_DELETION_VALIDATION";
export const settleSelfDeletionLeaseMutation = `mutation SettleOwnedSelfDeletionLease($id: UUID!, $uid: String!, $type: String!) @transaction {
  notificationDelivery_updateMany(where: {id: {eq: $id}, userId: {eq: $uid}, notificationType: {eq: $type}, status: {eq: PENDING}, recoveryPayload: {isNull: true}},
    data: {status: SENT, sentAt_expr: "request.time"}) @check(expr: "this == 1", message: "FIXTURE_LEASE_CHANGED")
}`;
const TASK_WORKER_NAME = `projects/${SELF_DELETION_PROJECT}/locations/${SELF_DELETION_REGION}/functions/processAnnouncementEmail`;
// Fixed Dev compute identity, also used by the existing admin validation runner.
const TASK_SERVICE_ACCOUNT = "931675247602-compute@developer.gserviceaccount.com";

export function validateSelfDeletionTaskWorker(metadata) {
  if (metadata?.name !== TASK_WORKER_NAME || metadata?.state !== "ACTIVE" || metadata?.serviceConfig?.serviceAccountEmail !== TASK_SERVICE_ACCOUNT) {
    throw new Error("Fixed Dev task worker resource, active state and runtime identity required.");
  }
  return TASK_SERVICE_ACCOUNT;
}

export function selfDeletionValidationErrorCategory(error) {
  const categories = {
    ERR_ASSERTION: "assertion",
    "functions/invalid-argument": "task-invalid-argument",
    "functions/permission-denied": "task-permission-denied",
    "functions/unauthenticated": "task-unauthenticated",
    "functions/unknown-error": "task-unknown-error",
    "functions/internal-error": "task-internal-error",
    "auth/insufficient-permission": "auth-permission-denied",
    "app/invalid-credential": "credential-unavailable",
    SELF_DELETION_TRANSPORT_FAILED: "hosted-transport-failed",
    SELF_DELETION_TRANSPORT_TIMEOUT: "hosted-transport-timeout",
    SELF_DELETION_REQUEST_INVALID: "hosted-request-invalid",
    SELF_DELETION_RESPONSE_INVALID: "hosted-response-invalid",
    SELF_DELETION_RESPONSE_TOO_LARGE: "hosted-response-too-large",
    SELF_DELETION_OUTCOME_UNCERTAIN: "hosted-outcome-uncertain",
  };
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && Object.hasOwn(categories, code) ? categories[code] : "unclassified";
}

/** Fail before SDK loading, ADC, fixture creation or network access. */
export function validateSelfAccountDeletionEnvironment(env, args = []) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) throw new Error("Only --check is supported; endpoint and fixture selection are fixed.");
  if (env.RUN_SELF_ACCOUNT_DELETION_VALIDATION !== "1" || env.SELF_ACCOUNT_DELETION_PROJECT !== SELF_DELETION_PROJECT || env.SELF_ACCOUNT_DELETION_CONFIRM !== SELF_DELETION_PROJECT) {
    throw new Error("Explicit RUN_SELF_ACCOUNT_DELETION_VALIDATION=1 and fixed Dev project confirmation required.");
  }
  for (const [key, value] of Object.entries(env)) {
    if ((key.endsWith("_EMULATOR_HOST") || key === "FIREBASE_EMULATORS_HUB") && value) throw new Error("Emulator overrides forbidden for hosted validation.");
    if (["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "VITE_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"].includes(key) && value && value !== SELF_DELETION_PROJECT) throw new Error("Conflicting project; only fixed Dev is supported.");
  }
  for (const key of ["FIREBASE_CONFIG", "SELF_ACCOUNT_DELETION_ENDPOINT", "SELF_ACCOUNT_DELETION_TRANSPORT", "SELF_ACCOUNT_DELETION_FIXTURE_PREFIX"]) {
    if (env[key]) throw new Error("Externally supplied Firebase, endpoint or fixture context forbidden.");
  }
  if (args[0] !== "--check" && (typeof env.VITE_FIREBASE_API_KEY !== "string" || !env.VITE_FIREBASE_API_KEY.trim())) throw new Error("Development Firebase API key required.");
  return {projectId: SELF_DELETION_PROJECT, region: SELF_DELETION_REGION, checkOnly: args[0] === "--check"};
}

export function selfDeletionCallableUrl(name) {
  if (!SELF_DELETION_CALLABLES.includes(name)) throw new Error("Unsupported validation callable.");
  return `${ROOT}/${name}`;
}

function callableDeadline(milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  timer.unref();
  return {signal: controller.signal, cancel: () => clearTimeout(timer)};
}

function callableTransportError(code) {
  return Object.assign(new Error("Hosted callable transport did not complete."), {code});
}

/** Native HTTPS has no Undici five-minute header deadline. The fixed target,
 * owned whole-request deadline and socket timeout cover the full sender drain. */
export async function requestSelfDeletionCallable(name, data, idToken, {requestImpl = httpsRequest, deadlineFactory = callableDeadline} = {}) {
  const url = new URL(selfDeletionCallableUrl(name));
  let payload;
  try {payload = JSON.stringify({data});}
  catch {throw callableTransportError("SELF_DELETION_REQUEST_INVALID");}
  if (Buffer.byteLength(payload) > MAX_CALLABLE_REQUEST_BYTES) throw callableTransportError("SELF_DELETION_REQUEST_INVALID");
  return new Promise((resolve, reject) => {
    let request, response, deadline, settled = false, ended = false;
    const chunks = [];
    let bytes = 0;
    const abort = () => fail("SELF_DELETION_TRANSPORT_TIMEOUT");
    const cancelDeadline = () => {
      deadline?.signal.removeEventListener("abort", abort);
      deadline?.cancel();
    };
    const fail = code => {
      if (settled) return;
      settled = true;
      cancelDeadline();
      response?.destroy();
      request?.destroy();
      reject(callableTransportError(code));
    };
    try {
      deadline = deadlineFactory(SELF_DELETION_CALLABLE_TIMEOUT_MS);
      if (deadline.signal.aborted) {fail("SELF_DELETION_TRANSPORT_TIMEOUT"); return;}
      deadline.signal.addEventListener("abort", abort, {once: true});
      request = requestImpl(url, {
        method: "POST", agent: false, timeout: SELF_DELETION_CALLABLE_TIMEOUT_MS, signal: deadline.signal,
        headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...(idToken ? {Authorization: `Bearer ${idToken}`} : {})},
      }, incoming => {
        response = incoming;
        const status = incoming.statusCode;
        const contentType = incoming.headers["content-type"];
        // Native HTTPS never follows redirects, and a redirect is not a valid
        // callable response even if it happens to contain JSON.
        if (!Number.isInteger(status) || status < 200 || status >= 600 || (status >= 300 && status < 400) ||
            typeof contentType !== "string" || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
          fail("SELF_DELETION_RESPONSE_INVALID"); return;
        }
        if (Number(incoming.headers["content-length"]) > MAX_CALLABLE_RESPONSE_BYTES) {fail("SELF_DELETION_RESPONSE_TOO_LARGE"); return;}
        incoming.on("error", () => fail("SELF_DELETION_TRANSPORT_FAILED"));
        incoming.on("aborted", () => fail("SELF_DELETION_TRANSPORT_FAILED"));
        incoming.on("close", () => {if (!ended) fail("SELF_DELETION_TRANSPORT_FAILED");});
        incoming.on("data", chunk => {
          if (settled) return;
          const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += value.length;
          if (bytes > MAX_CALLABLE_RESPONSE_BYTES) {fail("SELF_DELETION_RESPONSE_TOO_LARGE"); return;}
          chunks.push(value);
        });
        incoming.on("end", () => {
          ended = true;
          if (settled) return;
          let body;
          try {body = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));}
          catch {fail("SELF_DELETION_RESPONSE_INVALID"); return;}
          const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
          const hasResult = object(body) && Object.hasOwn(body, "result");
          const hasError = object(body) && Object.hasOwn(body, "error");
          if (!object(body) || hasResult === hasError ||
              (hasResult && (status >= 300 || !object(body.result))) ||
              (hasError && (!object(body.error) || typeof body.error.status !== "string"))) {
            fail("SELF_DELETION_RESPONSE_INVALID"); return;
          }
          settled = true;
          cancelDeadline();
          resolve(body);
        });
      });
      request.on("error", () => fail("SELF_DELETION_TRANSPORT_FAILED"));
      request.on("timeout", () => fail("SELF_DELETION_TRANSPORT_TIMEOUT"));
      request.setTimeout(SELF_DELETION_CALLABLE_TIMEOUT_MS);
      request.end(payload);
    } catch {fail("SELF_DELETION_TRANSPORT_FAILED");}
  });
}

export function knownSelfDeletionOutcome(body) {
  if (body?.result?.deleted === true && body.error === undefined) return true;
  return body?.result === undefined && typeof body?.error?.status === "string" &&
    (body.error.details?.deletionStatus === "NOT_STARTED" || body.error.details?.code === "ACCOUNT_DELETION_INCOMPLETE");
}

export async function awaitSelfDeletionHostedOutcomes(requests, started, {now = Date.now, wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))} = {}) {
  const outcomes = await Promise.allSettled(requests);
  if (outcomes.some(outcome => outcome.status === "rejected" || !knownSelfDeletionOutcome(outcome.value))) {
    // A transport failure or unproven gateway error does not establish that the
    // server stopped. Do not let fixture cleanup race its full runtime budget.
    const remaining = started + 570000 - now();
    if (remaining > 0) await wait(remaining);
    throw callableTransportError("SELF_DELETION_OUTCOME_UNCERTAIN");
  }
  return outcomes.map(outcome => outcome.value);
}

export function requireNotStartedRefusal(response, status, code) {
  assert.equal(response.error?.status, status, "Expected hosted refusal status");
  assert.equal(response.error?.details?.deletionStatus, "NOT_STARTED", "Hosted refusal must prove no erasure write was attempted");
  assert.notEqual(response.error?.details?.code, "ACCOUNT_DELETION_INCOMPLETE", "Incomplete erasure cannot be a not-started refusal");
  if (code) assert.equal(response.error.details.code, code, "Expected preserved hosted refusal domain code");
  assert.equal(response.result, undefined, "A refusal must not report a result");
}

export async function runSelfAccountDeletionValidation(env = process.env, args = process.argv.slice(2)) {
  const options = validateSelfAccountDeletionEnvironment(env, args);
  if (options.checkOnly) {
    console.log("Hosted self-deletion targeting check passed: fixed Dev only; no SDK, credential or network access.");
    return;
  }
  const require = createRequire(import.meta.url);
  const {initializeApp, applicationDefault, getApps, deleteApp} = require("firebase-admin/app");
  const {getAuth} = require("firebase-admin/auth");
  const {getDataConnect} = require("firebase-admin/data-connect");
  const {getFunctions} = require("firebase-admin/functions");
  const credential = applicationDefault();
  initializeApp({projectId: options.projectId, credential});
  const auth = getAuth();
  const dc = getDataConnect({connector: "api", serviceId: "sodc-web-service", location: options.region});
  const security = require("../lib/securityRepository.js");
  const transitions = require("../lib/currentAuthorizationTransitions.js");
  const {announcementErasureTaskIds} = require("../lib/accountCommunicationErasure.js");
  const {erasureEmailHash} = require("../lib/communicationErasureGuard.js");
  let queue;
  const prefix = `self-erasure-${randomUUID()}`;
  const fixtures = [], communications = [];
  let baselineCount, baselineAdministratorIds, stage = "preflight", failed = false;
  const mark = value => {stage = value; console.log(`Validation stage: ${value}`);};
  const own = fixture => assert.ok(fixtures.includes(fixture) && fixture.uid.startsWith(`${prefix}-`), "Unowned fixture refused");

  async function readCloud(url) {
    const access = await credential.getAccessToken();
    const response = await fetch(url, {headers: {Authorization: `Bearer ${access.access_token}`, "x-goog-user-project": options.projectId}, signal: AbortSignal.timeout(30000)});
    if (!response.ok) {await response.body?.cancel(); throw new Error("Dev cloud metadata request failed");}
    return response.json();
  }
  async function call(name, actor, data) {
    if (actor) own(actor);
    return requestSelfDeletionCallable(name, data, actor?.idToken);
  }
  const self = (actor, extra = {}) => call("deleteMyAccount", actor, {email: actor.email, operationId: randomUUID(), apply: false, ...extra});
  const erase = (actor, extra = {}) => self(actor, {apply: true, confirmMembershipEnd: true, ...extra});
  async function signIn(fixture, refresh = false) {
    own(fixture);
    const response = await fetch(refresh ? `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(env.VITE_FIREBASE_API_KEY)}` : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.VITE_FIREBASE_API_KEY)}`, {
      method: "POST", headers: {"Content-Type": refresh ? "application/x-www-form-urlencoded" : "application/json"},
      body: refresh ? new URLSearchParams({grant_type: "refresh_token", refresh_token: fixture.refreshToken}) : JSON.stringify({email: fixture.email, password: fixture.password, returnSecureToken: true}), signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    assert.equal(response.ok, true, "Synthetic fixture sign-in failed");
    fixture.idToken = refresh ? body.id_token : body.idToken;
    fixture.refreshToken = refresh ? body.refresh_token : body.refreshToken;
    fixture.token = await auth.verifyIdToken(fixture.idToken);
    assert.equal(fixture.token.uid, fixture.uid, "Fixture token has wrong identity");
    assert.equal(fixture.token.aud, options.projectId, "Fixture token has wrong project");
    assert.ok(typeof fixture.token.auth_time === "number", "Real sign-in time required");
  }
  async function createFixture(role, admin = false) {
    const uid = `${prefix}-${role}`;
    const fixture = {uid, email: `${uid}@example.invalid`, password: randomBytes(32).toString("base64url"), retireOperation: randomUUID()};
    fixtures.push(fixture);
    await auth.createUser({uid, email: fixture.email, password: fixture.password, emailVerified: true});
    await dc.executeGraphql(`mutation CreateSelfDeletionFixture($uid: String!, $email: String!) {
      user_insert(data: {id: $uid, email: $email, firstName: "Deletion", lastName: "Fixture", serviceNumber: "VALIDATION", membershipStatus: REGULAR, profileReviewedAt_expr: "request.time", mobileNumber: "+447700900123", createdBy: "validation", updatedBy: "validation"})
    }`, {variables: {uid, email: fixture.email}});
    await auth.setCustomUserClaims(uid, {enabled: true, admin});
    await transitions.initializeUserSecurityState({userId: uid, actorId: uid, actorKind: "OPERATOR", operationId: randomUUID(), reason: "Disposable Dev self-deletion validation", allowAdminBootstrap: admin});
    await signIn(fixture);
    return fixture;
  }
  async function verifyNoErasure(fixture) {
    own(fixture);
    const result = await dc.executeGraphql(`query VerifyNoSelfErasure($uid: String!) {
      accountErasures(where: {userId: {eq: $uid}}) {userId}
      user(id: $uid) {id membershipStatus}
    }`, {variables: {uid: fixture.uid}});
    assert.equal(result.data.accountErasures.length, 0, "Refusal inserted suppression");
    assert.ok(result.data.user, "Refusal removed profile");
  }
  async function verifyAbsent(fixture) {
    own(fixture);
    await assert.rejects(auth.getUser(fixture.uid), {code: "auth/user-not-found"});
    const result = await dc.executeGraphql(`query VerifySelfErased($uid: String!) {
      user(id: $uid) {id}
      userSecurityStates(where: {userId: {eq: $uid}}) {userId}
      securityTransitions(where: {userId: {eq: $uid}}) {operationId}
      notificationDeliveries(where: {userId: {eq: $uid}}) {id}
      accountErasures(where: {userId: {eq: $uid}}) {startedAt completedAt profileDeletedAt}
    }`, {variables: {uid: fixture.uid}});
    assert.equal(result.data.user, null, "Profile still present");
    for (const name of ["userSecurityStates", "securityTransitions", "notificationDeliveries"]) assert.equal(result.data[name].length, 0, "Owned records still present");
    assert.ok(result.data.accountErasures.length > 0 && result.data.accountErasures.every(row => row.completedAt && row.profileDeletedAt), "Erasure completion markers missing");
    // Use two server-owned timestamps so workstation/Cloud clock skew cannot
    // make an actual330-second database drain look shorter on the client.
    const serverDrainMs = Math.min(...result.data.accountErasures.map(row => Date.parse(row.profileDeletedAt) - Date.parse(row.startedAt)));
    assert.ok(serverDrainMs >= 330000, "Database profile erasure preceded its330-second suppression drain");
    return serverDrainMs;
  }
  async function seedCommunications(actor, target) {
    own(actor); own(target);
    const section = randomUUID(), send = randomUUID(), ownRecipient = randomUUID(), survivorRecipient = randomUUID(), receipt = randomUUID();
    const task = {sendId: send, recipientId: target.uid, email: `${target.uid}-former@example.invalid`, firstName: "Deletion", lastName: "Fixture", personalisation: {name: "Remove"}, templateUuid: randomUUID(), effectiveDeliveryMode: "SIMULATION"};
    const survivor = {...task, recipientId: actor.uid, email: actor.email, personalisation: {name: "Keep", value: "preserve-exactly"}};
    const item = {section, send, ownRecipient, survivorRecipient, receipt, target, survivor, taskId: announcementErasureTaskIds(send, target.uid, "SIMULATION")[0]};
    communications.push(item);
    await dc.executeGraphql(`mutation SeedSelfDeletionCommunications($section: UUID!, $send: UUID!, $own: UUID!, $survivor: UUID!, $uid: String!, $actor: String!, $email: String!, $actorEmail: String!, $receipt: String!, $hash: String!, $snapshot: String!) {
      section_insert(data: {id: $section, name: "Disposable self-deletion validation", type: MEMBERS, createdBy: "validation", updatedBy: "validation"})
      announcementSend_insert(data: {id: $send, sectionId: $section, templateUuid: "validation", sentBy: $actor, recipientCount: 2, skippedCount: 0, effectiveDeliveryMode: SIMULATION, siteDeliveryMode: SIMULATION, requestedDeliveryMode: SIMULATION, recipientSnapshot: $snapshot})
      own: announcementRecipient_insert(data: {id: $own, announcementSendId: $send, userId: $uid, email: $email, firstName: "Deletion", lastName: "Fixture", status: "queued", effectiveDeliveryMode: SIMULATION})
      survivor: announcementRecipient_insert(data: {id: $survivor, announcementSendId: $send, userId: $actor, email: $actorEmail, firstName: "Deletion", lastName: "Fixture", status: "sent", effectiveDeliveryMode: SIMULATION})
      notifyDeliveryReceipt_insert(data: {id: $receipt, notifyStatus: "delivered", recipientHash: $hash, eventAt_expr: "request.time", eventOrderingKey: $receipt, affectsBounceState: false, processingStatus: PROCESSED, lastAttemptedAt_expr: "request.time", createdBy: "validation", updatedBy: "validation"})
    }`, {variables: {section, send, own: ownRecipient, survivor: survivorRecipient, uid: target.uid, actor: actor.uid, email: task.email, actorEmail: actor.email, receipt, hash: erasureEmailHash(task.email), snapshot: JSON.stringify({version: 1, tasks: [task, survivor], skippedRecipients: [], audienceSummary: "preserve summary"})}});
    await queue.enqueue(task, {id: item.taskId, scheduleDelaySeconds: 3600, dispatchDeadlineSeconds: 60});
    return item;
  }
  async function verifyCommunications(item) {
    own(item.target);
    const result = await dc.executeGraphql(`query VerifySelfDeletionCommunications($send: UUID!, $receipt: String!) {
      announcementSend(id: $send) {recipientSnapshot recipientCount skippedCount}
      announcementRecipients(where: {announcementSendId: {eq: $send}}) {id userId email status}
      notifyDeliveryReceipt(id: $receipt) {id}
    }`, {variables: {send: item.send, receipt: item.receipt}});
    assert.deepEqual(JSON.parse(result.data.announcementSend.recipientSnapshot), {version: 1, tasks: [item.survivor], skippedRecipients: [], audienceSummary: "preserve summary"}, "Shared survivor contents changed");
    assert.equal(result.data.announcementSend.recipientCount, 1, "Shared recipient count incorrect");
    assert.equal(result.data.announcementRecipients.length, 1, "Unexpected shared recipient rows");
    assert.equal(result.data.announcementRecipients[0].userId, item.survivor.recipientId, "Wrong shared recipient preserved");
    assert.equal(result.data.notifyDeliveryReceipt, null, "Historical-address receipt remained");
    const access = await credential.getAccessToken();
    const response = await fetch(`https://cloudtasks.googleapis.com/v2/projects/${options.projectId}/locations/${options.region}/queues/processAnnouncementEmail/tasks/${item.taskId}`, {headers: {Authorization: `Bearer ${access.access_token}`, "x-goog-user-project": options.projectId}, signal: AbortSignal.timeout(30000)});
    // No operator deletes this task until cleanup. A 404 here proves the hosted
    // worker successfully exercised cloudtasks.tasks.delete on a known task.
    assert.equal(response.status, 404, "Hosted worker did not cancel its synthetic task");
    await response.body?.cancel();
  }
  async function cleanup() {
    let incomplete = false;
    for (const item of communications) {
      own(item.target);
      try {
        try {await queue.delete(item.taskId);} catch (error) {if (!["functions/task-not-found", "functions/not-found"].includes(error?.code)) throw error;}
        await dc.executeGraphql(`mutation RemoveSelfDeletionCommunicationFixture($send: UUID!, $section: UUID!, $receipt: String!) {
          announcementRecipient_deleteMany(where: {announcementSendId: {eq: $send}})
          announcementSend_delete(key: {id: $send})
          section_delete(key: {id: $section})
          notifyDeliveryReceipt_delete(key: {id: $receipt})
        }`, {variables: {send: item.send, section: item.section, receipt: item.receipt}});
      } catch {incomplete = true;}
    }
    // The temporary administrator is retired last; an existing healthy baseline
    // administrator must remain throughout. Never modify baseline identities.
    for (const fixture of [...fixtures].reverse()) {
      own(fixture);
      try {
        const current = (await security.getUserSecurityState({userId: fixture.uid})).data.userSecurityState;
        let identity;
        try {identity = await auth.getUser(fixture.uid);} catch (error) {if (error.code !== "auth/user-not-found") throw error;}
        if (current && identity) await transitions.transitionUserSecurity({userId: fixture.uid, actorId: "self-deletion-validation-cleanup", actorKind: "OPERATOR", operationId: fixture.retireOperation, admin: false, authDisabled: true, reason: "Disposable Dev self-deletion fixture cleanup"});
        const retired = (await security.getUserSecurityState({userId: fixture.uid})).data.userSecurityState;
        assert.ok(!retired?.adminReady && !retired?.accessReady, "Fixture readiness not retired");
        await dc.executeGraphql(`mutation RemoveSelfDeletionFixture($uid: String!, $expectedStates: Int!, $type: String!) @transaction {
          userSecurityState_deleteMany(where: {userId: {eq: $uid}, adminReady: {eq: false}, accessReady: {eq: false}}) @check(expr: "this == vars.expectedStates", message: "FIXTURE_CLEANUP_CONFLICT")
          notificationDelivery_deleteMany(where: {userId: {eq: $uid}, notificationType: {eq: $type}})
          callableRateLimitBucket_deleteMany(where: {userId: {eq: $uid}})
          callableInvocation_deleteMany(where: {userId: {eq: $uid}})
          securityTransition_deleteMany(where: {userId: {eq: $uid}})
          accountErasure_deleteMany(where: {userId: {eq: $uid}})
          accountErasureDisposal_deleteMany(where: {userId: {eq: $uid}})
          user_deleteMany(where: {id: {eq: $uid}})
        }`, {variables: {uid: fixture.uid, expectedStates: retired ? 1 : 0, type: TYPE}});
        if (identity) await auth.deleteUser(fixture.uid);
        await assert.rejects(auth.getUser(fixture.uid), {code: "auth/user-not-found"});
        const observed = await dc.executeGraphql(`query VerifyRemovedSelfDeletionFixture($uid: String!) {
          user(id: $uid) {id}
          userSecurityStates(where: {userId: {eq: $uid}}) {userId}
          securityTransitions(where: {userId: {eq: $uid}}) {operationId}
          accountErasures(where: {userId: {eq: $uid}}) {userId}
          accountErasureDisposals(where: {userId: {eq: $uid}}) {userId}
          notificationDeliveries(where: {userId: {eq: $uid}}) {id}
          callableInvocations(where: {userId: {eq: $uid}}) {userId}
          callableRateLimitBuckets(where: {userId: {eq: $uid}}) {userId}
        }`, {variables: {uid: fixture.uid}});
        assert.equal(observed.data.user, null, "Fixture profile remained after cleanup");
        for (const name of ["userSecurityStates", "securityTransitions", "accountErasures", "accountErasureDisposals", "notificationDeliveries", "callableInvocations", "callableRateLimitBuckets"]) assert.equal(observed.data[name].length, 0, "Owned fixture metadata remained after cleanup");
      } catch {incomplete = true;}
    }
    if (baselineCount !== undefined) {
      const [control, roster] = await Promise.all([security.getAdminSafetyControl(), security.listReadyAdministrators()]);
      assert.equal(control.data.adminSafetyControl?.readyAdminCount, baselineCount, "Baseline administrator count changed");
      assert.equal(roster.data.userSecurityStates.length, baselineCount, "Temporary administrator remained");
      assert.deepEqual(roster.data.userSecurityStates.map(row => row.userId).sort(), baselineAdministratorIds, "Baseline administrator identities changed");
    }
    assert.equal(incomplete, false, "Some owned fixture cleanup could not be verified");
  }

  try {
    mark("fixed hosted endpoint and runtime checks");
    for (const name of SELF_DELETION_CALLABLES) {
      const metadata = await readCloud(`https://cloudfunctions.googleapis.com/v2/projects/${options.projectId}/locations/${options.region}/functions/${name}?fields=name,state,buildConfig/runtime,serviceConfig/timeoutSeconds`);
      assert.equal(metadata.name, `projects/${options.projectId}/locations/${options.region}/functions/${name}`);
      assert.equal(metadata.state, "ACTIVE", "Hosted callable is not active");
      assert.equal(metadata.buildConfig.runtime, "nodejs24", "Unexpected hosted runtime");
      assert.equal(Number(metadata.serviceConfig.timeoutSeconds), 540, "Unexpected hosted timeout budget");
      const response = await call(name, null, {});
      assert.equal(response.error?.status, "UNAUTHENTICATED", "Hosted endpoint did not enforce sign-in");
      if (name === "deleteMyAccount") requireNotStartedRefusal(response, "UNAUTHENTICATED");
    }
    mark("fixed Dev task worker resource and runtime identity");
    const taskMetadata = await readCloud(`https://cloudfunctions.googleapis.com/v2/${TASK_WORKER_NAME}?fields=name,state,serviceConfig/serviceAccountEmail`);
    const taskServiceAccount = validateSelfDeletionTaskWorker(taskMetadata);
    // User ADC has no service-account email to infer. Bind task creation only to
    // this verified Dev worker identity; default Auth/Data Connect apps stay intact.
    const taskApp = initializeApp({projectId: options.projectId, credential, serviceAccountId: taskServiceAccount}, "self-account-deletion-validation-tasks");
    queue = getFunctions(taskApp).taskQueue(`locations/${options.region}/functions/processAnnouncementEmail`);
    mark("non-live email mode and baseline administrator health");
    const [control, roster, mode] = await Promise.all([security.getAdminSafetyControl(), security.listReadyAdministrators(), dc.executeGraphql("query ValidationSelfDeletionEmailMode {govNotifyDeliveryConfiguration(key: {id: \"site-wide\"}) {mode}}")]);
    assert.ok(["SIMULATION", "TEAM_TEST"].includes(mode.data.govNotifyDeliveryConfiguration?.mode), "Dev email mode must be non-live");
    assert.equal(control.data.adminSafetyControl?.status, "READY");
    baselineCount = control.data.adminSafetyControl.readyAdminCount;
    baselineAdministratorIds = roster.data.userSecurityStates.map(row => row.userId).sort();
    assert.ok(baselineCount > 0 && roster.data.userSecurityStates.length === baselineCount, "Healthy baseline administrator required");
    for (const row of roster.data.userSecurityStates) {
      const identity = await auth.getUser(row.userId);
      assert.ok(row.accessReady && row.adminReady && row.syncStatus === "READY" && row.desiredAdmin && row.desiredEnabled && !row.verificationEmail && row.membershipStatus === row.user.membershipStatus && !identity.disabled && identity.emailVerified && identity.customClaims?.admin && identity.customClaims?.enabled && identity.customClaims?.securityVersion === row.securityVersion, "Baseline administrator unhealthy");
    }
    mark("create owned synthetic fixtures and real Firebase sessions");
    const admin = await createFixture("admin", true);
    const success = await createFixture("success"), interrupted = await createFixture("interrupted");
    const refusals = await createFixture("refusals"), review = await createFixture("review"), recent = await createFixture("recent"), authorization = await createFixture("authorization");
    mark("hosted refusal details and unchanged-account verification");
    requireNotStartedRefusal(await erase(admin), "FAILED_PRECONDITION", "ACCOUNT_REVIEW_REQUIRED");
    assert.equal((await self(refusals)).result?.eligible, true);
    requireNotStartedRefusal(await erase(refusals, {uid: admin.uid}), "INVALID_ARGUMENT");
    requireNotStartedRefusal(await erase(refusals, {noRetention: true}), "INVALID_ARGUMENT");
    requireNotStartedRefusal(await erase(refusals, {email: "different@example.invalid"}), "FAILED_PRECONDITION", "ACCOUNT_CHANGED");
    requireNotStartedRefusal(await erase(refusals, {confirmMembershipEnd: false}), "INVALID_ARGUMENT");
    // Preview consumes the same allowance without risking a valid destructive
    // request if this run straddles an hourly counter-window boundary.
    let limited;
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await self(refusals);
      if (response.error?.status === "RESOURCE_EXHAUSTED") {limited = response; break;}
      assert.equal(response.result?.eligible, true, "Unexpected rate-limit probe result");
    }
    assert.ok(limited, "Hosted allowance was not exhausted by bounded preview probes");
    requireNotStartedRefusal(limited, "RESOURCE_EXHAUSTED");
    await verifyNoErasure(refusals);
    assert.equal((await auth.getUser(refusals.uid)).disabled, false);
    assert.equal((await self(review)).result?.eligible, true);
    await dc.executeGraphql("mutation AddSelfDeletionRetentionBlocker($uid: String!) {user_update(key: {id: $uid}, data: {stripeCustomerId: \"synthetic-validation-no-provider-customer\"})}", {variables: {uid: review.uid}});
    requireNotStartedRefusal(await erase(review), "FAILED_PRECONDITION", "ACCOUNT_REVIEW_REQUIRED");
    await verifyNoErasure(review);
    await dc.executeGraphql("mutation RemoveSelfDeletionRetentionBlocker($uid: String!) {user_update(key: {id: $uid}, data: {stripeCustomerId: null})}", {variables: {uid: review.uid}});
    await transitions.transitionUserSecurity({userId: authorization.uid, actorId: "self-deletion-validation", actorKind: "OPERATOR", operationId: randomUUID(), membershipStatus: "RETIRED", reason: "Synthetic stale-session refusal"});
    requireNotStartedRefusal(await erase(authorization), "UNAUTHENTICATED", "SESSION_VERSION_STALE");
    await signIn(authorization);
    await transitions.transitionUserSecurity({userId: authorization.uid, actorId: "self-deletion-validation", actorKind: "OPERATOR", operationId: randomUUID(), membershipStatus: "RESIGNED", authDisabled: true, reason: "Synthetic access-revocation refusal"});
    requireNotStartedRefusal(await erase(authorization), "PERMISSION_DENIED", "ACCESS_REVOKED");
    await verifyNoErasure(authorization);

    mark("seed SIMULATION task, shared survivor and non-recoverable active lease");
    const shared = await seedCommunications(admin, success);
    const notification = randomUUID();
    // recoveryPayload:null excludes this row from BOTH automatic recovery queries;
    // SIMULATION and a fresh ten-minute lease add independent safeguards. There
    // is no dispatcher payload, real address or provider API call to execute.
    await dc.executeGraphql(`mutation SeedSelfDeletionActiveLease($id: UUID!, $uid: String!, $key: String!, $type: String!) {
      notificationDelivery_insert(data: {id: $id, channel: EMAIL, notificationType: $type, deliveryKey: $key, userId: $uid, status: PENDING, recoveryPayload: null, deliveryMode: SIMULATION, lastAttemptedAt_expr: "request.time", createdBy: "validation", updatedBy: "validation"})
    }`, {variables: {id: notification, uid: interrupted.uid, key: `${prefix}-active-lease`, type: TYPE}});
    // Refresh real sign-in immediately before starting both long requests.
    await Promise.all([signIn(success), signIn(interrupted)]);
    mark("hosted self deletion and real interruption: waiting for at least 330-second drain");
    const started = Date.now();
    const [completed, partial] = await awaitSelfDeletionHostedOutcomes([erase(success), erase(interrupted)], started);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 540000, "Hosted requests exceeded the540-second budget");
    assert.equal(completed.result?.deleted, true, "Hosted self deletion was not confirmed");
    assert.equal(partial.error?.details?.code, "ACCOUNT_DELETION_INCOMPLETE", "Active lease did not interrupt genuine hosted deletion");
    assert.equal(partial.error?.details?.deletionStatus, undefined, "Interrupted erasure was mislabeled not-started");
    const serverDrainMs = await verifyAbsent(success);
    await verifyCommunications(shared);
    const hold = (await security.getUserSecurityState({userId: interrupted.uid})).data.userSecurityState;
    assert.ok(hold, "Interrupted SELF security state missing");
    const intent = (await security.getSecurityTransition({operationId: hold.operationId})).data.securityTransition;
    assert.ok(intent, "Interrupted SELF intent missing");
    assert.ok(!hold.accessReady && !hold.adminReady && hold.syncStatus === "READY" && hold.membershipStatus === "RESIGNED", "Interrupted SELF hold missing");
    assert.ok(intent.actorKind === "SELF" && intent.actorId === interrupted.uid && intent.reason === "ACCOUNT_DELETION" && intent.authDisabled && intent.syncStatus === "READY", "Interrupted intent is not the actual SELF deletion");
    assert.equal((await auth.getUser(interrupted.uid)).disabled, true, "Interrupted member remained enabled");
    console.log(`PASS: genuine hosted self deletion and interrupted SELF hold; server drain ${Math.round(serverDrainMs / 1000)} seconds, request elapsed ${Math.round(elapsed / 1000)} seconds; runtime task cancellation verified.`);

    mark("real expired-sign-in refusal after refreshing signed token");
    const originalAuthTime = recent.token.auth_time;
    await signIn(recent, true);
    assert.equal(recent.token.auth_time, originalAuthTime, "Refresh changed the original sign-in time");
    assert.ok(Date.now() / 1000 - recent.token.auth_time > 300, "Real sign-in has not aged beyond five minutes");
    requireNotStartedRefusal(await erase(recent), "FAILED_PRECONDITION", "RECENT_LOGIN_REQUIRED");
    await verifyNoErasure(recent);

    mark("settle only the owned synthetic pending lease");
    await dc.executeGraphql(settleSelfDeletionLeaseMutation, {variables: {id: notification, uid: interrupted.uid, type: TYPE}});
    mark("recover interrupted self deletion via hosted administrator callable");
    const recoveryStarted = Date.now();
    const [recovered] = await awaitSelfDeletionHostedOutcomes([
      call("deleteAccount", admin, {uid: interrupted.uid, email: interrupted.email, operationId: randomUUID(), apply: true, noRetention: true}),
    ], recoveryStarted);
    assert.equal(recovered.result?.deleted, true, "Hosted admin could not recover interrupted SELF deletion");
    mark("verify hosted administrator recovery and account absence");
    await verifyAbsent(interrupted);
    assert.equal((await security.getUserSecurityState({userId: admin.uid})).data.userSecurityState.adminReady, true);
    console.log("PASS: real hosted NOT_STARTED details, recent sign-in refusal and administrator recovery of the actual interrupted SELF hold.");
  } catch (error) {
    failed = true;
    console.error(`Validation failure category: ${selfDeletionValidationErrorCategory(error)}`);
    console.error(`FAIL: hosted self-deletion validation at stage: ${stage}. Synthetic run prefix: ${prefix}`);
  } finally {
    try {await cleanup(); console.log(fixtures.length ? "Synthetic fixture cleanup and baseline administrator count verified." : "No synthetic fixtures were created.");}
    catch (error) {failed = true; console.error(`Cleanup failure category: ${selfDeletionValidationErrorCategory(error)}`); console.error(`CLEANUP INCOMPLETE: inspect only synthetic run prefix ${prefix}`);}
    await Promise.all(getApps().map(app => deleteApp(app)));
  }
  if (failed) throw new Error("Hosted self-deletion validation failed; see bounded stage and cleanup outcome.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runSelfAccountDeletionValidation().catch(() => {console.error("Hosted Dev validation did not complete; check explicit targeting, stage and cleanup outcomes."); process.exitCode = 1;});
}
