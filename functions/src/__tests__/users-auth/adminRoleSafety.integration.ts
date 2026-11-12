import { fork, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DataConnect } from "firebase-admin/data-connect";
import type { App } from "firebase-admin/app";
import type * as SecuritySdk from "@dataconnect/security-admin-generated";
import { deleteInactiveAccountMutation, redactAccountSnapshotMutation, deleteMyInactiveAccountMutation, redactMyAccountSnapshotMutation } from "../../accountDeletionDatabase";
import { pruneAnnouncementSnapshot, withSnapshotErasure, communicationInventoryFilter } from "../../accountCommunicationErasure";
import { accountDeletionInventory } from "../../accountDeletionInventory";

// No ordinary test setup or Auth impersonation supplies the mutation evidence.
// These tests exercise actual SQL transactions in the runner's fresh local DB.
type Outcome = { kind: "result"; ok: boolean; pid: number; message?: string };
type Mutation = { operation: "beginSecurityTransition" | "completeSecurityTransition" | "recordSecurityNoop" | "initializeUserSecurityState" | "initializePendingEmailHold"; variables: Record<string, unknown> };
let sdk: typeof SecuritySdk;
let dc: DataConnect;
let security: DataConnect;
let apps: App[] = [];
let prefix: string;
let caseSequence = 0;
let freshDatabaseVerified = false;
let caseIds: string[] = [];
let caseOperations: string[] = [];
let caseSendIds: string[] = [];
let caseSectionIds: string[] = [];
const workers = new Set<ChildProcess>();
const functionsRoot = path.resolve(__dirname, "../../..");
const require = createRequire(path.join(functionsRoot, "package.json"));

