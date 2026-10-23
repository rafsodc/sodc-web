import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { App } from "firebase-admin/app";
import type { DataConnect } from "firebase-admin/data-connect";
import type * as AdminSdk from "@dataconnect/admin-generated";

type Claim = AdminSdk.ClaimNotificationDeliveryForRecoveryByIdVariables;
type Row = AdminSdk.GetNotificationDeliveryByChannelAndKeyData["notificationDeliveries"][number];
type RecoveryOperation = "claim" | "failure";
let sdk: typeof AdminSdk;
let db: DataConnect;
let otherDb: DataConnect;
let apps: App[] = [];
let prefix: string;
let fixtureSequence = 0;
let freshDatabaseVerified = false;
let ownedIds: string[] = [];
const functionsRoot = path.resolve(__dirname, "../../..");
const require = createRequire(path.join(functionsRoot, "package.json"));
const now = () => new Date().toISOString();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

async function seed(options: Partial<AdminSdk.CreateNotificationDeliveryVariables> = {}): Promise<Row> {
  const deliveryKey = `${prefix}:${fixtureSequence++}:notify-team_test`;
  const created = await sdk.createNotificationDelivery(db, {
    channel: sdk.NotificationChannel.EMAIL, notificationType: "LOCAL_RECOVERY_FIXTURE",
    deliveryKey, recoveryPayload: JSON.stringify({ version: 1, kind: "LOCAL_SQL_NO_PROVIDER", marker: deliveryKey }),
    deliveryMode: sdk.GovNotifyDeliveryMode.TEAM_TEST, status: sdk.NotificationDeliveryStatus.FAILED,
    attemptCount: 5, lastAttemptedAt: minutesAgo(30), provider: "local-sql-no-provider", ...options,
  });
  ownedIds.push(created.data.notificationDelivery_insert.id);
  return lookup(options.channel ?? sdk.NotificationChannel.EMAIL, options.deliveryKey ?? deliveryKey);
}

async function lookup(channel: AdminSdk.NotificationChannel, deliveryKey: string): Promise<Row> {
  const rows = (await sdk.getNotificationDeliveryByChannelAndKey(db, { channel, deliveryKey })).data.notificationDeliveries;
  expect(rows).toHaveLength(1);
  return rows[0];
}

function claimSnapshot(row: Row): Claim {
  expect(row.lastAttemptedAt).toBeTruthy();
  return {
    id: row.id, channel: row.channel, deliveryKey: row.deliveryKey, notificationType: row.notificationType,
    expectedStatus: row.status, expectedAttemptCount: row.attemptCount, expectedLastAttemptedAt: row.lastAttemptedAt!,
    expectedRecoveryPayload: row.recoveryPayload ?? null, expectedRecoveryPayloadIsNull: row.recoveryPayload == null,
    expectedDeliveryMode: row.deliveryMode ?? null, expectedDeliveryModeIsNull: row.deliveryMode == null,
    lastAttemptedAt: now(), provider: "local-sql-no-provider",
  };
}

async function recover(operation: RecoveryOperation, variables: Claim, client = db): Promise<number> {
  if (operation === "claim") return (await sdk.claimNotificationDeliveryForRecoveryById(client, variables)).data.notificationDelivery_updateMany;
  const { provider: _provider, ...snapshot } = variables;
  return (await sdk.recordNotificationRecoveryFailureForClaimById(client, {
    ...snapshot, lastErrorCode: "LOCAL_RECOVERY_FAILURE", lastErrorMessage: "Local SQL fixture; no provider was called",
  })).data.notificationDelivery_updateMany;
}

async function rawRow(id: string): Promise<Row | null> {
  const result = await db.executeGraphql<{ notificationDelivery: Row | null }, { id: string }>(`query ReadLocalFixture($id: UUID!) {
    notificationDelivery(key: {id: $id}) {id channel deliveryKey notificationType recoveryPayload deliveryMode recipientUserId booking {id} user {id} status provider providerMessageId attemptCount lastAttemptedAt sentAt skippedAt skipReason lastErrorCode lastErrorMessage createdAt}
  }`, { variables: { id } });
  return result.data.notificationDelivery;
}

