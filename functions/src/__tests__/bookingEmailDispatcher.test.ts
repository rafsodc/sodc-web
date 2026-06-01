import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import {
  bookingConfirmationDeliveryKey,
  bookingRevisionDeliveryKey,
  bookingTotalMinorFromLines,
  buildTicketLinesSummary,
  formatBookingEventDateTime,
  formatSignedDeltaAmount,
  notifyBookingConfirmationEmail,
  paymentAdjustmentStatusLabel,
} from "../bookingEmailDispatcher";
import * as notificationDelivery from "../notificationDelivery";

const mockGetBooking = vi.spyOn(admin, "getBookingForNotification");
const mockSendOnce = vi.spyOn(notificationDelivery, "sendNotificationOnce");

const sampleLines = [
  {
    sortOrder: 0,
    guestDisplayName: null,
    dietaryNote: null,
    ticketType: { title: "Member ticket", audience: "MEMBER", price: 25 },
  },
  {
    sortOrder: 1,
    guestDisplayName: "Jamie Guest",
    dietaryNote: "Vegan",
    ticketType: { title: "Guest ticket", audience: "GUEST", price: 10 },
  },
];

describe("bookingEmailDispatcher helpers", () => {
  it("formats event date/time for same-day events", () => {
    const formatted = formatBookingEventDateTime("2026-06-01T18:00:00.000Z", "2026-06-01T22:00:00.000Z");
    expect(formatted).toMatch(/Jun/);
    expect(formatted).toMatch(/–/);
  });

  it("sums booking line prices in minor units", () => {
    expect(bookingTotalMinorFromLines(sampleLines)).toBe(3500);
  });

  it("builds ticket line summary", () => {
    const summary = buildTicketLinesSummary(sampleLines);
    expect(summary).toContain("Member ticket");
    expect(summary).toContain("Jamie Guest");
    expect(summary).toContain("Vegan");
  });

  it("builds stable delivery keys", () => {
    expect(bookingConfirmationDeliveryKey("b1", "key1")).toBe("booking-confirm:b1:key1");
    expect(bookingRevisionDeliveryKey("b1", "key1")).toBe("booking-revision:b1:key1");
  });

  it("labels payment adjustment status", () => {
    expect(paymentAdjustmentStatusLabel(BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE)).toBe(
      "Additional payment due"
    );
    expect(formatSignedDeltaAmount(1500)).toBe("+15.00 GBP");
    expect(formatSignedDeltaAmount(-500)).toBe("-5.00 GBP");
  });
});

describe("notifyBookingConfirmationEmail", () => {
  beforeEach(() => {
    mockGetBooking.mockReset();
    mockSendOnce.mockReset();
    mockSendOnce.mockResolvedValue({ outcome: "sent" });
  });

  it("sends confirmation via sendNotificationOnce", async () => {
    mockGetBooking.mockResolvedValue({
      data: {
        booking: {
          id: "00000000-0000-4000-8000-000000000001",
          revisionNumber: 1,
          bookerDietaryNote: "None",
          sitNextToUserIds: [],
          accommodationRequested: false,
          accommodationNote: null,
          booker: {
            id: "user-1",
            firstName: "Sam",
            lastName: "Booker",
            email: "Sam@Example.COM",
          },
          event: {
            id: "evt-1",
            title: "Annual dinner",
            location: "Main Hall",
            startDateTime: "2026-06-01T18:00:00.000Z",
            endDateTime: "2026-06-01T22:00:00.000Z",
            section: { id: "sec-1", name: "Events" },
          },
          lines: sampleLines,
        },
      },
    } as never);

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "govuk_notify",
      providerNotificationId: "n-1",
    });

    await notifyBookingConfirmationEmail({
      bookingId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "00000000-0000-4000-8000-000000000099",
      appBaseUrl: "https://app.example/",
      getMailer: () => ({ sendEmail }),
    });

    expect(mockSendOnce).toHaveBeenCalledTimes(1);
    expect(mockSendOnce.mock.calls[0][0].notificationType).toBe("BOOKING_CONFIRMATION");
    await mockSendOnce.mock.calls[0][0].send();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "bookingConfirmation",
        to: "sam@example.com",
        personalisation: expect.objectContaining({
          eventTitle: "Annual dinner",
          sectionBookingsUrl: "https://app.example/sections/sec-1",
          myPaymentsUrl: "https://app.example/payments",
        }),
      })
    );
  });
});
