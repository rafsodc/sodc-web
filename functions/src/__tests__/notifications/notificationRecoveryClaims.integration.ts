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
type OperatorDependencies = import("../../notificationRecoveryAdmin").NotificationRecoveryAdminDependencies;
type ReleaseVariables = AdminSdk.ReleaseNotificationRecoveryDeferralForClaimByIdVariables;
type DeliveryRepository = import("../../notificationDelivery").NotificationDeliveryRepository;
let runAdmin: typeof import("../../notificationRecoveryAdmin").runNotificationRecoveryAdmin;
let planRelease: typeof import("../../notificationRecoveryDeferral").planNotificationRecoveryRelease;
let sendOnce: typeof import("../../notificationDelivery").sendNotificationOnce;
let sendPrivileged: typeof import("../../privilegedNotificationDelivery").sendPrivilegedNotification;
let createRecoveryClaim: typeof import("../../notificationRecoveryClaim").createNotificationRecoveryClaim;
let sdk: typeof AdminSdk;
let db: DataConnect;
let otherDb: DataConnect;
let apps: App[] = [];
let prefix: string;
let fixtureSequence = 0;
let freshDatabaseVerified = false;
let ownedIds: string[] = [];
let ownedDeliveryKeys = new Map<string, string>();
let ownedUserIds: string[] = [];
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
  ownedDeliveryKeys.set(created.data.notificationDelivery_insert.id, options.deliveryKey ?? deliveryKey);
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
    expectedRecipientUserId: row.recipientUserId ?? null, expectedRecipientUserIdIsNull: row.recipientUserId == null,
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

function deferSnapshot(row: Row): AdminSdk.MarkNotificationRecoveryDeferredForClaimByIdVariables {
  const { lastAttemptedAt: _lastAttemptedAt, provider: _provider, ...snapshot } = claimSnapshot(row);
  return { ...snapshot, deferredReason: sdk.NotificationRecoveryDeferredReason.RECOVERY_DELIVERY_MODE_UNVERIFIABLE };
}

async function defer(row: Row, client = db): Promise<number> {
  return (await sdk.markNotificationRecoveryDeferredForClaimById(client, deferSnapshot(row))).data.notificationDelivery_updateMany;
}

function releaseSnapshot(row: Row, verifiedDeliveryMode = sdk.GovNotifyDeliveryMode.TEAM_TEST): AdminSdk.ReleaseNotificationRecoveryDeferralForClaimByIdVariables {
  expect(row.recoveryDeferredAt).toBeTruthy(); expect(row.recoveryDeferredReason).toBeTruthy();
  const { deferredReason: _reason, ...snapshot } = deferSnapshot(row);
  return { ...snapshot, expectedBookingId: row.booking?.id ?? null, expectedBookingIdIsNull: row.booking == null,
    expectedUserId: row.user?.id ?? null, expectedUserIdIsNull: row.user == null,
    expectedDeferredAt: row.recoveryDeferredAt!, expectedDeferredReason: row.recoveryDeferredReason!,
    verifiedDeliveryMode, actorId: "local-sql-reviewer-no-auth" };
}

async function release(variables: AdminSdk.ReleaseNotificationRecoveryDeferralForClaimByIdVariables): Promise<number> {
  return (await sdk.releaseNotificationRecoveryDeferralForClaimById(db, variables)).data.notificationDelivery_updateMany;
}

async function patch(row: Row, literalData: string): Promise<Row> {
  await db.executeGraphql(`mutation PatchLocalNotificationFixture($id: UUID!) {
    notificationDelivery_update(key: {id: $id}, data: {${literalData}})
  }`, { variables: { id: row.id } });
  return (await rawRow(row.id))!;
}

async function rawRow(id: string): Promise<Row | null> {
  const result = await db.executeGraphql<{ notificationDelivery: Row | null }, { id: string }>(`query ReadLocalFixture($id: UUID!) {
    notificationDelivery(key: {id: $id}) {id channel deliveryKey notificationType recoveryPayload deliveryMode recipientUserId booking {id} user {id} status provider providerMessageId attemptCount lastAttemptedAt recoveryDeferredAt recoveryDeferredReason sentAt skippedAt skipReason lastErrorCode lastErrorMessage createdAt}
  }`, { variables: { id } });
  return result.data.notificationDelivery;
}

