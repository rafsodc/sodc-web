import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import * as delivery from "../../notificationDelivery";
import * as mailer from "../../mailer";
import { createNotificationRecoveryDispatcher, notificationRecoveryIdentity } from "../../notificationRecovery";
import { govNotifyReferenceForMode } from "../../govNotifyDeliveryMode";
import type { NotificationRecoveryPayload } from "../../notificationRecoveryPayload";

const ID = "11111111-1111-4111-8111-111111111111";
const OLD = "2026-10-23T19:30:00.123456Z";
const common = { version: 1, deliveryMode: "LIVE" } as const;
const payloads: NotificationRecoveryPayload[] = [
  { ...common, kind: "BOOKING_CONFIRMATION", bookingId: ID, idempotencyKey: "original" },
  { ...common, kind: "BOOKING_REVISION", bookingId: ID, idempotencyKey: "original", paymentDelta: {
    previousTotalMinor: 1000, revisedTotalMinor: 2000, deltaAmountMinor: 1000, paymentRemainingMinor: 1000,
    status: sdk.BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE } },
  { ...common, kind: "BOOKING_PENDING_MEMBER", bookingId: ID, idempotencyKey: "original" },
  { version: 2, deliveryMode: "LIVE", kind: "BOOKING_PENDING_MODERATOR", bookingId: ID, recipientUserId: "staff" },
  { ...common, kind: "BOOKING_CHANGES_REQUESTED", bookingId: ID },
  { ...common, kind: "BOOKING_APPROVED", bookingId: ID },
  { ...common, kind: "MEMBERSHIP_STATUS", userId: "applicant", previousStatus: "PENDING", newStatus: "REGULAR" },
  { version: 2, deliveryMode: "LIVE", kind: "USER_PENDING_APPROVAL", userId: "applicant", emailVerified: true, recipientUserId: "staff" },
  { ...common, kind: "PAYMENT_LIFECYCLE", orderId: ID, eventId: ID, stripeEventId: "evt_1", type: "PAYMENT_PAID", status: null, occurredAt: OLD, userId: "member" },
  { ...common, kind: "PAYMENT_RECONCILIATION_OPS", orderId: ID, stripeEventId: "evt_1", exceptionType: sdk.PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
    exceptionNote: "Offline test", recipientEmail: "ops@example.invalid" },
  { ...common, kind: "PAYMENT_DISPUTE_OPS", orderId: ID, stripeEventId: "evt_1", stripeEventType: "charge.dispute.created", disputeStripeStatus: "needs_response",
    disputeReason: "fraudulent", disputeLocalState: "OPEN", stripeDisputeId: "dp_1", recipientEmail: "ops@example.invalid" },
];
const send = vi.spyOn(delivery, "sendNotificationOnce");
const provider = vi.fn(async () => { throw new Error("Provider must not run in a forwarding test"); });

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({ outcome: "duplicate", reason: "offline forwarding inspection" });
  vi.spyOn(mailer, "createConfiguredGovNotifyMailer").mockReturnValue({ sendEmail: provider } as never);
  vi.spyOn(sdk, "getBookingForNotification").mockResolvedValue({ data: { booking: {
    id: ID, revisionNumber: 1, approvalStatus: "PENDING", accommodationRequested: false, lines: [],
    booker: { id: "member", firstName: "Member", lastName: "One", email: "member@example.invalid" },
    event: { id: ID, title: "Offline event", startDateTime: OLD, endDateTime: OLD, section: { id: ID, name: "Section" } },
  } } } as never);
  vi.spyOn(sdk, "serviceGetUserById").mockResolvedValue({ data: { user: {
    id: "applicant", firstName: "Applicant", lastName: "One", email: "applicant@example.invalid", serviceNumber: "test", membershipStatus: "PENDING",
  } } } as never);
  vi.spyOn(sdk, "getUserMembershipStatus").mockResolvedValue({ data: { user: { id: "applicant", firstName: "Applicant", email: "member@example.invalid" } } } as never);
  vi.spyOn(sdk, "getTicketOrderForWebhook").mockResolvedValue({ data: { ticketOrder: { id: ID, event: { title: "Offline event" }, user: { firstName: "Member", lastName: "One", email: "member@example.invalid" } } } } as never);
});

describe("recovery policy reaches every final notification sender", () => {
  it.each(payloads)("forwards exact original row and key through $kind", async (payload) => {
    const identity = notificationRecoveryIdentity(payload);
    const row = { id: ID, channel: sdk.NotificationChannel.EMAIL, notificationType: identity.notificationType,
      deliveryKey: govNotifyReferenceForMode(identity.deliveryKey, "LIVE"), recoveryPayload: JSON.stringify(payload),
      status: sdk.NotificationDeliveryStatus.FAILED, attemptCount: 5, lastAttemptedAt: OLD, createdAt: OLD,
      deliveryMode: "LIVE" as const, recipientUserId: "recipientUserId" in payload ? payload.recipientUserId : null,
      subjectBookingId: "bookingId" in payload ? payload.bookingId : null, subjectUserId: "userId" in payload ? payload.userId : null };
    await createNotificationRecoveryDispatcher("https://app.example")(row, payload);
    expect(send).toHaveBeenCalledOnce();
    const request = send.mock.calls[0][0];
    expect(request.deliveryKey).toBe(row.deliveryKey); expect(request.preserveDeliveryKey).toBe(true);
    expect(request.deliveryMode).toBe("LIVE");
    expect(request.recoveryClaim).toEqual({ id: row.id, channel: row.channel, notificationType: row.notificationType,
      deliveryKey: row.deliveryKey, status: row.status, attemptCount: 5, lastAttemptedAt: OLD,
      recoveryPayload: row.recoveryPayload, deliveryMode: "LIVE", recipientUserId: row.recipientUserId ?? null });
    expect(request.recoveryPayload).not.toHaveProperty("recoveryClaim");
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(["BOOKING_PENDING_MODERATOR", "USER_PENDING_APPROVAL"] as const)("keeps the same claim when terminally skipping legacy email-only $0", async (kind) => {
    const payload: NotificationRecoveryPayload = kind === "BOOKING_PENDING_MODERATOR"
      ? { ...common, kind, bookingId: ID, recipientEmail: "former@example.invalid" }
      : { ...common, kind, userId: "applicant", recipientEmail: "former@example.invalid", emailVerified: true };
    const identity = notificationRecoveryIdentity(payload);
    const row = { id: ID, channel: sdk.NotificationChannel.EMAIL, notificationType: identity.notificationType,
      deliveryKey: govNotifyReferenceForMode(identity.deliveryKey, "LIVE"), recoveryPayload: JSON.stringify(payload),
      status: sdk.NotificationDeliveryStatus.FAILED, attemptCount: 5, lastAttemptedAt: OLD, createdAt: OLD, deliveryMode: "LIVE" as const };
    await createNotificationRecoveryDispatcher("https://app.example")(row, payload);
    expect(send).toHaveBeenCalledOnce();
    const request = send.mock.calls[0][0];
    expect(request.deliveryKey).toBe(row.deliveryKey); expect(request.recoveryClaim).toMatchObject({ id: row.id, attemptCount: 5, lastAttemptedAt: OLD });
    expect(await request.send()).toEqual({ outcome: "skipped", reason: "LEGACY_RECIPIENT_IDENTITY_UNVERIFIABLE" });
    expect(provider).not.toHaveBeenCalled();
  });
});
