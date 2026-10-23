import { describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  createNotificationRecoveryDispatcher,
  notificationRecoveryIdentity,
  recordNotificationRecoveryFailureForClaim,
} from "../../notificationRecovery";
import type { RecoverableNotificationDelivery } from "../../notificationRecoveryEngine";
import type { NotificationRecoveryPayload } from "../../notificationRecoveryPayload";

const APP_BASE_URL = "https://app.example";
const CREATED_AT = "2026-07-17T12:00:00.000Z";

function candidate(
  payload: NotificationRecoveryPayload
): RecoverableNotificationDelivery {
  const identity = notificationRecoveryIdentity(payload);
  return {
    id: "11111111-1111-4111-8111-111111111111" as UUIDString,
    channel: NotificationChannel.EMAIL,
    notificationType: identity.notificationType,
    deliveryKey: identity.deliveryKey,
    recoveryPayload: JSON.stringify(payload),
    status: NotificationDeliveryStatus.FAILED,
    attemptCount: 1,
    lastAttemptedAt: CREATED_AT,
    createdAt: CREATED_AT,
    deliveryMode: "LIVE",
  };
}

describe("notification recovery dispatch routing", () => {
  it("routes booking confirmation context to the booking dispatcher", async () => {
    const notifyBookingConfirmation = vi.fn(async () => undefined);
    const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL, {
      notifyBookingConfirmation,
    });
    const payload: NotificationRecoveryPayload = {
      version: 1,
      kind: "BOOKING_CONFIRMATION",
      bookingId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "submission-1",
    };

    await dispatch(candidate(payload), payload);

    expect(notifyBookingConfirmation).toHaveBeenCalledWith({
      bookingId: payload.bookingId,
      idempotencyKey: payload.idempotencyKey,
      appBaseUrl: APP_BASE_URL,
      deliveryMode: "LIVE",
      recoveryClaim: expect.objectContaining({ id: candidate(payload).id, deliveryKey: candidate(payload).deliveryKey }),
    });
  });

  it("recovers a booking moderation alert for only its original organiser", async () => {
    const notifyBookingPending = vi.fn(async () => undefined);
    const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL, { notifyBookingPending });
    const payload: NotificationRecoveryPayload = {
      version: 2,
      kind: "BOOKING_PENDING_MODERATOR",
      bookingId: "77777777-7777-4777-8777-777777777777",
      recipientUserId: "original-moderator",
    };

    await dispatch({ ...candidate(payload), recipientUserId: payload.recipientUserId, subjectBookingId: payload.bookingId }, payload);

    expect(notifyBookingPending).toHaveBeenCalledWith({
      bookingId: payload.bookingId,
      idempotencyKey: `recovery:${payload.bookingId}`,
      recipientUserIds: [payload.recipientUserId],
      recoveryDeliveryKey: candidate(payload).deliveryKey,
      notifyMember: false,
      appBaseUrl: APP_BASE_URL,
      deliveryMode: "LIVE",
      recoveryClaim: expect.objectContaining({ id: candidate(payload).id, deliveryKey: candidate(payload).deliveryKey }),
    });
  });

  it("routes payment lifecycle context without changing its event identity", async () => {
    const notifyPaymentLifecycle = vi.fn(async () => undefined);
    const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL, {
      notifyPaymentLifecycle,
    });
    const payload: NotificationRecoveryPayload = {
      version: 1,
      kind: "PAYMENT_LIFECYCLE",
      type: "PAYMENT_REFUNDED",
      orderId: "44444444-4444-4444-8444-444444444444",
      eventId: "55555555-5555-4555-8555-555555555555",
      stripeEventId: "evt_refund_1",
      status: null,
      occurredAt: CREATED_AT,
      userId: "user-1",
    };

    await dispatch(candidate(payload), payload);

    expect(notifyPaymentLifecycle).toHaveBeenCalledWith(payload, expect.objectContaining({ id: candidate(payload).id, deliveryKey: candidate(payload).deliveryKey }), "LIVE");
  });

  it("rejects payloads that do not reproduce the ledger delivery key", async () => {
    const notifyBookingConfirmation = vi.fn(async () => undefined);
    const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL, {
      notifyBookingConfirmation,
    });
    const payload: NotificationRecoveryPayload = {
      version: 1,
      kind: "BOOKING_CONFIRMATION",
      bookingId: "66666666-6666-4666-8666-666666666666",
      idempotencyKey: "submission-1",
    };
    const mismatched = {
      ...candidate(payload),
      deliveryKey: "booking-confirm:other:key",
    };

    await expect(dispatch(mismatched, payload)).rejects.toThrow(
      "does not match its ledger identity"
    );
    expect(notifyBookingConfirmation).not.toHaveBeenCalled();
  });
});

