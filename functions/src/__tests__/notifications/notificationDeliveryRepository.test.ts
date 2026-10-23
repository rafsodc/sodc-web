import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import * as logger from "firebase-functions/logger";
import { createNotificationRecoveryClaim } from "../../notificationRecoveryClaim";
import { sendNotificationOnce } from "../../notificationDelivery";
const id = "11111111-1111-4111-8111-111111111111";
const now = "2026-10-21T10:00:00.000Z";
describe("production notification repository adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sdk, "getNotificationDeliveryByChannelAndKey").mockResolvedValue({ data: { notificationDeliveries: [] } } as never);
    vi.spyOn(sdk, "createNotificationDelivery").mockResolvedValue({ data: { notificationDelivery_insert: { id } } } as never);
    vi.spyOn(sdk, "markNotificationDeliverySkippedById").mockResolvedValue({ data: { notificationDelivery_updateMany: 1 } } as never);
    vi.spyOn(sdk, "markNotificationDeliveryFailedById").mockResolvedValue({ data: { notificationDelivery_updateMany: 1 } } as never);
  });
  it("persists separate recipient identity and maps skip completion to the full lease CAS mutation", async () => {
    expect(await sendNotificationOnce({ channel: sdk.NotificationChannel.EMAIL, notificationType: "USER_PENDING_APPROVAL",
      deliveryKey: "staff-key", userId: "applicant", recipientUserId: "original-admin", deliveryMode: "TEAM_TEST",
      recoveryPayload: { version: 2, kind: "USER_PENDING_APPROVAL", userId: "applicant", emailVerified: true, recipientUserId: "original-admin" },
      send: async () => ({ outcome: "skipped", reason: "RECIPIENT_DISABLED" }) }, { now: () => now }))
      .toMatchObject({ outcome: "skipped", deliveryId: id });
    expect(sdk.createNotificationDelivery).toHaveBeenCalledWith(expect.objectContaining({ userId: "applicant",
      recipientUserId: "original-admin", deliveryMode: "TEAM_TEST", deliveryKey: "staff-key:notify-team_test" }));
    expect(sdk.markNotificationDeliverySkippedById).toHaveBeenCalledWith({ id, attemptCount: 1, lastAttemptedAt: now,
      skippedAt: now, skipReason: "RECIPIENT_DISABLED" });
  });
  it("does not reclaim an existing terminal skip", async () => {
    vi.mocked(sdk.getNotificationDeliveryByChannelAndKey).mockResolvedValue({ data: { notificationDeliveries: [{ id,
      status: sdk.NotificationDeliveryStatus.SKIPPED, attemptCount: 2, lastAttemptedAt: now }] } } as never);
    const send = vi.fn();
    expect(await sendNotificationOnce({ channel: sdk.NotificationChannel.EMAIL, notificationType: "USER_PENDING_APPROVAL",
      deliveryKey: "key", send }, { now: () => now })).toMatchObject({ outcome: "skipped", reason: "already_skipped" });
    expect(send).not.toHaveBeenCalled(); expect(sdk.createNotificationDelivery).not.toHaveBeenCalled();
  });
  it("maps a recovery snapshot to the separate atomic claim without caller-supplied new count", async () => {
    const old = "2026-10-21T09:00:00.123456Z";
    const snapshot = { id, channel: sdk.NotificationChannel.EMAIL, notificationType: "USER_PENDING_APPROVAL", deliveryKey: "staff-key:notify-team_test",
      recoveryPayload: "original persisted JSON", status: sdk.NotificationDeliveryStatus.FAILED, attemptCount: 5, lastAttemptedAt: old, deliveryMode: "TEAM_TEST" as const };
    vi.mocked(sdk.getNotificationDeliveryByChannelAndKey).mockResolvedValue({ data: { notificationDeliveries: [snapshot] } } as never);
    const ordinaryClaim = vi.spyOn(sdk, "claimNotificationDeliveryById");
    const recoveryClaim = vi.spyOn(sdk, "claimNotificationDeliveryForRecoveryById").mockResolvedValue({ data: { notificationDelivery_updateMany: 1 } } as never);
    vi.spyOn(sdk, "markNotificationDeliverySentById").mockResolvedValue({ data: { notificationDelivery_updateMany: 1 } } as never);
    const send = vi.fn(async () => ({}));
    expect(await sendNotificationOnce({ channel: snapshot.channel, notificationType: snapshot.notificationType, deliveryKey: snapshot.deliveryKey,
      preserveDeliveryKey: true, deliveryMode: "TEAM_TEST", recoveryClaim: createNotificationRecoveryClaim(snapshot), send }, { now: () => now }))
      .toMatchObject({ outcome: "sent", attemptCount: 6 });
    expect(recoveryClaim).toHaveBeenCalledExactlyOnceWith({ id, channel: snapshot.channel, deliveryKey: snapshot.deliveryKey,
      notificationType: snapshot.notificationType, expectedStatus: sdk.NotificationDeliveryStatus.FAILED, expectedAttemptCount: 5,
      expectedLastAttemptedAt: old, expectedRecoveryPayload: snapshot.recoveryPayload, expectedRecoveryPayloadIsNull: false,
      expectedDeliveryMode: "TEAM_TEST", expectedDeliveryModeIsNull: false, lastAttemptedAt: now, provider: null });
    expect(ordinaryClaim).not.toHaveBeenCalled(); expect(sdk.createNotificationDelivery).not.toHaveBeenCalled(); expect(send).toHaveBeenCalledOnce();
  });

  it("keeps private provider request details out of staff ledgers and logs", async () => {
    vi.mocked(logger.error).mockClear();
    await sendNotificationOnce({ channel: sdk.NotificationChannel.EMAIL, notificationType: "USER_PENDING_APPROVAL",
      deliveryKey: "staff-key", recipientUserId: "staff", send: async () => { throw new Error("private@example.com dietary confidential applicant data"); } }, { now: () => now });
    expect(sdk.markNotificationDeliveryFailedById).toHaveBeenCalledWith(expect.objectContaining({ lastErrorCode: "PRIVILEGED_DELIVERY_FAILED",
      lastErrorMessage: "Privileged notification delivery failed" }));
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(/private@example|dietary|confidential/);
  });
});
