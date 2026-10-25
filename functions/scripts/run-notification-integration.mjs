import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Pure gate. No Firebase, credentials, network, provider, or fixture writes before this succeeds. */
export function readNotificationIntegrationConfig(env = process.env) {
  if (env.RUN_SECURITY_INTEGRATION !== "1") throw new Error("Set RUN_SECURITY_INTEGRATION=1 to opt in");
  const projectId = env.SECURITY_INTEGRATION_PROJECT;
  if (!["sodc-web", "sodc-web-beta"].includes(projectId)) throw new Error("Only explicit Dev/Beta projects are allowed");
  if (env.SECURITY_INTEGRATION_CONFIRM !== projectId) throw new Error("SECURITY_INTEGRATION_CONFIRM must match the project");
  for (const name of ["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"]) {
    if (env[name] && env[name] !== projectId) throw new Error(`Conflicting ${name}`);
  }
  for (const [name, value] of Object.entries(env)) {
    if (name.endsWith("_EMULATOR_HOST") && value) throw new Error("Emulator overrides are not allowed in the connector release check");
  }
  if (env.FIREBASE_CONFIG) {
    let config;
    try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { throw new Error("FIREBASE_CONFIG must be explicit JSON"); }
    if (config.projectId !== projectId) throw new Error("Conflicting FIREBASE_CONFIG project");
  }
  return { projectId };
}

