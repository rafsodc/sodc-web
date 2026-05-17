import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";
import { scheduleBookingSubmitNotificationEmails } from "../bookings";
import {
  notifyBookingConfirmationEmail,
  notifyBookingRevisionEmail,
} from "../bookingEmailDispatcher";

vi.mock("../bookingEmailDispatcher", () => ({
  notifyBookingConfirmationEmail: vi.fn(),
  notifyBookingRevisionEmail: vi.fn(),
}));

describe("scheduleBookingSubmitNotificationEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends confirmation email for a new booking", () => {
    scheduleBookingSubmitNotificationEmails({
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

  it("sends revision email when superseding a booking", () => {
    scheduleBookingSubmitNotificationEmails({
      bookingId: "00000000-0000-0000-0000-000000000002",
      idempotencyKey: "key-2",
      appBaseUrl: "https://app.example",
      supersededBookingId: "00000000-0000-0000-0000-000000000099",
      paymentDelta: {
        previousTotalMinor: 1000,
        revisedTotalMinor: 1500,
        deltaAmountMinor: 500,
        status: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE,
      },
    });

    expect(notifyBookingRevisionEmail).toHaveBeenCalledTimes(1);
    expect(notifyBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("falls back to confirmation when superseded id is set without payment delta", () => {
    scheduleBookingSubmitNotificationEmails({
      bookingId: "00000000-0000-0000-0000-000000000003",
      idempotencyKey: "key-3",
      appBaseUrl: "https://app.example",
      supersededBookingId: "00000000-0000-0000-0000-000000000099",
    });

    expect(notifyBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(notifyBookingRevisionEmail).not.toHaveBeenCalled();
  });
});
