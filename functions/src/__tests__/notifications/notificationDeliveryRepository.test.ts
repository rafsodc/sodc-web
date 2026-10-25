import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import * as logger from "firebase-functions/logger";
import { createNotificationRecoveryClaim } from "../../notificationRecoveryClaim";
import { sendNotificationOnce } from "../../notificationDelivery";
import { notifyBookingConfirmationEmail } from "../../bookingEmailDispatcher";

vi.mock("../../govNotifyDeliveryConfiguration", () => ({
  resolveRuntimeGovNotifyDeliveryMode: vi.fn(async (mode = "LIVE") => ({ effectiveMode: mode })),
}));
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
  it.each(["original-staff", null] as const)("maps a recovery snapshot and nullable recipient (%s) to the separate atomic claim without caller-supplied new count", async (recipientUserId) => {
    const old = "2026-10-21T09:00:00.123456Z";
    const snapshot = { id, channel: sdk.NotificationChannel.EMAIL, notificationType: "USER_PENDING_APPROVAL", deliveryKey: "staff-key:notify-team_test",
      recipientUserId, recoveryPayload: "original persisted JSON", status: sdk.NotificationDeliveryStatus.FAILED, attemptCount: 5, lastAttemptedAt: old, deliveryMode: "TEAM_TEST" as const };
    vi.mocked(sdk.getNotificationDeliveryByChannelAndKey).mockResolvedValue({ data: { notificationDeliveries: [snapshot] } } as never);
    const ordinaryClaim = vi.spyOn(sdk, "claimNotificationDeliveryById");
    const recoveryClaim = vi.spyOn(sdk, "claimNotificationDeliveryForRecoveryById").mockImplementation(async () => {
      Object.assign(snapshot, { status: sdk.NotificationDeliveryStatus.PENDING, attemptCount: 6, lastAttemptedAt: now });
      return { data: { notificationDelivery_updateMany: 1 } } as never;
    });
    vi.spyOn(sdk, "markNotificationDeliverySentById").mockResolvedValue({ data: { notificationDelivery_updateMany: 1 } } as never);
    const send = vi.fn(async () => ({}));
    expect(await sendNotificationOnce({ channel: snapshot.channel, notificationType: snapshot.notificationType, deliveryKey: snapshot.deliveryKey,
      preserveDeliveryKey: true, recipientUserId: recipientUserId ?? undefined, deliveryMode: "TEAM_TEST", recoveryClaim: createNotificationRecoveryClaim(snapshot), send }, { now: () => now }))
      .toMatchObject({ outcome: "sent", attemptCount: 6 });
    expect(recoveryClaim).toHaveBeenCalledExactlyOnceWith({ id, channel: snapshot.channel, deliveryKey: snapshot.deliveryKey,
      notificationType: snapshot.notificationType, expectedStatus: sdk.NotificationDeliveryStatus.FAILED, expectedAttemptCount: 5,
      expectedRecipientUserId: recipientUserId, expectedRecipientUserIdIsNull: recipientUserId === null,
      expectedLastAttemptedAt: old, expectedRecoveryPayload: snapshot.recoveryPayload, expectedRecoveryPayloadIsNull: false,
      expectedDeliveryMode: "TEAM_TEST", expectedDeliveryModeIsNull: false, lastAttemptedAt: now, provider: null });
    expect(ordinaryClaim).not.toHaveBeenCalled(); expect(sdk.createNotificationDelivery).not.toHaveBeenCalled(); expect(send).toHaveBeenCalledOnce();
  });

  it.each(["null", "undefined", "non-null", "drift-after-claim"] as const)("binds nullable recipients on the real booking confirmation path (%s)", async (recipientCase) => {
    const old = "2026-10-21T09:00:00.000Z";
    const snapshot = { id, channel: sdk.NotificationChannel.EMAIL, notificationType: "BOOKING_CONFIRMATION",
      deliveryKey: `booking-confirm:${id}:original:notify-live`, recoveryPayload: "original booking context",
      status: sdk.NotificationDeliveryStatus.FAILED, attemptCount: 5, lastAttemptedAt: old,
      recipientUserId: recipientCase === "non-null" ? "staff-binding" : recipientCase === "undefined" ? undefined : null,
      deliveryMode: "LIVE" as const };
    const claim = createNotificationRecoveryClaim(snapshot);
    vi.mocked(sdk.getNotificationDeliveryByChannelAndKey).mockResolvedValue({ data: { notificationDeliveries: [snapshot] } } as never);
    const atomicClaim = vi.spyOn(sdk, "claimNotificationDeliveryForRecoveryById").mockImplementation(async (args) => {
      Object.assign(snapshot, { status: sdk.NotificationDeliveryStatus.PENDING, attemptCount: 6,
        lastAttemptedAt: args.lastAttemptedAt, recipientUserId: recipientCase === "drift-after-claim" ? "replacement-recipient" : snapshot.recipientUserId });
      return { data: { notificationDelivery_updateMany: 1 } } as never;
    });
    vi.spyOn(sdk, "markNotificationDeliverySentById").mockResolvedValue({ data: { notificationDelivery_updateMany: 1 } } as never);
    vi.spyOn(sdk, "getBookingForNotification").mockResolvedValue({ data: { booking: {
      id, revisionNumber: 1, approvalStatus: "PENDING", accommodationRequested: false, lines: [],
      booker: { id: "member-subject", firstName: "Member", lastName: "One", email: "member@example.invalid" },
      event: { id, title: "Offline event", startDateTime: old, endDateTime: old, section: { id, name: "Section" } },
    } } } as never);
    const provider = vi.fn(async () => ({ providerNotificationId: "offline-booking" }));
    await notifyBookingConfirmationEmail({ bookingId: id, idempotencyKey: "original", appBaseUrl: "https://app.example",
      deliveryMode: "LIVE", recoveryClaim: claim, getMailer: () => ({ sendEmail: provider }) as never });
    if (recipientCase === "non-null") {
      expect(atomicClaim).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
    } else {
      expect(atomicClaim).toHaveBeenCalledWith(expect.objectContaining({ expectedRecipientUserId: null, expectedRecipientUserIdIsNull: true }));
      if (recipientCase === "drift-after-claim") expect(provider).not.toHaveBeenCalled();
      else expect(provider).toHaveBeenCalledOnce();
    }
    expect(sdk.createNotificationDelivery).not.toHaveBeenCalled();
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
