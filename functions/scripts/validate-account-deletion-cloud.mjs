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
if (!["local", "hosted", "browser"].includes(transport)) throw new Error("Unknown validation transport.");
const apiKey = process.env.VITE_FIREBASE_API_KEY;
if (!apiKey) throw new Error("Development Firebase API key required.");
const require = createRequire(import.meta.url);
const {initializeApp, applicationDefault, getApps, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getDataConnect} = require("firebase-admin/data-connect");
// Dev worker identity, read from its deployed service configuration. Needed when
// the operator uses user ADC rather than service-account credentials.
initializeApp({projectId: "sodc-web", credential: applicationDefault(), serviceAccountId: "931675247602-compute@developer.gserviceaccount.com"});
const auth = getAuth();
const dc = getDataConnect({connector: "api", serviceId: "sodc-web-service", location: "europe-west2"});
const security = require("../lib/securityRepository.js");
const transitions = require("../lib/currentAuthorizationTransitions.js");
const {deleteAccount} = require("../lib/accountDeletion.js");
const prefix = "deletion-validation-" + randomUUID();
const fixtures = [];
const communications = [];
const {getFunctions} = require("firebase-admin/functions");
const {announcementErasureTaskIds} = require("../lib/accountCommunicationErasure.js");
const {erasureEmailHash} = require("../lib/communicationErasureGuard.js");
const queue = getFunctions().taskQueue("locations/europe-west2/functions/processAnnouncementEmail");
let stage = "preflight", failed = false;
function mark(value) {stage = value; console.log(`Validation stage: ${value}`);}

