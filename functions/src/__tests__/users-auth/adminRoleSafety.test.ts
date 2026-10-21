import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => Object.fromEntries(["lookup", "operation", "control", "roster", "begin", "complete", "noop", "initialize", "failure", "supersede", "audit", "create", "activate", "recount", "getUser", "setClaims", "updateUser", "revoke", "profile"].map(name => [name, vi.fn()])));
vi.mock("../../securityRepository", () => ({getUserSecurityState: mocks.lookup, getSecurityTransition: mocks.operation, getAdminSafetyControl: mocks.control,
  listReadyAdministrators: mocks.roster, beginSecurityTransition: mocks.begin, completeSecurityTransition: mocks.complete, recordSecurityNoop: mocks.noop,
  initializeUserSecurityState: mocks.initialize, recordSecuritySynchronizationFailure: mocks.failure, supersedeSecurityTransition: mocks.supersede,
  getAdminSafetyAudit: mocks.audit, createAdminSafetyControl: mocks.create, activateAdminSafetyControl: mocks.activate, reconcileAdminSafetyControl: mocks.recount}));
vi.mock("firebase-admin", () => ({auth: () => ({getUser: mocks.getUser, setCustomUserClaims: mocks.setClaims, updateUser: mocks.updateUser, revokeRefreshTokens: mocks.revoke})}));
vi.mock("@dataconnect/admin-generated", () => ({getUserMembershipStatus: mocks.profile}));
import { transitionUserSecurity, synchronizeUserSecurity, initializeUserSecurityState, bootstrapAdminSafetyControl, activateAdminSafetyControl, reconcileAdminSafetyControl, repairUserSecurity } from "../../currentAuthorizationTransitions";
type State = {userId: string; securityVersion: number; operationId: string; membershipStatus: string; desiredAdmin: boolean; desiredEnabled: boolean;
  accessReady: boolean; adminReady: boolean; verificationEmail: string | null; syncStatus: string; user: {membershipStatus: string; email: string}};
