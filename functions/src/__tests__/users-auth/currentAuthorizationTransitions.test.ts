import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({getUser: vi.fn(), setClaims: vi.fn(), updateUser: vi.fn(), revoke: vi.fn(),
  lookup: vi.fn(), operation: vi.fn(), initialize: vi.fn(), begin: vi.fn(), complete: vi.fn(), failure: vi.fn(), supersede: vi.fn(), profile: vi.fn()}));
vi.mock("firebase-admin", () => ({auth: () => ({getUser: mocks.getUser, setCustomUserClaims: mocks.setClaims, updateUser: mocks.updateUser, revokeRefreshTokens: mocks.revoke})}));
vi.mock("../../securityRepository", () => ({getUserSecurityState: mocks.lookup, getSecurityTransition: mocks.operation,
  initializeUserSecurityState: mocks.initialize, beginSecurityTransition: mocks.begin, completeSecurityTransition: mocks.complete,
  recordSecuritySynchronizationFailure: mocks.failure, supersedeSecurityTransition: mocks.supersede}));
vi.mock("@dataconnect/admin-generated", () => ({getUserMembershipStatus: mocks.profile}));
import { initializeUserSecurityState, transitionUserSecurity, synchronizeUserSecurity } from "../../currentAuthorizationTransitions";
import { requireCurrentAuthorization } from "../../currentAuthorization";
type State = {userId: string; securityVersion: number; membershipStatus: string; desiredEnabled: boolean; desiredAdmin: boolean;
 accessReady: boolean; adminReady: boolean; operationId: string; syncStatus: string; user: {membershipStatus: string}};
