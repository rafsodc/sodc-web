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
  notifyBookingApprovedEmail,
  notifyBookingChangesRequestedEmail,
  notifyBookingConfirmationEmail,
  notifyBookingRevisionEmail,
  notifyBookingPendingApprovalEmails,
} from "../../bookingEmailDispatcher";
import * as recipientPolicy from "../../privilegedNotificationRecipient";
import * as legacyPolicy from "../../privilegedNotificationLegacy";
import * as bookingModerators from "../../bookingModerators";
import * as notificationDelivery from "../../notificationDelivery";
import * as mailer from "../../mailer";
import { createNotificationRecoveryDispatcher, notificationRecoveryIdentity } from "../../notificationRecovery";
import type { NotificationRecoveryPayload } from "../../notificationRecoveryPayload";

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
          sectionBookingsUrl: "https://app.example/sections/sec-1/events/evt-1?tab=book",
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

describe("canonical booking links in actual mailer personalisation", () => {
  const bookingId = "00000000-0000-4000-8000-000000000001";
  const eventId = "00000000-0000-4000-8000-000000000002";
  const sectionId = "00000000-0000-4000-8000-000000000003";
  const sendEmail = vi.fn(async (_args: unknown) => ({ provider: "govuk_notify" as const, providerNotificationId: "offline-only" }));
  const args = { bookingId, idempotencyKey: "submission", appBaseUrl: "https://app.example///", getMailer: () => ({ sendEmail }) };
  const paymentDelta = { previousTotalMinor: 1000, revisedTotalMinor: 2000, deltaAmountMinor: 1000,
    paymentRemainingMinor: 1000, status: admin.BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE };
  const memberUrl = `https://app.example/sections/${sectionId}/events/${eventId}?tab=book`;
  const managementUrl = `https://app.example/sections/${sectionId}/manage/events/${eventId}?task=approvals`;

  beforeEach(() => {
    mockGetBooking.mockReset().mockResolvedValue({ data: { booking: {
      id: bookingId, revisionNumber: 1, approvalStatus: "PENDING", accommodationRequested: false,
      booker: { id: "member", firstName: "Member", lastName: "One", email: "member@example.invalid" },
      event: { id: eventId, title: "Offline event", startDateTime: "2026-10-28T12:00:00Z",
        endDateTime: "2026-10-28T14:00:00Z", section: { id: sectionId, name: "Section" } }, lines: sampleLines,
    } } } as never);
    mockSendOnce.mockReset().mockImplementation(async (request) => {
      await request.send("LIVE");
      return { outcome: "sent" };
    });
    sendEmail.mockClear();
    vi.spyOn(mailer, "createConfiguredGovNotifyMailer").mockReturnValue({ sendEmail } as never);
    vi.spyOn(legacyPolicy, "hasLegacyPrivilegedNotificationEvent").mockResolvedValue(false);
    vi.spyOn(recipientPolicy, "authorizePrivilegedNotificationRecipient").mockResolvedValue({ eligible: true, email: "staff@example.invalid" });
  });

  it.each([
    ["bookingConfirmation", () => notifyBookingConfirmationEmail(args)],
    ["bookingRevision", () => notifyBookingRevisionEmail({ ...args, paymentDelta })],
    ["bookingPendingApproval", () => notifyBookingPendingApprovalEmails({ ...args, recipientUserIds: [] })],
    ["bookingChangesRequested", () => notifyBookingChangesRequestedEmail(args)],
    ["bookingApproved", () => notifyBookingApprovedEmail(args)],
  ] as const)("links %s directly to the member event booking", async (templateName, notify) => {
    await notify();
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      templateName, to: "member@example.invalid",
      personalisation: expect.objectContaining({ sectionBookingsUrl: memberUrl, myPaymentsUrl: "https://app.example/payments" }),
    }));
  });

  it("links an authorised moderator directly to the event approval task", async () => {
    await notifyBookingPendingApprovalEmails({ ...args, recipientUserIds: ["staff"], notifyMember: false });
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      templateName: "bookingPendingApprovalModerator", to: "staff@example.invalid",
      personalisation: expect.objectContaining({ moderationUrl: managementUrl }),
    }));
    expect(recipientPolicy.authorizePrivilegedNotificationRecipient).toHaveBeenCalledWith("staff", { kind: "BOOKING", sectionId });
  });

  it.each(["member", "moderator"] as const)("percent-encodes each resource path segment for a %s link", async (recipient) => {
    // The booking ID is not an input to the URL; the authoritative resource IDs are.
    mockGetBooking.mockResolvedValue({ data: { booking: {
      id: bookingId, accommodationRequested: false,
      booker: { id: "member", firstName: "Member", lastName: "One", email: "member@example.invalid" },
      event: { id: "event/one?task=wrong#fragment", title: "Offline event", startDateTime: "2026-10-28T12:00:00Z",
        endDateTime: "2026-10-28T14:00:00Z", section: { id: "section/one?next=wrong", name: "Section" } }, lines: sampleLines,
    } } } as never);
    if (recipient === "member") await notifyBookingConfirmationEmail(args);
    else await notifyBookingPendingApprovalEmails({ ...args, recipientUserIds: ["staff"], notifyMember: false });
    const expected = recipient === "member"
      ? "https://app.example/sections/section%2Fone%3Fnext%3Dwrong/events/event%2Fone%3Ftask%3Dwrong%23fragment?tab=book"
      : "https://app.example/sections/section%2Fone%3Fnext%3Dwrong/manage/events/event%2Fone%3Ftask%3Dwrong%23fragment?task=approvals";
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ personalisation: expect.objectContaining({
      [recipient === "member" ? "sectionBookingsUrl" : "moderationUrl"]: expected,
    }) }));
  });

  it.each([
    { version: 1, deliveryMode: "LIVE", kind: "BOOKING_CONFIRMATION", bookingId, idempotencyKey: "submission" },
    { version: 2, deliveryMode: "LIVE", kind: "BOOKING_PENDING_MODERATOR", bookingId, recipientUserId: "staff" },
  ] satisfies NotificationRecoveryPayload[])("rebuilds the canonical link on real $kind recovery dispatch", async (payload) => {
    const identity = notificationRecoveryIdentity(payload);
    const previousAttempt = "2026-10-27T12:00:00Z";
    const candidate = { id: bookingId, channel: admin.NotificationChannel.EMAIL, notificationType: identity.notificationType,
      deliveryKey: identity.deliveryKey, recoveryPayload: JSON.stringify(payload), status: admin.NotificationDeliveryStatus.FAILED,
      attemptCount: 1, lastAttemptedAt: previousAttempt, createdAt: previousAttempt, deliveryMode: "LIVE" as const,
      recipientUserId: "recipientUserId" in payload ? payload.recipientUserId : null, subjectBookingId: bookingId,
    };
    await createNotificationRecoveryDispatcher(args.appBaseUrl)(candidate, payload);
    const moderator = payload.kind === "BOOKING_PENDING_MODERATOR";
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      templateName: moderator ? "bookingPendingApprovalModerator" : "bookingConfirmation",
      personalisation: expect.objectContaining(moderator ? { moderationUrl: managementUrl } : { sectionBookingsUrl: memberUrl }),
    }));
    expect(mockSendOnce).toHaveBeenCalledOnce();
    expect(mockSendOnce.mock.calls[0][0]).toMatchObject({
      preserveDeliveryKey: true, deliveryKey: candidate.deliveryKey,
      recoveryClaim: expect.objectContaining({ id: candidate.id, attemptCount: 1 }),
    });
  });
});