describe("applicant privileged recovery identity", () => {
  const payload = { version: 2, kind: "USER_PENDING_APPROVAL", userId: "applicant", emailVerified: true, recipientUserId: "original-admin" } as const;
  it("keeps the applicant subject separate and only retries the original staff UID", async () => {
    const notifyPendingApproval = vi.fn(async () => undefined);
    const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL, { notifyPendingApproval });
    const row = { ...candidate(payload), recipientUserId: "original-admin", subjectUserId: "applicant" };
    await dispatch(row, payload);
    expect(notifyPendingApproval).toHaveBeenCalledWith({ userId: "applicant", emailVerified: true,
      recipientUserIds: ["original-admin"], recoveryDeliveryKey: row.deliveryKey, appBaseUrl: APP_BASE_URL, deliveryMode: "LIVE",
      recoveryClaim: expect.objectContaining({ id: row.id, deliveryKey: row.deliveryKey }) });
  });
  it.each([{ recipientUserId: "replacement-admin", subjectUserId: "applicant" }, { recipientUserId: "original-admin", subjectUserId: "other-applicant" }])("rejects mismatched applicant/recipient ledger metadata", async (metadata) => {
      const notifyPendingApproval = vi.fn(async () => undefined);
      const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL, { notifyPendingApproval });
      await expect(dispatch({ ...candidate(payload), ...metadata }, payload)).rejects.toThrow(/ledger identity/);
      expect(notifyPendingApproval).not.toHaveBeenCalled();
    });
  it("terminal-skips an email-only applicant recovery without interpreting that email as a current UID", async () => {
    const old = { version: 1, kind: "USER_PENDING_APPROVAL", userId: "applicant", emailVerified: true, recipientEmail: "reassigned@example.com" } as const;
    const notifyPendingApproval = vi.fn(async () => undefined);
    const sendNotification = vi.fn(async (request) => {
      expect(await request.send()).toMatchObject({ outcome: "skipped", reason: "LEGACY_RECIPIENT_IDENTITY_UNVERIFIABLE" });
      return { outcome: "skipped" as const };
    });
    await createNotificationRecoveryDispatcher(APP_BASE_URL, { notifyPendingApproval, sendNotification })(candidate(old), old);
    expect(notifyPendingApproval).not.toHaveBeenCalled(); expect(sendNotification).toHaveBeenCalledOnce();
  });
});


describe("scheduled recovery failure operation compatibility", () => {
  it.each([0, 1])("calls only the new guarded operation when it returns %i affected rows", async (affected) => {
    const payload: NotificationRecoveryPayload = { version: 1, kind: "BOOKING_CONFIRMATION", bookingId: "22222222-2222-4222-8222-222222222222", idempotencyKey: "original", deliveryMode: "LIVE" };
    const original = { ...candidate(payload), attemptCount: 5, lastAttemptedAt: "2026-10-23T19:30:00.123456Z" };
    const legacy = vi.spyOn(sdk, "recordNotificationRecoveryFailureById").mockImplementation(async () => { throw new Error("New recovery must not call the legacy operation"); });
    const guarded = vi.spyOn(sdk, "recordNotificationRecoveryFailureForClaimById").mockResolvedValue({ data: { notificationDelivery_updateMany: affected } } as never);
    const now = "2026-10-23T20:00:00.000Z";
    expect(await recordNotificationRecoveryFailureForClaim(original, now)).toBe(affected === 1);
    expect(guarded).toHaveBeenCalledExactlyOnceWith({ id: original.id, channel: original.channel, deliveryKey: original.deliveryKey,
      notificationType: original.notificationType, expectedStatus: original.status, expectedAttemptCount: 5,
      expectedLastAttemptedAt: original.lastAttemptedAt, expectedRecoveryPayload: original.recoveryPayload, expectedRecoveryPayloadIsNull: false,
      expectedDeliveryMode: "LIVE", expectedDeliveryModeIsNull: false, lastAttemptedAt: now,
      lastErrorCode: "RECOVERY_DISPATCH_FAILED", lastErrorMessage: "Recovery dispatch did not complete the notification delivery" });
    expect(legacy).not.toHaveBeenCalled();
    legacy.mockRestore(); guarded.mockRestore();
  });
});
