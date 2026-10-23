import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({control: vi.fn(), pending: vi.fn(), states: vi.fn(), ledgers: vi.fn(), transition: vi.fn(), state: vi.fn(), complete: vi.fn(),
  getUser: vi.fn(), getUsers: vi.fn(), setClaims: vi.fn(), revoke: vi.fn(), info: vi.fn()}));
vi.mock("firebase-functions/v2/scheduler", () => ({onSchedule: (_options: unknown, handler: unknown) => handler}));
vi.mock("firebase-functions/logger", () => ({info: mocks.info, warn: vi.fn()}));
vi.mock("firebase-admin", () => ({auth: () => ({getUser: mocks.getUser, getUsers: mocks.getUsers, setCustomUserClaims: mocks.setClaims, revokeRefreshTokens: mocks.revoke})}));
vi.mock("@dataconnect/admin-generated", () => ({getUserMembershipStatus: vi.fn()}));
vi.mock("../../securityRepository", () => ({getAdminSafetyControl: mocks.control, listPendingSecurityTransitions: mocks.pending,
  listSecurityStatesForReconciliation: mocks.states, listSecurityTransitionsForReconciliation: mocks.ledgers, getSecurityTransition: mocks.transition,
  getUserSecurityState: mocks.state, completeSecurityTransition: mocks.complete, supersedeSecurityTransition: vi.fn(), recordSecuritySynchronizationFailure: vi.fn()}));
import { reconcilePendingSecurityTransitions } from "../../securityReconciliation";
const run = () => (reconcilePendingSecurityTransitions as unknown as () => Promise<void>)();
let current: any;
let account: any;
let operations: Map<string, any>;
function operation(state: any) {return {...state, noOp: false, authDisabled: null};}
beforeEach(() => {
  vi.resetAllMocks();
  current = {userId: "member", operationId: "old", securityVersion: 1, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: false,
    accessReady: true, adminReady: false, syncStatus: "READY", verificationEmail: null, user: {membershipStatus: "REGULAR"}};
  account = {uid: "member", disabled: false, emailVerified: true, customClaims: {enabled: true, admin: false, securityVersion: 1, unrelated: "latest"}};
  operations = new Map([[current.operationId, operation(current)]]);
  mocks.control.mockResolvedValue({data: {adminSafetyControl: {status: "READY", version: 1, readyAdminCount: 2}}});
  mocks.pending.mockImplementation(async () => ({data: {securityTransitions: [...operations.values()].filter(row => row.syncStatus === "PENDING").map(row => ({operationId: row.operationId}))}}));
  mocks.states.mockImplementation(async () => ({data: {userSecurityStates: [structuredClone(current)]}}));
  mocks.ledgers.mockImplementation(async ({operationIds}) => ({data: {securityTransitions: operationIds.map((id: string) => structuredClone(operations.get(id))).filter(Boolean)}}));
  mocks.transition.mockImplementation(async ({operationId}) => ({data: {securityTransition: structuredClone(operations.get(operationId))}}));
  mocks.state.mockImplementation(async () => ({data: {userSecurityState: structuredClone(current)}}));
  mocks.getUsers.mockImplementation(async () => ({users: [structuredClone(account)], notFound: []}));
  mocks.getUser.mockImplementation(async () => structuredClone(account));
  mocks.setClaims.mockImplementation(async (_uid, claims) => {account.customClaims = structuredClone(claims);});
  mocks.complete.mockImplementation(async ({operationId, securityVersion, accessReady, adminReady}) => {
    if (current.operationId !== operationId || current.securityVersion !== securityVersion) throw new Error("SECURITY_STATE_CONFLICT");
    current = {...current, accessReady, adminReady, syncStatus: "READY"}; operations.get(operationId).syncStatus = "READY";
  });
});
function beginNewDenial() {
  current = {...current, operationId: "new-denial", securityVersion: 2, desiredEnabled: false, accessReady: false, syncStatus: "PENDING"};
  operations.set(current.operationId, operation(current));
}

