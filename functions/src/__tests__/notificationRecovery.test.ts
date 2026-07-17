import { describe, expect, it, vi } from "vitest";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  createNotificationRecoveryDispatcher,
  notificationRecoveryIdentity,
} from "../notificationRecovery";
import type { RecoverableNotificationDelivery } from "../notificationRecoveryEngine";
import type { NotificationRecoveryPayload } from "../notificationRecoveryPayload";

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
    });
  });

  it("targets only the original recipient for fan-out recovery", async () => {
    const notifyGuestRequestModerators = vi.fn(async () => undefined);
    const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL, {
      notifyGuestRequestModerators,
    });
    const payload: NotificationRecoveryPayload = {
      version: 1,
      kind: "GUEST_REQUEST_MODERATORS",
      requestId: "33333333-3333-4333-8333-333333333333",
      recipientEmail: "moderator@example.com",
    };

    await dispatch(candidate(payload), payload);

    expect(notifyGuestRequestModerators).toHaveBeenCalledWith({
      requestId: payload.requestId,
      recipientEmails: [payload.recipientEmail],
      appBaseUrl: APP_BASE_URL,
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

    expect(notifyPaymentLifecycle).toHaveBeenCalledWith(payload);
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