function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), 30_000);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function race(mutations: Mutation[]): Promise<Outcome[]> {
  const channels = mutations.map(() => {
    const child = fork(path.join(functionsRoot, "scripts/admin-safety-integration-worker.mjs"), [], {
      cwd: functionsRoot, env: { ...process.env }, stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    workers.add(child);
    let stderr = "";
    child.stderr?.on("data", chunk => { stderr += String(chunk).slice(0, 1000); });
    let ready = false;
    let received = false;
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    let resolveResult!: (value: Outcome) => void;
    let rejectResult!: (error: Error) => void;
    const readyPromise = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const result = new Promise<Outcome>((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
    // Attach rejection handlers before an early child failure; the awaited
    // barriers below still receive the original rejection.
    void readyPromise.catch(() => undefined);
    void result.catch(() => undefined);
    child.on("message", message => {
      const value = message as { kind?: string };
      if (value.kind === "ready") { ready = true; resolveReady(); }
      if (value.kind === "result") { received = true; resolveResult(message as Outcome); }
    });
    const exited = new Promise<void>((resolve, reject) => {
      child.once("error", error => { rejectReady(error); rejectResult(error); reject(error); });
      child.once("exit", code => {
        workers.delete(child);
        const error = new Error(`Independent SQL worker exited (${code}): ${stderr}`);
        if (!ready) rejectReady(error);
        if (!received) rejectResult(error);
        if (code !== 0) reject(error); else resolve();
      });
    });
    void exited.catch(() => undefined);
    return { child, readyPromise, result, exited };
  });
  try {
    await bounded(Promise.all(channels.map(channel => channel.readyPromise)), "Independent process barrier");
    channels.forEach((channel, index) => channel.child.send(mutations[index]));
    const outcomes = await bounded(Promise.all(channels.map(channel => channel.result)), "Concurrent SQL mutations");
    await bounded(Promise.all(channels.map(channel => channel.exited)), "Independent process shutdown");
    expect(new Set(outcomes.map(outcome => outcome.pid)).size).toBe(mutations.length);
    return outcomes;
  } finally {
    for (const channel of channels) if (workers.has(channel.child)) channel.child.kill("SIGTERM");
  }
}

const state = async (userId: string) => (await sdk.getUserSecurityState(security, { userId })).data.userSecurityState!;
const control = async () => (await sdk.getAdminSafetyControl(security)).data.adminSafetyControl!;
const operation = async (operationId: string) => (await sdk.getSecurityTransition(security, { operationId })).data.securityTransition;
function operationId() { const id = randomUUID(); caseOperations.push(id); return id; }
async function assertCount(expected: number) {
  const [current, roster] = await Promise.all([control(), sdk.listReadyAdministrators(security)]);
  expect(current.readyAdminCount).toBe(expected);
  expect(roster.data.userSecurityStates).toHaveLength(expected);
  expect(roster.data.userSecurityStates.every(row => row.userId.startsWith(prefix) && row.accessReady && row.syncStatus === "READY")).toBe(true);
  expect(current.readyAdminCount).toBeGreaterThanOrEqual(0);
}

async function seedUser(suffix: string, admin = true) {
  const userId = `${prefix}-${caseSequence}-${suffix}`;
  const id = operationId();
  caseIds.push(userId);
  await dc.executeGraphql(`mutation SeedLocalProfile($userId: String!, $email: String!) {
    user_insert(data: {id: $userId, firstName: "Local", lastName: "SQL fixture", email: $email, serviceNumber: "LOCAL-SQL", membershipStatus: REGULAR,
      createdBy: "local-fixture", updatedBy: "local-fixture"})
  }`, { variables: { userId, email: `${userId}@example.test` } });
  await dc.executeGraphql(`mutation SeedLocalAdmin($userId: String!, $operationId: String!, $admin: Boolean!) @transaction {
    userSecurityState_insert(data: {userId: $userId, securityVersion: 1, membershipStatus: REGULAR, desiredEnabled: true, desiredAdmin: $admin,
      accessReady: true, adminReady: $admin, operationId: $operationId, syncStatus: READY})
    securityTransition_insert(data: {operationId: $operationId, userId: $userId, securityVersion: 1, membershipStatus: REGULAR,
      desiredEnabled: true, desiredAdmin: $admin, intentHash: "local-fixture-only", actorId: "local-fixture", actorKind: OPERATOR, reason: "LOCAL_SQL_FIXTURE", syncStatus: READY})
  }`, { variables: { userId, operationId: id, admin } });
  return userId;
}

async function initialize(admins: number, members = 0) {
  const ids = [];
  for (let index = 0; index < admins + members; index++) ids.push(await seedUser(String(index), index < admins));
  await sdk.createAdminSafetyControl(security, { operationId: operationId(), actorId: "local-fixture", reason: "LOCAL_SQL_FIXTURE", readyAdminCount: admins, intentHash: "local-control-create" });
  await sdk.activateAdminSafetyControl(security, { expectedControlVersion: (await control()).version, operationId: operationId(), actorId: "local-fixture", reason: "LOCAL_SQL_FIXTURE", intentHash: "local-control-activate" });
  return ids;
}

async function begin(target: string, actor: string, overrides: Record<string, unknown> = {}): Promise<Mutation> {
  const [current, targetState, actorState] = await Promise.all([control(), state(target), state(actor)]);
  const variables = { expectedControlVersion: current.version, actorKind: "ADMIN", actorSecurityVersion: actorState.securityVersion,
    userId: target, expectedVersion: targetState.securityVersion, nextVersion: targetState.securityVersion + 1,
    expectedMembershipStatus: "REGULAR", membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: false,
    verificationEmail: null, authDisabled: null, operationId: operationId(), actorId: actor, reason: "LOCAL_SQL_RACE", ...overrides };
  return { operation: "beginSecurityTransition", variables: { ...variables, intentHash: createHash("sha256").update(JSON.stringify(variables)).digest("hex") } };
}
async function complete(userId: string): Promise<Mutation> {
  const [current, target] = await Promise.all([control(), state(userId)]);
  return { operation: "completeSecurityTransition", variables: { expectedControlVersion: current.version, userId,
    securityVersion: target.securityVersion, operationId: target.operationId, membershipStatus: target.membershipStatus,
    accessReady: target.desiredEnabled, adminReady: target.desiredEnabled && target.desiredAdmin } };
}

async function pendingApplicant() {
  const userId = `${prefix}-${caseSequence}-applicant`;
  caseIds.push(userId);
  await dc.executeGraphql(`mutation SeedPendingApplicant($userId: String!, $email: String!) {
    user_insert(data: {id: $userId, firstName: "Pending", lastName: "Local fixture", email: $email,
      serviceNumber: "LOCAL-PENDING", membershipStatus: PENDING, createdBy: "local-fixture", updatedBy: "local-fixture"})
  }`, {variables: {userId, email: `${userId}@example.test`}});
  return userId;
}

async function pendingEmailHold(userId: string, actorId: string): Promise<Mutation> {
  return {operation: "initializePendingEmailHold", variables: {
    expectedControlVersion: (await control()).version, actorSecurityVersion: (await state(actorId)).securityVersion,
    userId, expectedProfileEmail: `${userId}@example.test`, verificationEmail: `corrected-${userId}@example.test`,
    operationId: operationId(), actorId, reason: "LOCAL_PENDING_EMAIL", intentHash: "local-pending-email-intent",
  }};
}

async function approvalInitialization(userId: string, actorId: string): Promise<Mutation> {
  return {operation: "initializeUserSecurityState", variables: {
    expectedControlVersion: (await control()).version, actorKind: "ADMIN", actorSecurityVersion: (await state(actorId)).securityVersion,
    userId, membershipStatus: "PENDING", desiredEnabled: false, desiredAdmin: false, verificationEmail: null,
    operationId: operationId(), actorId, reason: "LOCAL_INITIAL_APPROVAL", intentHash: "local-approval-init-intent",
  }};
}

beforeAll(async () => {
  const { assertAdminSafetyFixture } = await import(pathToFileURL(path.join(functionsRoot, "scripts/admin-safety-integration-fixture.mjs")).href);
  const context = await assertAdminSafetyFixture();
  prefix = `admin-safety-it-${context.runId}`;
  const { initializeApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  const { getDataConnect } = require("firebase-admin/data-connect") as typeof import("firebase-admin/data-connect");
  sdk = require("@dataconnect/security-admin-generated");
  apps = [initializeApp({ projectId: context.projectId }, "admin-safety-test-api"), initializeApp({ projectId: context.projectId }, "admin-safety-test-authority")];
  dc = getDataConnect({ connector: "api", serviceId: "sodc-web-service", location: "europe-west2" }, apps[0]);
  security = getDataConnect(sdk.connectorConfig, apps[1]);
  const initial = await dc.executeGraphql("query FreshLocalDatabase { users(limit: 1) {id} userSecurityStates(limit: 1) {userId} adminSafetyControls(limit: 1) {id} }");
  expect(initial.data).toEqual({ users: [], userSecurityStates: [], adminSafetyControls: [] });
  freshDatabaseVerified = true;
});
beforeEach(() => { caseSequence++; caseIds = []; caseOperations = []; caseSendIds = []; caseSectionIds = []; });
afterEach(async () => {
  await Promise.all([...workers].map(child => new Promise<void>(resolve => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  })));
  // This is the fresh runner-owned database, never a shared Dev/Beta roster.
  // Delete only tracked fixture rows between cases; final disposal occurs after
  // the emulator stops. No saved live counter value is ever restored.
  if (!dc || !freshDatabaseVerified) return;
  const occupants = await dc.executeGraphql<{ users: { id: string }[] }, Record<string, never>>("query OnlyLocalFixtures { users(limit: 1001) {id} }");
  expect(occupants.data.users.every(user => user.id.startsWith(prefix))).toBe(true);
  await dc.executeGraphql(`mutation RemoveLocalFixture($users: [String!]!, $operations: [String!]!, $sends: [UUID!]!, $sections: [UUID!]!) @transaction {
    announcementRecipient_deleteMany(where: {announcementSendId: {in: $sends}})
    announcementSend_deleteMany(where: {id: {in: $sends}})
    section_deleteMany(where: {id: {in: $sections}})
    notificationDelivery_deleteMany(where: {_or: [{recipientUserId: {in: $users}}, {userId: {in: $users}}]})
    notifyDeliveryReceipt_deleteMany(where: {userId: {in: $users}})
    accountErasure_deleteMany(where: {userId: {in: $users}})
    userSecurityState_deleteMany(where: {userId: {in: $users}})
    securityTransition_deleteMany(where: {operationId: {in: $operations}})
    adminSafetyAudit_deleteMany(where: {operationId: {in: $operations}})
    adminSafetyControl_deleteMany(where: {id: {eq: "site-wide"}})
    user_deleteMany(where: {id: {in: $users}})
  }`, { variables: { users: caseIds, operations: caseOperations, sends: caseSendIds, sections: caseSectionIds } });
});
afterAll(async () => {
  if (!apps.length) return;
  const { deleteApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  await Promise.all(apps.map(app => deleteApp(app)));
});

describe("actual independent-process administrator safety transactions", () => {
  it("permits only one of two simultaneous removals and rejects the revoked actor's retry", async () => {
    const [a, b] = await initialize(2);
    const changes = await Promise.all([begin(b, a), begin(a, b)]);
    const outcomes = await race(changes);
    expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1);
    const winner = outcomes.findIndex(outcome => outcome.ok);
    const loser = 1 - winner;
    await assertCount(1);
    expect(await operation(String(changes[loser].variables.operationId))).toBeNull();
    const retried = { ...changes[loser], variables: { ...changes[loser].variables, expectedControlVersion: (await control()).version } };
    expect((await race([retried]))[0].ok).toBe(false);
    await assertCount(1);
  });

  it("allows two removals from three admins after a fresh bounded control-conflict retry", async () => {
    const [a, b, actor] = await initialize(3);
    const changes = await Promise.all([begin(a, actor), begin(b, actor)]);
    const outcomes = await race(changes);
    expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1);
    const loser = outcomes.findIndex(outcome => !outcome.ok);
    const retried = { ...changes[loser], variables: { ...changes[loser].variables, expectedControlVersion: (await control()).version } };
    expect((await race([retried]))[0].ok).toBe(true);
    await assertCount(1);
    expect((await state(actor)).adminReady).toBe(true);
  });

  it.each([true, false])("removes a same target once when duplicate operation IDs are %s", async sameId => {
    const [actor, target] = await initialize(2);
    const first = await begin(target, actor);
    const second = await begin(target, actor);
    if (sameId) second.variables = { ...first.variables };
    const outcomes = await race([first, second]);
    expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1);
    await assertCount(1);
    expect((await state(target)).securityVersion).toBe(2);
    const ids = [...new Set([first.variables.operationId, second.variables.operationId].map(String))];
    const records = await Promise.all(ids.map(operation));
    expect(records.filter(Boolean)).toHaveLength(1);
    const retry = { ...first, variables: { ...first.variables, expectedControlVersion: (await control()).version } };
    expect((await race([retry]))[0].ok).toBe(false);
    await assertCount(1);
  });

  it("rolls back control, target version and audit when the profile CAS fails", async () => {
    const [actor, target] = await initialize(2);
    const before = await control();
    const change = await begin(target, actor, { expectedMembershipStatus: "LOST" });
    expect((await race([change]))[0].ok).toBe(false);
    expect(await control()).toEqual(before);
    expect((await state(target)).securityVersion).toBe(1);
    expect(await operation(String(change.variables.operationId))).toBeNull();
    await assertCount(2);
  });

  it("does not count a pending grant, then admits removal only after its verified completion", async () => {
    const [actor, pending] = await initialize(1, 1);
    expect((await race([await begin(pending, actor, { desiredAdmin: true })]))[0].ok).toBe(true);
    await assertCount(1);
    const grant = await complete(pending);
    const removal = await begin(actor, actor);
    const outcomes = await race([grant, removal]);
    expect(outcomes[0].ok).toBe(true);
    expect(outcomes[1].ok).toBe(false);
    await assertCount(2);
    const retry = { ...removal, variables: { ...removal.variables, expectedControlVersion: (await control()).version } };
    expect((await race([retry]))[0].ok).toBe(true);
    await assertCount(1);
    expect((await state(pending)).adminReady).toBe(true);
  });

  it("cannot increment for an old grant completion after a newer target intent", async () => {
    const [actor, target] = await initialize(1, 1);
    expect((await race([await begin(target, actor, { desiredAdmin: true })]))[0].ok).toBe(true);
    const oldCompletion = await complete(target);
    expect((await race([await begin(target, actor)]))[0].ok).toBe(true);
    const before = await control();
    oldCompletion.variables.expectedControlVersion = before.version;
    expect((await race([oldCompletion]))[0].ok).toBe(false);
    expect(await control()).toEqual(before);
    expect((await race([await complete(target)]))[0].ok).toBe(true);
    await assertCount(1);
    expect((await state(target)).adminReady).toBe(false);
  });

  it("increments once when independent workers complete the same pending grant", async () => {
    const [actor, target] = await initialize(1, 1);
    expect((await race([await begin(target, actor, { desiredAdmin: true })]))[0].ok).toBe(true);
    const completion = await complete(target);
    const outcomes = await race([completion, { ...completion, variables: { ...completion.variables } }]);
    expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1);
    await assertCount(2);
    completion.variables.expectedControlVersion = (await control()).version;
    expect((await race([completion]))[0].ok).toBe(false);
    await assertCount(2);
  });

  it("records one healthy no-op without removing the sole admin or changing its active intent", async () => {
    const [actor] = await initialize(1);
    const before = await state(actor);
    const request: Mutation = { operation: "recordSecurityNoop", variables: {
      expectedControlVersion: (await control()).version, actorKind: "ADMIN", actorSecurityVersion: before.securityVersion,
      userId: actor, expectedVersion: before.securityVersion, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: true,
      verificationEmail: null, operationId: operationId(), actorId: actor, reason: "LOCAL_NOOP", intentHash: "local-noop-original-intent",
    } };
    const outcomes = await race([request, { ...request, variables: { ...request.variables } }]);
    expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1);
    await assertCount(1);
    expect(await state(actor)).toEqual(before);
    const recorded = await operation(String(request.variables.operationId));
    expect(recorded).toMatchObject({ noOp: true, syncStatus: "READY", intentHash: "local-noop-original-intent" });
    const checkpoint = await control();
    const conflicting = { ...request, variables: { ...request.variables, expectedControlVersion: checkpoint.version, intentHash: "conflicting-reuse" } };
    expect((await race([conflicting]))[0].ok).toBe(false);
    expect(await control()).toEqual(checkpoint);
    expect((await operation(String(request.variables.operationId)))!.intentHash).toBe("local-noop-original-intent");
  });

  it.each([
    { desiredAdmin: false },
    { desiredAdmin: true, membershipStatus: "RETIRED" },
    { desiredAdmin: true, desiredEnabled: false, verificationEmail: "new@example.test" },
    { desiredAdmin: true, desiredEnabled: false, authDisabled: true },
  ])("refuses every supported sole-admin readiness reduction %j", async flags => {
    const [actor] = await initialize(1);
    const before = await control();
    const request = await begin(actor, actor, flags);
    const result = (await race([request]))[0];
    expect(result.ok).toBe(false);
    expect(result.message).toContain("LAST_ADMIN_REQUIRED");
    expect(await control()).toEqual(before);
    expect(await operation(String(request.variables.operationId))).toBeNull();
    await assertCount(1);
  });

  it("checks the actor again inside the transaction even when two other admins remain", async () => {
    const [a, b, actor] = await initialize(3);
    const admittedEarlier = await begin(a, actor);
    expect((await race([await begin(actor, actor)]))[0].ok).toBe(true);
    await assertCount(2);
    admittedEarlier.variables.expectedControlVersion = (await control()).version;
    const result = (await race([admittedEarlier]))[0];
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SECURITY_ACTOR_REVOKED");
    expect((await state(a)).adminReady).toBe(true);
    expect((await state(b)).adminReady).toBe(true);
    await assertCount(2);
  });

  it("records observed external loss honestly at zero and permits only audited operator recovery", async () => {
    const [lost, recovery] = await initialize(1, 1);
    const drift = await begin(lost, lost, { actorKind: "DRIFT", actorSecurityVersion: null,
      actorId: "local-drift-observer", desiredAdmin: true, desiredEnabled: false });
    expect((await race([drift]))[0].ok).toBe(true);
    expect((await control()).status).toBe("RECOVERY_REQUIRED");
    await assertCount(0);
    expect((await race([await complete(lost)]))[0].ok).toBe(true);
    const ordinary = await begin(recovery, lost, { desiredAdmin: true });
    expect((await race([ordinary]))[0].ok).toBe(false);
    await assertCount(0);
    const operator = await begin(recovery, lost, { actorKind: "OPERATOR", actorId: "local-recovery-operator",
      actorSecurityVersion: null, desiredAdmin: true });
    expect((await race([operator]))[0].ok).toBe(true);
    expect((await race([await complete(recovery)]))[0].ok).toBe(true);
    expect((await control()).status).toBe("RECOVERY_REQUIRED");
    await sdk.activateAdminSafetyControl(security, { expectedControlVersion: (await control()).version, operationId: operationId(),
      actorId: "local-recovery-operator", reason: "LOCAL_RECOVERY", intentHash: "local-explicit-recovery" });
    expect((await control()).status).toBe("READY");
    expect((await state(lost)).accessReady).toBe(false);
    await assertCount(1);
  });

  it("does not expose the control or mutation to impersonated ordinary client contexts", async () => {
    const [actor, target] = await initialize(2);
    const before = await control();
    const request = await begin(target, actor);
    const clientContext = { impersonate: { authClaims: { sub: actor, enabled: true, admin: true, securityVersion: 1 } } };
    await expect(sdk.getAdminSafetyControl(security, clientContext)).rejects.toThrow();
    await expect(sdk.beginSecurityTransition(security, request.variables as unknown as SecuritySdk.BeginSecurityTransitionVariables, clientContext)).rejects.toThrow();
    expect(await control()).toEqual(before);
    expect((await state(target)).securityVersion).toBe(1);
    await assertCount(2);
  });

  it("still denies an observed lost admin when a corrupt zero counter needs recovery", async () => {
    const [lost] = await initialize(1);
    await dc.executeGraphql("mutation CorruptLocalFixtureCounter { adminSafetyControl_update(key: {id: \"site-wide\"}, data: {readyAdminCount: 0}) }");
    const drift = await begin(lost, lost, { actorKind: "DRIFT", actorId: "local-drift-observer", actorSecurityVersion: null,
      desiredEnabled: false, desiredAdmin: true });
    expect((await race([drift]))[0].ok).toBe(true);
    expect((await state(lost)).accessReady).toBe(false);
    expect((await control()).status).toBe("RECOVERY_REQUIRED");
    await assertCount(0);
  });

  it.each(["RETIRED", "LOST"])("refuses a previously admitted SELF request after its profile drifts to %s", async status => {
    const [, , member] = await initialize(2, 1);
    await dc.executeGraphql("mutation DriftLocalMember($id: String!, $status: MembershipStatus!) { user_update(key: {id: $id}, data: {membershipStatus: $status}) }",
      { variables: { id: member, status } });
    const request = await begin(member, member, { actorKind: "SELF", expectedMembershipStatus: status, membershipStatus: "REGULAR" });
    const before = await control();
    const result = (await race([request]))[0];
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SECURITY_ACTOR_REVOKED");
    expect((await state(member)).securityVersion).toBe(1);
    expect(await operation(String(request.variables.operationId))).toBeNull();
    expect(await control()).toEqual(before);
    await assertCount(2);
  });

  it("initializes duplicate applicant email corrections once without granting membership or counting an admin", async () => {
    const [actor] = await initialize(1);
    const applicant = await pendingApplicant();
    const request = await pendingEmailHold(applicant, actor);
    const before = await control();
    const results = await race([request, request]);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect((await control()).version).toBe(before.version + 1);
    expect(await state(applicant)).toMatchObject({membershipStatus: "PENDING", securityVersion: 1,
      accessReady: false, adminReady: false, desiredEnabled: false, desiredAdmin: false,
      verificationEmail: request.variables.verificationEmail, operationId: request.variables.operationId});
    expect((await race([await complete(applicant)]))[0].ok).toBe(true);
    expect(await state(applicant)).toMatchObject({syncStatus: "READY", accessReady: false, adminReady: false});
    await assertCount(1);
  });

  it("serializes independent approval initialization and email hold creation against the same absent authority", async () => {
    const [actor] = await initialize(1);
    const applicant = await pendingApplicant();
    const requests = await Promise.all([pendingEmailHold(applicant, actor), approvalInitialization(applicant, actor)]);
    const before = await control();
    const results = await race(requests);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect((await control()).version).toBe(before.version + 1);
    const winner = results.findIndex(result => result.ok);
    expect(await state(applicant)).toMatchObject({operationId: requests[winner].variables.operationId,
      accessReady: false, adminReady: false, desiredEnabled: false, desiredAdmin: false});
    expect(await operation(String(requests[1 - winner].variables.operationId))).toBeNull();
    await assertCount(1);
  });

  it.each(["hold", "approval"])("keeps correction denied and preserves its exact hold when %s wins initialization", async winner => {
    const [actor] = await initialize(1);
    const applicant = await pendingApplicant();
    const hold = await pendingEmailHold(applicant, actor);
    const approval = await approvalInitialization(applicant, actor);
    const first = winner === "hold" ? hold : approval;
    const second = winner === "hold" ? approval : hold;
    expect((await race([first]))[0].ok).toBe(true);
    expect((await race([await complete(applicant)]))[0].ok).toBe(true);
    second.variables.expectedControlVersion = (await control()).version;
    expect((await race([second]))[0].ok).toBe(false);
    const enable = await begin(applicant, actor, {expectedMembershipStatus: "PENDING", membershipStatus: "REGULAR",
      desiredEnabled: winner === "approval", verificationEmail: winner === "hold" ? hold.variables.verificationEmail : null});
    expect((await race([enable]))[0].ok).toBe(true);
    expect((await race([await complete(applicant)]))[0].ok).toBe(true);
    if (winner === "approval") {
      expect((await state(applicant)).accessReady).toBe(true);
      const correction = await begin(applicant, actor, {desiredEnabled: false, verificationEmail: hold.variables.verificationEmail});
      expect((await race([correction]))[0].ok).toBe(true);
      expect((await race([await complete(applicant)]))[0].ok).toBe(true);
    }
    expect(await state(applicant)).toMatchObject({membershipStatus: "REGULAR", accessReady: false, adminReady: false,
      desiredEnabled: false, verificationEmail: hold.variables.verificationEmail, syncStatus: "READY"});
    await assertCount(1);
  });

  it.each(["email", "status"])("rolls back applicant email initialization on changed profile %s", async field => {
    const [actor] = await initialize(1);
    const applicant = await pendingApplicant();
    const request = await pendingEmailHold(applicant, actor);
    if (field === "email") request.variables.expectedProfileEmail = "stale@example.test";
    else await dc.executeGraphql("mutation ChangedApplicant($userId: String!) {user_update(key: {id: $userId}, data: {membershipStatus: REGULAR})}", {variables: {userId: applicant}});
    const before = await control();
    const result = (await race([request]))[0];
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SECURITY_PROFILE_CONFLICT");
    expect(await state(applicant)).toBeNull();
    expect(await operation(String(request.variables.operationId))).toBeNull();
    expect(await control()).toEqual(before);
    await assertCount(1);
  });

  it("refuses client access and revalidates a revoked actor before initializing applicant authority", async () => {
    const [actor, other] = await initialize(2);
    const applicant = await pendingApplicant();
    const request = await pendingEmailHold(applicant, actor);
    await expect(sdk.initializePendingEmailHold(security, request.variables as unknown as SecuritySdk.InitializePendingEmailHoldVariables,
      {impersonate: {authClaims: {sub: actor, enabled: true, admin: true, securityVersion: 1}}})).rejects.toThrow();
    expect((await race([await begin(actor, other)]))[0].ok).toBe(true);
    request.variables.expectedControlVersion = (await control()).version;
    const before = await control();
    const result = (await race([request]))[0];
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SECURITY_ACTOR_REVOKED");
    expect(await state(applicant)).toBeNull();
    expect(await operation(String(request.variables.operationId))).toBeNull();
    expect(await control()).toEqual(before);
    await assertCount(1);
  });
});

