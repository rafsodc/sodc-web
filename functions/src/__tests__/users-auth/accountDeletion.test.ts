import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({getUser: vi.fn(), get: vi.fn(), write: vi.fn(), transition: vi.fn(), remove: vi.fn(), revoke: vi.fn(), requireAdmin: vi.fn(), marker: vi.fn(), start: vi.fn(), drain: vi.fn(), cancel: vi.fn(), complete: vi.fn(), sync: vi.fn()}));
vi.mock("firebase-admin", () => ({auth: () => ({getUser: mocks.getUser, deleteUser: mocks.remove, revokeRefreshTokens: mocks.revoke})}));
vi.mock("firebase-admin/data-connect", () => ({getDataConnect: () => ({executeGraphqlRead: mocks.get, executeGraphql: mocks.write})}));
vi.mock("../../helpers", async original => ({...await original<typeof import("../../helpers")>(), requireAdmin: mocks.requireAdmin}));
vi.mock("../../currentAuthorizationTransitions", async original => ({...await original<typeof import("../../currentAuthorizationTransitions")>(), transitionUserSecurity: mocks.transition, synchronizeUserSecurity: mocks.sync}));
vi.mock("../../rateLimiter", () => ({enforceRateLimit: vi.fn()}));
vi.mock("../../securityRepository", () => ({
  getUserSecurityState: vi.fn(async () => ({data: {userSecurityState: {operationId: "deletion-operation-reference", securityVersion: 8}}})),
  getSecurityTransition: vi.fn(async () => ({data: {securityTransition: {userId: "target-account", syncStatus: "READY", securityVersion: 8}}})),
}));
vi.mock("../../accountErasureState", () => ({accountErasureState: mocks.marker, startAccountErasure: mocks.start,
  drainAccountCommunications: mocks.drain, cancelErasureTasks: mocks.cancel, completeAccountErasure: mocks.complete}));