export async function runNotificationIntegration(env = process.env) {
  const { projectId } = readNotificationIntegrationConfig(env);
  // Admin connector operations only: this module never imports a mailer or provider.
  const [{ initializeApp, deleteApp }, { getDataConnect }, sdk] = await Promise.all([
    import("firebase-admin/app"), import("firebase-admin/data-connect"), import("@dataconnect/admin-generated"),
  ]);
  const app = initializeApp({ projectId }, `notification-integration-${randomUUID()}`);
  const dc = getDataConnect(sdk.connectorConfig, app);
  const runId = randomUUID();
  const subjectUserId = `notification-integration-${runId}`;
  const created = [];
  let failure;
  const now = new Date().toISOString();
  const ancient = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  // Deliberately beyond the scheduler's retry limit. Even an overlapping recovery worker cannot select fixtures.
  const fixtureAttempt = 100;
  try {
    await sdk.createUser(dc, { userId: subjectUserId, firstName: "Synthetic", lastName: "Notification fixture",
      email: `${runId}@example.invalid`, serviceNumber: `fixture-${runId}`, membershipStatus: sdk.MembershipStatus.PENDING, now });
    for (const [index, mode] of ["LIVE", "TEAM_TEST", "SIMULATION"].entries()) {
      for (const status of ["SENT", "FAILED", "PENDING"]) {
        const deliveryKey = `pending-approval:${subjectUserId}:fixture-${index}-${status}@example.invalid:notify-${mode.toLowerCase()}`;
        const fixture = { id: null, deliveryKey, mode, status };
        created.push(fixture);
        const result = await sdk.createNotificationDelivery(dc, {
          channel: sdk.NotificationChannel.EMAIL, notificationType: "USER_PENDING_APPROVAL", deliveryKey,
          userId: subjectUserId, status: sdk.NotificationDeliveryStatus[status], deliveryMode: mode,
          recoveryPayload: JSON.stringify({ version: 1, kind: "INTEGRATION_FIXTURE_NO_PROVIDER", deliveryMode: mode }),
          attemptCount: fixtureAttempt, lastAttemptedAt: ancient,
        });
        fixture.id = result.data.notificationDelivery_insert.id;
      }
    }
    const legacy = await sdk.listLegacyApplicantStaffNotificationDeliveries(dc, { subjectUserId });
    assert.equal(legacy.data.notificationDeliveries.length, 9);
    for (const mode of ["LIVE", "TEAM_TEST", "SIMULATION"]) {
      assert.equal(legacy.data.notificationDeliveries.filter((row) => row.deliveryMode === mode).length, 3);
    }
    const pending = created.find((row) => row.status === "PENDING");
    const skipArgs = { id: pending.id, attemptCount: fixtureAttempt, lastAttemptedAt: ancient, skippedAt: now, skipReason: "INTEGRATION_FIXTURE_SUPPRESSED" };
    assert.equal((await sdk.markNotificationDeliverySkippedById(dc, { ...skipArgs, attemptCount: fixtureAttempt - 1 })).data.notificationDelivery_updateMany, 0);
    assert.equal((await sdk.markNotificationDeliverySkippedById(dc, { ...skipArgs, lastAttemptedAt: now })).data.notificationDelivery_updateMany, 0);
    assert.equal((await sdk.markNotificationDeliverySkippedById(dc, skipArgs)).data.notificationDelivery_updateMany, 1);
    assert.equal((await sdk.markNotificationDeliverySkippedById(dc, skipArgs)).data.notificationDelivery_updateMany, 0);
    const lookup = await sdk.getNotificationDeliveryByChannelAndKey(dc, { channel: sdk.NotificationChannel.EMAIL, deliveryKey: pending.deliveryKey });
    const skipped = lookup.data.notificationDeliveries[0];
    assert.equal(skipped.status, "SKIPPED"); assert.equal(skipped.skipReason, "INTEGRATION_FIXTURE_SUPPRESSED");
    assert.ok(skipped.skippedAt); assert.equal(skipped.sentAt ?? null, null); assert.equal(skipped.providerMessageId ?? null, null);
    const retryArgs = { attemptedBefore: future, maxAttemptCount: fixtureAttempt + 1, limit: 1000 };
    const [failed, stale] = await Promise.all([
      sdk.listFailedNotificationDeliveriesForRecovery(dc, retryArgs), sdk.listStalePendingNotificationDeliveriesForRecovery(dc, retryArgs),
    ]);
    assert.ok(!failed.data.notificationDeliveries.some((row) => row.id === pending.id));
    assert.ok(!stale.data.notificationDeliveries.some((row) => row.id === pending.id));
    assert.ok(failed.data.notificationDeliveries.some((row) => row.id === created.find((r) => r.status === "FAILED").id));
    assert.ok(stale.data.notificationDeliveries.some((row) => row.id === created.find((r) => r.status === "PENDING" && r.id !== pending.id).id));
  } catch (error) {
    failure = error;
  } finally {
    let cleanupFailed = false;
    for (const row of created) {
      try {
        const id = row.id ?? (await sdk.getNotificationDeliveryByChannelAndKey(dc, {
          channel: sdk.NotificationChannel.EMAIL, deliveryKey: row.deliveryKey,
        })).data.notificationDeliveries[0]?.id;
        if (id) await sdk.deleteNotificationDeliveryIntegrationFixture(dc, { id, deliveryKey: row.deliveryKey });
      } catch { cleanupFailed = true; }
    }
    // Also clean up if the profile write succeeded but its response was lost.
    if (!cleanupFailed) {
      try { await sdk.deleteUser(dc, { userId: subjectUserId }); } catch { cleanupFailed = true; }
    }
    await deleteApp(app);
    if (cleanupFailed) {
      console.error(`Synthetic notification fixture cleanup incomplete for run ${runId}.`);
      failure = new Error("Synthetic notification fixture cleanup failed; inspect this run before repeating");
    }
  }
  if (failure) throw failure;
  console.log(`Notification connector checks passed for ${projectId}: SKIPPED CAS, terminal query exclusions, 9 synthetic legacy states/modes, fixture cleanup. Provider calls: 0.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runNotificationIntegration().catch((error) => {
    console.error(`Notification integration check stopped: ${error instanceof Error ? error.name : "unknown error"}. Check opt-in configuration and connector diagnostics.`);
    process.exitCode = 1;
  });
}