describe("batch snapshots never become authority for reconciliation writes", () => {
  it.each(["page", "ledger", "Auth"])("can only skip when a new denial commits after the %s snapshot; the next sweep completes current authority", async stage => {
    if (stage === "page") mocks.states.mockImplementationOnce(async () => {const snapshot = structuredClone(current); beginNewDenial(); return {data: {userSecurityStates: [snapshot]}};});
    if (stage === "ledger") mocks.ledgers.mockImplementationOnce(async () => {const snapshot = structuredClone(operations.get("old")); beginNewDenial(); return {data: {securityTransitions: [snapshot]}};});
    if (stage === "Auth") mocks.getUsers.mockImplementationOnce(async () => {const snapshot = structuredClone(account); beginNewDenial(); return {users: [snapshot], notFound: []};});
    await run();
    expect(current).toMatchObject({operationId: "new-denial", securityVersion: 2, accessReady: false, syncStatus: "PENDING"});
    expect(mocks.setClaims).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled(); expect(mocks.getUser).not.toHaveBeenCalled();
    await run();
    expect(current).toMatchObject({operationId: "new-denial", securityVersion: 2, accessReady: false, syncStatus: "READY"});
    expect(account.customClaims).toEqual({enabled: false, admin: false, securityVersion: 2, unrelated: "latest"});
    expect(mocks.setClaims).toHaveBeenCalledOnce(); expect(mocks.revoke).toHaveBeenCalledOnce();
  });
  it("fresh fallback follows a superseding generation without overwriting its claims", async () => {
    mocks.getUsers.mockImplementationOnce(async () => {
      beginNewDenial(); account.customClaims = {...account.customClaims, enabled: false, securityVersion: 2};
      return {users: [structuredClone(account)], notFound: []};
    });
    await run();
    expect(mocks.transition).toHaveBeenCalledWith({operationId: "old"});
    expect(mocks.setClaims).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled();
    expect(account.customClaims).toMatchObject({enabled: false, securityVersion: 2});
  });
  it("repairs drift using fresh Auth claims, preserving changes absent from the batch snapshot", async () => {
    mocks.getUsers.mockResolvedValue({users: [{...account, customClaims: {enabled: true, admin: false, securityVersion: 0, unrelated: "stale"}}], notFound: []});
    account.customClaims = {enabled: true, admin: false, securityVersion: 0, unrelated: "fresh", anotherClaim: true};
    await run();
    expect(account.customClaims).toEqual({enabled: true, admin: false, securityVersion: 1, unrelated: "fresh", anotherClaim: true});
    expect(mocks.getUser).toHaveBeenCalledOnce(); expect(mocks.setClaims).toHaveBeenCalledOnce(); expect(mocks.state).toHaveBeenCalledTimes(2);
  });
  it.each([{desiredAdmin: true, adminReady: true}, {desiredAdmin: true, adminReady: false}, {desiredAdmin: false, adminReady: true}])("always freshly checks administrator authority: %j", async flags => {
    current = {...current, ...flags}; operations.set(current.operationId, operation(current)); account.customClaims.admin = flags.desiredAdmin;
    if (!flags.desiredAdmin) mocks.getUser.mockRejectedValue(new Error("temporary"));
    await run();
    expect(mocks.getUsers).not.toHaveBeenCalled(); expect(mocks.ledgers).not.toHaveBeenCalled();
    expect(mocks.getUser).toHaveBeenCalledWith("member"); expect(mocks.state).toHaveBeenCalled();
  });
  it("aggregates service phase costs and fresh fallback after a failed batch, resetting each invocation", async () => {
    let elapsed = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => elapsed);
    mocks.pending.mockResolvedValue({data: {securityTransitions: [{operationId: "old"}]}});
    mocks.states.mockImplementation(async () => {elapsed += 5; return {data: {userSecurityStates: [structuredClone(current)]}};});
    mocks.ledgers.mockImplementation(async () => {elapsed += 3; return {data: {securityTransitions: [structuredClone(operations.get("old"))]}};});
    mocks.getUsers.mockImplementationOnce(async () => {elapsed += 7; throw new Error("temporary");});
    mocks.getUser.mockImplementation(async () => {elapsed += 11; return structuredClone(account);});
    try {
      await run();
      expect(mocks.info).toHaveBeenLastCalledWith("Security reconciliation completed", {
        pendingAttempts: 1, stateAttempts: 1, failedAttempts: 0, healthyMirrorChecks: 0, durationMs: 37,
        phaseMetrics: {statePageReads: 1, statePageReadDurationMs: 5, statePages: 1, maxStatePageDurationMs: 26,
          pendingRepairs: 1, pendingRepairDurationMs: 11, stateRepairs: 1, stateRepairDurationMs: 11,
          ledgerReads: 1, ledgerReadDurationMs: 3, ledgerReadFailures: 0, authBatchReads: 1, authBatchReadDurationMs: 7, authBatchReadFailures: 1},
      });
      await run();
      expect(mocks.info).toHaveBeenLastCalledWith("Security reconciliation completed", expect.objectContaining({
        healthyMirrorChecks: 1, phaseMetrics: expect.objectContaining({statePageReads: 1, ledgerReads: 1, authBatchReads: 1,
          authBatchReadFailures: 0, stateRepairs: 0, stateRepairDurationMs: 0, pendingRepairs: 1, pendingRepairDurationMs: 11}),
      }));
      expect(mocks.setClaims).not.toHaveBeenCalled();
    } finally {clock.mockRestore();}
  });

  it("uses fresh lookups after missing identities and a transient batch failure", async () => {
    mocks.getUsers.mockResolvedValueOnce({users: [], notFound: [{uid: "member"}]}).mockRejectedValueOnce(new Error("temporary"));
    await run(); await run();
    expect(mocks.getUser).toHaveBeenCalledTimes(2); expect(mocks.setClaims).not.toHaveBeenCalled();
  });
});