function sqlDeliveryRepository(reads: Row[]): DeliveryRepository {
  return {
    getByChannelAndKey: async args => {
      const rows = (await sdk.getNotificationDeliveryByChannelAndKey(db, args)).data.notificationDeliveries;
      expect(rows).toHaveLength(1);
      reads.push(rows[0]);
      return { ...rows[0], lastAttemptedAt: rows[0].lastAttemptedAt ?? null };
    },
    createPending: async () => { throw new Error("Recovery must retain its existing SQL row"); },
    tryMarkPending: async () => { throw new Error("Recovery must use its guarded SQL claim"); },
    tryMarkPendingForRecovery: async ({ claim, lastAttemptedAt, provider }) =>
      (await sdk.claimNotificationDeliveryForRecoveryById(db, {
        id: claim.id, channel: claim.channel, deliveryKey: claim.deliveryKey, notificationType: claim.notificationType,
        expectedStatus: claim.status, expectedAttemptCount: claim.attemptCount,
        expectedLastAttemptedAt: claim.lastAttemptedAt,
        expectedRecoveryPayload: claim.recoveryPayload, expectedRecoveryPayloadIsNull: claim.recoveryPayload === null,
        expectedRecipientUserId: claim.recipientUserId, expectedRecipientUserIdIsNull: claim.recipientUserId === null,
        expectedDeliveryMode: claim.deliveryMode as AdminSdk.GovNotifyDeliveryMode | null,
        expectedDeliveryModeIsNull: claim.deliveryMode === null,
        lastAttemptedAt, provider: provider ?? null,
      })).data.notificationDelivery_updateMany === 1,
    markSent: async args => (await sdk.markNotificationDeliverySentById(db, {
      ...args, deliveryMode: args.deliveryMode as AdminSdk.GovNotifyDeliveryMode | null | undefined,
      lastErrorCode: null, lastErrorMessage: null,
    })).data.notificationDelivery_updateMany === 1,
    markSkipped: async args => (await sdk.markNotificationDeliverySkippedById(db, args)).data.notificationDelivery_updateMany === 1,
    markFailed: async args => (await sdk.markNotificationDeliveryFailedById(db, args)).data.notificationDelivery_updateMany === 1,
  };
}

async function seedReviewedOperatorRow(): Promise<Row> {
  const payload = { version: 1, kind: "BOOKING_CONFIRMATION", bookingId: randomUUID(),
    idempotencyKey: `${prefix}:operator:${fixtureSequence++}`, deliveryMode: "TEAM_TEST" };
  const row = await seed({ notificationType: "BOOKING_CONFIRMATION",
    deliveryKey: `booking-confirm:${payload.bookingId}:${payload.idempotencyKey}:notify-team_test`,
    recoveryPayload: JSON.stringify(payload) });
  expect(await defer(row)).toBe(1);
  return (await rawRow(row.id))!;
}

const operatorIdFormats = ["database", "compact-uppercase", "hyphenated", "hyphenated-uppercase"] as const;
type OperatorIdFormat = typeof operatorIdFormats[number];
function formattedOperatorId(id: string, format: OperatorIdFormat): string {
  // This is the actual generated-SDK SQL response, not a canonicalized mock fixture.
  expect(id).toMatch(/^[0-9a-f]{32}$/);
  const hyphenated = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  if (format === "database") return id;
  if (format === "compact-uppercase") return id.toUpperCase();
  return format === "hyphenated" ? hyphenated : hyphenated.toUpperCase();
}

function operatorArguments(id: string, flags: string[] = []): string[] {
  return ["--project", "sodc-web", "--delivery-id", id, "--actor", "local-sql-reviewer-no-auth",
    "--evidence-reference", "local-sql-no-provider", ...flags];
}

