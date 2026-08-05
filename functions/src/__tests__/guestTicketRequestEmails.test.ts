import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestTicketRequestStatus } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import {
  aggregateGuestTicketRequests,
  formatModeratorNote,
  formatTotalAmountLine,
  guestTicketBookerDeliveryKey,
  guestTicketModeratorDeliveryKey,
  notifyBookerGuestTicketRequestReviewed,
  notifyModeratorsGuestTicketRequestSubmitted,
} from "../guestTicketRequestEmails";
import * as notificationDelivery from "../notificationDelivery";

const mockGetRequest = vi.spyOn(admin, "getGuestTicketRequestForNotification");
const mockSendOnce = vi.spyOn(notificationDelivery, "sendNotificationOnce");

describe("guest ticket email helpers", () => {
  it("formats moderator note", () => {
    expect(formatModeratorNote(null)).toBe("No additional note");
    expect(formatModeratorNote("  OK  ")).toBe("OK");
  });

  it("builds stable delivery keys", () => {
    expect(guestTicketModeratorDeliveryKey("req-1", "mod@example.com")).toBe(
      "guest-request-mod:req-1:mod@example.com"
    );
    expect(guestTicketBookerDeliveryKey("req-1", "APPROVED")).toBe("guest-request-booker:req-1:APPROVED");
  });

  it("aggregateGuestTicketRequests sums requestedGuestCount and price across matching siblings", () => {
    const siblings = [
      { status: GuestTicketRequestStatus.APPROVED, requestedGuestCount: 1, guestTicketType: { price: 15 } },
      { status: GuestTicketRequestStatus.APPROVED, requestedGuestCount: 1, guestTicketType: { price: 15 } },
      // A legacy pre-fix row can still carry requestedGuestCount > 1.
      { status: GuestTicketRequestStatus.APPROVED, requestedGuestCount: 2, guestTicketType: { price: 10 } },
      { status: GuestTicketRequestStatus.REJECTED, requestedGuestCount: 1, guestTicketType: { price: 15 } },
      { status: GuestTicketRequestStatus.PENDING, requestedGuestCount: 1, guestTicketType: { price: 15 } },
    ];

    expect(aggregateGuestTicketRequests(siblings, GuestTicketRequestStatus.APPROVED)).toEqual({
      count: 4, // 1 + 1 + 2
      totalMinor: 5000, // (1500*1) + (1500*1) + (1000*2)
    });
    expect(aggregateGuestTicketRequests(siblings, GuestTicketRequestStatus.REJECTED)).toEqual({
      count: 1,
      totalMinor: 1500,
    });
  });

  it("aggregateGuestTicketRequests treats a missing guestTicketType as free", () => {
    expect(
      aggregateGuestTicketRequests(
        [{ status: GuestTicketRequestStatus.APPROVED, requestedGuestCount: 1, guestTicketType: null }],
        GuestTicketRequestStatus.APPROVED
      )
    ).toEqual({ count: 1, totalMinor: 0 });
  });

  it("formatTotalAmountLine is blank for free tickets and formatted for paid ones", () => {
    expect(formatTotalAmountLine(0)).toBe("");
    expect(formatTotalAmountLine(5000)).toBe("Total additional cost: £50.00");
  });
});

function mockGuestTicketRequest(overrides: {
  status: admin.GuestTicketRequestStatus;
  moderatorNote?: string | null;
  dietaryNote?: string | null;
  siblings?: Array<{ status: admin.GuestTicketRequestStatus; requestedGuestCount: number; price: number }>;
}) {
  const siblings = overrides.siblings ?? [{ status: overrides.status, requestedGuestCount: 1, price: 15 }];
  return {
    data: {
      guestTicketRequest: {
        id: "00000000-0000-4000-8000-000000000001",
        status: overrides.status,
        requestedGuestCount: 1,
        dietaryNote: overrides.dietaryNote !== undefined ? overrides.dietaryNote : "Vegan",
        moderatorNote: overrides.moderatorNote !== undefined ? overrides.moderatorNote : "Welcome",
        guestTicketType: { id: "tt", title: "Guest ticket", price: 15 },
        booking: {
          id: "00000000-0000-4000-8000-000000000002",
          booker: {
            id: "booker-1",
            firstName: "Sam",
            lastName: "Booker",
            email: "sam@example.com",
          },
          event: {
            id: "evt",
            title: "Annual dinner",
            location: "Main Hall",
            startDateTime: "2026-07-01T18:00:00.000Z",
            endDateTime: "2026-07-01T22:00:00.000Z",
            section: { id: "sec-1", name: "Events" },
          },
          guestTicketRequests: siblings.map((s) => ({
            id: "sibling",
            status: s.status,
            requestedGuestCount: s.requestedGuestCount,
            guestTicketType: { price: s.price },
          })),
        },
      },
    },
  } as Awaited<ReturnType<typeof admin.getGuestTicketRequestForNotification>>;
}