describe("account deletion against actual disposable SQL", () => {
  async function deletionFixture() {
    const [actorId] = await initialize(1);
    const uid = await seedUser("delete-target", false);
    const op = operationId();
    await dc.executeGraphql(`mutation HoldDeletion($uid: String!, $op: String!) {
      userSecurityState_update(key: {userId: $uid}, data: {operationId: $op, accessReady: false, desiredEnabled: false})
    }`, {variables: {uid, op}});
    const emailHash = createHash("sha256").update(`${uid}@example.test`).digest("hex");
    await dc.executeGraphql(`mutation SeedErasureSuppression($uid: String!, $hash: String!) {
      accountErasure_insert(data: {userId: $uid, emailHash: $hash, startedAt: "2026-01-01T00:00:00Z"})
    }`, {variables: {uid, hash: emailHash}});
    return {uid, emailHashes: [emailHash], email: `${uid}@example.test`, operationId: op, targetVersion: (await state(uid)).securityVersion,
      actorId, actorVersion: (await state(actorId)).securityVersion};
  }
  async function seedSelfErasureMarker(uid: string) {
    const hash = createHash("sha256").update(`${uid}@example.test`).digest("hex");
    await dc.executeGraphql(`mutation SeedSelfErasureMarker($uid: String!, $hash: String!) {
      accountErasure_insert(data: {userId: $uid, emailHash: $hash, startedAt: "2026-01-01T00:00:00Z"})
    }`, {variables: {uid, hash}});
    return hash;
  }
  async function selfDeletionFixture() {
    const [adminId, uid] = await initialize(1, 1);
    const hash = await seedSelfErasureMarker(uid);
    const hold = await begin(uid, uid, {actorKind: "SELF", reason: "ACCOUNT_DELETION", membershipStatus: "RESIGNED",
      desiredEnabled: false, desiredAdmin: false, authDisabled: true});
    await sdk.beginSecurityTransition(security, hold.variables as unknown as SecuritySdk.BeginSecurityTransitionVariables);
    const finish = await complete(uid);
    await sdk.completeSecurityTransition(security, finish.variables as unknown as SecuritySdk.CompleteSecurityTransitionVariables);
    return {uid, adminId, email: `${uid}@example.test`, emailHashes: [hash], operationId: String(hold.variables.operationId),
      actorId: uid, actorVersion: 1, targetVersion: (await state(uid)).securityVersion};
  }
  it.each([
    {label: "missing suppression marker", marker: false, overrides: {}},
    {label: "unrelated disable intent", marker: true, overrides: {reason: "UNRELATED_ACTION"}},
    {label: "re-enablement", marker: true, overrides: {authDisabled: false}},
    {label: "membership left active", marker: true, overrides: {membershipStatus: "REGULAR"}},
  ])("refuses a SELF deletion transition with $label without changing membership", async ({marker, overrides}) => {
    const [, uid] = await initialize(1, 1);
    if (marker) await seedSelfErasureMarker(uid);
    const hold = await begin(uid, uid, {actorKind: "SELF", reason: "ACCOUNT_DELETION", membershipStatus: "RESIGNED",
      desiredEnabled: false, desiredAdmin: false, authDisabled: true, ...overrides});
    const before = await control();
    await expect(sdk.beginSecurityTransition(security, hold.variables as unknown as SecuritySdk.BeginSecurityTransitionVariables)).rejects.toThrow("SECURITY_ACTOR_REVOKED");
    expect(await state(uid)).toMatchObject({securityVersion: 1, membershipStatus: "REGULAR", accessReady: true});
    expect(await operation(String(hold.variables.operationId))).toBeNull();
    expect(await control()).toEqual(before);
    await assertCount(1);
  });
  it("refuses SELF deletion of administrator accounts or another member", async () => {
    const [adminId, , uid, other] = await initialize(2, 2);
    await seedSelfErasureMarker(adminId);
    await seedSelfErasureMarker(uid);
    for (const [target, actor] of [[adminId, adminId], [uid, other]]) {
      const hold = await begin(target, actor, {actorKind: "SELF", reason: "ACCOUNT_DELETION", membershipStatus: "RESIGNED",
        desiredEnabled: false, desiredAdmin: false, authDisabled: true});
      await expect(sdk.beginSecurityTransition(security, hold.variables as unknown as SecuritySdk.BeginSecurityTransitionVariables)).rejects.toThrow("SECURITY_ACTOR_REVOKED");
      expect((await state(target)).securityVersion).toBe(1);
      expect(await operation(String(hold.variables.operationId))).toBeNull();
    }
    await assertCount(2);
  });
  it("completes the exact SELF erasure hold and removes the profile without affecting the administrator", async () => {
    const {adminId, ...variables} = await selfDeletionFixture();
    expect(await state(variables.uid)).toMatchObject({membershipStatus: "RESIGNED", accessReady: false, desiredEnabled: false, syncStatus: "READY"});
    await dc.executeGraphql(deleteMyInactiveAccountMutation, {variables});
    const result = await dc.executeGraphql<any, {uid: string}>(`query VerifySelfDeletion($uid: String!) {
      user(id: $uid) {id}
      userSecurityStates(where: {userId: {eq: $uid}}) {userId}
      securityTransitions(where: {userId: {eq: $uid}}) {operationId}
      accountErasures(where: {userId: {eq: $uid}}) {profileDeletedAt}
    }`, {variables: {uid: variables.uid}});
    expect(result.data.user).toBeNull();
    expect(result.data.userSecurityStates).toEqual([]);
    expect(result.data.securityTransitions).toEqual([]);
    expect(result.data.accountErasures).toHaveLength(1);
    expect(result.data.accountErasures[0].profileDeletedAt).toBeTruthy();
    expect((await state(adminId)).adminReady).toBe(true);
    await assertCount(1);
  });
  it("accepts every inventory selection and primary-key ordering in the real schema", async () => {
    const fixture = await deletionFixture();
    for (const table of accountDeletionInventory) {
      const scoped = "searchStrings" in table ? communicationInventoryFilter(table.searchStrings, table.searchUserRefs, fixture.uid, [fixture.email], fixture.emailHashes) : undefined;
      const result = await dc.executeGraphqlRead<Record<string, unknown[]>, Record<string, unknown>>(`query ValidateDeletionInventory${scoped?.declaration ?? ""} { ${table.collection}(${scoped?.filter ?? ""}orderBy: ${table.orderBy}, limit: 250, offset: 0) { ${table.selection} } }`, scoped ? {variables: scoped.variables} : undefined);
      expect(Array.isArray(result.data[table.collection]), table.name).toBe(true);
    }
  });
  it("removes target metadata and profile while preserving the acting admin", async () => {
    const variables = await deletionFixture();
    await dc.executeGraphql(`mutation SeedDeletionCounters($uid: String!) {
      callableInvocation_insert(data: {userId: $uid, functionName: "fixture", windowStart: "2026-01-01T00:00:00Z", count: 1})
      callableRateLimitBucket_insert(data: {userId: $uid, functionName: "fixture", windowStart: "2026-01-01T00:00:00Z", count: 1})
    }`, {variables: {uid: variables.uid}});
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    const result = await dc.executeGraphql<any, {uid: string}>(`query VerifyDeletion($uid: String!) {
      users(where: {id: {eq: $uid}}) {id}
      userSecurityStates(where: {userId: {eq: $uid}}) {userId}
      callableInvocations(where: {userId: {eq: $uid}}) {userId}
      callableRateLimitBuckets(where: {userId: {eq: $uid}}) {userId}
      securityTransitions(where: {userId: {eq: $uid}}) {operationId}
    }`, {variables: {uid: variables.uid}});
    expect(Object.values(result.data).every(rows => Array.isArray(rows) && rows.length === 0)).toBe(true);
    expect((await state(variables.actorId)).adminReady).toBe(true);
    await assertCount(1);
  });
  it("rolls back target removal when the actor's authority version is stale", async () => {
    const variables = await deletionFixture();
    await expect(dc.executeGraphql(deleteInactiveAccountMutation, {variables: {...variables, actorVersion: variables.actorVersion + 1}})).rejects.toThrow();
    expect((await state(variables.uid)).operationId).toBe(variables.operationId);
    await assertCount(1);
  });
  it("rolls back deletion when the target changes or email confirmation is stale", async () => {
    const variables = await deletionFixture();
    for (const change of [{targetVersion: variables.targetVersion + 1}, {email: "different@example.test"}]) {
      await expect(dc.executeGraphql(deleteInactiveAccountMutation, {variables: {...variables, ...change}})).rejects.toThrow();
      expect((await state(variables.uid)).operationId).toBe(variables.operationId);
    }
    await assertCount(1);
  });
  async function sharedSnapshotFixture(variables: Awaited<ReturnType<typeof deletionFixture>>) {
    const section = randomUUID(), send = randomUUID(); caseSectionIds.push(section); caseSendIds.push(send);
    const survivor = {sendId: send, recipientId: variables.actorId, email: "survivor@example.test", personalisation: {name: "Keep", unsubscribe: "opaque-keep"}};
    const snapshot = JSON.stringify({version: 1, tasks: [{sendId: send, recipientId: variables.uid, email: variables.email, personalisation: {name: "Remove"}}, survivor], skippedRecipients: [], audienceSummary: "keep summary"});
    await dc.executeGraphql(`mutation SeedSharedErasureSnapshot($section: UUID!, $send: UUID!, $actor: String!, $snapshot: String!) {
      section_insert(data: {id: $section, name: "Local erasure fixture", type: MEMBERS, createdBy: "fixture", updatedBy: "fixture"})
      announcementSend_insert(data: {id: $send, sectionId: $section, templateUuid: "fixture", sentBy: $actor, recipientCount: 2, skippedCount: 0, recipientSnapshot: $snapshot})
    }`, {variables: {section, send, actor: variables.actorId, snapshot}});
    return {send, snapshot, survivor};
  }
  it("refuses profile deletion while a shared snapshot still contains the member, then preserves the other entry during erasure", async () => {
    const variables = await deletionFixture();
    const shared = await sharedSnapshotFixture(variables);
    await expect(dc.executeGraphql(deleteInactiveAccountMutation, {variables})).rejects.toThrow();
    const pruned = pruneAnnouncementSnapshot(shared.snapshot, variables.uid, variables.email);
    const transaction = withSnapshotErasure(redactAccountSnapshotMutation, [{id: shared.send, expected: shared.snapshot, replacement: pruned.replacement, recipientCount: 2, skippedCount: 0, removedTasks: 1, removedSkipped: 0}]);
    await dc.executeGraphql(transaction.query, {variables: {uid: variables.uid, actorId: variables.actorId, actorVersion: variables.actorVersion, ...transaction.variables}});
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    const result = await dc.executeGraphql<any, {id: string}>("query PreservedSharedSnapshot($id: UUID!) {announcementSend(id: $id) {recipientSnapshot recipientCount skippedCount}}", {variables: {id: shared.send}});
    expect(JSON.parse(result.data.announcementSend.recipientSnapshot)).toEqual({version: 1, tasks: [shared.survivor], skippedRecipients: [], audienceSummary: "keep summary"});
    expect(result.data.announcementSend.recipientCount).toBe(1);
    await assertCount(1);
  });
  it("redacts only the member's shared entry under the SELF hold before deleting the profile", async () => {
    const {adminId, ...variables} = await selfDeletionFixture();
    const shared = await sharedSnapshotFixture({...variables, actorId: adminId});
    await expect(dc.executeGraphql(deleteMyInactiveAccountMutation, {variables})).rejects.toThrow("ERASURE_DRAIN_PENDING");
    const pruned = pruneAnnouncementSnapshot(shared.snapshot, variables.uid, variables.email);
    const transaction = withSnapshotErasure(redactMyAccountSnapshotMutation, [{id: shared.send, expected: shared.snapshot,
      replacement: pruned.replacement, recipientCount: 2, skippedCount: 0, removedTasks: 1, removedSkipped: 0}]);
    await dc.executeGraphql(transaction.query, {variables: {uid: variables.uid, actorId: variables.actorId, actorVersion: variables.actorVersion, operationId: variables.operationId, targetVersion: variables.targetVersion, ...transaction.variables}});
    await dc.executeGraphql(deleteMyInactiveAccountMutation, {variables});
    const observed = await dc.executeGraphql<any, {id: string}>("query PreservedSelfErasureSnapshot($id: UUID!) {announcementSend(id: $id) {recipientSnapshot recipientCount}}", {variables: {id: shared.send}});
    expect(JSON.parse(observed.data.announcementSend.recipientSnapshot).tasks).toEqual([shared.survivor]);
    expect(observed.data.announcementSend.recipientCount).toBe(1);
    expect(await state(variables.uid)).toBeNull();
    await assertCount(1);
  });
  it("refuses superseded SELF snapshot and profile deletion while preserving the current data", async () => {
    const {adminId, ...variables} = await selfDeletionFixture();
    const shared = await sharedSnapshotFixture({...variables, actorId: adminId});
    const pruned = pruneAnnouncementSnapshot(shared.snapshot, variables.uid, variables.email);
    const transaction = withSnapshotErasure(redactMyAccountSnapshotMutation, [{id: shared.send, expected: shared.snapshot,
      replacement: pruned.replacement, recipientCount: 2, skippedCount: 0, removedTasks: 1, removedSkipped: 0}]);
    const replacementOperation = operationId();
    await dc.executeGraphql(`mutation SupersedeSelfErasure($uid: String!, $operation: String!) {
      userSecurityState_update(key: {userId: $uid}, data: {operationId: $operation, securityVersion_update: {inc: 1}})
    }`, {variables: {uid: variables.uid, operation: replacementOperation}});
    await expect(dc.executeGraphql(transaction.query, {variables: {uid: variables.uid, actorId: variables.actorId, actorVersion: variables.actorVersion, operationId: variables.operationId, targetVersion: variables.targetVersion, ...transaction.variables}})).rejects.toThrow("SELF_ERASURE_AUTHORITY_CHANGED");
    const observed = await dc.executeGraphql<any, {id: string}>("query UnchangedSelfErasureSnapshot($id: UUID!) {announcementSend(id: $id) {recipientSnapshot}}", {variables: {id: shared.send}});
    expect(observed.data.announcementSend.recipientSnapshot).toBe(shared.snapshot);
    // Remove the independent snapshot blocker so this call exercises the stale
    // self-authority fence rather than stopping at the communication drain.
    await dc.executeGraphql("mutation SettleSelfSnapshot($id: UUID!) {announcementSend_update(key: {id: $id}, data: {recipientSnapshot: null})}", {variables: {id: shared.send}});
    await expect(dc.executeGraphql(deleteMyInactiveAccountMutation, {variables})).rejects.toThrow("SELF_ERASURE_AUTHORITY_CHANGED");
    expect(await state(variables.uid)).toMatchObject({operationId: replacementOperation, securityVersion: variables.targetVersion + 1});
    await assertCount(1);
  });
  it("rejects snapshot CAS drift without overwriting the newer shared value", async () => {
    const variables = await deletionFixture();
    const shared = await sharedSnapshotFixture(variables);
    const pruned = pruneAnnouncementSnapshot(shared.snapshot, variables.uid, variables.email);
    const transaction = withSnapshotErasure(redactAccountSnapshotMutation, [{id: shared.send, expected: shared.snapshot, replacement: pruned.replacement, recipientCount: 2, skippedCount: 0, removedTasks: 1, removedSkipped: 0}]);
    const changed = shared.snapshot.replace("keep summary", "new summary");
    await dc.executeGraphql("mutation ConcurrentSnapshotChange($id: UUID!, $snapshot: String!) {announcementSend_update(key: {id: $id}, data: {recipientSnapshot: $snapshot})}", {variables: {id: shared.send, snapshot: changed}});
    await expect(dc.executeGraphql(transaction.query, {variables: {uid: variables.uid, actorId: variables.actorId, actorVersion: variables.actorVersion, ...transaction.variables}})).rejects.toThrow();
    const observed = await dc.executeGraphql<any, {id: string}>("query ObserveSnapshotChange($id: UUID!) {announcementSend(id: $id) {recipientSnapshot}}", {variables: {id: shared.send}});
    expect(observed.data.announcementSend.recipientSnapshot).toBe(changed);
    expect(await state(variables.uid)).toBeDefined();
  });
  it("rejects late recipient, notification, receipt and snapshot creation at the SQL boundary", async () => {
    const variables = await deletionFixture();
    const shared = await sharedSnapshotFixture(variables);
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await expect(admin.createAnnouncementRecipient(dc, {id: randomUUID(), announcementSendId: shared.send, userId: variables.uid, email: variables.email, firstName: "Remove", lastName: "Fixture", status: "queued"})).rejects.toThrow("ACCOUNT_ERASURE_IN_PROGRESS");
    await expect(admin.createNotificationDelivery(dc, {channel: "EMAIL", notificationType: "ERASURE_TEST", deliveryKey: randomUUID(), userId: variables.uid, status: "PENDING", attemptCount: 0})).rejects.toThrow("ACCOUNT_ERASURE_IN_PROGRESS");
    await expect(admin.createNotifyDeliveryReceipt(dc, {id: randomUUID(), recipientHash: variables.emailHashes[0], notifyStatus: "delivered", eventAt: "2026-01-01T00:00:00Z", eventOrderingKey: "fixture", affectsBounceState: false, lastAttemptedAt: "2026-01-01T00:00:00Z"})).rejects.toThrow("ACCOUNT_ERASURE_IN_PROGRESS");
    await expect(admin.createAnnouncementSendWithDeliveryMode(dc, {id: randomUUID(), sectionId: caseSectionIds[0], templateUuid: "fixture", sentBy: variables.actorId, recipientCount: 1, skippedCount: 0, recipientSnapshot: shared.snapshot, requestedDeliveryMode: "SIMULATION", siteDeliveryMode: "SIMULATION", effectiveDeliveryMode: "SIMULATION", recipientIds: [variables.uid]})).rejects.toThrow("ACCOUNT_ERASURE_IN_PROGRESS");
    // Cached pre-erasure writers cannot persist an unlisted audience either.
    await expect(admin.createAnnouncementSendWithDeliveryMode(dc, {id: randomUUID(), sectionId: caseSectionIds[0], templateUuid: "fixture", sentBy: variables.actorId, recipientCount: 1, skippedCount: 0, recipientSnapshot: shared.snapshot, requestedDeliveryMode: "SIMULATION", siteDeliveryMode: "SIMULATION", effectiveDeliveryMode: "SIMULATION"})).rejects.toThrow("ACCOUNT_ERASURE_IN_PROGRESS");
  });
  const callbackArgs = (userId: string | null, recipientHash = "synthetic-callback-hash") => ({
    id: randomUUID(), userId, recipientHash, notifyStatus: "delivered", eventAt: "2026-01-01T00:00:00Z",
    eventOrderingKey: "fixture", affectsBounceState: false, lastAttemptedAt: "2026-01-01T00:00:00Z",
  });
  async function seedCallbackNotification(userId: string, providerMessageId: string) {
    await dc.executeGraphql(`mutation SeedCorrelatedCallback($uid: String!, $providerId: String!, $key: String!) {
      notificationDelivery_insert(data: {channel: EMAIL, notificationType: "CALLBACK_FIXTURE", deliveryKey: $key,
        recipientUserId: $uid, providerMessageId: $providerId, status: SENT, createdBy: "fixture", updatedBy: "fixture"})
    }`, {variables: {uid: userId, providerId: providerMessageId, key: randomUUID()}});
  }
  async function seedAuthCallbackNotification(userId: string, reference: string, overrides: {
    channel?: "EMAIL" | "SMS"; notificationType?: string; provider?: string;
    status?: "PENDING" | "FAILED" | "SENT" | "SKIPPED"; providerMessageId?: string | null;
    missingProfile?: boolean;
  } = {}) {
    await dc.executeGraphql(`mutation SeedAuthCallbackBinding($uid: String!, $subject: String, $key: String!, $channel: NotificationChannel!, $kind: String!, $provider: String!, $status: NotificationDeliveryStatus!, $providerId: String) {
      notificationDelivery_insert(data: {channel: $channel, notificationType: $kind, deliveryKey: $key,
        userId: $subject, recipientUserId: $uid, provider: $provider, providerMessageId: $providerId, status: $status,
        createdBy: "fixture", updatedBy: "fixture"})
    }`, {variables: {uid: userId, subject: overrides.missingProfile ? null : userId, key: reference, channel: overrides.channel ?? "EMAIL", kind: overrides.notificationType ?? "AUTH_PASSWORD_RESET",
      provider: overrides.provider ?? "govuk_notify", status: overrides.status ?? "PENDING", providerId: overrides.providerMessageId ?? null}});
  }
  it.each([
    ["PENDING", "live", "AUTH_PASSWORD_RESET"],
    ["FAILED", "team_test", "AUTH_EMAIL_VERIFICATION"],
    ["SENT", "simulation", "AUTH_EMAIL_CHANGE_VERIFICATION"],
  ] as const)("accepts the exact pre-send auth binding with %s metadata before provider ID persistence", async (status, mode, notificationType) => {
    const [uid] = await initialize(1);
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    const reference = `AUTH_EMAIL:${randomUUID()}:notify-${mode}`;
    await seedAuthCallbackNotification(uid, reference, {status, notificationType});
    const args = {...callbackArgs(uid), reference};
    const lookup = await admin.getNotifyCallbackNotificationUser(dc, {providerMessageId: args.id, authReference: reference});
    expect(lookup.data.notificationDeliveries).toEqual([{userId: uid, recipientUserId: uid}]);
    await expect(admin.createNotifyDeliveryReceipt(dc, args)).resolves.toBeDefined();
    const observed = await admin.getNotifyDeliveryReceipt(dc, {id: args.id});
    expect(observed.data.notifyDeliveryReceipt?.userId).toBe(uid);
  });
  it.each([
    {notificationType: "BOOKING_CONFIRMATION"},
    {channel: "SMS"},
    {provider: "another-provider"},
    {status: "SKIPPED"},
    {providerMessageId: "different-accepted-provider-message"},
  ] as const)("refuses an auth reference fallback with an incompatible persisted binding: %j", async overrides => {
    const [uid] = await initialize(1);
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    const reference = `AUTH_EMAIL:${randomUUID()}:notify-live`;
    await seedAuthCallbackNotification(uid, reference, overrides);
    const args = {...callbackArgs(uid), reference};
    const lookup = await admin.getNotifyCallbackNotificationUser(dc, {providerMessageId: args.id, authReference: reference});
    expect(lookup.data.notificationDeliveries).toEqual([]);
    await expect(admin.createNotifyDeliveryReceipt(dc, args)).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
  });
  it("refuses guessed or mode-mismatched auth references at both callback lookup and receipt insertion", async () => {
    const [uid] = await initialize(1);
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    const reference = `AUTH_EMAIL:${randomUUID()}:notify-live`;
    await seedAuthCallbackNotification(uid, reference);
    for (const forged of [`AUTH_EMAIL:${randomUUID()}:notify-live`, reference.replace("notify-live", "notify-simulation")]) {
      const args = {...callbackArgs(uid), reference: forged};
      expect((await admin.getNotifyCallbackNotificationUser(dc, {providerMessageId: args.id, authReference: forged})).data.notificationDeliveries).toEqual([]);
      await expect(admin.createNotifyDeliveryReceipt(dc, args)).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
    }
  });
  it("refuses a stale auth binding for a missing profile or a replacement identity at the same address", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    await dc.executeGraphql("mutation ExpireAuthCallbackMarker($uid: String!) {accountErasure_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid: variables.uid}});
    const reference = `AUTH_EMAIL:${randomUUID()}:notify-live`;
    // Deliberate stale legacy fixture: normal owned-delivery insertion refuses
    // this absent UID, and ordinary erasure removes its existing delivery rows.
    await seedAuthCallbackNotification(variables.uid, reference, {status: "FAILED", missingProfile: true});
    await dc.executeGraphql("mutation ReuseErasedAuthAddress($id: String!, $email: String!) {user_update(key: {id: $id}, data: {email: $email})}", {variables: {id: variables.actorId, email: variables.email}});
    await expect(admin.createNotifyDeliveryReceipt(dc, {...callbackArgs(variables.uid, variables.emailHashes[0]), reference})).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
    await expect(admin.createNotifyDeliveryReceipt(dc, {...callbackArgs(variables.actorId, variables.emailHashes[0]), reference})).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
  });
  it("rejects orphan callback recreation after the profile and its suppression marker have gone", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    await dc.executeGraphql("mutation ExpireCallbackMarker($uid: String!) {accountErasure_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid: variables.uid}});
    const orphan = callbackArgs(null, variables.emailHashes[0]);
    await expect(admin.createNotifyDeliveryReceipt(dc, orphan)).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
    const stale = callbackArgs(variables.uid, variables.emailHashes[0]);
    await seedCallbackNotification(variables.uid, stale.id);
    await expect(admin.createNotifyDeliveryReceipt(dc, stale)).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
    const observed = await dc.executeGraphql<any, {ids: string[]}>("query NoRecreatedCallbacks($ids: [String!]!) {notifyDeliveryReceipts(where: {id: {in: $ids}}) {id}}", {variables: {ids: [orphan.id, stale.id]}});
    expect(observed.data.notifyDeliveryReceipts).toEqual([]);
  });
  it("rejects a current identity substituted for an old provider UID or deleted announcement reference", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    await dc.executeGraphql("mutation ExpireStaleCallbackMarker($uid: String!) {accountErasure_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid: variables.uid}});
    const tracked = callbackArgs(variables.actorId, variables.emailHashes[0]);
    await seedCallbackNotification(variables.uid, tracked.id);
    await expect(admin.createNotifyDeliveryReceipt(dc, tracked)).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
    const sendId = randomUUID();
    await expect(admin.createNotifyDeliveryReceipt(dc, {...callbackArgs(variables.actorId, variables.emailHashes[0]),
      reference: `announcement:${sendId}:${variables.uid}`, announcementRecipientId: randomUUID(), announcementSendId: sendId, announcementUserId: variables.uid})).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
  });
  it("accepts a live announcement callback without attaching an unrelated current user", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    await dc.executeGraphql("mutation ExpireAnnouncementCallbackMarker($uid: String!) {accountErasure_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid: variables.uid}});
    const shared = await sharedSnapshotFixture(variables);
    const recipientId = randomUUID();
    // Deliberate legacy fixture: current recipient writers refuse a missing UID.
    await dc.executeGraphql(`mutation SeedLegacyAnnouncementCallback($id: UUID!, $send: UUID!, $uid: String!, $email: String!) {
      announcementRecipient_insert(data: {id: $id, announcementSendId: $send, userId: $uid, email: $email,
        firstName: "Synthetic", lastName: "Fixture", status: "sent"})
    }`, {variables: {id: recipientId, send: shared.send, uid: variables.uid, email: variables.email}});
    const args = {...callbackArgs(null, variables.emailHashes[0]), reference: `announcement:${shared.send}:${variables.uid}`,
      announcementRecipientId: recipientId, announcementSendId: shared.send, announcementUserId: variables.uid};
    await expect(admin.createNotifyDeliveryReceipt(dc, args)).resolves.toBeDefined();
    await expect(admin.createNotifyDeliveryReceipt(dc, {...args, id: randomUUID(), userId: variables.actorId})).rejects.toThrow("NOTIFY_CALLBACK_SUBJECT_MISSING");
    await dc.executeGraphql("mutation RemoveAnnouncementCallbackFixture($id: String!) {notifyDeliveryReceipt_delete(key: {id: $id})}", {variables: {id: args.id}});
  });
  it("permits unrelated notifications and a newly registered identity at the same address", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await expect(admin.createNotificationDelivery(dc, {channel: "EMAIL", notificationType: "ERASURE_UNRELATED", deliveryKey: randomUUID(), recipientUserId: variables.actorId, status: "SENT", attemptCount: 1})).resolves.toBeDefined();
    const args = callbackArgs(variables.actorId, variables.emailHashes[0]);
    await seedCallbackNotification(variables.actorId, args.id);
    await expect(admin.createNotifyDeliveryReceipt(dc, args)).resolves.toBeDefined();
  });
  it("waits for claimed notification and announcement leases before purging owned records", async () => {
    const variables = await deletionFixture();
    const shared = await sharedSnapshotFixture(variables);
    const delivery = randomUUID(), recipient = randomUUID();
    await dc.executeGraphql(`mutation SeedActiveDelivery($uid: String!, $delivery: UUID!, $send: UUID!, $recipient: UUID!, $email: String!) {
      announcementSend_update(key: {id: $send}, data: {recipientSnapshot: null})
      notificationDelivery_insert(data: {id: $delivery, channel: EMAIL, notificationType: "ERASURE_LEASE", deliveryKey: $email, userId: $uid, status: PENDING, lastAttemptedAt_expr: "request.time", createdBy: "fixture", updatedBy: "fixture"})
      announcementRecipient_insert(data: {id: $recipient, announcementSendId: $send, userId: $uid, email: $email, firstName: "Remove", lastName: "Fixture", status: "sending", processingStartedAt_expr: "request.time"})
    }`, {variables: {uid: variables.uid, email: variables.email, send: shared.send, delivery, recipient}});
    await expect(dc.executeGraphql(deleteInactiveAccountMutation, {variables})).rejects.toThrow("ERASURE_DRAIN_PENDING");
    await dc.executeGraphql("mutation SettleNotification($id: UUID!) {notificationDelivery_update(key: {id: $id}, data: {lastAttemptedAt: \"2026-01-01T00:00:00Z\"})}", {variables: {id: delivery}});
    await expect(dc.executeGraphql(deleteInactiveAccountMutation, {variables})).rejects.toThrow("ERASURE_DRAIN_PENDING");
    await dc.executeGraphql("mutation SettleAnnouncement($id: UUID!) {announcementRecipient_update(key: {id: $id}, data: {processingStartedAt: \"2026-01-01T00:00:00Z\"})}", {variables: {id: recipient}});
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    expect(await state(variables.uid)).toBeNull();
  });
  it("rejects early deletion before the suppression drain has elapsed", async () => {
    const variables = await deletionFixture();
    await dc.executeGraphql("mutation FreshErasureMarker($uid: String!) {accountErasure_updateMany(where: {userId: {eq: $uid}}, data: {startedAt_expr: \"request.time\"})}", {variables: {uid: variables.uid}});
    await expect(dc.executeGraphql(deleteInactiveAccountMutation, {variables})).rejects.toThrow();
    expect(await state(variables.uid)).toBeDefined();
  });

  it("rejects both announcement creation paths for an absent UID after suppression disposal", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    await dc.executeGraphql("mutation DisposeLateTaskMarker($uid: String!) {accountErasure_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid: variables.uid}});
    const shared = await sharedSnapshotFixture(variables);
    const base = {announcementSendId: shared.send, userId: variables.uid, email: variables.email, firstName: "Synthetic", lastName: "Fixture", status: "queued"};
    await expect(admin.createAnnouncementRecipient(dc, {...base, id: randomUUID()})).rejects.toThrow("ANNOUNCEMENT_SUBJECT_MISSING");
    await expect(admin.createAnnouncementRecipientWithDeliveryMode(dc, {...base, id: randomUUID(), surnameInitial: "F", surnameSortKey: "fixture", firstNameSortKey: "synthetic", searchText: "synthetic fixture", effectiveDeliveryMode: "SIMULATION"})).rejects.toThrow("ANNOUNCEMENT_SUBJECT_MISSING");
    const observed = await dc.executeGraphql<any, {uid: string}>("query NoLateTaskRecipient($uid: String!) {announcementRecipients(where: {userId: {eq: $uid}}) {id}}", {variables: {uid: variables.uid}});
    expect(observed.data.announcementRecipients).toEqual([]);
  });
  it("binds announcement creation to the current UID and exact email while allowing a new identity at that address", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    await dc.executeGraphql("mutation DisposeReRegisteredTaskMarker($uid: String!) {accountErasure_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid: variables.uid}});
    const uid = await seedUser("re-registered-task-target", false);
    await dc.executeGraphql("mutation ReRegisterTaskEmail($uid: String!, $email: String!) {user_update(key: {id: $uid}, data: {email: $email})}", {variables: {uid, email: variables.email}});
    const shared = await sharedSnapshotFixture(variables);
    const base = {announcementSendId: shared.send, userId: uid, email: variables.email, firstName: "Synthetic", lastName: "Fixture", status: "queued"};
    await expect(admin.createAnnouncementRecipient(dc, {...base, id: randomUUID(), userId: variables.uid})).rejects.toThrow("ANNOUNCEMENT_SUBJECT_MISSING");
    await expect(admin.createAnnouncementRecipient(dc, {...base, id: randomUUID(), email: "obsolete@example.invalid"})).rejects.toThrow("ANNOUNCEMENT_SUBJECT_MISSING");
    await expect(admin.createAnnouncementRecipientWithDeliveryMode(dc, {...base, id: randomUUID(), email: "obsolete@example.invalid", surnameInitial: "F", surnameSortKey: "fixture", firstNameSortKey: "synthetic", searchText: "synthetic fixture", effectiveDeliveryMode: "SIMULATION"})).rejects.toThrow("ANNOUNCEMENT_SUBJECT_MISSING");
    await expect(admin.createAnnouncementRecipient(dc, {...base, id: randomUUID()})).resolves.toBeDefined();
    await dc.executeGraphql("mutation ResetCurrentTaskRecipient($uid: String!) {announcementRecipient_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid}});
    await expect(admin.createAnnouncementRecipientWithDeliveryMode(dc, {...base, id: randomUUID(), surnameInitial: "F", surnameSortKey: "fixture", firstNameSortKey: "synthetic", searchText: "synthetic fixture", effectiveDeliveryMode: "SIMULATION"})).resolves.toBeDefined();
  });
  it("requires live notification ownership after disposal while preserving unowned guest deliveries", async () => {
    const variables = await deletionFixture();
    const admin = require("@dataconnect/admin-generated") as typeof import("@dataconnect/admin-generated");
    await dc.executeGraphql(deleteInactiveAccountMutation, {variables});
    await dc.executeGraphql("mutation DisposeNotificationTaskMarker($uid: String!) {accountErasure_deleteMany(where: {userId: {eq: $uid}})}", {variables: {uid: variables.uid}});
    const base = {channel: "EMAIL" as const, notificationType: "LATE_TASK_FIXTURE", status: "PENDING" as const, attemptCount: 1};
    for (const ownership of [{userId: variables.uid}, {recipientUserId: variables.uid}, {userId: variables.actorId, recipientUserId: variables.uid}, {userId: variables.uid, recipientUserId: variables.actorId}]) {
      await expect(admin.createNotificationDelivery(dc, {...base, ...ownership, deliveryKey: randomUUID()})).rejects.toThrow("NOTIFICATION_SUBJECT_MISSING");
    }
    await expect(admin.createNotificationDelivery(dc, {...base, userId: variables.actorId, recipientUserId: variables.actorId, deliveryKey: randomUUID()})).resolves.toBeDefined();
    const guest = await admin.createNotificationDelivery(dc, {...base, deliveryKey: randomUUID()});
    await dc.executeGraphql("mutation RemoveUnownedLateTaskFixture($id: UUID!) {notificationDelivery_delete(key: {id: $id})}", {variables: {id: guest.data.notificationDelivery_insert.id}});
    const observed = await dc.executeGraphql<any, {uid: string}>("query NoLateOwnedNotification($uid: String!) {notificationDeliveries(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]}) {id}}", {variables: {uid: variables.uid}});
    expect(observed.data.notificationDeliveries).toEqual([]);
  });

});
