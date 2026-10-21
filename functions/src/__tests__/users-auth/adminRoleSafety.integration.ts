import { fork, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DataConnect } from "firebase-admin/data-connect";
import type { App } from "firebase-admin/app";
import type * as SecuritySdk from "@dataconnect/security-admin-generated";

// No ordinary test setup or Auth impersonation supplies the mutation evidence.
// These tests exercise actual SQL transactions in the runner's fresh local DB.
type Outcome = { kind: "result"; ok: boolean; pid: number; message?: string };
type Mutation = { operation: "beginSecurityTransition" | "completeSecurityTransition" | "recordSecurityNoop"; variables: Record<string, unknown> };
let sdk: typeof SecuritySdk;
let dc: DataConnect;
let security: DataConnect;
let apps: App[] = [];
let prefix: string;
let caseSequence = 0;
let freshDatabaseVerified = false;
let caseIds: string[] = [];
let caseOperations: string[] = [];
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
beforeEach(() => { caseSequence++; caseIds = []; caseOperations = []; });
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
  await dc.executeGraphql(`mutation RemoveLocalFixture($users: [String!]!, $operations: [String!]!) @transaction {
    userSecurityState_deleteMany(where: {userId: {in: $users}})
    securityTransition_deleteMany(where: {operationId: {in: $operations}})
    adminSafetyAudit_deleteMany(where: {operationId: {in: $operations}})
    adminSafetyControl_deleteMany(where: {id: {eq: "site-wide"}})
    user_deleteMany(where: {id: {in: $users}})
  }`, { variables: { users: caseIds, operations: caseOperations } });
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
});
