import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { App } from "firebase-admin/app";
import type { DataConnect } from "firebase-admin/data-connect";
import type * as AdminSdk from "@dataconnect/admin-generated";

// Real service-account transport and actual SQL. The ordinary mocked setup is never loaded.
const functionsRoot = path.resolve(__dirname, "../../..");
const require = createRequire(path.join(functionsRoot, "package.json"));
let sdk: typeof AdminSdk;
let app: App;
let dc: DataConnect;
let prefix: string;
let sequence = 0;
let caseUsers: string[] = [];
let caseGroups: string[] = [];
let disposableVerified = false;
let canonicalUuid: typeof import("../../helpers").validateUUID;
const variables = (userId: string, userGroupId: string, securityVersion = 1) => ({ userId, userGroupId, securityVersion });

async function member(suffix: string) {
  const userId = `${prefix}-${sequence}-${suffix}`; caseUsers.push(userId);
  await dc.executeGraphql(`mutation LocalSubscriptionMember($userId: String!, $operationId: String!) @transaction {
    user_insert(data: {id: $userId, firstName: "Local", lastName: "Subscription fixture", email: "local@example.invalid", serviceNumber: "LOCAL-SUBSCRIPTION", membershipStatus: REGULAR, createdBy: "local-fixture", updatedBy: "local-fixture"})
    userSecurityState_insert(data: {userId: $userId, securityVersion: 1, membershipStatus: REGULAR, desiredEnabled: true, desiredAdmin: false, accessReady: true, adminReady: false, operationId: $operationId, syncStatus: READY})
  }`, { variables: { userId, operationId: randomUUID() } });
  return userId;
}
async function group(subscribable: boolean | null = true) {
  const id = randomUUID(); caseGroups.push(id);
  await dc.executeGraphql(`mutation LocalSubscriptionGroup($id: UUID!, $name: String!, $subscribable: Boolean) {
    userGroup_insert(data: {id: $id, name: $name, subscribable: $subscribable, createdBy: "local-fixture", updatedBy: "local-fixture"})
  }`, { variables: { id, name: `${prefix}-${sequence}`, subscribable } });
  return id;
}
async function memberships() {
  const rows = (await dc.executeGraphql<{ userUserGroups: { userId: string; userGroupId: string; createdBy: string | null; updatedBy: string | null }[] }, { users: string[] }>(
    "query LocalSubscriptionMemberships($users: [String!]!) { userUserGroups(where: {userId: {in: $users}}) {userId userGroupId createdBy updatedBy} }", { variables: { users: caseUsers } })).data.userUserGroups;
  return rows.map(row => ({ ...row, userGroupId: canonicalUuid(row.userGroupId) }));
}
beforeAll(async () => {
  const { assertAdminSafetyFixture } = await import(pathToFileURL(path.join(functionsRoot, "scripts/admin-safety-integration-fixture.mjs")).href);
  const context = await assertAdminSafetyFixture();
  ({ validateUUID: canonicalUuid } = await import("../../helpers.js"));
  prefix = `subscription-it-${context.runId}`;
  const { initializeApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  const { getDataConnect } = require("firebase-admin/data-connect") as typeof import("firebase-admin/data-connect");
  sdk = require("@dataconnect/admin-generated");
  app = initializeApp({ projectId: context.projectId }, "subscription-local-api");
  dc = getDataConnect(sdk.connectorConfig, app);
  const initial = await dc.executeGraphql("query FreshSubscriptionDatabase { users(limit: 1) {id} userSecurityStates(limit: 1) {userId} userGroups(limit: 1) {id} }");
  expect(initial.data).toEqual({ users: [], userSecurityStates: [], userGroups: [] });
  disposableVerified = true;
});
beforeEach(() => { sequence++; caseUsers = []; caseGroups = []; });
afterEach(async () => {
  if (!disposableVerified) return;
  await dc.executeGraphql(`mutation RemoveLocalSubscriptionFixtures($users: [String!]!, $groups: [UUID!]!) @transaction {
    userUserGroup_deleteMany(where: {userId: {in: $users}})
    userGroup_deleteMany(where: {id: {in: $groups}})
    userSecurityState_deleteMany(where: {userId: {in: $users}})
    user_deleteMany(where: {id: {in: $users}})
  }`, { variables: { users: caseUsers, groups: caseGroups } });
  expect(await memberships()).toEqual([]);
});
afterAll(async () => { if (app) await (require("firebase-admin/app") as typeof import("firebase-admin/app")).deleteApp(app); });

for (const operation of ["SubscribeToUserGroup", "RegisterForSection"] as const) describe(operation + " actual service-account identity and SQL boundary", () => {
  const join = (args: ReturnType<typeof variables>, options?: Parameters<DataConnect["executeMutation"]>[2]) => operation === "SubscribeToUserGroup" ? sdk.subscribeToUserGroup(dc, args, options) : sdk.registerForSection(dc, args, options);
  it("has no implicit auth.uid, then inserts only the explicit caller and remains idempotent", async () => {
    const caller = await member("caller"), other = await member("other"), id = await group();
    await expect(dc.executeGraphql("mutation LegacyImplicitIdentity($group: UUID!) { userUserGroup_upsert(data: {userId_expr: \"auth.uid\", userGroupId: $group}) }", { variables: { group: id } })).rejects.toThrow();
    expect(await memberships()).toEqual([]);
    await join(variables(caller, id)); await join(variables(caller, id));
    expect(await memberships()).toEqual([{ userId: caller, userGroupId: id, createdBy: caller, updatedBy: caller }]);
    expect((await memberships()).some(row => row.userId === other)).toBe(false);
  });
  for (const creator of ["local-admin", null]) it("preserves an existing " + (creator === null ? "null" : "different") + " creator when joining repeatedly", async () => {
    const caller = await member("existing"), id = await group();
    await dc.executeGraphql(`mutation ExistingSubscriptionMembership($userId: String!, $group: UUID!, $creator: String, $actor: String!, $createdAt: Timestamp!) {
      userUserGroup_insert(data: {userId: $userId, userGroupId: $group, createdBy_expr: "vars.creator", updatedBy_expr: "vars.actor", createdAt: $createdAt})
    }`, { variables: { userId: caller, group: id, creator, actor: "local-admin", createdAt: "2020-01-02T03:04:05Z" } });
    const createdAt = async () => (await dc.executeGraphql<{ userUserGroups: { createdAt: string }[] }, { userId: string }>(
      "query ExistingSubscriptionCreatedAt($userId: String!) { userUserGroups(where: {userId: {eq: $userId}}) {createdAt} }", { variables: { userId: caller } })).data.userUserGroups[0].createdAt;
    const originalCreatedAt = await createdAt();
    expect(await memberships()).toEqual([{ userId: caller, userGroupId: id, createdBy: creator, updatedBy: "local-admin" }]);
    await join(variables(caller, id)); await join(variables(caller, id));
    expect(await memberships()).toEqual([{ userId: caller, userGroupId: id, createdBy: creator, updatedBy: caller }]);
    expect(await createdAt()).toBe(originalCreatedAt);
  });
  it("denies direct clients even when they forge another UID and enabled/admin claims", async () => {
    const caller = await member("caller"), victim = await member("victim"), id = await group();
    await expect(join(variables(victim, id), { impersonate: { authClaims: { sub: caller, enabled: true, admin: true, securityVersion: 1 } } })).rejects.toThrow();
    expect(await memberships()).toEqual([]);
  });
  for (const subscribable of [false, null]) it("rejects a non-subscribable " + subscribable + " group transaction without inserting membership", async () => {
    const caller = await member("caller"), id = await group(subscribable);
    await expect(join(variables(caller, id))).rejects.toThrow(/USER_GROUP_NOT_SUBSCRIBABLE/);
    expect(await memberships()).toEqual([]);
  });
  it("rejects a missing group and a missing current authority without inserting membership", async () => {
    const caller = await member("caller");
    await expect(join(variables(caller, randomUUID()))).rejects.toThrow(/USER_GROUP_NOT_FOUND/);
    const id = await group(); await dc.executeGraphql("mutation RemoveLocalAuthority($user: String!) { userSecurityState_delete(key: {userId: $user}) }", { variables: { user: caller } });
    await expect(join(variables(caller, id))).rejects.toThrow(/ACCESS_REVOKED/);
    expect(await memberships()).toEqual([]);
  });
  it("rechecks subscribability after a previous successful join rather than trusting a preflight read", async () => {
    const caller = await member("caller"), id = await group(); await join(variables(caller, id));
    await dc.executeGraphql("mutation CloseLocalGroup($id: UUID!) { userGroup_update(id: $id, data: {subscribable: false}) }", { variables: { id } });
    const before = await memberships(); await expect(join(variables(caller, id))).rejects.toThrow(/USER_GROUP_NOT_SUBSCRIBABLE/); expect(await memberships()).toEqual(before);
  });
  for (const kind of ["disabled", "pending", "stale", "restricted", "membership mismatch"] as const) it("denies " + kind + " authority at the actual database boundary", async () => {
    const caller = await member("caller"), id = await group();
    const changes = kind === "disabled" ? "accessReady: false, desiredEnabled: false" : kind === "pending" ? "syncStatus: PENDING" : kind === "stale" ? "securityVersion: 2" : kind === "restricted" ? "membershipStatus: LOST" : "membershipStatus: RETIRED";
    await dc.executeGraphql(`mutation AlterLocalAuthority($user: String!) { userSecurityState_update(key: {userId: $user}, data: {${changes}}) }`, { variables: { user: caller } });
    await expect(join(variables(caller, id))).rejects.toThrow(kind === "stale" ? /SESSION_VERSION_STALE/ : /ACCESS_REVOKED/);
    expect(await memberships()).toEqual([]);
  });
});

it("binds service-account audit expressions explicitly instead of evaluating auth.uid defaults", async () => {
  const caller = await member("diagnostic"), id = await group();
  await dc.executeGraphql(`mutation DirectExplicitJoin($userId: String!, $group: UUID!) {
    userUserGroup_upsert(data: {userId: $userId, userGroupId: $group, createdBy_expr: "vars.userId", updatedBy_expr: "vars.userId"})
  }`, { variables: { userId: caller, group: id } });
  expect(await memberships()).toEqual([{ userId: caller, userGroupId: canonicalUuid(id), createdBy: caller, updatedBy: caller }]);
});