let state: State | null;
let account: {disabled: boolean; emailVerified: boolean; email: string; customClaims: Record<string, unknown>};
let operations: Map<string, Record<string, any>>;
let events: string[];
const input = {userId: "member", actorId: "reviewer", reason: "RESTRICT", operationId: "operation-2", membershipStatus: "LOST" as const};
const token = {auth: {uid: "member", token: {enabled: true, admin: true, securityVersion: 1}}};
beforeEach(() => {
  vi.resetAllMocks(); events = []; operations = new Map();
  state = {userId: "member", securityVersion: 1, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: false,
    accessReady: true, adminReady: false, operationId: "old", syncStatus: "READY", user: {membershipStatus: "REGULAR"}};
  account = {disabled: false, emailVerified: true, email: "old@example.org", customClaims: {enabled: true, admin: false, securityVersion: 1, unrelated: "kept"}};
  mocks.lookup.mockImplementation(async () => ({data: {userSecurityState: state && structuredClone(state)}}));
  mocks.operation.mockImplementation(async ({operationId}) => ({data: {securityTransition: operations.get(operationId) ?? null}}));
  mocks.profile.mockResolvedValue({data: {user: {membershipStatus: "REGULAR"}}});
  mocks.getUser.mockImplementation(async () => structuredClone(account));
  mocks.updateUser.mockImplementation(async (_id, updates) => {Object.assign(account, updates); return structuredClone(account);});
  mocks.setClaims.mockImplementation(async (_id, claims) => {events.push("auth"); account.customClaims = claims;});
  mocks.begin.mockImplementation(async values => {
    events.push("database-denial");
    if (!state || state.securityVersion !== values.expectedVersion || state.user.membershipStatus !== values.expectedMembershipStatus) throw new Error("SECURITY_STATE_CONFLICT");
    state = {...state, ...values, securityVersion: values.nextVersion, accessReady: false, adminReady: false, syncStatus: "PENDING", user: {membershipStatus: values.membershipStatus}};
    operations.set(values.operationId, {...values, securityVersion: values.nextVersion, syncStatus: "PENDING"});
  });
  mocks.initialize.mockImplementation(async values => {
    state = {...values, securityVersion: 1, accessReady: false, adminReady: false, syncStatus: "PENDING", user: {membershipStatus: values.membershipStatus}};
    operations.set(values.operationId, {...values, securityVersion: 1, syncStatus: "PENDING"});
  });
  mocks.complete.mockImplementation(async values => {
    events.push("database-ready");
    if (!state || state.securityVersion !== values.securityVersion || state.operationId !== values.operationId || state.user.membershipStatus !== values.membershipStatus) throw new Error("SECURITY_STATE_CONFLICT");
    state = {...state, ...values, syncStatus: "READY"}; operations.get(values.operationId)!.syncStatus = "READY";
  });
  mocks.supersede.mockImplementation(async ({operationId}) => {operations.get(operationId)!.syncStatus = "SUPERSEDED";});
});
describe("durable security transition", () => {
  it("commits profile/version/denial before changing Auth and verifies the mirror before readiness", async () => {
    await transitionUserSecurity(input);
    expect(events).toEqual(["database-denial", "auth", "database-ready"]);
    expect(state).toMatchObject({securityVersion: 2, membershipStatus: "LOST", accessReady: false, syncStatus: "READY"});
    expect(account.customClaims).toMatchObject({enabled: false, securityVersion: 2, unrelated: "kept"});
    expect(mocks.revoke).toHaveBeenCalledWith("member");
  });
  it("denies the exact old identity after restriction even when Auth fails", async () => {
    mocks.setClaims.mockRejectedValueOnce(new Error("Auth unavailable"));
    await expect(transitionUserSecurity(input)).rejects.toThrow("Auth unavailable");
    expect(state).toMatchObject({securityVersion: 2, accessReady: false, syncStatus: "PENDING"});
    await expect(requireCurrentAuthorization(structuredClone(token) as never)).rejects.toMatchObject({details: {code: "ACCESS_REVOKED"}});
    expect(mocks.failure).toHaveBeenCalledWith({operationId: "operation-2", errorCode: "AUTH_SYNCHRONIZATION_FAILED"});
    expect(mocks.complete).not.toHaveBeenCalled();
    await synchronizeUserSecurity("operation-2");
    expect(state!.syncStatus).toBe("READY");
  });
  it("increments again on restoration so the original token never becomes valid", async () => {
    await transitionUserSecurity(input);
    await transitionUserSecurity({...input, reason: "RESTORE", operationId: "operation-3", membershipStatus: "REGULAR"});
    expect(state).toMatchObject({securityVersion: 3, accessReady: true});
    await expect(requireCurrentAuthorization(structuredClone(token) as never)).rejects.toMatchObject({details: {code: "SESSION_VERSION_STALE"}});
    await expect(requireCurrentAuthorization({auth: {uid: "member", token: {securityVersion: 3}}} as never)).resolves.toMatchObject({securityVersion: 3, isAdmin: false});
  });
  it("reuses a durable operation without incrementing its version", async () => {
    await transitionUserSecurity(input); await transitionUserSecurity(input);
    expect(mocks.begin).toHaveBeenCalledTimes(1); expect(state!.securityVersion).toBe(2);
  });
  it("rejects reuse by another actor or user", async () => {
    await transitionUserSecurity(input);
    await expect(transitionUserSecurity({...input, actorId: "other"})).rejects.toThrow("reference already used");
  });
  it("does not bootstrap a missing authority during an ordinary change", async () => {
    state = null;
    await expect(transitionUserSecurity(input)).rejects.toThrow("initialized by an operator");
    expect(mocks.initialize).not.toHaveBeenCalled();
  });
  it("cannot make a superseded version ready after a late Auth response", async () => {
    mocks.setClaims.mockImplementationOnce(async (_id, claims) => {
      account.customClaims = claims;
      state = {...state!, securityVersion: 3, operationId: "newer", accessReady: false, adminReady: false, syncStatus: "PENDING"};
    });
    await expect(transitionUserSecurity(input)).rejects.toThrow("SECURITY_STATE_CONFLICT");
    expect(state).toMatchObject({securityVersion: 3, operationId: "newer", accessReady: false});
    await synchronizeUserSecurity("operation-2");
    expect(mocks.supersede).toHaveBeenCalledWith({operationId: "operation-2"});
    expect(operations.get("operation-2")!.syncStatus).toBe("SUPERSEDED");
  });
  it("does not write Auth after a database CAS failure", async () => {
    mocks.begin.mockRejectedValueOnce(new Error("SECURITY_STATE_CONFLICT"));
    await expect(transitionUserSecurity(input)).rejects.toThrow("SECURITY_STATE_CONFLICT");
    expect(mocks.setClaims).not.toHaveBeenCalled();
  });
  it.each([{disabled: true}, {emailVerified: false}])("rejects a new administrator whose identity is not ready: %s", async change => {
    Object.assign(account, change);
    await expect(transitionUserSecurity({...input, membershipStatus: "REGULAR", admin: true})).rejects.toThrow("active verified member");
    expect(mocks.begin).not.toHaveBeenCalled();
  });
  it("blocks database access before the supported Auth disable", async () => {
    await transitionUserSecurity({...input, membershipStatus: "REGULAR", authDisabled: true});
    expect(state!.accessReady).toBe(false); expect(account.disabled).toBe(true);
  });
  it("blocks account access for email reverification", async () => {
    await transitionUserSecurity({...input, membershipStatus: "REGULAR", verificationEmail: "new@example.org"});
    expect(state!.accessReady).toBe(false); expect(account.customClaims.enabled).toBe(false);
  });
  it("initializes only the explicitly approved bootstrap role", async () => {
    state = null; account.customClaims.admin = true;
    await initializeUserSecurityState({userId: "member", actorId: "operator", reason: "BOOTSTRAP"});
    expect(state!.adminReady).toBe(false);
  });
  it("supports audited first-administrator bootstrap", async () => {
    state = null; account.customClaims.admin = true;
    await initializeUserSecurityState({userId: "member", actorId: "operator", reason: "BOOTSTRAP", allowAdminBootstrap: true});
    expect(state!.adminReady).toBe(true); expect(account.customClaims.securityVersion).toBe(1);
  });
  it("repairs a late old Auth write after the newer version already became READY", async () => {
    await transitionUserSecurity(input);
    await transitionUserSecurity({...input, reason: "RESTORE", operationId: "operation-3", membershipStatus: "REGULAR"});
    account.customClaims = {enabled: false, admin: false, securityVersion: 2};
    await synchronizeUserSecurity("operation-3");
    expect(account.customClaims).toMatchObject({enabled: true, securityVersion: 3});
    expect(state).toMatchObject({securityVersion: 3, accessReady: true, syncStatus: "READY"});
  });
  it("a READY sweep restricts an externally disabled account rather than undoing the disable", async () => {
    await transitionUserSecurity({...input, membershipStatus: "REGULAR"});
    account.disabled = true;
    await synchronizeUserSecurity("operation-2");
    expect(account.disabled).toBe(true);
    expect(state).toMatchObject({securityVersion: 3, accessReady: false});
  });
  it("binds duplicate operation IDs to every requested action and flag", async () => {
    await transitionUserSecurity(input);
    await expect(transitionUserSecurity({...input, membershipStatus: "REGULAR"})).rejects.toThrow("reference already used");
  });
  it("the old verified email cannot release the new-address verification hold", async () => {
    await transitionUserSecurity({...input, membershipStatus: "REGULAR", verificationEmail: "new@example.org"});
    await expect(transitionUserSecurity({userId: "member", actorId: "member", reason: "VERIFY", releaseEmailVerification: true})).rejects.toThrow("intended new email");
    expect(state!.accessReady).toBe(false);
    account.email = "new@example.org";
    await transitionUserSecurity({userId: "member", actorId: "member", reason: "VERIFY", releaseEmailVerification: true});
    expect(state).toMatchObject({securityVersion: 3, accessReady: true});
  });

  it("binds initial unverified identity to its intended address and restores only after exact verification", async () => {
    state = null; account.emailVerified = false;
    await initializeUserSecurityState({userId: "member", actorId: "operator", reason: "BOOTSTRAP"});
    expect(state).toMatchObject({accessReady: false, verificationEmail: "old@example.org"});
    account.emailVerified = true; account.email = "different@example.org";
    await expect(transitionUserSecurity({userId: "member", actorId: "member", reason: "VERIFY", releaseEmailVerification: true})).rejects.toThrow("intended new email");
    account.email = "old@example.org";
    await transitionUserSecurity({userId: "member", actorId: "member", reason: "VERIFY", releaseEmailVerification: true});
    expect(state).toMatchObject({securityVersion: 2, accessReady: true, verificationEmail: null});
  });

});
