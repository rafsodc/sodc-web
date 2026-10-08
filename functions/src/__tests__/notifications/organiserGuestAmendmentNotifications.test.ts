import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@dataconnect/admin-generated";
import { sendNotificationOnce } from "../../notificationDelivery";
import {
  notifyOrganiserGuestAmendment,
  recoverPendingGuestAmendmentNotifications,
  guestAmendmentDeliveryKey,
  type GuestAmendmentEmailSnapshot,
} from "../../organiserGuestAmendmentNotifications";
import { createNotificationRecoveryDispatcher, notificationRecoveryIdentity } from "../../notificationRecovery";
import { parseNotificationRecoveryPayload } from "../../notificationRecoveryPayload";
vi.mock("../../notificationDelivery", async (original) => ({
  ...(await original<typeof import("../../notificationDelivery")>()),
  sendNotificationOnce: vi.fn(),
}));
const id = "00000000-0000-4000-8000-000000000001";
const guestId = "00000000-0000-4000-8000-000000000002";
const snapshot: GuestAmendmentEmailSnapshot = {
  recipientEmail: "guest@example.test", firstName: "Guest", eventTitle: "Dinner",
  eventDateTime: "2 January 2099", eventLocation: "Club", previousTicket: "Dinner ticket",
  updatedTicket: "Dinner and symposium", previousTotalMinor: 1000, revisedTotalMinor: 1500,
  refundDueMinor: 0, refundedBeforeMinor: 0, guestLink: "https://example.test/guest-ticket#scoped-token",
};
let amendment: any;
let guest: any;
const sendEmail = vi.fn();
const getMailer = () => ({ sendEmail }) as never;
const updateStatus = vi.spyOn(db, "setOrganiserGuestAmendmentNotificationStatus");
beforeEach(() => {
  vi.resetAllMocks();
  amendment = { id, guestId, tokenHash: "hash", notificationStatus: "PENDING", payload: JSON.stringify(snapshot) };
  guest = { priceMinor: 1500, paidAt: "2026-01-01", paidAmountMinor: 1000, refundedAmountMinor: 0, refundPendingMinor: 0, refundFailureReason: null, payments: [], cancelledAt: null };
  vi.spyOn(db, "getOrganiserGuestAmendment").mockImplementation(async () => ({ data: { organiserGuestAmendment: amendment } }) as never);
  vi.spyOn(db, "getOrganiserGuest").mockImplementation(async () => ({ data: { organiserGuests: [guest] } }) as never);
  updateStatus.mockResolvedValue({} as never);
  sendEmail.mockResolvedValue({ providerNotificationId: "notify-id", deliveryMode: { effectiveMode: "LIVE" } });
  vi.mocked(sendNotificationOnce).mockImplementation(async (request) => { await request.send("LIVE"); return { outcome: "sent" }; });
});

describe("organiser guest amendment notifications", () => {
  it("emails the changes and current top-up with an account-free scoped payment link", async () => {
    await notifyOrganiserGuestAmendment({ amendmentId: id, getMailer });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      templateName: "bookingRevision", to: snapshot.recipientEmail,
      personalisation: expect.objectContaining({
        ticketLinesSummary: "Previous: Dinner ticket\nUpdated: Dinner and symposium",
        paymentRemainingFormatted: "£5.00",
        financialEffectSummary: "Payment required—please pay as soon as possible. Amount due: £5.00.",
        myPaymentsUrl: snapshot.guestLink,
      }),
    }));
    expect(sendNotificationOnce).toHaveBeenCalledWith(expect.objectContaining({
      deliveryKey: guestAmendmentDeliveryKey(id),
      recoveryPayload: { version: 1, kind: "ORGANISER_GUEST_AMENDMENT", amendmentId: id },
    }));
    expect(updateStatus).toHaveBeenCalledWith({ id, status: "SENT" });
  });

  it.each([
    [0, 500, null, "being processed"],
    [500, 0, null, "has been completed"],
    [0, 0, "Stripe failed", "needs organiser attention"],
    [0, 0, null, "is due"],
  ])("reports refund state truthfully (%s completed, %s pending)", async (refunded, pending, failure, text) => {
    guest.priceMinor = 500;
    guest.refundedAmountMinor = refunded;
    guest.refundPendingMinor = pending;
    guest.refundFailureReason = failure;
    amendment.payload = JSON.stringify({ ...snapshot, refundDueMinor: 500, revisedTotalMinor: 500 });
    await notifyOrganiserGuestAmendment({ amendmentId: id, getMailer });
    expect(sendEmail.mock.calls[0][0].personalisation.financialEffectSummary).toContain(text);
  });

  it("retains failed delivery for independent retry and recovery", async () => {
    vi.mocked(sendNotificationOnce).mockResolvedValue({ outcome: "failed", reason: "send_failed" });
    await expect(notifyOrganiserGuestAmendment({ amendmentId: id, getMailer })).resolves.toMatchObject({ outcome: "failed" });
    expect(updateStatus).toHaveBeenCalledWith({ id, status: "FAILED" });
    const payload = parseNotificationRecoveryPayload(JSON.stringify({ version: 1, kind: "ORGANISER_GUEST_AMENDMENT", amendmentId: id }));
    const recover = vi.fn().mockResolvedValue({ outcome: "sent" });
    const dispatch = createNotificationRecoveryDispatcher("https://example.test", { notifyGuestAmendment: recover });
    await dispatch({ id, channel: db.NotificationChannel.EMAIL, ...notificationRecoveryIdentity(payload), status: db.NotificationDeliveryStatus.FAILED, attemptCount: 1, recoveryPayload: JSON.stringify(payload), createdAt: "2026-01-01", lastAttemptedAt: "2026-01-01" }, payload);
    expect(recover).toHaveBeenCalledWith({ amendmentId: id, deliveryMode: undefined });
  });

  it("does not resend a completed amendment notification", async () => {
    amendment.notificationStatus = "SENT";
    await expect(notifyOrganiserGuestAmendment({ amendmentId: id, getMailer })).resolves.toEqual({ outcome: "duplicate" });
    expect(sendNotificationOnce).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("honours the delivery ledger if another sender already owns the attempt", async () => {
    vi.mocked(sendNotificationOnce).mockResolvedValue({ outcome: "duplicate", reason: "in_progress" });
    await notifyOrganiserGuestAmendment({ amendmentId: id, getMailer });
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("clearly records missing email addresses without attempting delivery", async () => {
    amendment.payload = JSON.stringify({ ...snapshot, recipientEmail: null });
    await expect(notifyOrganiserGuestAmendment({ amendmentId: id, getMailer })).resolves.toEqual({ outcome: "no_email" });
    expect(updateStatus).toHaveBeenCalledWith({ id, status: "NOT_REQUIRED" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not put a revoked link back into a recovered email", async () => {
    amendment.tokenHash = null;
    await notifyOrganiserGuestAmendment({ amendmentId: id, getMailer });
    expect(sendEmail.mock.calls[0][0].personalisation.myPaymentsUrl).not.toContain("scoped-token");
  });

  it("recovers an amendment saved before the notification ledger could be created", async () => {
    vi.spyOn(db, "listPendingOrganiserGuestAmendments").mockResolvedValue({ data: { organiserGuestAmendments: [{ id }] } });
    vi.mocked(sendNotificationOnce).mockResolvedValue({ outcome: "sent" });
    await recoverPendingGuestAmendmentNotifications("2026-01-01", 10);
    expect(sendNotificationOnce).toHaveBeenCalledWith(expect.objectContaining({ deliveryKey: guestAmendmentDeliveryKey(id) }));
  });
});
