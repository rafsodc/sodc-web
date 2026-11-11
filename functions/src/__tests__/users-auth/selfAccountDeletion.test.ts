import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({getUser: vi.fn(), get: vi.fn(), write: vi.fn(), transition: vi.fn(), remove: vi.fn(), revoke: vi.fn(), requireEnabled: vi.fn(), marker: vi.fn(), start: vi.fn(), drain: vi.fn(), cancel: vi.fn(), complete: vi.fn(), state: vi.fn(), intent: vi.fn(), rate: vi.fn()}));
vi.mock("firebase-admin", () => ({auth: () => ({getUser: mocks.getUser, deleteUser: mocks.remove, revokeRefreshTokens: mocks.revoke})}));
vi.mock("firebase-admin/data-connect", () => ({getDataConnect: () => ({executeGraphqlRead: mocks.get, executeGraphql: mocks.write})}));
vi.mock("../../helpers", async original => ({...await original<typeof import("../../helpers")>(), requireEnabled: mocks.requireEnabled}));
vi.mock("../../currentAuthorizationTransitions", async original => ({...await original<typeof import("../../currentAuthorizationTransitions")>(), transitionUserSecurity: mocks.transition}));
vi.mock("../../rateLimiter", () => ({enforceRateLimit: mocks.rate}));
vi.mock("../../securityRepository", () => ({getUserSecurityState: mocks.state, getSecurityTransition: mocks.intent}));
vi.mock("../../accountErasureState", () => ({accountErasureState: mocks.marker, startAccountErasure: mocks.start,
  drainAccountCommunications: mocks.drain, cancelErasureTasks: mocks.cancel, completeAccountErasure: mocks.complete}));
import { deleteMyAccount } from "../../selfAccountDeletion";

