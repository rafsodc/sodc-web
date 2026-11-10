#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import process from "node:process";

// This runner calls the locally built callable handler with verified Firebase
// tokens and real Dev services. Set ACCOUNT_DELETION_TRANSPORT=hosted to test
// the fixed Dev HTTPS endpoint; this script never deploys anything.
if (process.env.RUN_ACCOUNT_DELETION_VALIDATION !== "1" || process.env.ACCOUNT_DELETION_PROJECT !== "sodc-web" ||
    process.env.ACCOUNT_DELETION_CONFIRM !== "sodc-web" || process.argv.length !== 2) throw new Error("Explicit Dev-only validation opt-in required.");
for (const [key, value] of Object.entries(process.env)) {
  if (key.endsWith("_EMULATOR_HOST") && value) throw new Error("Emulator overrides forbidden.");
  if (["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"].includes(key) && value && value !== "sodc-web") throw new Error("Conflicting project.");
}
if (process.env.FIREBASE_CONFIG) throw new Error("Ambiguous Firebase configuration forbidden.");
const transport = process.env.ACCOUNT_DELETION_TRANSPORT ?? "local";
if (!["local", "hosted"].includes(transport)) throw new Error("Unknown validation transport.");
const apiKey = process.env.VITE_FIREBASE_API_KEY;
if (!apiKey) throw new Error("Development Firebase API key required.");
const require = createRequire(import.meta.url);
const {initializeApp, applicationDefault, getApps, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getDataConnect} = require("firebase-admin/data-connect");
initializeApp({projectId: "sodc-web", credential: applicationDefault()});
const auth = getAuth();
const dc = getDataConnect({connector: "api", serviceId: "sodc-web-service", location: "europe-west2"});
const security = require("../lib/securityRepository.js");
const transitions = require("../lib/currentAuthorizationTransitions.js");
const {deleteAccount} = require("../lib/accountDeletion.js");
const prefix = "deletion-validation-" + randomUUID();
const fixtures = [];
const notifications = [];
let stage = "preflight", failed = false;
function mark(value) {stage = value; console.log(`Validation stage: ${value}`);}

