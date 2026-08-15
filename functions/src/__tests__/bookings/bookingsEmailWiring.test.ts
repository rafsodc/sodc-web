import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";
import { parseSitNextToUserIds, sendBookingSubmitNotificationEmails } from "../../bookings";
import {
  notifyBookingConfirmationEmail,
  notifyBookingRevisionEmail,
} from "../../bookingEmailDispatcher";

vi.mock("../../bookingEmailDispatcher", () => ({
  notifyBookingConfirmationEmail: vi.fn(),
  notifyBookingRevisionEmail: vi.fn(),
}));

describe("booking request seating preferences", () => {
  it("accepts opaque Firebase Auth UIDs and preserves their values", () => {
    expect(parseSitNextToUserIds([" user-2 ", "cGqrtuZyUBcXfz9pbSC9Jb8QE4u1"], "user-1")).toEqual([
      "user-2",
      "cGqrtuZyUBcXfz9pbSC9Jb8QE4u1",
    ]);
  });

  it("removes duplicate and blank selections", () => {
    expect(parseSitNextToUserIds(["user-2", " ", "user-2"], "user-1")).toEqual(["user-2"]);
  });

  it("rejects self-selection and oversized UIDs", () => {
    expect(() => parseSitNextToUserIds(["user-1"], "user-1")).toThrow(
      "You cannot select yourself"
    );
    expect(() => parseSitNextToUserIds(["x".repeat(129)], "user-1")).toThrow(
      "must be no more than 128 characters"
    );
  });
});

describe("sendBookingSubmitNotificationEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends confirmation email for a new booking", async () => {
    await sendBookingSubmitNotificationEmails({
      bookingId: "00000000-0000-0000-0000-000000000001",
      idempotencyKey: "key-1",
      appBaseUrl: "https://app.example",
    });

    expect(notifyBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(notifyBookingRevisionEmail).not.toHaveBeenCalled();
    expect(notifyBookingConfirmationEmail).toHaveBeenCalledWith({
      bookingId: "00000000-0000-0000-0000-000000000001",
      idempotencyKey: "key-1",
      appBaseUrl: "https://app.example",
    });
  });

  it("sends revision email when superseding a booking", async () => {
    await sendBookingSubmitNotificationEmails({
      bookingId: "00000000-0000-0000-0000-000000000002",
      idempotencyKey: "key-2",
      appBaseUrl: "https://app.example",
      supersededBookingId: "00000000-0000-0000-0000-000000000099",
      paymentDelta: {
        previousTotalMinor: 1000,
        revisedTotalMinor: 1500,
        deltaAmountMinor: 500,
        paymentRemainingMinor: 500,
        status: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE,
      },
    });

    expect(notifyBookingRevisionEmail).toHaveBeenCalledTimes(1);
    expect(notifyBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("falls back to confirmation when superseded id is set without payment delta", async () => {
    await sendBookingSubmitNotificationEmails({
      bookingId: "00000000-0000-0000-0000-000000000003",
      idempotencyKey: "key-3",
      appBaseUrl: "https://app.example",
      supersededBookingId: "00000000-0000-0000-0000-000000000099",
    });

    expect(notifyBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(notifyBookingRevisionEmail).not.toHaveBeenCalled();
  });
});