function operatorFixture() {
  const reads: string[] = [];
  const releases: ReleaseVariables[] = [];
  const dependencies: OperatorDependencies = {
    get: async options => {
      expect(options.deliveryId).toBeTruthy(); expect(options.deliveryKey).toBeUndefined();
      reads.push(options.deliveryId!);
      return (await sdk.getNotificationDeliveryById(db, { id: options.deliveryId! })).data.notificationDeliveries[0] ?? null;
    },
    plan: (row, attestation) => planRelease(row, attestation),
    release: async variables => {
      releases.push(variables);
      return (await sdk.releaseNotificationRecoveryDeferralForClaimById(db, variables)).data.notificationDelivery_updateMany;
    },
  };
  const run = async (id: string, flags: string[] = []) => {
    expect(freshDatabaseVerified).toBe(true);
    // Only this gated test injects transport: the SDK above is already bound to
    // the runner-owned fresh demo database. Production emulator guards stay intact.
    return runAdmin(operatorArguments(id, flags), async () => dependencies, {});
  };
  return { run, reads, releases };
}

beforeAll(async () => {
  // No Firebase SDK is loaded until this fixed demo/loopback/temp-metadata gate succeeds.
  const { assertNotificationRecoveryFixture } = await import(pathToFileURL(path.join(functionsRoot, "scripts/run-notification-recovery-integration.mjs")).href);
  const context = await assertNotificationRecoveryFixture();
  prefix = `notification-recovery-it-${context.runId}`;
  ({ runNotificationRecoveryAdmin: runAdmin } = await import("../../notificationRecoveryAdmin"));
  ({ planNotificationRecoveryRelease: planRelease } = await import("../../notificationRecoveryDeferral"));
  ({ sendNotificationOnce: sendOnce } = await import("../../notificationDelivery.js"));
  ({ sendPrivilegedNotification: sendPrivileged } = await import("../../privilegedNotificationDelivery.js"));
  ({ createNotificationRecoveryClaim: createRecoveryClaim } = await import("../../notificationRecoveryClaim.js"));
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
  expect(occupants.data.notificationDeliveries.every(row => ownedIds.includes(row.id) && ownedDeliveryKeys.get(row.id) === row.deliveryKey)).toBe(true);
  await db.executeGraphql("mutation RemoveLocalNotificationFixtures($ids: [UUID!]!) { notificationDelivery_deleteMany(where: {id: {in: $ids}}) }",
    { variables: { ids: ownedIds } });
  ownedIds = [];
  ownedDeliveryKeys = new Map();
  if (ownedUserIds.length) {
    await db.executeGraphql("mutation RemoveLocalSubjectFixtures($ids: [String!]!) { user_deleteMany(where: {id: {in: $ids}}) }",
      { variables: { ids: ownedUserIds } });
    ownedUserIds = [];
  }
});