type Identity = {uid: string; email: string; emailVerified: boolean; disabled: boolean; customClaims: Record<string, unknown>};
let states: Map<string, State>, identities: Map<string, Identity>, operations: Map<string, any>, audits: Map<string, any>;
let safety: {id: string; version: number; readyAdminCount: number; status: string} | null;
let events: string[];
function seed(uid: string, admin = true) {
  const state = {userId: uid, securityVersion: 1, operationId: `initial-${uid}`, membershipStatus: "REGULAR", desiredAdmin: admin, desiredEnabled: true,
    accessReady: true, adminReady: admin, verificationEmail: null, syncStatus: "READY", user: {membershipStatus: "REGULAR", email: `${uid}@example.invalid`}};
  states.set(uid, state); identities.set(uid, {uid, email: state.user.email, emailVerified: true, disabled: false, customClaims: {enabled: true, admin, securityVersion: 1, unrelated: "keep"}});
  operations.set(state.operationId, {...structuredClone(state), actorId: "operator", actorKind: "OPERATOR", reason: "BOOTSTRAP", intentHash: "initial", noOp: false});
  if (admin && safety) safety.readyAdminCount++;
}
function transaction(work: () => void) {
  const old = structuredClone({safety, states, operations, audits});
  try {work();} catch (error) {({safety, states, operations, audits} = old); throw error;}
}
function check(values: any) {
  if (!safety || safety.version !== values.expectedControlVersion) throw new Error("ADMIN_CONTROL_CONFLICT");
  if (["ADMIN", "SELF", "SELF_VERIFICATION"].includes(values.actorKind)) {
    const actor = states.get(values.actorId);
    if (!actor || actor.securityVersion !== values.actorSecurityVersion || actor.syncStatus !== "READY" ||
      (values.actorKind === "ADMIN" && (!actor.adminReady || !actor.accessReady || actor.membershipStatus !== actor.user.membershipStatus)) ||
      (values.actorKind === "SELF" && (values.actorId !== values.userId || !actor.accessReady || actor.membershipStatus !== actor.user.membershipStatus))) throw new Error("SECURITY_ACTOR_REVOKED");
    if (safety.status !== "READY") throw new Error("ADMIN_SAFETY_RECOVERY_REQUIRED");
  }
  if (operations.has(values.operationId)) throw new Error("duplicate key");
}
function begin(values: any) {transaction(() => {
  check(values); const state = states.get(values.userId)!;
  if (state.securityVersion !== values.expectedVersion) throw new Error("SECURITY_STATE_CONFLICT");
  if (state.adminReady && safety!.readyAdminCount <= 1 && values.actorKind !== "DRIFT") throw new Error("LAST_ADMIN_REQUIRED");
  const delta = state.adminReady ? -1 : 0;
  safety!.readyAdminCount = Math.max(0, safety!.readyAdminCount + delta); safety!.version++;
  if (values.actorKind === "DRIFT" && safety!.readyAdminCount === 0) safety!.status = "RECOVERY_REQUIRED";
  Object.assign(state, values, {securityVersion: values.nextVersion, accessReady: false, adminReady: false, syncStatus: "PENDING", user: {...state.user, membershipStatus: values.membershipStatus}});
  operations.set(values.operationId, {...values, securityVersion: values.nextVersion, syncStatus: "PENDING", noOp: false, startedAdminDelta: delta});
  events.push(`begin:${values.userId}`);
});}
function intent(userId: string, overrides: Record<string, unknown> = {}) {
  return {userId, actorId: "a", actorKind: "ADMIN" as const, actorSecurityVersion: 1, reason: "REVOKE_ADMIN", operationId: `revoke-${userId}-operation`, admin: false, ...overrides};
}
beforeEach(() => {
  vi.resetAllMocks(); states = new Map(); identities = new Map(); operations = new Map(); audits = new Map(); events = [];
  safety = {id: "site-wide", version: 1, readyAdminCount: 0, status: "READY"}; seed("a");
  mocks.lookup.mockImplementation(async ({userId}) => ({data: {userSecurityState: structuredClone(states.get(userId) ?? null)}}));
  mocks.operation.mockImplementation(async ({operationId}) => ({data: {securityTransition: structuredClone(operations.get(operationId) ?? null)}}));
  mocks.control.mockImplementation(async () => ({data: {adminSafetyControl: structuredClone(safety)}}));
  mocks.roster.mockImplementation(async () => ({data: {userSecurityStates: structuredClone([...states.values()].filter(state => state.adminReady))}}));
  mocks.audit.mockImplementation(async ({operationId}) => ({data: {adminSafetyAudit: audits.get(operationId) ?? null}}));
  mocks.getUser.mockImplementation(async uid => {const user = identities.get(uid); if (!user) throw Object.assign(new Error("missing"), {code: "auth/user-not-found"}); return structuredClone(user);});
  mocks.profile.mockImplementation(async ({id}) => ({data: {user: states.get(id)?.user ?? {membershipStatus: "REGULAR"}}}));
  mocks.setClaims.mockImplementation(async (uid, claims) => {events.push(`auth:${uid}`); identities.get(uid)!.customClaims = {...claims};});
  mocks.updateUser.mockImplementation(async (uid, values) => {Object.assign(identities.get(uid)!, values); return structuredClone(identities.get(uid));});
  mocks.begin.mockImplementation(async values => begin(values));
  mocks.complete.mockImplementation(async values => transaction(() => {
    if (!safety || safety.version !== values.expectedControlVersion) throw new Error("ADMIN_CONTROL_CONFLICT");
    const state = states.get(values.userId)!; const op = operations.get(values.operationId);
    if (state.securityVersion !== values.securityVersion || state.operationId !== values.operationId || state.syncStatus !== "PENDING" || op.syncStatus !== "PENDING") throw new Error("SECURITY_STATE_CONFLICT");
    safety.readyAdminCount += Number(values.adminReady); safety.version++;
    Object.assign(state, {accessReady: values.accessReady, adminReady: values.adminReady, syncStatus: "READY"});
    Object.assign(op, {syncStatus: "READY", completedAdminDelta: Number(values.adminReady)}); events.push(`complete:${values.userId}`);
  }));
  mocks.noop.mockImplementation(async values => transaction(() => {
    check(values); const state = states.get(values.userId)!;
    if (state.securityVersion !== values.expectedVersion) throw new Error("SECURITY_STATE_CONFLICT");
    safety!.version++; operations.set(values.operationId, {...values, securityVersion: values.expectedVersion, noOp: true, syncStatus: "READY"});
  }));
  mocks.initialize.mockImplementation(async values => transaction(() => {
    check(values);
    const state = {userId: values.userId, ...values, securityVersion: 1, accessReady: false, adminReady: false, syncStatus: "PENDING", user: {membershipStatus: values.membershipStatus, email: identities.get(values.userId)!.email}};
    states.set(values.userId, state); safety!.version++;
    operations.set(values.operationId, {...values, securityVersion: 1, noOp: false, syncStatus: "PENDING"});
  }));
  mocks.supersede.mockImplementation(async ({operationId}) => {operations.get(operationId).syncStatus = "SUPERSEDED";});
  mocks.create.mockImplementation(async values => {if (safety) throw new Error("already exists"); safety = {id: "site-wide", version: 1, readyAdminCount: values.readyAdminCount, status: "BOOTSTRAP"}; audits.set(values.operationId, values);});
  mocks.activate.mockImplementation(async values => transaction(() => {if (safety!.version !== values.expectedControlVersion) throw new Error("ADMIN_CONTROL_CONFLICT"); if (!safety!.readyAdminCount) throw new Error("ADMIN_ROSTER_CONFLICT"); safety!.version++; safety!.status = "READY"; audits.set(values.operationId, values);}));
  mocks.recount.mockImplementation(async values => {safety!.version++; safety!.readyAdminCount = values.readyAdminCount; safety!.status = values.readyAdminCount ? "BOOTSTRAP" : "RECOVERY_REQUIRED"; audits.set(values.operationId, values);});
});

