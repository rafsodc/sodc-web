import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const mocks = vi.hoisted(() => ({getUser: vi.fn(), get: vi.fn(), write: vi.fn(), transition: vi.fn(), remove: vi.fn(), revoke: vi.fn(), requireAdmin: vi.fn()}));
vi.mock("firebase-admin", () => ({auth: () => ({getUser: mocks.getUser, deleteUser: mocks.remove, revokeRefreshTokens: mocks.revoke})}));
vi.mock("firebase-admin/data-connect", () => ({getDataConnect: () => ({executeGraphqlRead: mocks.get, executeGraphql: mocks.write})}));
vi.mock("../../helpers", async original => ({...await original<typeof import("../../helpers")>(), requireAdmin: mocks.requireAdmin}));
vi.mock("../../currentAuthorizationTransitions", async original => ({...await original<typeof import("../../currentAuthorizationTransitions")>(), transitionUserSecurity: mocks.transition}));
vi.mock("../../rateLimiter", () => ({enforceRateLimit: vi.fn()}));
vi.mock("../../securityRepository", () => ({
  getUserSecurityState: vi.fn(async () => ({data: {userSecurityState: {operationId: "deletion-operation-reference", securityVersion: 8}}})),
  getSecurityTransition: vi.fn(async () => ({data: {securityTransition: {userId: "target-account", syncStatus: "READY", securityVersion: 8}}})),
}));
import { deleteAccount, accountDeletionMatch } from "../../accountDeletion";
import { accountDeletionInventory } from "../../accountDeletionInventory";
import { getUserSecurityState, getSecurityTransition } from "../../securityRepository";
const uid = "target-account", email = "target@example.invalid", operationId = "deletion-operation-reference";
const request = (extra = {}) => ({auth: {uid: "actor", token: {securityVersion: 7}}, data: {uid, email, operationId, ...extra}} as never);
let rows: Record<string, unknown[]>;
beforeEach(() => {
  vi.resetAllMocks();
  rows = {users: [{id: uid, email}], userSecurityStates: [{user: {id: uid}, desiredAdmin: false, adminReady: false, syncStatus: "READY"}]};
  mocks.getUser.mockResolvedValue({uid, email, disabled: true});
  mocks.get.mockImplementation(async (query: string) => ({data: {[query.match(/\{ (\w+)\(/)![1]]: rows[query.match(/\{ (\w+)\(/)![1]] ?? []}}));
  mocks.write.mockImplementation(async () => {rows = {}; return {data: {fence: 1}};});
  mocks.remove.mockImplementation(async () => {mocks.getUser.mockRejectedValue({code: "auth/user-not-found"});});
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
  mocks.getUser.mockResolvedValue({uid, email, customClaims: {admin: true}});
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
  mocks.getUser.mockRejectedValue({code: "auth/user-not-found"});
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
  }
});