afterAll(async () => {
  if (!apps.length) return;
  const { deleteApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  await Promise.all(apps.map(app => deleteApp(app)));
});

describe("actual local SQL notification recovery claims", () => {
  it.each(["recovery engine", "privileged final ownership callback"] as const)(
    "sends the due sixth attempt through the %s after native SQL pads the lease timestamp", async path => {
      const recipientUserId = prefix + ":local-recipient";
      const payload = { version: 2 as const, kind: "USER_PENDING_APPROVAL" as const,
        userId: prefix + ":local-subject", emailVerified: true, recipientUserId, deliveryMode: "TEAM_TEST" as const };
      const row = await seed({ notificationType: "USER_PENDING_APPROVAL", recipientUserId,
        recoveryPayload: JSON.stringify(payload) });
      const reads: Row[] = [];
      const repository = sqlDeliveryRepository(reads);
      const attemptedAt = new Date(Math.floor((Date.now() - 2_000) / 1_000) * 1_000 + 123).toISOString();
      const recoveryClaim = createRecoveryClaim({ ...row, lastAttemptedAt: row.lastAttemptedAt ?? null,
        recoveryPayload: row.recoveryPayload ?? null });
      let providerCalls = 0;
      let authorizationCalls = 0;
      const provider = async () => {
        providerCalls += 1;
        const pending = await rawRow(row.id);
        expect(pending).toMatchObject({ id: row.id, status: "PENDING", attemptCount: 6,
          deliveryKey: row.deliveryKey, recoveryPayload: row.recoveryPayload,
          recoveryDeferredAt: null, recoveryDeferredReason: null });
        // Keep the real response intact: this format difference caused the live
        // ownership check to discard a successfully acquired final retry slot.
        expect(pending!.lastAttemptedAt).toMatch(/\.123000Z$/);
        expect(pending!.lastAttemptedAt).not.toBe(attemptedAt);
        expect(Date.parse(pending!.lastAttemptedAt!)).toBe(Date.parse(attemptedAt));
        return { providerMessageId: "local-sql-provider-receipt", deliveryMode: "TEAM_TEST" as const };
      };
      const request = { channel: row.channel, notificationType: row.notificationType, deliveryKey: row.deliveryKey,
        provider: "local-sql-no-provider", deliveryMode: "TEAM_TEST" as const,
        preserveDeliveryKey: true, recipientUserId, recoveryClaim,
        recoveryPayload: { ...payload, deliveryMode: undefined } };
      const dependencies = { repository, now: () => attemptedAt };
      const result = path === "recovery engine"
        ? await sendOnce({ ...request, send: async (_mode, assertOwnership) => {
          await assertOwnership!();
          return provider();
        } }, dependencies)
        : await sendPrivileged({ ...request, scope: { kind: "ADMIN" },
          event: { kind: "APPLICANT", subjectUserId: payload.userId },
          sendAuthorized: async (email, mode) => {
            expect(email).toBe("local-sql-recipient@example.invalid"); expect(mode).toBe("TEAM_TEST");
            return provider();
          } }, {
          authorize: async uid => {
            authorizationCalls += 1; expect(uid).toBe(recipientUserId);
            return { eligible: true, recipientUserId, email: "local-sql-recipient@example.invalid" };
          },
          hasLegacyEvent: async () => false,
          delivery: dependencies,
        });
      expect(result).toMatchObject({ outcome: "sent", deliveryId: row.id, attemptCount: 6 });
      expect(providerCalls).toBe(1);
      expect(authorizationCalls).toBe(path === "recovery engine" ? 0 : 1);
      expect(reads.filter(read => read.status === "PENDING")).toHaveLength(2);
      const sent = await rawRow(row.id);
      expect(sent).toMatchObject({ id: row.id, status: "SENT", attemptCount: 6,
        providerMessageId: "local-sql-provider-receipt", deliveryKey: row.deliveryKey,
        recoveryPayload: row.recoveryPayload, recipientUserId, deliveryMode: row.deliveryMode,
        recoveryDeferredAt: null, recoveryDeferredReason: null, createdAt: row.createdAt });
      expect(sent!.lastAttemptedAt).toBe(reads.find(read => read.status === "PENDING")!.lastAttemptedAt);
    });

  it("looks up only the expected delivery ID with the complete current ledger projection", async () => {
    const first = await seed(); const other = await seed();
    expect(await defer(first)).toBe(1);
    const current = await lookup(first.channel, first.deliveryKey);
    const byId = await sdk.getNotificationDeliveryById(db, { id: first.id });
    expect(byId.data.notificationDeliveries).toEqual([current]);
    expect(byId.data.notificationDeliveries[0]).toMatchObject({ id: first.id, recoveryDeferredAt: expect.any(String),
      recoveryDeferredReason: sdk.NotificationRecoveryDeferredReason.RECOVERY_DELIVERY_MODE_UNVERIFIABLE });
    expect(await lookup(other.channel, other.deliveryKey)).toEqual(other);
    expect(await rawRow(first.id)).toEqual(current);
  });

  it("returns an empty array for a nonexistent delivery ID without falling back to another row", async () => {
    const existing = await seed();
    expect((await sdk.getNotificationDeliveryById(db, { id: randomUUID() })).data.notificationDeliveries).toEqual([]);
    expect(await rawRow(existing.id)).toEqual(existing);
  });

  describe("operator orchestration with genuine database UUID responses", () => {
    it.each(operatorIdFormats)("inspects and previews a database row with a %s selector without a write", async format => {
      const row = await seedReviewedOperatorRow(); const other = await seed();
      const operator = operatorFixture(); const selector = formattedOperatorId(row.id, format);
      expect(await operator.run(selector, ["--inspect"])).toMatchObject({ result: "INSPECTED", deliveryId: row.id,
        deferredAt: row.recoveryDeferredAt, deferredReason: row.recoveryDeferredReason });
      const preview = await operator.run(selector);
      expect(preview).toMatchObject({ result: "PLAN", deliveryId: row.id, verifiedMode: "TEAM_TEST", fillsMissingDeliveryMode: false });
      expect("planHash" in preview && preview.planHash).toMatch(/^[a-f0-9]{64}$/);
      expect(operator.reads).toEqual([row.id, row.id]);
      expect(operator.releases).toEqual([]);
      expect(await rawRow(row.id)).toEqual(row); expect(await rawRow(other.id)).toEqual(other);
    });

    it.each(operatorIdFormats)("applies a database-ID reviewed hash through an equivalent %s selector and preserves physical identity", async format => {
      const row = await seedReviewedOperatorRow(); const other = await seed();
      const operator = operatorFixture();
      const originalPreview = await operator.run(row.id);
      expect(originalPreview.result).toBe("PLAN");
      if (!("planHash" in originalPreview)) throw new Error("Expected reviewed plan receipt");
      // Every accepted representation binds the same selector into the real plan hash.
      for (const equivalent of operatorIdFormats) {
        const preview = await operator.run(formattedOperatorId(row.id, equivalent));
        expect(preview).toMatchObject({ result: "PLAN", deliveryId: row.id, planHash: originalPreview.planHash });
      }
      expect(operator.releases).toEqual([]); expect(await rawRow(row.id)).toEqual(row);
      expect(await operator.run(formattedOperatorId(row.id, format), ["--apply", "--confirm-project", "sodc-web",
        "--expected-plan-hash", originalPreview.planHash])).toMatchObject({ result: "RELEASED", deliveryId: row.id,
        planHash: originalPreview.planHash, verifiedAt: expect.any(String) });
      expect(operator.releases).toHaveLength(1);
      expect(operator.releases[0]).toMatchObject({ id: row.id, deliveryKey: row.deliveryKey,
        expectedRecoveryPayload: row.recoveryPayload, expectedDeferredAt: row.recoveryDeferredAt,
        expectedAttemptCount: row.attemptCount, expectedLastAttemptedAt: row.lastAttemptedAt,
        expectedRecipientUserId: null, expectedRecipientUserIdIsNull: true,
        expectedBookingId: null, expectedBookingIdIsNull: true, expectedUserId: null, expectedUserIdIsNull: true });
      expect(operator.reads.every(id => id === row.id)).toBe(true);
      expect(await rawRow(row.id)).toEqual({ ...row, recoveryDeferredAt: null });
      expect(await rawRow(other.id)).toEqual(other);
    });

    it("refuses an unrelated delivery ID with another row's reviewed hash without a write", async () => {
      const reviewed = await seedReviewedOperatorRow(); const other = await seedReviewedOperatorRow();
      const operator = operatorFixture(); const preview = await operator.run(reviewed.id);
      if (!("planHash" in preview)) throw new Error("Expected reviewed plan receipt");
      await expect(operator.run(formattedOperatorId(other.id, "hyphenated-uppercase"), ["--apply", "--confirm-project", "sodc-web",
        "--expected-plan-hash", preview.planHash])).rejects.toMatchObject({ code: "RELEASE_PLAN_CHANGED", outcome: "NOT_APPLIED" });
      expect(operator.releases).toEqual([]);
      expect(await rawRow(reviewed.id)).toEqual(reviewed); expect(await rawRow(other.id)).toEqual(other);
    });

    it("does not select or mutate an existing row when the requested ID is missing", async () => {
      const row = await seedReviewedOperatorRow(); const operator = operatorFixture(); const missingId = randomUUID();
      for (const flags of [["--inspect"], [], ["--apply", "--confirm-project", "sodc-web", "--expected-plan-hash", "a".repeat(64)]]) {
        await expect(operator.run(missingId, flags)).rejects.toMatchObject({ code: "RELEASE_ROW_NOT_FOUND", outcome: "NOT_APPLIED" });
      }
      expect(operator.releases).toEqual([]); expect(await rawRow(row.id)).toEqual(row);
    });
  });

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
        ["recipient value", { expectedRecipientUserId: "different-recipient", expectedRecipientUserIdIsNull: false }],
        ["recipient nullness", { expectedRecipientUserIdIsNull: false }],
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

  describe("durable deferral removes ambiguous rows from both bounded automatic queues", () => {
    it.each(["FAILED", "PENDING"] as const)("reaches newer valid %s work after more than 25 older ambiguous rows across repeated scans", async status => {
      const blockers: Row[] = [];
      for (let index = 0; index < 26; index += 1) blockers.push(await seed({ status: sdk.NotificationDeliveryStatus[status],
        deliveryMode: null, lastAttemptedAt: minutesAgo(60 + index) }));
      const valid = await seed({ status: sdk.NotificationDeliveryStatus[status], lastAttemptedAt: minutesAgo(20) });
      const scan = async () => (status === "FAILED"
        ? await sdk.listFailedNotificationDeliveriesForAutomaticRecovery(db, { limit: 25 })
        : await sdk.listStalePendingNotificationDeliveriesForAutomaticRecovery(db, { limit: 25 })).data.notificationDeliveries;
      // Old deployed workers retain their original operation names and variable signatures.
      const oldVariables = { attemptedBefore: now(), maxAttemptCount: 6, limit: 25 };
      const oldFirst = status === "FAILED" ? await sdk.listFailedNotificationDeliveriesForRecovery(db, oldVariables)
        : await sdk.listStalePendingNotificationDeliveriesForRecovery(db, oldVariables);
      expect(oldFirst.data.notificationDeliveries).toHaveLength(25);
      const first = await scan();
      expect(first).toHaveLength(25); expect(first.some(row => row.id === valid.id)).toBe(false);
      for (const row of first) expect(await defer(row as Row)).toBe(1);
      const second = await scan();
      expect(second).toHaveLength(2); expect(second[1].id).toBe(valid.id);
      expect(await defer(second[0] as Row)).toBe(1);
      expect(await recover("claim", claimSnapshot(valid))).toBe(1);
      expect(await scan()).toEqual([]); expect(await scan()).toEqual([]);
      for (const row of blockers) expect(await rawRow(row.id)).toEqual({ ...row,
        recoveryDeferredAt: expect.any(String),
        recoveryDeferredReason: sdk.NotificationRecoveryDeferredReason.RECOVERY_DELIVERY_MODE_UNVERIFIABLE });
      expect(await rawRow(valid.id)).toMatchObject({ status: "PENDING", attemptCount: 6, recoveryDeferredAt: null });
    });

    it.each([
      ["recipient value", { expectedRecipientUserId: "replacement", expectedRecipientUserIdIsNull: false }],
      ["recipient nullness", { expectedRecipientUserIdIsNull: false }],
      ["payload", { expectedRecoveryPayload: "different" }],
      ["mode", { expectedDeliveryMode: "LIVE" }],
      ["attempt", { expectedAttemptCount: 4 }],
      ["timestamp", { expectedLastAttemptedAt: "2020-01-01T00:00:00Z" }],
    ])("rejects a stale deferral %s without touching history", async (_label, changed) => {
      const row = await seed();
      expect((await sdk.markNotificationRecoveryDeferredForClaimById(db, { ...deferSnapshot(row), ...changed } as AdminSdk.MarkNotificationRecoveryDeferredForClaimByIdVariables))
        .data.notificationDelivery_updateMany).toBe(0);
      expect(await rawRow(row.id)).toEqual(row);
    });

    it("rejects actual recipient drift after listing and rejects recovery mutations once deferred", async () => {
      const listed = await seed();
      const changed = await patch(listed, "recipientUserId: \"replacement-recipient\"");
      expect(await defer(listed)).toBe(0); expect(await rawRow(listed.id)).toEqual(changed);
      expect(await defer(changed)).toBe(1);
      const marked = (await rawRow(listed.id))!;
      expect(await recover("claim", claimSnapshot(marked))).toBe(0);
      expect(await recover("failure", claimSnapshot(marked))).toBe(0);
      expect(await defer(changed)).toBe(0); expect(await rawRow(listed.id)).toEqual(marked);
    });

    it.each(["claim", "failure"] as const)("serializes deferral against %s with one winner and no extra attempt", async operation => {
      const row = await seed(); const snapshot = claimSnapshot(row);
      const results = await Promise.all([defer(row, db), recover(operation, snapshot, otherDb)]);
      expect(results.sort()).toEqual([0, 1]);
      const current = (await rawRow(row.id))!;
      if (current.recoveryDeferredAt) expect(current).toEqual({ ...row, recoveryDeferredAt: expect.any(String),
        recoveryDeferredReason: sdk.NotificationRecoveryDeferredReason.RECOVERY_DELIVERY_MODE_UNVERIFIABLE });
      else expect(current).toMatchObject({ attemptCount: 6, recoveryDeferredAt: null });
    });
  });

  describe("guarded reviewed release", () => {
    it.each([null, "TEAM_TEST"] as const)("releases an exactly reviewed row with original mode %s while retaining its history", async mode => {
      const original = await seed({ deliveryMode: mode == null ? null : sdk.GovNotifyDeliveryMode[mode] });
      expect(await defer(original)).toBe(1);
      const marked = (await rawRow(original.id))!; const variables = releaseSnapshot(marked);
      expect(await release(variables)).toBe(1);
      expect(await rawRow(original.id)).toEqual({ ...marked, recoveryDeferredAt: null, deliveryMode: "TEAM_TEST" });
      expect(await release(variables)).toBe(0);
      expect((await sdk.listFailedNotificationDeliveriesForAutomaticRecovery(db, { limit: 25 })).data.notificationDeliveries.map(row => row.id)).toEqual([original.id]);
    });

    it.each([
      ["marker timestamp", { expectedDeferredAt: "2020-01-01T00:00:00Z" }],
      ["marker reason", { expectedDeferredReason: "RECOVERY_DELIVERY_MODE_CONFLICT" }],
      ["recipient", { expectedRecipientUserId: "replacement", expectedRecipientUserIdIsNull: false }],
      ["payload", { expectedRecoveryPayload: "replacement-payload" }],
      ["booking subject", { expectedBookingId: "11111111-1111-4111-8111-111111111111", expectedBookingIdIsNull: false }],
      ["user subject", { expectedUserId: "different-subject", expectedUserIdIsNull: false }],
      ["known mode override", { verifiedDeliveryMode: "LIVE" }],
    ])("rejects stale release %s without writing", async (_label, changed) => {
      const row = await seed(); expect(await defer(row)).toBe(1);
      const marked = (await rawRow(row.id))!;
      expect(await release({ ...releaseSnapshot(marked), ...changed } as AdminSdk.ReleaseNotificationRecoveryDeferralForClaimByIdVariables)).toBe(0);
      expect(await rawRow(row.id)).toEqual(marked);
    });

    it.each([
      ["advanced count", "attemptCount: 6"],
      ["fresh active lease", "status: PENDING, lastAttemptedAt: \"FRESH_TIME\""],
      ["sent terminal", "status: SENT"],
      ["skipped terminal", "status: SKIPPED"],
    ])("rejects a matching snapshot whose state is now %s", async (_label, literal) => {
      const row = await seed(); expect(await defer(row)).toBe(1);
      const current = await patch(row, literal.replace("FRESH_TIME", now()));
      expect(await release(releaseSnapshot(current))).toBe(0);
      expect(await rawRow(row.id)).toEqual(current);
    });

    it("rejects genuine subject-FK drift after review and retains its marker", async () => {
      const row = await seed(); expect(await defer(row)).toBe(1);
      const variables = releaseSnapshot((await rawRow(row.id))!);
      const subjectId = `${prefix}-subject`;
      await db.executeGraphql(`mutation InsertLocalSubject($id: String!) {
        user_insert(data: {id: $id, firstName: "Local", lastName: "Fixture", email: "local@example.invalid", serviceNumber: "LOCAL", createdBy: "local-fixture", updatedBy: "local-fixture"})
      }`, { variables: { id: subjectId } });
      ownedUserIds.push(subjectId);
      const current = await patch(row, `userId: ${JSON.stringify(subjectId)}`);
      expect(await release(variables)).toBe(0); expect(await rawRow(row.id)).toEqual(current);
    });
  });

  it("keeps the ordinary direct/manual FAILED6 to attempt-seven retry semantics", async () => {
    const row = await seed({ attemptCount: 6 });
    expect((await sdk.claimNotificationDeliveryById(db, { id: row.id, expectedStatus: row.status,
      expectedAttemptCount: 6, attemptCount: 7, lastAttemptedAt: now(), provider: "local-sql-no-provider",
      recoveryPayload: row.recoveryPayload })).data.notificationDelivery_updateMany).toBe(1);
    expect(await rawRow(row.id)).toMatchObject({ status: "PENDING", attemptCount: 7 });
  });
});