describe("notifyBookerGuestTicketRequestReviewed", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
    mockSendOnce.mockReset();
    mockSendOnce.mockResolvedValue({ outcome: "sent" });
  });

  it("sends an approved email with the aggregate guest count and total, not a single guest's name", async () => {
    mockGetRequest.mockResolvedValue(
      mockGuestTicketRequest({
        status: GuestTicketRequestStatus.APPROVED,
        siblings: [
          { status: GuestTicketRequestStatus.APPROVED, requestedGuestCount: 1, price: 15 },
          { status: GuestTicketRequestStatus.APPROVED, requestedGuestCount: 1, price: 15 },
        ],
      })
    );

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "govuk_notify",
      providerNotificationId: "n-1",
    });

    await notifyBookerGuestTicketRequestReviewed({
      requestId: "00000000-0000-4000-8000-000000000001",
      status: GuestTicketRequestStatus.APPROVED,
      appBaseUrl: "https://app.example/",
      getMailer: () => ({ sendEmail }),
    });

    expect(mockSendOnce).toHaveBeenCalledTimes(1);
    expect(mockSendOnce.mock.calls[0][0].notificationType).toBe("GUEST_REQUEST_APPROVED");
    await mockSendOnce.mock.calls[0][0].send();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "guestTicketRequestApproved",
        to: "sam@example.com",
        personalisation: {
          firstName: "Sam",
          eventTitle: "Annual dinner",
          eventDateTime: expect.stringContaining("19:00 – 23:00"),
          eventLocation: "Main Hall",
          guestTicketCount: 2,
          totalAmountLine: "Total additional cost: £30.00",
          moderatorNote: "Welcome",
          myBookingsUrl: "https://app.example/sections/sec-1",
        },
      })
    );
    const personalisation = sendEmail.mock.calls[0][0].personalisation;
    expect(personalisation).not.toHaveProperty("guestDisplayName");
  });

  it("sends a rejected email with no total-amount line", async () => {
    mockGetRequest.mockResolvedValue(
      mockGuestTicketRequest({
        status: GuestTicketRequestStatus.REJECTED,
        moderatorNote: null,
      })
    );

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "govuk_notify",
      providerNotificationId: "n-2",
    });

    await notifyBookerGuestTicketRequestReviewed({
      requestId: "00000000-0000-4000-8000-000000000001",
      status: GuestTicketRequestStatus.REJECTED,
      appBaseUrl: "https://app.example/",
      getMailer: () => ({ sendEmail }),
    });

    await mockSendOnce.mock.calls[0][0].send();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "guestTicketRequestRejected",
        personalisation: {
          firstName: "Sam",
          eventTitle: "Annual dinner",
          eventDateTime: expect.stringContaining("19:00 – 23:00"),
          eventLocation: "Main Hall",
          guestTicketCount: 1,
          moderatorNote: "No additional note",
          myBookingsUrl: "https://app.example/sections/sec-1",
        },
      })
    );
  });
});

describe("notifyModeratorsGuestTicketRequestSubmitted", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
    mockSendOnce.mockReset();
    mockSendOnce.mockResolvedValue({ outcome: "sent" });
  });

  it("uses a distinct provider reference for every moderator and does not name the guest", async () => {
    mockGetRequest.mockResolvedValue(
      mockGuestTicketRequest({ status: GuestTicketRequestStatus.PENDING, moderatorNote: null, dietaryNote: null })
    );
    const sendEmail = vi.fn().mockResolvedValue({
      provider: "govuk_notify",
      providerNotificationId: "n-1",
    });

    await notifyModeratorsGuestTicketRequestSubmitted({
      requestId: "00000000-0000-4000-8000-000000000001",
      appBaseUrl: "https://app.example/",
      recipientEmails: ["first@example.com", "second@example.com"],
      getMailer: () => ({ sendEmail }),
    });

    expect(mockSendOnce).toHaveBeenCalledTimes(2);
    await mockSendOnce.mock.calls[0][0].send();
    await mockSendOnce.mock.calls[1][0].send();
    const references = sendEmail.mock.calls.map(([request]) => request.reference);
    expect(new Set(references)).toHaveLength(2);
    for (const reference of references) {
      expect(reference).toMatch(/^GUEST_REQUEST_SUBMITTED:[0-9a-f-]+:[0-9a-f]{24}$/);
    }
    for (const [request] of sendEmail.mock.calls) {
      expect(request.personalisation).not.toHaveProperty("guestDisplayName");
      expect(request.personalisation.requestedGuestCount).toBe(1);
    }
  });
});