async function createFixture(role, admin) {
  const uid = `${prefix}-${role}`, email = `${uid}@example.invalid`, password = randomBytes(32).toString("base64url");
  const fixture = {uid, email, password, retireOperation: randomUUID()};
  fixtures.push(fixture);
  await auth.createUser({uid, email, password, emailVerified: true});
  await dc.executeGraphql(`mutation CreateDeletionFixture($uid: String!, $email: String!) {
    user_insert(data: {id: $uid, email: $email, firstName: "Deletion", lastName: "Fixture", serviceNumber: "VALIDATION", membershipStatus: REGULAR, createdBy: "validation", updatedBy: "validation"})
  }`, {variables: {uid, email}});
  await auth.setCustomUserClaims(uid, {enabled: true, admin});
  await transitions.initializeUserSecurityState({userId: uid, actorId: uid, actorKind: "OPERATOR", operationId: randomUUID(), reason: "Disposable Dev account deletion validation", allowAdminBootstrap: admin});
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email, password, returnSecureToken: true}),
  });
  const data = await response.json();
  assert.equal(response.ok, true, "Disposable fixture sign-in failed");
  fixture.token = await auth.verifyIdToken(data.idToken);
  fixture.idToken = data.idToken;
  assert.equal(fixture.token.uid, uid);
  assert.equal(fixture.token.aud, "sodc-web");
  return fixture;
}
async function call(actor, target, extra = {}) {
  const data = {uid: target.uid, email: target.email, operationId: randomUUID(), ...extra};
  if (transport === "local") return deleteAccount.run({auth: {uid: actor.uid, token: actor.token}, data, rawRequest: {headers: {}}});
  assert.equal(typeof actor.idToken, "string", "A real Firebase ID token is required");
  assert.equal(actor.idToken.split(".").length, 3, "Malformed Firebase ID token");
  const response = await fetch("https://europe-west2-sodc-web.cloudfunctions.net/deleteAccount", {
    method: "POST", headers: {"Content-Type": "application/json", Authorization: `Bearer ${actor.idToken}`},
    body: JSON.stringify({data}), signal: AbortSignal.timeout(540000),
  });
  const body = await response.json();
  if (body.error) {
    console.log(`Hosted response: ${body.error.status ?? "UNKNOWN"}`);
    throw Object.assign(new Error("Hosted callable refused request"), {code: body.error.status?.toLowerCase().replaceAll("_", "-") ?? "unknown"});
  }
  assert.equal(response.ok, true, "Hosted callable failed");
  assert.ok(body.result, "Hosted callable returned no result");
  return body.result;
}
async function cleanup() {
  for (const fixture of fixtures) {
    assert.ok(fixture.uid.startsWith(prefix + "-"));
    const state = (await security.getUserSecurityState({userId: fixture.uid})).data.userSecurityState;
    let identity;
    try {identity = await auth.getUser(fixture.uid);} catch (error) {if (error.code !== "auth/user-not-found") throw error;}
    if (state && identity) await transitions.transitionUserSecurity({userId: fixture.uid, actorId: "deletion-validation-cleanup", actorKind: "OPERATOR", operationId: fixture.retireOperation, admin: false, authDisabled: true, reason: "Disposable Dev fixture cleanup"});
    const retired = (await security.getUserSecurityState({userId: fixture.uid})).data.userSecurityState;
    assert.ok(!retired?.adminReady && !retired?.accessReady, "Fixture readiness must be retired before cleanup");
    await dc.executeGraphql(`mutation RemoveDeletionFixture($uid: String!, $expectedStates: Int!) @transaction {
      userSecurityState_deleteMany(where: {userId: {eq: $uid}, adminReady: {eq: false}, accessReady: {eq: false}}) @check(expr: "this == vars.expectedStates", message: "FIXTURE_CLEANUP_CONFLICT")
      notificationDelivery_deleteMany(where: {userId: {eq: $uid}, notificationType: {eq: "DELETION_VALIDATION"}})
      callableRateLimitBucket_deleteMany(where: {userId: {eq: $uid}})
      callableInvocation_deleteMany(where: {userId: {eq: $uid}})
      securityTransition_deleteMany(where: {userId: {eq: $uid}})
      user_deleteMany(where: {id: {eq: $uid}})
    }`, {variables: {uid: fixture.uid, expectedStates: retired ? 1 : 0}});
    if (identity) await auth.deleteUser(fixture.uid);
    await assert.rejects(auth.getUser(fixture.uid), {code: "auth/user-not-found"});
  }
}
try {
  const [control, roster, mode] = await Promise.all([security.getAdminSafetyControl(), security.listReadyAdministrators(), dc.executeGraphql("query ValidationEmailMode { govNotifyDeliveryConfiguration(key: {id: \"site-wide\"}) {mode} }")]);
  mark("preflight: non-live email mode");
  // This runner invokes no mailer or membership-notification callable. Its only
  // notification fixture is terminal SENT and can never be dispatched.
  assert.ok(["SIMULATION", "TEAM_TEST"].includes(mode.data.govNotifyDeliveryConfiguration?.mode));
  mark("preflight: admin safety control");
  assert.equal(control.data.adminSafetyControl?.status, "READY");
  assert.ok(roster.data.userSecurityStates.length > 0);
  assert.equal(control.data.adminSafetyControl.readyAdminCount, roster.data.userSecurityStates.length);
  mark("preflight: baseline administrator health");
  for (const row of roster.data.userSecurityStates) {
    const identity = await auth.getUser(row.userId);
    assert.ok(row.accessReady && row.syncStatus === "READY" && row.desiredAdmin && row.desiredEnabled && !row.verificationEmail && row.membershipStatus === row.user.membershipStatus && !identity.disabled && identity.emailVerified && identity.customClaims?.admin && identity.customClaims?.enabled && identity.customClaims?.securityVersion === row.securityVersion);
  }
  mark("create disposable fixtures");
  const actor = await createFixture("actor", true), target = await createFixture("target", false);
  mark("authorization checks");
  await assert.rejects(call(target, actor), {code: "permission-denied"});
  mark("self-deletion check");
  await assert.rejects(call(actor, actor), {code: "failed-precondition"});
  mark("stale email check");
  await assert.rejects(call(actor, target, {email: "different@example.invalid", apply: true, noRetention: true}), {code: "failed-precondition"});
  mark("retention confirmation check");
  await assert.rejects(call(actor, target, {apply: true, noRetention: false}), {code: "invalid-argument"});
  mark("read-only preview");
  assert.equal((await call(actor, target)).eligible, true);
  assert.equal((await auth.getUser(target.uid)).disabled, false);
  mark("linked record blocker");
  const notification = randomUUID(); notifications.push(notification);
  await dc.executeGraphql(`mutation LinkedDeletionFixture($id: UUID!, $uid: String!, $key: String!) {
    notificationDelivery_insert(data: {id: $id, channel: EMAIL, notificationType: "DELETION_VALIDATION", deliveryKey: $key, userId: $uid, status: SENT, createdBy: "validation", updatedBy: "validation"})
  }`, {variables: {id: notification, uid: target.uid, key: notification}});
  assert.equal((await call(actor, target)).eligible, false);
  await assert.rejects(call(actor, target, {apply: true, noRetention: true}), {code: "failed-precondition"});
  assert.equal((await auth.getUser(target.uid)).disabled, false);
  await dc.executeGraphql("mutation RemoveLinkedDeletionFixture($id: UUID!) {notificationDelivery_deleteMany(where: {id: {eq: $id}, notificationType: {eq: \"DELETION_VALIDATION\"}})}", {variables: {id: notification}});
  mark("delete and verify");
  assert.equal((await call(actor, target, {apply: true, noRetention: true})).deleted, true);
  await assert.rejects(auth.getUser(target.uid), {code: "auth/user-not-found"});
  assert.equal((await call(actor, target, {apply: true, noRetention: true})).deleted, true);
  assert.equal((await security.getUserSecurityState({userId: actor.uid})).data.userSecurityState.adminReady, true);
  console.log(`PASS: Dev backend (${transport}) with real Firebase tokens: authorization, preview, linked-record blocker, deletion, absence verification and repeated request.`);
} catch (error) {
  failed = true;
  console.error(`Validation error category: ${error.code ?? error.name ?? "unknown"}`);
  console.error(`FAIL: Dev deletion validation at stage: ${stage}. Run prefix: ${prefix}`);
} finally {
  try {await cleanup(); console.log("Disposable fixture cleanup verified.");}
  catch {failed = true; console.error(`CLEANUP INCOMPLETE. Inspect only fixture prefix: ${prefix}`);}
  await Promise.all(getApps().map(app => deleteApp(app)));
  if (failed) process.exitCode = 1;
}
