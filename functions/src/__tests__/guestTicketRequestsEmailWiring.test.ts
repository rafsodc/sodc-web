import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestTicketRequestStatus } from "@dataconnect/admin-generated";
import {
  sendGuestTicketRequestReviewedEmails,
  sendGuestTicketRequestSubmittedEmails,
} from "../guestTicketRequests";
import {
  notifyBookerGuestTicketRequestReviewed,
  notifyModeratorsGuestTicketRequestSubmitted,
} from "../guestTicketRequestEmails";

vi.mock("../guestTicketRequestEmails", () => ({
  notifyModeratorsGuestTicketRequestSubmitted: vi.fn(),
  notifyBookerGuestTicketRequestReviewed: vi.fn(),
}));

describe("guest ticket request email wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fans out moderator emails on submit", async () => {
    await sendGuestTicketRequestSubmittedEmails({
      requestId: "req-1",
      appBaseUrl: "https://app.example",
    });

    expect(notifyModeratorsGuestTicketRequestSubmitted).toHaveBeenCalledTimes(1);
    expect(notifyModeratorsGuestTicketRequestSubmitted).toHaveBeenCalledWith({
      requestId: "req-1",
      appBaseUrl: "https://app.example",
    });
  });

  it("notifies booker on approve", async () => {
    await sendGuestTicketRequestReviewedEmails({
      requestId: "req-2",
      status: GuestTicketRequestStatus.APPROVED,
      appBaseUrl: "https://app.example",
    });

    expect(notifyBookerGuestTicketRequestReviewed).toHaveBeenCalledWith({
      requestId: "req-2",
      status: GuestTicketRequestStatus.APPROVED,
      appBaseUrl: "https://app.example",
    });
  });

  it("notifies booker on reject", async () => {
    await sendGuestTicketRequestReviewedEmails({
      requestId: "req-3",
      status: GuestTicketRequestStatus.REJECTED,
      appBaseUrl: "https://app.example",
    });

    expect(notifyBookerGuestTicketRequestReviewed).toHaveBeenCalledWith({
      requestId: "req-3",
      status: GuestTicketRequestStatus.REJECTED,
      appBaseUrl: "https://app.example",
    });
  });
});