async function createFixture(role, admin) {
  const uid = `${prefix}-${role}`, email = `${uid}@example.invalid`, password = randomBytes(32).toString("base64url");
  const fixture = {uid, email, password, retireOperation: randomUUID()};
  fixtures.push(fixture);
  await auth.createUser({uid, email, password, emailVerified: true});
  await dc.executeGraphql(`mutation CreateDeletionFixture($uid: String!, $email: String!) {
    user_insert(data: {id: $uid, email: $email, firstName: "Deletion", lastName: "Fixture", serviceNumber: "VALIDATION", membershipStatus: REGULAR, profileReviewedAt_expr: "request.time", mobileNumber: "+447700900123", createdBy: "validation", updatedBy: "validation"})
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
async function seedCommunications(actor, target) {
  const section = randomUUID(), send = randomUUID(), own = randomUUID(), survivorId = randomUUID(), notification = randomUUID(), receipt = randomUUID();
  const formerEmail = `${target.uid}-former@example.invalid`;
  const task = {sendId: send, recipientId: target.uid, email: formerEmail, firstName: "Deletion", lastName: "Fixture", personalisation: {name: "Remove"}, templateUuid: randomUUID(), effectiveDeliveryMode: "SIMULATION"};
  const survivor = {...task, recipientId: actor.uid, email: actor.email, personalisation: {name: "Keep", token: "preserve-exactly"}};
  const fixture = {section, send, own, survivorId, notification, receipt, target, task, survivor, taskId: announcementErasureTaskIds(send, target.uid, "SIMULATION")[0]};
  communications.push(fixture);
  await dc.executeGraphql(`mutation SeedDeletionCommunications($section: UUID!, $send: UUID!, $own: UUID!, $survivor: UUID!, $notification: UUID!, $receipt: String!, $uid: String!, $actor: String!, $email: String!, $actorEmail: String!, $hash: String!, $snapshot: String!) {
    section_insert(data: {id: $section, name: "Disposable deletion validation", type: MEMBERS, createdBy: "validation", updatedBy: "validation"})
    announcementSend_insert(data: {id: $send, sectionId: $section, templateUuid: "validation", sentBy: $actor, recipientCount: 2, skippedCount: 0, effectiveDeliveryMode: SIMULATION, siteDeliveryMode: SIMULATION, requestedDeliveryMode: SIMULATION, recipientSnapshot: $snapshot})
    own: announcementRecipient_insert(data: {id: $own, announcementSendId: $send, userId: $uid, email: $email, firstName: "Deletion", lastName: "Fixture", status: "queued", effectiveDeliveryMode: SIMULATION})
    survivor: announcementRecipient_insert(data: {id: $survivor, announcementSendId: $send, userId: $actor, email: $actorEmail, firstName: "Deletion", lastName: "Fixture", status: "sent", effectiveDeliveryMode: SIMULATION})
    notificationDelivery_insert(data: {id: $notification, channel: EMAIL, notificationType: "DELETION_VALIDATION", deliveryKey: $receipt, userId: $uid, status: SENT, createdBy: "validation", updatedBy: "validation"})
    notifyDeliveryReceipt_insert(data: {id: $receipt, notifyStatus: "delivered", recipientHash: $hash, eventAt_expr: "request.time", eventOrderingKey: $receipt, affectsBounceState: false, processingStatus: PROCESSED, lastAttemptedAt_expr: "request.time", createdBy: "validation", updatedBy: "validation"})
  }`, {variables: {section, send, own, survivor: survivorId, notification, receipt, uid: target.uid, actor: actor.uid, email: formerEmail, actorEmail: actor.email, hash: erasureEmailHash(formerEmail), snapshot: JSON.stringify({version: 1, tasks: [task, survivor], skippedRecipients: [], audienceSummary: "preserve summary"})}});
  // Only the selected synthetic member gets a task, scheduled far in the future.
  await queue.enqueue(task, {id: fixture.taskId, scheduleDelaySeconds: 3600, dispatchDeadlineSeconds: 60});
}
async function verifyCommunications() {
  for (const item of communications) {
    const result = await dc.executeGraphql(`query VerifyErasedCommunications($send: UUID!, $uid: String!, $receipt: String!, $notification: UUID!) {
      announcementSend(id: $send) {recipientSnapshot recipientCount skippedCount}
      announcementRecipients(where: {announcementSendId: {eq: $send}}) {id userId email status}
      notificationDelivery(id: $notification) {id}
      notifyDeliveryReceipt(id: $receipt) {id}
      accountErasures(where: {userId: {eq: $uid}}) {emailHash completedAt}
    }`, {variables: {send: item.send, uid: item.target.uid, receipt: item.receipt, notification: item.notification}});
    assert.deepEqual(JSON.parse(result.data.announcementSend.recipientSnapshot), {version: 1, tasks: [item.survivor], skippedRecipients: [], audienceSummary: "preserve summary"});
    assert.equal(result.data.announcementSend.recipientCount, 1);
    assert.equal(result.data.announcementRecipients.length, 1);
    assert.equal(result.data.announcementRecipients[0].id.replaceAll("-", ""), item.survivorId.replaceAll("-", ""));
    assert.deepEqual({...result.data.announcementRecipients[0], id: undefined}, {id: undefined, userId: item.survivor.recipientId, email: item.survivor.email, status: "sent"});
    assert.equal(result.data.notificationDelivery, null);
    assert.equal(result.data.notifyDeliveryReceipt, null);
    assert.ok(result.data.accountErasures.length >= 2 && result.data.accountErasures.every(row => row.completedAt));
    // Admin TaskQueue.delete intentionally resolves for absent tasks. A read
    // proves cancellation without accidentally performing it during verification.
    const access = await applicationDefault().getAccessToken();
    const taskResponse = await fetch(`https://cloudtasks.googleapis.com/v2/projects/sodc-web/locations/europe-west2/queues/processAnnouncementEmail/tasks/${item.taskId}`, {
      headers: {Authorization: `Bearer ${access.access_token}`, "x-goog-user-project": "sodc-web"}, signal: AbortSignal.timeout(30000),
    });
    assert.equal(taskResponse.status, 404, "Selected task must already be absent");
    await taskResponse.body?.cancel();
    const {processAnnouncementEmailTask} = require("../lib/announcementDelivery.js");
    await processAnnouncementEmailTask(item.task, {retryCount: 0}, {repository: {get: () => {throw new Error("Erased task must not reach storage");}}, client: {sendEmail: () => {throw new Error("Erased task must not send");}}});
    const sdk = require("@dataconnect/admin-generated");
    await assert.rejects(sdk.createAnnouncementRecipient({id: randomUUID(), announcementSendId: item.send, userId: item.target.uid, email: item.task.email, firstName: "Deletion", lastName: "Fixture", status: "queued"}), /ACCOUNT_ERASURE_IN_PROGRESS/);
  }
  console.log("PASS: shared-recipient preservation, historical-address removal, task cancellation and late-task/write suppression.");
}
async function cleanup() {
  for (const item of communications) {
    try {await queue.delete(item.taskId);} catch (error) {if (!["functions/task-not-found", "functions/not-found"].includes(error.code)) throw error;}
    await dc.executeGraphql(`mutation RemoveCommunicationFixture($send: UUID!, $section: UUID!, $receipt: String!) {
      announcementRecipient_deleteMany(where: {announcementSendId: {eq: $send}})
      announcementSend_delete(key: {id: $send})
      section_delete(key: {id: $section})
      notifyDeliveryReceipt_delete(key: {id: $receipt})
    }`, {variables: {send: item.send, section: item.section, receipt: item.receipt}});
  }
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
      accountErasure_deleteMany(where: {userId: {eq: $uid}})
      accountErasureDisposal_deleteMany(where: {userId: {eq: $uid}})
      user_deleteMany(where: {id: {eq: $uid}})
    }`, {variables: {uid: fixture.uid, expectedStates: retired ? 1 : 0}});
    if (identity) await auth.deleteUser(fixture.uid);
    await assert.rejects(auth.getUser(fixture.uid), {code: "auth/user-not-found"});
    const removed = await dc.executeGraphql(`query VerifyRemovedDeletionDisposal($uid: String!) {
      accountErasureDisposals(where: {userId: {eq: $uid}}) {userId}
    }`, {variables: {uid: fixture.uid}});
    assert.equal(removed.data.accountErasureDisposals.length, 0, "Owned disposal metadata remained after cleanup");
  }
}
try {
  const [control, roster, mode] = await Promise.all([security.getAdminSafetyControl(), security.listReadyAdministrators(), dc.executeGraphql("query ValidationEmailMode { govNotifyDeliveryConfiguration(key: {id: \"site-wide\"}) {mode} }")]);
  mark("preflight: non-live email mode");
  // No mailer is invoked. The queued synthetic task uses SIMULATION and is
  // scheduled one hour ahead; cleanup always cancels it.
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
  mark("seed shared communications and cancellable task");
  await seedCommunications(actor, target);
  if (transport === "browser") {
    mark("browser sign-in and deletion");
    const {chromium} = require("@playwright/test");
    mark("browser launch");
    const browser = await chromium.launch({headless: true});
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(60000);
      mark("browser sign-in page");
      await page.goto("https://sodc-web.web.app/admin/users");
      await page.getByRole("button", {name: "Decline preference cookies", exact: true}).click();
      await page.getByLabel("Email", {exact: true}).fill(actor.email);
      await page.getByLabel("Password", {exact: true}).fill(actor.password);
      await page.getByRole("main").getByRole("button", {name: "Sign in", exact: true}).click();
      mark("browser admin page");
      await page.getByRole("heading", {name: "Manage Users", exact: true}).waitFor();
      await page.getByLabel("Search by Email or Display Name").fill(target.email);
      const row = page.getByRole("row").filter({hasText: target.email});
      await row.getByRole("button", {name: "Delete account", exact: true}).click();
      const dialog = page.getByRole("dialog");
      assert.equal(await dialog.getByRole("button", {name: "Permanently delete account"}).count(), 0);
      await dialog.getByRole("button", {name: "Check account", exact: true}).click();
      const confirm = dialog.getByRole("button", {name: "Permanently delete account"});
      await confirm.waitFor({timeout: 120000});
      assert.equal(await confirm.isDisabled(), true);
      await dialog.getByLabel("Type the account email to confirm").fill(target.email);
      assert.equal(await confirm.isDisabled(), true);
      await dialog.getByRole("checkbox").check();
      assert.equal(await confirm.isEnabled(), true);
      await confirm.click();
      await dialog.waitFor({state: "hidden", timeout: 540000});
      await page.getByText("Account deleted. Complete the separate external-record and backup erasure checks.").waitFor();
      await assert.rejects(auth.getUser(target.uid), {code: "auth/user-not-found"});
      assert.equal((await security.getUserSecurityState({userId: target.uid})).data.userSecurityState, null);
      console.log("PASS: Dev browser sign-in, search, preview, confirmation guards, deletion, success feedback and actual account absence.");
    } catch (error) {
      let message = String(error.message);
      for (const fixture of fixtures) for (const value of [fixture.password, fixture.idToken]) if (value) message = message.replaceAll(value, "[redacted]");
      console.error(message.slice(0, 1600));
      throw error;
    } finally {await browser.close();}
  } else {
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
  await dc.executeGraphql("mutation AddFinancialBlocker($uid: String!) {user_update(key: {id: $uid}, data: {stripeCustomerId: \"disposable-validation-no-provider-customer\"})}", {variables: {uid: target.uid}});
  assert.equal((await call(actor, target)).eligible, false);
  await assert.rejects(call(actor, target, {apply: true, noRetention: true}), {code: "failed-precondition"});
  assert.equal((await auth.getUser(target.uid)).disabled, false);
  await dc.executeGraphql("mutation RemoveFinancialBlocker($uid: String!) {user_update(key: {id: $uid}, data: {stripeCustomerId: null})}", {variables: {uid: target.uid}});
  mark("delete and verify");
  assert.equal((await call(actor, target, {apply: true, noRetention: true})).deleted, true);
  await assert.rejects(auth.getUser(target.uid), {code: "auth/user-not-found"});
  assert.equal((await call(actor, target, {apply: true, noRetention: true})).deleted, true);
  assert.equal((await security.getUserSecurityState({userId: actor.uid})).data.userSecurityState.adminReady, true);
  console.log(`PASS: Dev backend (${transport}) with real Firebase tokens: authorization, preview, linked-record blocker, deletion, absence verification and repeated request.`);
  }
  mark("verify communication erasure and suppression");
  await verifyCommunications();
} catch (error) {
  failed = true;
  console.error(`Validation error category: ${error.code ?? error.name ?? "unknown"}`);
  console.error(String(error.message).slice(0, 600));
  console.error(`FAIL: Dev deletion validation at stage: ${stage}. Run prefix: ${prefix}`);
} finally {
  try {await cleanup(); console.log("Disposable fixture cleanup verified.");}
  catch (error) {failed = true; console.error(String(error.message).slice(0, 600)); console.error(`CLEANUP INCOMPLETE. Inspect only fixture prefix: ${prefix}`);}
  await Promise.all(getApps().map(app => deleteApp(app)));
  if (failed) process.exitCode = 1;
}
