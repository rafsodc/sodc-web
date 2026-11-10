import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inventoryTables, classify, parseOptions, runErasure } from "./erase-personal-data.mjs";

const subject = {uid: "target-uid", email: "target@example.com"};
const schema = readFileSync(new URL("../../dataconnect/schema/schema.gql", import.meta.url), "utf8");
test("inventory covers every current table and includes relation and snapshot fields", () => {
  const tables = inventoryTables(schema);
  assert.equal(tables.length, [...schema.matchAll(/^type /gm)].length);
  assert.match(tables.find(t => t.name === "AnnouncementSend").selection, /recipientSnapshot/);
  assert.match(tables.find(t => t.name === "BookingLine").selection, /guestUser \{ id \}/);
  assert.equal(tables.find(t => t.name === "LegacyUserIdentity").collection, "legacyUserIdentities");
  assert.throws(() => inventoryTables("type Unexpected { id: String! }"));
});
test("domain activity, shared snapshots, foreign actors and administrators block deletion", () => {
  for (const [name, row] of [
    ["Booking", {booker: {id: subject.uid}}],
    ["AnnouncementSend", {recipientSnapshot: JSON.stringify([subject])}],
    ["UserSecurityState", {user: {id: subject.uid}, desiredAdmin: true, syncStatus: "READY"}],
    ["SecurityTransition", {userId: subject.uid, actorId: "someone-else", syncStatus: "READY"}],
    ["SecurityTransition", {userId: subject.uid, actorId: subject.uid, syncStatus: "PENDING"}],
    ["User", {id: subject.uid, email: subject.email, stripeCustomerId: "cus_123"}],
  ]) assert.equal(classify({name}, row, subject), "blocked");
  assert.equal(classify({name: "CallableInvocation"}, {userId: subject.uid}, subject), "delete");
  assert.equal(classify({name: "User"}, {id: "someone-else", email: "else@example.com"}, subject), "unrelated");
});
test("apply requires retention, writer and external review attestations before remote access", () => {
  const args = ["--project", "sodc-web-production", "--email", subject.email, "--uid", subject.uid, "--case", "ERASURE-1", "--receipt", "/tmp/erasure-test.jsonl"];
  assert.equal(parseOptions(args)["--apply"], undefined);
  assert.throws(() => parseOptions([...args, "--apply"]), /ATTESTATIONS/);
  assert.throws(() => parseOptions([...args, "--project", "other"]), /DUPLICATE/);
});
test("operator recovery can remove a completed admin deletion hold, but preserves other operator history", () => {
  const hold = {userId: subject.uid, actorId: "admin", actorKind: "ADMIN", reason: "ACCOUNT_DELETION", authDisabled: true, desiredAdmin: false, syncStatus: "READY"};
  assert.equal(classify({name: "SecurityTransition"}, hold, subject), "delete");
  assert.equal(classify({name: "SecurityTransition"}, {...hold, syncStatus: "PENDING"}, subject), "blocked");
  assert.equal(classify({name: "SecurityTransition"}, {...hold, reason: "GRANT_ADMIN"}, subject), "blocked");
});

function fixture({block = false, failDatabase = false, failAuthDelete = false} = {}) {
  const events = [], receipts = [];
  let exists = true, databaseExists = true;
  const auth = {
    getUser: async () => { if (!exists) throw Object.assign(new Error(), {code: "auth/user-not-found"}); return {uid: subject.uid, email: subject.email}; },
    getUserByEmail: async () => auth.getUser(),
    updateUser: async () => events.push("disable"), revokeRefreshTokens: async () => events.push("revoke"),
    deleteUser: async () => { events.push("auth-delete"); if (failAuthDelete) throw new Error(); exists = false; },
  };
  const dc = {
    executeGraphqlRead: async query => {
      const field = query.match(/\{ (\w+)\(/)[1];
      return {data: {[field]: field === "users" && databaseExists ? [{id: subject.uid, email: subject.email}] : field === "bookings" && block ? [{booker: {id: subject.uid}}] : []}};
    },
    executeGraphql: async query => { events.push("database-delete"); assert.match(query, /@transaction/); assert.match(query, /ERASURE_IDENTITY_CHANGED/); if (failDatabase) throw new Error(); databaseExists = false; return {data: {profile: 1}}; },
  };
  return {events, receipts, auth, dc, receipt: r => receipts.push(r)};
}
const options = {"--project": "sodc-web-production", "--uid": subject.uid, "--email": subject.email, "--case": "ERASURE-1", "--apply": true};
test("successful erasure verifies the database before deleting Auth and emits no email", async () => {
  const f = fixture(); await runErasure(options, f);
  assert.deepEqual(f.events, ["disable", "revoke", "database-delete", "auth-delete"]);
  assert.equal(f.receipts.at(-1).stage, "ACTIVE_STORES_ERASED");
  assert.ok(!JSON.stringify(f.receipts).includes(subject.email));
  assert.ok(!JSON.stringify(f.receipts).includes(subject.uid));
});
test("preview and blockers perform no mutations", async () => {
  const preview = fixture(); await runErasure({...options, "--apply": false}, preview);
  assert.deepEqual(preview.events, []);
  const blocked = fixture({block: true}); await assert.rejects(runErasure(options, blocked));
  assert.deepEqual(blocked.events, []);
});
test("database failure leaves Auth intact; Auth deletion failure is retryable", async () => {
  const failed = fixture({failDatabase: true}); await assert.rejects(runErasure(options, failed));
  assert.ok(!failed.events.includes("auth-delete"));
  assert.equal(failed.receipts.at(-1).stage, "INCOMPLETE");
  const authFailed = fixture({failAuthDelete: true}); await assert.rejects(runErasure(options, authFailed));
  assert.equal(authFailed.receipts.at(-1).stage, "INCOMPLETE");
  const realDelete = fixture().auth.deleteUser;
  // Reuse the partially erased database; simulate successful Auth deletion and
  // subsequent missing identity reads on retry.
  let removed = false;
  const get = authFailed.auth.getUser;
  authFailed.auth.deleteUser = async () => { await realDelete(); removed = true; };
  authFailed.auth.getUser = async () => {
    if (removed) throw Object.assign(new Error(), {code: "auth/user-not-found"});
    return get();
  };
  await runErasure(options, authFailed);
  assert.equal(authFailed.receipts.at(-1).stage, "ACTIVE_STORES_ERASED");
});
test("identity mismatch and incomplete inventories fail before writes", async () => {
  const wrong = fixture();
  wrong.auth.getUser = async () => ({uid: subject.uid, email: "other@example.com"});
  await assert.rejects(runErasure(options, wrong));
  assert.deepEqual(wrong.events, []);
  const incomplete = fixture();
  incomplete.dc.executeGraphqlRead = async () => ({data: {}});
  await assert.rejects(runErasure(options, incomplete));
  assert.deepEqual(incomplete.events, []);
});