describe("administrator safety orchestration with durable transaction adapter", () => {
  it.each([{admin: false}, {admin: undefined, membershipStatus: "RESERVE"}, {admin: undefined, verificationEmail: "new@example.invalid"}, {admin: undefined, authDisabled: true}])("refuses every sole-admin readiness drop before Auth: %s", async change => {
    await expect(transitionUserSecurity(intent("a", change))).rejects.toMatchObject({details: {code: "LAST_ADMIN_REQUIRED"}});
    expect(safety!.readyAdminCount).toBe(1); expect(states.get("a")!.adminReady).toBe(true); expect(mocks.setClaims).not.toHaveBeenCalled(); expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("records and replays a sole-admin no-op without removing readiness, then rejects conflicting flag reuse", async () => {
    const request = intent("a", {admin: true}); await transitionUserSecurity(request); await transitionUserSecurity(request);
    expect(safety!.readyAdminCount).toBe(1); expect(states.get("a")).toMatchObject({securityVersion: 1, operationId: "initial-a", adminReady: true});
    expect(mocks.noop).toHaveBeenCalledOnce(); expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.setClaims).not.toHaveBeenCalled();
    await expect(transitionUserSecurity({...request, authDisabled: true})).rejects.toMatchObject({details: {code: "SECURITY_OPERATION_CONFLICT"}});
  });
  it("retries an already-recorded no-op mirror failure without changing the version or count", async () => {
    identities.get("a")!.customClaims.admin = false; mocks.setClaims.mockRejectedValueOnce(new Error("Auth unavailable"));
    const request = intent("a", {admin: true}); await expect(transitionUserSecurity(request)).rejects.toThrow("Auth unavailable");
    expect(operations.get(request.operationId).noOp).toBe(true); await transitionUserSecurity(request);
    expect(mocks.noop).toHaveBeenCalledOnce(); expect(states.get("a")!.securityVersion).toBe(1); expect(safety!.readyAdminCount).toBe(1);
    expect(identities.get("a")!.customClaims).toMatchObject({admin: true, unrelated: "keep"});
  });
  it("commits denied/count state before Auth failure and resumes exactly once", async () => {
    seed("b"); mocks.setClaims.mockRejectedValueOnce(new Error("Auth unavailable")); const request = intent("b");
    await expect(transitionUserSecurity(request)).rejects.toThrow("Auth unavailable");
    expect(safety!.readyAdminCount).toBe(1); expect(states.get("b")).toMatchObject({adminReady: false, syncStatus: "PENDING"});
    await transitionUserSecurity(request); expect(mocks.begin).toHaveBeenCalledOnce(); expect(safety!.readyAdminCount).toBe(1);
    expect(events).toEqual(["begin:b", "auth:b", "complete:b"]);
  });
  it("recovers an uncertain begin commit without decrementing twice", async () => {
    seed("b"); mocks.begin.mockImplementationOnce(async values => {begin(values); throw new Error("connection lost after commit");});
    await transitionUserSecurity(intent("b")); expect(safety!.readyAdminCount).toBe(1); expect(mocks.begin).toHaveBeenCalledOnce(); expect(operations.get("revoke-b-operation").syncStatus).toBe("READY");
  });
  it("does not count an incomplete grant and completes it once after a lost acknowledgement", async () => {
    seed("member", false); mocks.setClaims.mockRejectedValueOnce(new Error("Auth unavailable")); const request = intent("member", {admin: true, reason: "GRANT_ADMIN"});
    await expect(transitionUserSecurity(request)).rejects.toThrow("Auth unavailable"); expect(safety!.readyAdminCount).toBe(1);
    const complete = mocks.complete.getMockImplementation()!; mocks.complete.mockImplementationOnce(async values => {await complete(values); throw new Error("lost acknowledgement");});
    await transitionUserSecurity(request); await transitionUserSecurity(request); expect(safety!.readyAdminCount).toBe(2); expect(mocks.begin).toHaveBeenCalledOnce();
  });
  it("never counts a superseded pending grant after a later revocation", async () => {
    seed("member", false); mocks.setClaims.mockRejectedValueOnce(new Error("Auth unavailable"));
    await expect(transitionUserSecurity(intent("member", {admin: true, reason: "GRANT_ADMIN"}))).rejects.toThrow();
    await transitionUserSecurity(intent("member", {operationId: "later-revoke-operation"})); await synchronizeUserSecurity("revoke-member-operation");
    expect(safety!.readyAdminCount).toBe(1); expect(states.get("member")!.adminReady).toBe(false); expect(operations.get("revoke-member-operation").syncStatus).toBe("SUPERSEDED");
  });
  it("a previous no-op replay cannot undo a later role transition", async () => {
    seed("b"); const request = intent("b", {admin: true}); await transitionUserSecurity(request);
    await transitionUserSecurity(intent("b", {operationId: "new-revoke-operation"})); await transitionUserSecurity(request);
    expect(safety!.readyAdminCount).toBe(1); expect(states.get("b")!.adminReady).toBe(false); expect(identities.get("b")!.customClaims.admin).toBe(false);
  });
  it("rechecks a concurrently revoked actor inside the protected transaction", async () => {
    seed("b"); seed("c"); mocks.begin.mockImplementationOnce(async values => {states.get("a")!.adminReady = false; states.get("a")!.accessReady = false; states.get("a")!.securityVersion++; safety!.version++; safety!.readyAdminCount--; begin(values);});
    await expect(transitionUserSecurity(intent("b"))).rejects.toMatchObject({details: {code: "SECURITY_ACTOR_REVOKED"}});
    expect(states.get("b")!.adminReady).toBe(true); expect(mocks.setClaims).not.toHaveBeenCalled();
  });
  it("observed disabled remaining identities cannot inflate removal eligibility", async () => {
    seed("b"); identities.get("b")!.disabled = true;
    await expect(transitionUserSecurity(intent("a"))).rejects.toMatchObject({details: {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"}});
    expect(states.get("a")!.adminReady).toBe(true); expect(states.get("b")!.adminReady).toBe(false); expect(safety!.readyAdminCount).toBe(1); expect(identities.get("b")!.disabled).toBe(true);
  });
  it.each(["disabled", "deleted", "unverified", "corrupt-count"])("corrects an already unusable sole admin without restoring it: %s", async failure => {
    if (failure === "deleted") identities.delete("a");
    else if (failure === "unverified") identities.get("a")!.emailVerified = false;
    else identities.get("a")!.disabled = true;
    if (failure === "corrupt-count") safety!.readyAdminCount = 0;
    await synchronizeUserSecurity("initial-a");
    expect(states.get("a")!.adminReady).toBe(false); expect(safety).toMatchObject({readyAdminCount: 0, status: "RECOVERY_REQUIRED"});
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("operator exact-address release recovers an unverified zero-admin hold before explicit activation", async () => {
    identities.get("a")!.emailVerified = false; await synchronizeUserSecurity("initial-a"); identities.get("a")!.emailVerified = true;
    await transitionUserSecurity({userId: "a", actorId: "approved-operator", actorKind: "OPERATOR", reason: "APPROVED_VERIFICATION_RELEASE", operationId: "operator-release-operation", releaseEmailVerification: true});
    expect(safety).toMatchObject({readyAdminCount: 1, status: "RECOVERY_REQUIRED"});
    await activateAdminSafetyControl({operationId: "activate-safety-operation", actorId: "operator", reason: "Reviewed recovery"}); expect(safety!.status).toBe("READY");
  });
  it("operator enable writes a changed disabled flag rather than accepting a no-op", async () => {
    seed("member", false); identities.get("member")!.disabled = true; Object.assign(states.get("member")!, {accessReady: false, desiredEnabled: false});
    await transitionUserSecurity({userId: "member", actorId: "operator", actorKind: "OPERATOR", reason: "ENABLE", authDisabled: false});
    expect(mocks.updateUser).toHaveBeenCalledWith("member", {disabled: false}); expect(states.get("member")!.securityVersion).toBe(2);
  });
  it("uncertain roster lookups fail closed without an Auth or database mutation", async () => {
    seed("b"); mocks.getUser.mockRejectedValueOnce(new Error("lookup outage"));
    await expect(transitionUserSecurity(intent("b"))).rejects.toThrow(); expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.setClaims).not.toHaveBeenCalled();
  });
  it("bounds conflicts, preserving the same operation identity", async () => {
    seed("b"); mocks.begin.mockRejectedValue(new Error("ADMIN_CONTROL_CONFLICT"));
    await expect(transitionUserSecurity(intent("b"))).rejects.toMatchObject({details: {code: "SECURITY_CONFLICT_RETRY"}});
    expect(mocks.begin).toHaveBeenCalledTimes(4); expect(mocks.setClaims).not.toHaveBeenCalled();
  });
  it("bootstrap records do not count before verified completion, and control creation/activation are replayable", async () => {
    const identity = identities.get("a")!; states.clear(); operations.clear(); safety = null;
    const create = {operationId: "create-control-operation", actorId: "operator", reason: "Reviewed fresh bootstrap"};
    await bootstrapAdminSafetyControl(create); await bootstrapAdminSafetyControl(create);
    await initializeUserSecurityState({userId: "a", actorId: "operator", actorKind: "OPERATOR", reason: "BOOTSTRAP", allowAdminBootstrap: true, operationId: "initialize-admin-operation"});
    expect(safety).toMatchObject({status: "BOOTSTRAP", readyAdminCount: 1}); expect(identity.customClaims.admin).toBe(true);
    const activate = {operationId: "activate-control-operation", actorId: "operator", reason: "Fresh roster verified"}; await activateAdminSafetyControl(activate); await activateAdminSafetyControl(activate);
    expect(mocks.create).toHaveBeenCalledOnce(); expect(mocks.activate).toHaveBeenCalledOnce();
    await expect(activateAdminSafetyControl({...activate, reason: "Another intent"})).rejects.toMatchObject({details: {code: "SECURITY_OPERATION_CONFLICT"}});
  });
  it("audited recount corrects drift without automatically enabling normal changes", async () => {
    safety!.readyAdminCount = 5;
    await reconcileAdminSafetyControl({operationId: "recount-control-operation", actorId: "operator", reason: "Frozen roster audit"});
    expect(safety).toMatchObject({readyAdminCount: 1, status: "BOOTSTRAP"});
  });
  it.each(["disabled", "deleted"])("scheduler corrects an unusable malformed adminReady-only row: %s", async failure => {
    states.get("a")!.accessReady = false;
    if (failure === "deleted") identities.delete("a"); else identities.get("a")!.disabled = true;
    await synchronizeUserSecurity("initial-a");
    expect(safety).toMatchObject({readyAdminCount: 0, status: "RECOVERY_REQUIRED"}); expect(states.get("a")!.adminReady).toBe(false);
  });

  it("verified established sign-in reconciliation is a bound no-op for a healthy sole admin", async () => {
    await transitionUserSecurity({userId: "a", actorId: "a", actorKind: "SELF_VERIFICATION", actorSecurityVersion: 1,
      reason: "VERIFIED_EMAIL_RECONCILIATION", releaseEmailVerification: true, operationId: "existing-verification-operation"});
    expect(mocks.noop).toHaveBeenCalledOnce(); expect(mocks.begin).not.toHaveBeenCalled();
    expect(states.get("a")).toMatchObject({adminReady: true, accessReady: true, securityVersion: 1}); expect(safety!.readyAdminCount).toBe(1);
  });
  it("cannot self-release an unheld restriction", async () => {
    Object.assign(states.get("a")!, {accessReady: false, adminReady: false, desiredEnabled: false}); safety!.readyAdminCount = 0;
    await expect(transitionUserSecurity({userId: "a", actorId: "a", actorKind: "SELF_VERIFICATION", actorSecurityVersion: 1,
      reason: "VERIFIED_EMAIL_RECONCILIATION", releaseEmailVerification: true})).rejects.toThrow("intended new email");
    expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.setClaims).not.toHaveBeenCalled();
  });

  it("operator repair binds its own receipt without deriving a grant from active profile/Auth", async () => {
    seed("member", false); Object.assign(states.get("member")!, {desiredEnabled: false, accessReady: false});
    Object.assign(operations.get("initial-member"), {desiredEnabled: false, accessReady: false});
    const request = {userId: "member", actorId: "operator", actorKind: "OPERATOR" as const, reason: "Reviewed repair", operationId: "operator-repair-reference"};
    await repairUserSecurity(request); await repairUserSecurity(request);
    expect(states.get("member")).toMatchObject({desiredEnabled: false, accessReady: false, securityVersion: 1});
    expect(identities.get("member")!.customClaims.enabled).toBe(false); expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.noop).toHaveBeenCalledOnce();
    await expect(transitionUserSecurity({...request, authDisabled: false})).rejects.toMatchObject({details: {code: "SECURITY_OPERATION_CONFLICT"}});
  });
  it("operator repair refuses missing state rather than bootstrapping it", async () => {
    await expect(repairUserSecurity({userId: "missing", actorId: "operator", actorKind: "OPERATOR", reason: "Repair", operationId: "missing-repair-reference"})).rejects.toThrow("cannot initialize");
    expect(mocks.initialize).not.toHaveBeenCalled();
  });

  it("an ordinary change observing a deleted sole administrator corrects drift rather than pretending last-admin refusal protects it", async () => {
    identities.delete("a");
    await expect(transitionUserSecurity(intent("a"))).rejects.toMatchObject({details: {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"}});
    expect(safety).toMatchObject({readyAdminCount: 0, status: "RECOVERY_REQUIRED"}); expect(states.get("a")!.adminReady).toBe(false);
  });

  it("explicit frozen control recovery counts only flags until unusable identities are denied and separately recovered", async () => {
    safety = null; identities.get("a")!.disabled = true;
    const request = {operationId: "recovery-control-reference", actorId: "operator", reason: "Approved frozen recovery", recoverObservedDrift: true};
    await bootstrapAdminSafetyControl(request); await bootstrapAdminSafetyControl(request);
    expect(safety).toMatchObject({readyAdminCount: 1, status: "BOOTSTRAP"}); expect(mocks.getUser).not.toHaveBeenCalled();
    await expect(bootstrapAdminSafetyControl({...request, recoverObservedDrift: false})).rejects.toMatchObject({details: {code: "SECURITY_OPERATION_CONFLICT"}});
    const recount = {operationId: "recovery-recount-reference", actorId: "operator", reason: "Observed roster audit"};
    await expect(reconcileAdminSafetyControl(recount)).rejects.toMatchObject({details: {code: "ADMIN_SAFETY_RECOVERY_REQUIRED"}});
    await reconcileAdminSafetyControl(recount);
    expect(safety).toMatchObject({readyAdminCount: 0, status: "RECOVERY_REQUIRED"}); expect(identities.get("a")!.disabled).toBe(true);
    await expect(activateAdminSafetyControl({operationId: "too-early-activation-reference", actorId: "operator", reason: "No usable admins"})).rejects.toThrow("ADMIN_ROSTER_CONFLICT");
    await transitionUserSecurity({userId: "a", actorId: "operator", actorKind: "OPERATOR", reason: "Explicit approved enable", authDisabled: false, operationId: "recovery-enable-reference"});
    await activateAdminSafetyControl({operationId: "recovered-activation-reference", actorId: "operator", reason: "Fresh verified roster"});
    expect(safety).toMatchObject({readyAdminCount: 1, status: "READY"});
  });
  it("ordinary control creation still refuses unusable administrators without creating a control", async () => {
    safety = null; identities.get("a")!.disabled = true;
    await expect(bootstrapAdminSafetyControl({operationId: "strict-create-reference", actorId: "operator", reason: "Normal bootstrap"})).rejects.toThrow("Resolve administrator drift");
    expect(safety).toBeNull(); expect(mocks.create).not.toHaveBeenCalled();
  });

  it("unknown Auth lookup after recovery creation leaves BOOTSTRAP without activating, recounting or restoring identity", async () => {
    safety = null;
    await bootstrapAdminSafetyControl({operationId: "unknown-recovery-reference", actorId: "operator", reason: "Approved frozen recovery", recoverObservedDrift: true});
    mocks.getUser.mockRejectedValue(new Error("temporary Auth outage"));
    await expect(activateAdminSafetyControl({operationId: "unknown-activation-reference", actorId: "operator", reason: "Audit"})).rejects.toMatchObject({code: "unavailable"});
    await expect(reconcileAdminSafetyControl({operationId: "unknown-recount-reference", actorId: "operator", reason: "Audit"})).rejects.toMatchObject({code: "unavailable"});
    expect(safety).toMatchObject({readyAdminCount: 1, status: "BOOTSTRAP"});
    expect(mocks.activate).not.toHaveBeenCalled(); expect(mocks.recount).not.toHaveBeenCalled(); expect(mocks.setClaims).not.toHaveBeenCalled(); expect(mocks.updateUser).not.toHaveBeenCalled();
  });

});