beforeAll(async () => {
  // No Firebase SDK is loaded until this fixed demo/loopback/temp-metadata gate succeeds.
  const { assertNotificationRecoveryFixture } = await import(pathToFileURL(path.join(functionsRoot, "scripts/run-notification-recovery-integration.mjs")).href);
  const context = await assertNotificationRecoveryFixture();
  prefix = `notification-recovery-it-${context.runId}`;
  const { initializeApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  const { getDataConnect } = require("firebase-admin/data-connect") as typeof import("firebase-admin/data-connect");
  sdk = require("@dataconnect/admin-generated");
  apps = [initializeApp({ projectId: context.projectId }, "notification-recovery-local-one"),
    initializeApp({ projectId: context.projectId }, "notification-recovery-local-two")];
  db = getDataConnect(sdk.connectorConfig, apps[0]);
  otherDb = getDataConnect(sdk.connectorConfig, apps[1]);
  const initial = await db.executeGraphql("query FreshLocalNotificationDatabase { notificationDeliveries(limit: 1) {id} users(limit: 1) {id} }");
  expect(initial.data).toEqual({ notificationDeliveries: [], users: [] });
  freshDatabaseVerified = true;
});

afterEach(async () => {
  if (!db || !freshDatabaseVerified) return;
  const occupants = await db.executeGraphql<{ notificationDeliveries: { id: string; deliveryKey: string }[] }, Record<string, never>>(
    "query OnlyLocalNotificationFixtures { notificationDeliveries(limit: 1001) {id deliveryKey} }");
  expect(occupants.data.notificationDeliveries.every(row => row.deliveryKey.startsWith(prefix) && ownedIds.includes(row.id))).toBe(true);
  await db.executeGraphql("mutation RemoveLocalNotificationFixtures($ids: [UUID!]!) { notificationDelivery_deleteMany(where: {id: {in: $ids}}) }",
    { variables: { ids: ownedIds } });
  ownedIds = [];
});

afterAll(async () => {
  if (!apps.length) return;
  const { deleteApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  await Promise.all(apps.map(app => deleteApp(app)));
});

describe("actual local SQL notification recovery claims", () => {
  it("retains the deployed recovery-failure operation and its old variables during connector-first rollout", async () => {
    const row = await seed();
    const oldVariables = { id: row.id, expectedStatus: row.status, expectedAttemptCount: row.attemptCount,
      attemptCount: row.attemptCount + 1, lastAttemptedAt: now(), lastErrorCode: "OLD_WORKER_COMPATIBILITY",
      lastErrorMessage: "Original deployed signature remains accepted" };
    expect((await sdk.recordNotificationRecoveryFailureById(db, oldVariables)).data.notificationDelivery_updateMany).toBe(1);
    expect(await rawRow(row.id)).toMatchObject({ status: "FAILED", attemptCount: 6, lastErrorCode: "OLD_WORKER_COMPATIBILITY" });
    expect((await sdk.recordNotificationRecoveryFailureById(db, oldVariables)).data.notificationDelivery_updateMany).toBe(0);
  });

  it("permits due FAILED5 to claim attempt six and fail, but rejects its stale snapshot and current FAILED6", async () => {
    const row = await seed();
    const snapshot = claimSnapshot(row);
    expect(await recover("claim", snapshot)).toBe(1);
    expect(await rawRow(row.id)).toMatchObject({ status: "PENDING", attemptCount: 6 });
    expect((await sdk.markNotificationDeliveryFailedById(db, { id: row.id, attemptCount: 6,
      lastAttemptedAt: snapshot.lastAttemptedAt, lastErrorCode: "LOCAL_FAILURE", lastErrorMessage: "No provider called" })).data.notificationDelivery_updateMany).toBe(1);
    expect(await recover("claim", snapshot)).toBe(0);
    expect(await recover("failure", snapshot)).toBe(0);
    const current = (await rawRow(row.id))!;
    expect(await recover("claim", claimSnapshot(current))).toBe(0);
    expect(await recover("failure", claimSnapshot(current))).toBe(0);
    expect(await rawRow(row.id)).toEqual(current);
  });

  for (const operation of ["claim", "failure"] as const) {
    describe(`${operation} enforces the same atomic snapshot and retry policy`, () => {
      it.each([
        ["physical row ID", { id: randomUUID() }],
        ["channel", { channel: "SMS" }],
        ["physical delivery key", { deliveryKey: "WRONG_KEY" }],
        ["notification type", { notificationType: "WRONG_TYPE" }],
        ["status", { expectedStatus: "PENDING" }],
        ["attempt count", { expectedAttemptCount: 4 }],
        ["timestamp", { expectedLastAttemptedAt: "2020-01-01T00:00:00.000Z" }],
        ["payload", { expectedRecoveryPayload: "different-payload" }],
        ["payload nullness", { expectedRecoveryPayload: null, expectedRecoveryPayloadIsNull: true }],
        ["delivery mode", { expectedDeliveryMode: "LIVE" }],
        ["delivery mode nullness", { expectedDeliveryMode: null, expectedDeliveryModeIsNull: true }],
      ])("rejects a changed %s without a write", async (_label, changed) => {
        const row = await seed();
        expect(await recover(operation, { ...claimSnapshot(row), ...changed } as Claim)).toBe(0);
        expect(await rawRow(row.id)).toEqual(row);
      });

      it("rejects a timestamp refreshed after listing while the FAILED count stays five", async () => {
        const row = await seed();
        const snapshot = claimSnapshot(row);
        await db.executeGraphql("mutation RefreshLocalTimestamp($id: UUID!, $timestamp: Timestamp!) {notificationDelivery_update(key: {id: $id}, data: {lastAttemptedAt: $timestamp})}",
          { variables: { id: row.id, timestamp: minutesAgo(20) } });
        const current = await rawRow(row.id);
        expect(await recover(operation, snapshot)).toBe(0);
        expect(await rawRow(row.id)).toEqual(current);
      });

      it.each(["FAILED", "PENDING"] as const)("hard-caps even an ancient %s row at attempt six", async status => {
        const row = await seed({ status: sdk.NotificationDeliveryStatus[status], attemptCount: 6 });
        expect(await recover(operation, claimSnapshot(row))).toBe(0);
        expect(await rawRow(row.id)).toEqual(row);
      });

      it.each(["SENT", "SKIPPED"] as const)("retains terminal %s rows even with a matching snapshot", async status => {
        const row = await seed({ status: sdk.NotificationDeliveryStatus[status] });
        expect(await recover(operation, claimSnapshot(row))).toBe(0);
        expect(await rawRow(row.id)).toEqual(row);
      });

      it("uses database time for FAILED cooldown despite an hour-ahead client attempt timestamp", async () => {
        const row = await seed({ lastAttemptedAt: minutesAgo(14) });
        const snapshot = { ...claimSnapshot(row), lastAttemptedAt: new Date(Date.now() + 60 * 60_000).toISOString() };
        expect(await recover(operation, snapshot)).toBe(0);
        expect(await rawRow(row.id)).toEqual(row);
      });

      it.each([
        { status: "FAILED", ageMinutes: 15 - 10 / 60, allowed: false },
        { status: "FAILED", ageMinutes: 15 + 2 / 60, allowed: true },
        { status: "PENDING", ageMinutes: 10 - 10 / 60, allowed: false },
        { status: "PENDING", ageMinutes: 10 + 2 / 60, allowed: true },
      ] as const)("honours $status boundary: age $ageMinutes minutes, allowed $allowed", async ({ status, ageMinutes, allowed }) => {
        const row = await seed({ status: sdk.NotificationDeliveryStatus[status], lastAttemptedAt: minutesAgo(ageMinutes) });
        expect(await recover(operation, claimSnapshot(row))).toBe(Number(allowed));
        if (allowed) expect(await rawRow(row.id)).toMatchObject({ status: operation === "claim" ? "PENDING" : "FAILED", attemptCount: 6 });
        else expect(await rawRow(row.id)).toEqual(row);
      });

      it("supports an exactly matched null payload/mode without weakening non-null ownership predicates", async () => {
        const row = await seed({ recoveryPayload: null, deliveryMode: null });
        expect(await recover(operation, claimSnapshot(row))).toBe(1);
        expect(await rawRow(row.id)).toMatchObject({ attemptCount: 6, recoveryPayload: null, deliveryMode: null });
      });

      it("cannot create or claim a deleted row or its same-key replacement", async () => {
        const row = await seed();
        const snapshot = claimSnapshot(row);
        expect((await sdk.deleteNotificationDeliveryIntegrationFixture(db, { id: row.id, deliveryKey: row.deliveryKey })).data.notificationDelivery_deleteMany).toBe(1);
        expect(await recover(operation, snapshot)).toBe(0);
        expect(await rawRow(row.id)).toBeNull();
        const replacement = await seed({ deliveryKey: row.deliveryKey, recoveryPayload: row.recoveryPayload,
          lastAttemptedAt: row.lastAttemptedAt, attemptCount: row.attemptCount });
        expect(replacement.id).not.toBe(row.id);
        expect(await recover(operation, snapshot)).toBe(0);
        expect(await rawRow(replacement.id)).toEqual(replacement);
      });
    });
  }

  it("lets only one of two independent clients acquire the genuine due sixth claim", async () => {
    const row = await seed();
    const snapshot = claimSnapshot(row);
    const results = await Promise.all([recover("claim", snapshot, db), recover("claim", snapshot, otherDb)]);
    expect(results.sort()).toEqual([0, 1]);
    expect(await rawRow(row.id)).toMatchObject({ status: "PENDING", attemptCount: 6 });
  });

  it("serializes a claim against fallback failure so only one worker consumes attempt six", async () => {
    const row = await seed();
    const snapshot = claimSnapshot(row);
    const results = await Promise.all([recover("claim", snapshot, db), recover("failure", snapshot, otherDb)]);
    expect(results.sort()).toEqual([0, 1]);
    expect((await rawRow(row.id))!.attemptCount).toBe(6);
  });

  it("keeps the ordinary direct/manual FAILED6 to attempt-seven retry semantics", async () => {
    const row = await seed({ attemptCount: 6 });
    expect((await sdk.claimNotificationDeliveryById(db, { id: row.id, expectedStatus: row.status,
      expectedAttemptCount: 6, attemptCount: 7, lastAttemptedAt: now(), provider: "local-sql-no-provider",
      recoveryPayload: row.recoveryPayload })).data.notificationDelivery_updateMany).toBe(1);
    expect(await rawRow(row.id)).toMatchObject({ status: "PENDING", attemptCount: 7 });
  });
});
