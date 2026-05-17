import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestTicketRequestStatus } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import {
  formatModeratorNote,
  guestTicketBookerDeliveryKey,
  guestTicketModeratorDeliveryKey,
  notifyBookerGuestTicketRequestReviewed,
} from "../guestTicketRequestEmails";
import * as notificationDelivery from "../notificationDelivery";

const mockGetRequest = vi.spyOn(admin, "getGuestTicketRequestForNotification");
const mockSendOnce = vi.spyOn(notificationDelivery, "sendNotificationOnce");

describe("guest ticket email helpers", () => {
  it("formats moderator note", () => {
    expect(formatModeratorNote(null)).toBe("—");
    expect(formatModeratorNote("  OK  ")).toBe("OK");
  });

  it("builds stable delivery keys", () => {
    expect(guestTicketModeratorDeliveryKey("req-1", "mod@example.com")).toBe(
      "guest-request-mod:req-1:mod@example.com"
    );
    expect(guestTicketBookerDeliveryKey("req-1", "APPROVED")).toBe("guest-request-booker:req-1:APPROVED");
  });
});

describe("notifyBookerGuestTicketRequestReviewed", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
    mockSendOnce.mockReset();
    mockSendOnce.mockResolvedValue({ outcome: "sent" });
  });

  it("sends approved email with moderator note", async () => {
    mockGetRequest.mockResolvedValue({
      data: {
        guestTicketRequest: {
          id: "00000000-0000-4000-8000-000000000001",
          status: GuestTicketRequestStatus.APPROVED,
          requestedGuestCount: 2,
          guestDisplayName: "Guest One",
          dietaryNote: "Vegan",
          moderatorNote: "Welcome",
          guestTicketType: { id: "tt", title: "Guest ticket" },
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
              section: { id: "sec-1", name: "Events" },
            },
          },
        },
      },
    } as Awaited<ReturnType<typeof admin.getGuestTicketRequestForNotification>>);

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
        personalisation: expect.objectContaining({
          moderatorNote: "Welcome",
          myBookingsUrl: "https://app.example/sections/sec-1",
        }),
      })
    );
  });
});
