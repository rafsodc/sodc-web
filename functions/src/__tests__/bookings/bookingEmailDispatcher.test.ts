import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import {
  accommodationRequestedCondition,
  bookingApprovedDeliveryKey,
  bookingChangesRequestedDeliveryKey,
  bookingConfirmationDeliveryKey,
  bookingPendingMemberDeliveryKey,
  bookingPendingModeratorDeliveryKey,
  bookingPendingModeratorUidDeliveryKey,
  bookingRevisionDeliveryKey,
  bookingTotalMinorFromLines,
  buildTicketLinesSummary,
  formatBookingEventDateTime,
  notifyBookingConfirmationEmail,
  notifyBookingPendingApprovalEmails,
} from "../../bookingEmailDispatcher";
import * as recipientPolicy from "../../privilegedNotificationRecipient";
import * as legacyPolicy from "../../privilegedNotificationLegacy";
import * as bookingModerators from "../../bookingModerators";
import * as notificationDelivery from "../../notificationDelivery";

const mockGetBooking = vi.spyOn(admin, "getBookingForNotification");
const mockSendOnce = vi.spyOn(notificationDelivery, "sendNotificationOnce");

const sampleLines = [
  {
    sortOrder: 0,
    guestDisplayName: null,
    dietaryNote: "No nuts",
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
    expect(formatted).toMatch(/June/);
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
    expect(bookingPendingMemberDeliveryKey("b1", "key1")).toBe("booking-pending-member:b1:key1");
    expect(bookingPendingModeratorDeliveryKey("b1", "Mod@Example.com")).toBe(
      "booking-pending-mod:b1:mod@example.com"
    );
    expect(bookingPendingModeratorUidDeliveryKey("b1", "Staff:One")).toBe("booking-pending-mod-v2:b1:Staff%3AOne");
    expect(bookingChangesRequestedDeliveryKey("b1")).toBe("booking-changes-requested:b1");
    expect(bookingApprovedDeliveryKey("b1")).toBe("booking-approved:b1");
  });

  it("accommodationRequestedCondition returns GOV.UK Notify's literal yes/no condition value", () => {
    // The optional-content ((var??text)) syntax requires the personalisation
    // value to be exactly "yes" or "no", not a boolean.
    expect(accommodationRequestedCondition(true)).toBe("yes");
    expect(accommodationRequestedCondition(false)).toBe("no");
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
          firstName: "Sam",
          eventTitle: "Annual dinner",
          sectionBookingsUrl: "https://app.example/sections/sec-1",
          myPaymentsUrl: "https://app.example/payments",
        }),
      })
    );
    const personalisation = sendEmail.mock.calls[0]?.[0]?.personalisation;
    expect(personalisation).not.toHaveProperty("memberDietaryNote");
    expect(personalisation.ticketLinesSummary).toContain("dietary: No nuts");
  });
});

describe("staff booking disclosure boundary", () => {
  const bookingId = "00000000-0000-4000-8000-000000000001";
  const sendEmail = vi.fn(async () => ({ provider: "govuk_notify" as const, providerNotificationId: "fake" }));
  beforeEach(() => {
    mockGetBooking.mockResolvedValue({ data: { booking: { id: bookingId, revisionNumber: 1,
      approvalStatus: "PENDING", accommodationRequested: false, booker: { id: "member", firstName: "Member", lastName: "One", email: "member@example.com" },
      event: { id: bookingId, title: "Event", startDateTime: "2026-10-21T12:00:00Z", endDateTime: "2026-10-21T14:00:00Z", section: { id: "section-1", name: "Section" } }, lines: sampleLines } } } as never);
    mockSendOnce.mockReset().mockResolvedValue({ outcome: "sent" }); sendEmail.mockClear();
    vi.spyOn(legacyPolicy, "hasLegacyPrivilegedNotificationEvent").mockResolvedValue(false);
    vi.spyOn(recipientPolicy, "authorizePrivilegedNotificationRecipient").mockResolvedValue({ eligible: false, reason: "RECIPIENT_AUTHORITY_REVOKED" });
  });
  it("does not let an explicit retry UID bypass the final current section check", async () => {
    await notifyBookingPendingApprovalEmails({ bookingId, idempotencyKey: "submission", appBaseUrl: "https://app.example", recipientUserIds: ["former-staff"], getMailer: () => ({ sendEmail }) });
    const member = mockSendOnce.mock.calls.find(([r]) => r.notificationType === "BOOKING_PENDING_APPROVAL_MEMBER")![0];
    const staff = mockSendOnce.mock.calls.find(([r]) => r.notificationType === "BOOKING_PENDING_APPROVAL_MODERATOR")![0];
    expect(staff).toMatchObject({ recipientUserId: "former-staff", userId: null,
      recoveryPayload: { version: 2, recipientUserId: "former-staff", bookingId } });
    expect(await staff.send("LIVE")).toMatchObject({ outcome: "skipped", reason: "RECIPIENT_AUTHORITY_REVOKED" });
    expect(recipientPolicy.authorizePrivilegedNotificationRecipient).toHaveBeenCalledWith("former-staff", { kind: "BOOKING", sectionId: "section-1" });
    await member.send("LIVE"); expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ templateName: "bookingPendingApproval", to: "member@example.com" }));
  });
  it("preserves member acknowledgement when staff discovery fails", async () => {
    vi.spyOn(bookingModerators, "resolveBookingModeratorUserIds").mockRejectedValueOnce(new Error("directory unavailable"));
    await notifyBookingPendingApprovalEmails({ bookingId, idempotencyKey: "submission", appBaseUrl: "https://app.example", getMailer: () => ({ sendEmail }) });
    expect(mockSendOnce).toHaveBeenCalledOnce();
    await mockSendOnce.mock.calls[0][0].send("LIVE"); expect(sendEmail).toHaveBeenCalledOnce();
  });
});