import { deleteAccount, accountDeletionMatch } from "../../accountDeletion";
import { accountDeletionInventory } from "../../accountDeletionInventory";
import { getUserSecurityState, getSecurityTransition } from "../../securityRepository";
const uid = "target-account", email = "target@example.invalid", operationId = "deletion-operation-reference";
const request = (extra = {}) => ({auth: {uid: "actor", token: {securityVersion: 7}}, data: {uid, email, operationId, ...extra}} as never);
let rows: Record<string, unknown[]>;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.marker.mockResolvedValue([]);
  mocks.start.mockResolvedValue({startedAt: "2026-01-01T00:00:00Z"});
  rows = {users: [{id: uid, email}], userSecurityStates: [{user: {id: uid}, desiredAdmin: false, adminReady: false, syncStatus: "READY"}]};
  let removed = false;
  mocks.getUser.mockImplementation(async (id: string) => {
    if (id === "actor") return {uid: id, disabled: false, emailVerified: true, customClaims: {admin: true, enabled: true, securityVersion: 7}};
    if (removed) throw {code: "auth/user-not-found"};
    return {uid, email, disabled: true};
  });
  mocks.get.mockImplementation(async (query: string, options?: {variables?: Record<string, string>}) => {
    if (query.includes("SnapshotForErasure")) return {data: {announcementSend: (rows.announcementSends as any[] | undefined)?.find(row => row.id === options?.variables?.id) ?? null}};
    const table = query.match(/\{ (\w+)\(/)![1];
    const offset = Number(query.match(/offset: (\d+)/)?.[1] ?? 0), limit = Number(query.match(/limit: (\d+)/)?.[1] ?? 250);
    return {data: {[table]: (rows[table] ?? []).slice(offset, offset + limit)}};
  });
  mocks.write.mockImplementation(async () => {rows = {}; return {data: {fence: 1}};});
  mocks.remove.mockImplementation(async () => {removed = true;});
});
it("requires current admin authority before reading account data", async () => {
  mocks.requireAdmin.mockRejectedValue(new Error("denied"));
  await expect(deleteAccount.run(request())).rejects.toThrow("denied");
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it("preview is read only and self/admin deletion is refused", async () => {
  await expect(deleteAccount.run(request())).resolves.toMatchObject({eligible: true});
  expect(mocks.transition).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
  await expect(deleteAccount.run(request({uid: "actor"}))).rejects.toThrow("own account");
  const original = mocks.getUser.getMockImplementation()!;
  mocks.getUser.mockImplementation(async (id: string) => id === "actor" ? original(id) : {uid, email, customClaims: {admin: true}});
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toThrow("Administrator accounts");
});
it("blocks linked records before disabling or deleting the account", async () => {
  rows.bookings = [{booker: {id: uid}}];
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toThrow("Linked records");
  expect(mocks.transition).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("fences the actor and target in a transaction, then verifies removal", async () => {
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).resolves.toEqual({deleted: true});
  expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({authDisabled: true, actorKind: "ADMIN", actorSecurityVersion: 7}));
  const [query, options] = mocks.write.mock.calls[0];
  expect(query).toContain("@transaction");
  expect(query).toContain("SECURITY_ACTOR_REVOKED");
  expect(query).toContain("ACCOUNT_CHANGED");
  expect(options.variables).toMatchObject({actorId: "actor", actorVersion: 7, operationId});
  expect(mocks.remove).toHaveBeenCalledWith(uid);
});
it("never deletes Auth if database removal fails", async () => {
  mocks.write.mockRejectedValue(new Error("transaction failed"));
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toThrow("did not complete");
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("routes Auth-only accounts and orphan metadata to operators instead of offering deletion", async () => {
  rows = {};
  await expect(deleteAccount.run(request())).resolves.toMatchObject({eligible: false, needsOperator: true});
  const original = mocks.getUser.getMockImplementation()!;
  mocks.getUser.mockImplementation(async (id: string) => {if (id === "actor") return original(id); throw {code: "auth/user-not-found"};});
  rows = {callableInvocations: [{userId: uid}]};
  await expect(deleteAccount.run(request())).resolves.toMatchObject({eligible: false, needsOperator: true});
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toThrow("require review");
});
it("does not delete Auth or report success if eligible metadata remains after the transaction", async () => {
  mocks.write.mockImplementationOnce(async () => {rows = {callableInvocations: [{userId: uid}]}; return {data: {fence: 1}};});
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toThrow("did not complete");
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("accepts an already-disabled account only when the no-op receipt matches its version", async () => {
  vi.mocked(getUserSecurityState).mockResolvedValueOnce({data: {userSecurityState: {operationId: "previous-disable", securityVersion: 8}}} as never);
  vi.mocked(getSecurityTransition).mockResolvedValueOnce({data: {securityTransition: {userId: uid, syncStatus: "READY", securityVersion: 8, noOp: true}}} as never);
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).resolves.toEqual({deleted: true});
  expect(mocks.write.mock.calls[0][1].variables).toMatchObject({operationId: "previous-disable", targetVersion: 8});
});
it("a superseding security operation prevents profile and Auth deletion", async () => {
  vi.mocked(getUserSecurityState).mockResolvedValueOnce({data: {userSecurityState: {operationId: "different-operation", securityVersion: 9}}} as never);
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toThrow("changed during deletion");
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("detects snapshots and rejects other people's audit evidence", () => {
  expect(accountDeletionMatch("AnnouncementSend", {recipientSnapshot: JSON.stringify([{email}])}, uid, email)).toBe("block");
  expect(accountDeletionMatch("SecurityTransition", {userId: uid, actorId: "operator", syncStatus: "READY"}, uid, email)).toBe("block");
});
it("inventory stays aligned with every table and declared field", () => {
  const schema = readFileSync("../dataconnect/schema/schema.gql", "utf8").replace(/#[^\n]*/g, "");
  const tables = [...schema.matchAll(/type\s+(\w+)\s+(@table[^{}]*)\{([^}]+)\}/g)];
  expect(tables.length).toBe(accountDeletionInventory.length);
  for (const [, name, , body] of tables) {
    const entry = accountDeletionInventory.find(table => table.name === name);
    expect(entry).toBeDefined();
    for (const [, field] of body.matchAll(/^\s*(\w+):/gm)) expect(entry!.selection.split(/\W+/)).toContain(field);
    if (entry && "searchStrings" in entry) {
      expect([...entry.searchStrings].sort()).toEqual([...body.matchAll(/^\s*(\w+):\s*String[!\s]/gm)].map(match => match[1]).sort());
      expect([...entry.searchUserRefs].sort()).toEqual([...body.matchAll(/^\s*(\w+):\s*User[!\s]/gm)].map(match => `${match[1]}Id`).sort());
    }
  }
});

it("rechecks earlier records against historical addresses before offering deletion", async () => {
  const ownSend = "10000000-0000-4000-8000-000000000002";
  const otherSend = "10000000-0000-4000-8000-000000000001";
  const former = "former@example.invalid";
  rows.announcementSends = [
    {id: otherSend, recipientCount: 1, skippedCount: 0, recipientSnapshot: JSON.stringify({version: 1, tasks: [{sendId: otherSend, recipientId: "someone-else", email: former}], skippedRecipients: []})},
    {id: ownSend, recipientCount: 1, skippedCount: 0, recipientSnapshot: JSON.stringify({version: 1, tasks: [{sendId: ownSend, recipientId: uid, email: former}], skippedRecipients: []})},
  ];
  await expect(deleteAccount.run(request())).resolves.toMatchObject({eligible: false, blockers: ["AnnouncementSend"]});
  expect(mocks.start).not.toHaveBeenCalled();
});

it("previews and removes only the selected member's shared snapshot entries and communication history", async () => {
  const sendId = "10000000-0000-4000-8000-000000000001";
  const survivor = {sendId, recipientId: "actor", email: "actor@example.invalid", personalisation: {keep: "exact value"}};
  const snapshot = JSON.stringify({version: 1, tasks: [{sendId, recipientId: uid, email}, survivor], skippedRecipients: []});
  rows.announcementSends = [{id: sendId, recipientSnapshot: snapshot, recipientCount: 2, skippedCount: 0}];
  rows.announcementRecipients = [{userId: uid, email, status: "queued", announcementSend: {id: sendId}}, {userId: "actor", email: survivor.email, status: "sent", announcementSend: {id: sendId}}];
  rows.notificationDeliveries = [{user: {id: uid}, status: "SENT"}];
  rows.notifyDeliveryReceipts = [{user: {id: uid}, processingStatus: "PROCESSED"}];
  await expect(deleteAccount.run(request())).resolves.toMatchObject({eligible: true, sharedAnnouncements: 1, communicationRecords: 4});
  expect(mocks.start).not.toHaveBeenCalled();
  mocks.write.mockImplementation(async (query: string, options: {variables: Record<string, any>}) => {
    if (query.includes("RedactAccountSnapshot")) {
      const row = (rows.announcementSends as any[])[0];
      expect(options.variables.before0).toBe(row.recipientSnapshot);
      row.recipientSnapshot = options.variables.after0; row.recipientCount = options.variables.recipientAfter0;
      return {data: {snapshot0: 1}};
    }
    rows = {announcementSends: rows.announcementSends, announcementRecipients: (rows.announcementRecipients as any[]).filter(row => row.userId !== uid)};
    return {data: {fence: 1}};
  });
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).resolves.toEqual({deleted: true});
  expect(JSON.parse((rows.announcementSends as any[])[0].recipientSnapshot).tasks).toEqual([survivor]);
  expect((rows.announcementSends as any[])[0].recipientCount).toBe(1);
  expect((rows.announcementRecipients as any[])[0].userId).toBe("actor");
  expect(mocks.cancel).toHaveBeenCalled();
  expect(mocks.drain).toHaveBeenCalledOnce();
  expect(mocks.complete).toHaveBeenCalledWith(uid);
});
it("recovers an Auth deletion failure after the database phase without requiring a profile or security row", async () => {
  const {createHash} = await import("node:crypto");
  const emailHash = createHash("sha256").update(email).digest("hex");
  mocks.write.mockImplementation(async () => {
    rows = {};
    mocks.marker.mockResolvedValue([{emailHash, startedAt: "2026-01-01T00:00:00Z", profileDeletedAt: "2026-01-02T00:00:00Z", completedAt: null}]);
    return {data: {fence: 1}};
  });
  const remove = mocks.remove.getMockImplementation()!;
  mocks.remove.mockRejectedValueOnce(new Error("Auth temporarily unavailable")).mockImplementation(remove);
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toThrow("did not complete");
  expect(mocks.complete).not.toHaveBeenCalled();
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).resolves.toEqual({deleted: true});
  expect(mocks.complete).toHaveBeenCalledWith(uid);
});
it("lets an administrator finish an interrupted READY self-deletion through a fresh no-op receipt", async () => {
  const selfOperationId = "interrupted-self-deletion-operation";
  const selfState = {user: {id: uid, membershipStatus: "RESIGNED"}, operationId: selfOperationId, securityVersion: 8,
    membershipStatus: "RESIGNED", desiredEnabled: false, desiredAdmin: false, accessReady: false, adminReady: false, syncStatus: "READY"};
  const selfIntent = {userId: uid, actorId: uid, actorKind: "SELF", actorSecurityVersion: 7, operationId: selfOperationId,
    securityVersion: 8, membershipStatus: "RESIGNED", desiredEnabled: false, desiredAdmin: false,
    authDisabled: true, reason: "ACCOUNT_DELETION", syncStatus: "READY"};
  const marker = {emailHash: createHash("sha256").update(email).digest("hex"), startedAt: "2026-01-01T00:00:00Z", profileDeletedAt: null, completedAt: null};
  rows = {users: [{id: uid, email, membershipStatus: "RESIGNED"}], userSecurityStates: [selfState], securityTransitions: [selfIntent],
    notificationDeliveries: [{user: {id: uid}, status: "PENDING", lastAttemptedAt: "2026-01-01T00:00:00Z"}]};
  const getUser = mocks.getUser.getMockImplementation()!;
  mocks.getUser.mockImplementation(async (id: string) => {
    const identity = await getUser(id);
    return id === uid ? {...identity, emailVerified: true, customClaims: {enabled: false, admin: false, securityVersion: 8}} : identity;
  });
  mocks.marker.mockResolvedValue([marker]);
  vi.mocked(getUserSecurityState).mockResolvedValue({data: {userSecurityState: selfState}} as never);
  const adminReceipt = {userId: uid, actorId: "actor", actorKind: "ADMIN", operationId, securityVersion: 8,
    membershipStatus: "RESIGNED", desiredEnabled: false, desiredAdmin: false, authDisabled: null,
    reason: "ACCOUNT_DELETION", syncStatus: "READY", noOp: true};
  vi.mocked(getSecurityTransition).mockResolvedValue({data: {securityTransition: adminReceipt}} as never);
  mocks.transition.mockImplementation(async () => {rows.securityTransitions.push(adminReceipt);});
  const remove = mocks.remove.getMockImplementation()!;
  mocks.remove.mockImplementation(async () => {
    expect(rows).toEqual({});
    expect(mocks.write).toHaveBeenCalledOnce();
    await remove();
  });

  await expect(deleteAccount.run(request())).resolves.toMatchObject({eligible: true, needsOperator: false});
  expect(mocks.transition).not.toHaveBeenCalled();
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).resolves.toEqual({deleted: true});

  expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({userId: uid, actorId: "actor", actorKind: "ADMIN",
    actorSecurityVersion: 7, operationId, authDisabled: true, reason: "ACCOUNT_DELETION"}));
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.drain).toHaveBeenCalledWith(marker.startedAt);
  const [query, options] = mocks.write.mock.calls[0];
  expect(query).toContain("SECURITY_ACTOR_REVOKED");
  expect(query).toContain("ACCOUNT_CHANGED");
  expect(options.variables).toMatchObject({uid, actorId: "actor", actorVersion: 7, operationId: selfOperationId, targetVersion: 8});
  expect(mocks.remove).toHaveBeenCalledWith(uid);
  expect(mocks.complete).toHaveBeenCalledWith(uid);
  expect(mocks.complete.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.remove.mock.invocationCallOrder[0]);
});
it("lets an administrator finish self-deletion after the profile phase using the durable marker", async () => {
  rows = {notifyDeliveryReceipts: [{user: null, recipientHash: createHash("sha256").update(email).digest("hex"), processingStatus: "PROCESSED"}]};
  mocks.marker.mockResolvedValue([{emailHash: createHash("sha256").update(email).digest("hex"), startedAt: "2026-01-01T00:00:00Z",
    profileDeletedAt: "2026-01-02T00:00:00Z", completedAt: null}]);
  vi.mocked(getUserSecurityState).mockResolvedValue({data: {userSecurityState: null}} as never);
  const remove = mocks.remove.getMockImplementation()!;
  mocks.remove.mockImplementation(async () => {
    expect(rows).toEqual({});
    expect(mocks.write).toHaveBeenCalledOnce();
    await remove();
  });

  await expect(deleteAccount.run(request())).resolves.toMatchObject({eligible: true, needsOperator: false});
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).resolves.toEqual({deleted: true});

  expect(mocks.transition).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
  const [query, options] = mocks.write.mock.calls[0];
  expect(query).toContain("mutation DeleteErasedCommunication");
  expect(query).toContain("ERASURE_RECOVERY_NOT_READY");
  expect(query).toContain("SECURITY_ACTOR_REVOKED");
  expect(options.variables).toMatchObject({uid, actorId: "actor", actorVersion: 7, emailHashes: [createHash("sha256").update(email).digest("hex")]});
  expect(mocks.remove).toHaveBeenCalledWith(uid);
  expect(mocks.complete).toHaveBeenCalledWith(uid);
  expect(mocks.complete.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.remove.mock.invocationCallOrder[0]);
});
it("does not continue after the acting administrator is disabled during the drain", async () => {
  let disabled = false;
  mocks.drain.mockImplementation(async () => {disabled = true;});
  mocks.getUser.mockImplementation(async (id: string) => id === "actor" ? {uid: id, disabled, emailVerified: true, customClaims: {admin: true, enabled: true, securityVersion: 7}} : {uid, email, disabled: true});
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).rejects.toMatchObject({code: "permission-denied"});
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("resumes only a verified interrupted deletion disable before continuing", async () => {
  mocks.marker.mockResolvedValue([{emailHash: "48b4d49725de38e1c09a348c18dfbaa350474fc24ec8c93750b2303ceb91444b", startedAt: "2026-01-01T00:00:00Z"}]);
  rows.userSecurityStates = [{user: {id: uid}, desiredAdmin: false, desiredEnabled: false, adminReady: false, accessReady: false, syncStatus: "PENDING", operationId: "interrupted-disable"}];
  rows.securityTransitions = [{userId: uid, operationId: "interrupted-disable", desiredAdmin: false, desiredEnabled: false, authDisabled: true, reason: "ACCOUNT_DELETION", syncStatus: "PENDING"}];
  vi.mocked(getUserSecurityState).mockResolvedValueOnce({data: {userSecurityState: {operationId: "interrupted-disable", syncStatus: "PENDING", desiredAdmin: false, desiredEnabled: false, adminReady: false, accessReady: false}}} as never).mockResolvedValue({data: {userSecurityState: {operationId, securityVersion: 8}}} as never);
  vi.mocked(getSecurityTransition).mockResolvedValueOnce({data: {securityTransition: {userId: uid, reason: "ACCOUNT_DELETION", authDisabled: true, desiredAdmin: false, desiredEnabled: false}}} as never).mockResolvedValue({data: {securityTransition: {userId: uid, syncStatus: "READY", securityVersion: 8}}} as never);
  mocks.sync.mockImplementation(async () => {rows.userSecurityStates = [{user: {id: uid}, desiredAdmin: false, adminReady: false, syncStatus: "READY"}]; rows.securityTransitions = [];});
  await expect(deleteAccount.run(request({apply: true, noRetention: true}))).resolves.toEqual({deleted: true});
  expect(mocks.sync).toHaveBeenCalledWith("interrupted-disable");
});
