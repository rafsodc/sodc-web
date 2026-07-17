import { describe, expect, it } from "vitest";
import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";
import {
  NotificationRecoveryPayloadError,
  parseNotificationRecoveryPayload,
  serializeNotificationRecoveryPayload,
  type NotificationRecoveryPayload,
} from "../notificationRecoveryPayload";

describe("notification recovery payloads", () => {
  it("round-trips versioned booking revision context", () => {
    const payload: NotificationRecoveryPayload = {
      version: 1,
      kind: "BOOKING_REVISION",
      bookingId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "submission-key",
      paymentDelta: {
        previousTotalMinor: 2_000,
        revisedTotalMinor: 2_500,
        deltaAmountMinor: 500,
        status: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE,
      },
    };

    expect(parseNotificationRecoveryPayload(serializeNotificationRecoveryPayload(payload))).toEqual(
      payload
    );
  });

  it("rejects malformed and unsupported payloads", () => {
    expect(() => parseNotificationRecoveryPayload("not-json")).toThrow(
      NotificationRecoveryPayloadError
    );
    expect(() =>
      parseNotificationRecoveryPayload(
        JSON.stringify({ version: 2, kind: "BOOKING_CONFIRMATION" })
      )
    ).toThrow("version is unsupported");
  });

  it("rejects invalid domain enum values", () => {
    expect(() =>
      parseNotificationRecoveryPayload(
        JSON.stringify({
          version: 1,
          kind: "MEMBERSHIP_STATUS",
          userId: "user-1",
          previousStatus: "REGULAR",
          newStatus: "UNKNOWN",
        })
      )
    ).toThrow("newStatus is invalid");
  });
});