const uid = "self-delete-member", email = "member@example.invalid", operationId = "self-deletion-operation-reference";
const request = (data = {}, token = {}) => ({auth: {uid, token: {securityVersion: 7, auth_time: Date.now() / 1000, ...token}}, data: {email, operationId, ...data}} as never);
const apply = (data = {}, token = {}) => request({apply: true, confirmMembershipEnd: true, ...data}, token);
let rows: Record<string, any[]>;
let identity: any, state: any, intent: any, removed: boolean;
beforeEach(() => {
  vi.resetAllMocks();
  removed = false;
  identity = {uid, email, disabled: false, emailVerified: true, customClaims: {enabled: true, admin: false, securityVersion: 7}};
  state = {userId: uid, user: {id: uid, membershipStatus: "REGULAR"}, membershipStatus: "REGULAR", operationId: "existing-operation", securityVersion: 7, syncStatus: "READY", accessReady: true, desiredEnabled: true, desiredAdmin: false, adminReady: false};
  intent = null;
  rows = {users: [{id: uid, email}], userSecurityStates: [state]};
  mocks.state.mockImplementation(async () => ({data: {userSecurityState: state}}));
  mocks.intent.mockImplementation(async () => ({data: {securityTransition: intent}}));
  mocks.marker.mockResolvedValue([]);
  mocks.start.mockResolvedValue({startedAt: "2026-01-01T00:00:00Z"});
  mocks.getUser.mockImplementation(async (id: string) => {expect(id).toBe(uid); if (removed) throw {code: "auth/user-not-found"}; return identity;});
  mocks.get.mockImplementation(async (query: string, options?: {variables?: Record<string, string>}) => {
    if (query.includes("SnapshotForErasure")) return {data: {announcementSend: rows.announcementSends?.find(row => row.id === options?.variables?.id) ?? null}};
    const table = query.match(/\{ (\w+)\(/)![1];
    const offset = Number(query.match(/offset: (\d+)/)?.[1] ?? 0), limit = Number(query.match(/limit: (\d+)/)?.[1] ?? 250);
    return {data: {[table]: (rows[table] ?? []).slice(offset, offset + limit)}};
  });
  mocks.transition.mockImplementation(async () => {
    state = {...state, user: {...state.user, membershipStatus: "RESIGNED"}, membershipStatus: "RESIGNED", securityVersion: 8, operationId, accessReady: false, desiredEnabled: false};
    rows.userSecurityStates = [state];
    intent = {userId: uid, actorId: uid, actorKind: "SELF", actorSecurityVersion: 7, securityVersion: 8, operationId, reason: "ACCOUNT_DELETION", authDisabled: true, syncStatus: "READY", desiredEnabled: false, desiredAdmin: false, membershipStatus: "RESIGNED"};
    identity = {...identity, disabled: true, customClaims: {...identity.customClaims, enabled: false, securityVersion: 8}};
  });
  mocks.write.mockImplementation(async () => {rows = {}; return {data: {fence: 1}};});
  mocks.remove.mockImplementation(async () => {removed = true;});
});

it("requires current member authority before inspecting personal data", async () => {
  mocks.requireEnabled.mockRejectedValue(new Error("access revoked"));
  await expect(deleteMyAccount.run(request())).rejects.toThrow("access revoked");
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
});
it("rejects a supplied target or retention override", async () => {
  for (const data of [{uid: "another-member"}, {uid}, {noRetention: true}, {noRetention: false}]) {
    await expect(deleteMyAccount.run(apply(data))).rejects.toMatchObject({code: "invalid-argument"});
  }
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("previews only eligibility without leaking inventory or changing membership", async () => {
  await expect(deleteMyAccount.run(request())).resolves.toEqual({eligible: true});
  expect(mocks.rate).toHaveBeenCalledWith("deleteMyAccount", uid);
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.transition).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("keeps administrator, uninitialized and interrupted accounts out of self deletion", async () => {
  identity.customClaims.admin = true;
  await expect(deleteMyAccount.run(request())).resolves.toEqual({eligible: false});
  await expect(deleteMyAccount.run(apply())).rejects.toThrow("administrator's help");
  identity.customClaims.admin = false;
  state.desiredAdmin = true;
  await expect(deleteMyAccount.run(request())).resolves.toEqual({eligible: false});
  state.desiredAdmin = false;
  rows.userSecurityStates = [];
  await expect(deleteMyAccount.run(request())).resolves.toEqual({eligible: false});
  rows.userSecurityStates = [state];
  mocks.marker.mockResolvedValue([{emailHash: "minimal-marker"}]);
  await expect(deleteMyAccount.run(request())).resolves.toEqual({eligible: false});
  expect(mocks.start).not.toHaveBeenCalled();
});
it("preserves financial and other blocked records without starting deletion", async () => {
  rows.bookings = [{booker: {id: uid}}];
  await expect(deleteMyAccount.run(request())).resolves.toEqual({eligible: false});
  await expect(deleteMyAccount.run(apply())).rejects.toThrow("administrator's help");
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.transition).not.toHaveBeenCalled();
});
it("requires the confirmed current verified email and security version", async () => {
  for (const changed of [{email: "changed@example.invalid"}, {emailVerified: false}, {disabled: true}, {customClaims: {enabled: true, securityVersion: 8}}]) {
    const before = identity; identity = {...identity, ...changed};
    await expect(deleteMyAccount.run(apply())).rejects.toThrow("account changed");
    identity = before;
  }
  expect(mocks.start).not.toHaveBeenCalled();
});
it("requires recent sign-in and acknowledgement before inventory or mutation", async () => {
  for (const auth_time of [undefined, Date.now() / 1000 - 301, Date.now() / 1000 + 60]) {
    await expect(deleteMyAccount.run(apply({}, {auth_time}))).rejects.toMatchObject({details: {code: "RECENT_LOGIN_REQUIRED"}});
  }
  await expect(deleteMyAccount.run(apply({confirmMembershipEnd: false}))).rejects.toThrow("ends your membership");
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("ends membership, drains communications and verifies deletion using the exact self hold", async () => {
  await expect(deleteMyAccount.run(apply())).resolves.toEqual({deleted: true});
  expect(mocks.transition).toHaveBeenCalledWith({userId: uid, actorId: uid, actorKind: "SELF", actorSecurityVersion: 7, reason: "ACCOUNT_DELETION", operationId, membershipStatus: "RESIGNED", admin: false, authDisabled: true});
  expect(mocks.drain).toHaveBeenCalledOnce();
  const [query, options] = mocks.write.mock.calls[0];
  expect(query).toContain("SELF_ERASURE_AUTHORITY_CHANGED");
  expect(query).not.toContain("selfAuthority: userSecurityState_updateMany");
  expect(query).toContain("fence: userSecurityState_deleteMany");
  expect(options.variables).toMatchObject({uid, actorId: uid, actorVersion: 7, targetVersion: 8, operationId});
  expect(mocks.remove).toHaveBeenCalledWith(uid);
  expect(mocks.complete).toHaveBeenCalledWith(uid);
});
it("rechecks the identity before entering a self hold", async () => {
  mocks.cancel.mockImplementation(async () => {identity.customClaims.admin = true;});
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.transition).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
it("refuses superseded or changed self holds after the drain", async () => {
  mocks.drain.mockImplementation(async () => {state = {...state, operationId: "different-hold", securityVersion: 9};});
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("refuses an intent with another actor even while the member remains disabled", async () => {
  mocks.drain.mockImplementation(async () => {intent.actorId = "another-member";});
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.write).not.toHaveBeenCalled();
});
it("stops when financial records appear during draining", async () => {
  mocks.drain.mockImplementation(async () => {rows.bookings = [{booker: {id: uid}}];});
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("does not delete Auth if the database transaction fails", async () => {
  mocks.write.mockRejectedValue(new Error("transaction refused"));
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});
it("does not report success while owned metadata remains after the transaction", async () => {
  mocks.write.mockImplementation(async () => {rows = {callableInvocations: [{userId: uid}]}; return {data: {fence: 1}};});
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("refuses to delete a changed Auth identity after profile removal", async () => {
  mocks.write.mockImplementation(async () => {rows = {}; identity.customClaims.securityVersion = 9; return {data: {fence: 1}};});
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("keeps a still-active communication lease for administrator recovery", async () => {
  rows.notificationDeliveries = [{user: {id: uid}, status: "PENDING", lastAttemptedAt: new Date().toISOString()}];
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("prunes shared announcements under the self hold without changing another recipient", async () => {
  const sendId = "10000000-0000-4000-8000-000000000001";
  const survivor = {sendId, recipientId: "other-member", email: "other@example.invalid", personalisation: {name: "Keep"}};
  rows.announcementSends = [{id: sendId, recipientCount: 2, skippedCount: 0,
    recipientSnapshot: JSON.stringify({version: 1, tasks: [{sendId, recipientId: uid, email}, survivor], skippedRecipients: []})}];
  mocks.write.mockImplementation(async (query: string, options: {variables: Record<string, any>}) => {
    if (query.includes("RedactMyAccountSnapshot")) {
      expect(options.variables).toMatchObject({uid, actorId: uid, operationId, actorVersion: 7, targetVersion: 8});
      expect(query).toContain("selfAuthority: userSecurityState_updateMany");
      rows.announcementSends[0].recipientSnapshot = options.variables.after0;
      rows.announcementSends[0].recipientCount = options.variables.recipientAfter0;
    } else rows = {announcementSends: rows.announcementSends};
    return {data: {fence: 1}};
  });
  await expect(deleteMyAccount.run(apply())).resolves.toEqual({deleted: true});
  expect(JSON.parse(rows.announcementSends[0].recipientSnapshot).tasks).toEqual([survivor]);
  expect(rows.announcementSends[0].recipientCount).toBe(1);
});
it("requires administrator recovery if Auth deletion fails after profile erasure", async () => {
  mocks.remove.mockRejectedValue(new Error("Auth unavailable"));
  await expect(deleteMyAccount.run(apply())).rejects.toMatchObject({details: {code: "ACCOUNT_DELETION_INCOMPLETE"}});
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(identity.disabled).toBe(true);
});
