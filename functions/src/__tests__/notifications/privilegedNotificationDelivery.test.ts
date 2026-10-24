import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationDeliveryStatus, NotificationChannel } from "@dataconnect/admin-generated";
import { sendPrivilegedNotification } from "../../privilegedNotificationDelivery";
import { authorizePrivilegedNotificationRecipient, PrivilegedRecipientLookupError, type CurrentRecipientState } from "../../privilegedNotificationRecipient";
import { sendNotificationOnce } from "../../notificationDelivery";
import { createNotificationRecoveryDispatcher, notificationRecoveryIdentity } from "../../notificationRecovery";
import { runNotificationRecoveryBatch } from "../../notificationRecoveryEngine";
import { resolveRuntimeGovNotifyDeliveryMode } from "../../govNotifyDeliveryConfiguration";
import { govNotifyReferenceForMode } from "../../govNotifyDeliveryMode";
import type { NotificationRecoveryClaim } from "../../notificationRecoveryClaim";
import type { NotificationRecoveryPayload } from "../../notificationRecoveryPayload";
import { notificationTestRepository, STAFF_BOOKING_ID, STAFF_NOW, STAFF_LATER, STAFF_CHANNEL } from "./notificationTestRepository";

vi.mock("../../govNotifyDeliveryConfiguration", () => ({ resolveRuntimeGovNotifyDeliveryMode: vi.fn(async (mode = "LIVE") => ({ effectiveMode: mode })) }));

afterEach(() => {
  vi.mocked(resolveRuntimeGovNotifyDeliveryMode).mockImplementation(async (requestedMode = "LIVE") => ({
    requestedMode, siteMode: "LIVE", effectiveMode: requestedMode,
  }));
});

const payload = { version: 2, kind: "BOOKING_PENDING_MODERATOR", bookingId: STAFF_BOOKING_ID, recipientUserId: "staff-1", deliveryMode: "LIVE" } as const;
function fixture() {
  const store = notificationTestRepository();
  let now = STAFF_NOW;
  const current: CurrentRecipientState = { auth: { uid: "staff-1", disabled: false, emailVerified: true, email: "staff@example.com",
    customClaims: { enabled: true, admin: true, securityVersion: 1 } }, profile: { email: "staff@example.com", membershipStatus: "REGULAR" }, security: {userId: "staff-1", securityVersion: 1, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: true, accessReady: true, adminReady: true, verificationEmail: null, operationId: "op-1", syncStatus: "READY", user: {membershipStatus: "REGULAR"}} };
  const readCurrentState = vi.fn(async () => current);
  const authorize = (uid: string, scope: Parameters<typeof authorizePrivilegedNotificationRecipient>[1]) =>
    authorizePrivilegedNotificationRecipient(uid, scope, { readCurrentState });
  const sendAuthorized = vi.fn(async (_email: string) => ({ providerMessageId: "fake-provider-id" }));
  const hasLegacyEvent = vi.fn(async () => false);
  const deliver = (key?: string, recoveredPayload: typeof payload = payload, recoveryClaim?: NotificationRecoveryClaim) => sendPrivilegedNotification({
    channel: STAFF_CHANNEL, notificationType: "BOOKING_PENDING_APPROVAL_MODERATOR",
    deliveryKey: key ?? notificationRecoveryIdentity(recoveredPayload).deliveryKey, preserveDeliveryKey: Boolean(key),
    recipientUserId: recoveredPayload.recipientUserId, bookingId: recoveredPayload.bookingId,
    recoveryPayload: recoveredPayload, recoveryClaim, deliveryMode: recoveredPayload.deliveryMode, provider: "govuk_notify",
    scope: { kind: "BOOKING", sectionId: "section-1" }, event: { kind: "BOOKING", bookingId: recoveredPayload.bookingId }, sendAuthorized,
  }, { authorize, hasLegacyEvent, delivery: { repository: store.repository, now: () => now } });
  const dispatcher = createNotificationRecoveryDispatcher("https://app.example", {
    notifyBookingPending: async (args) => { expect(args.recipientUserIds).toEqual(["staff-1"]); expect(args.notifyMember).toBe(false); await deliver(args.recoveryDeliveryKey, payload, args.recoveryClaim); },
    sendNotification: (request) => sendNotificationOnce(request, { repository: store.repository, now: () => now }),
  });
  const recover = () => runNotificationRecoveryBatch({ candidates: [...store.rows.values()].map((r) => ({ ...r })), now,
    dispatch: dispatcher, getCurrent: async (candidate) => ({ ...store.rows.get(candidate.deliveryKey)! }) });
  return { ...store, current, readCurrentState, sendAuthorized, hasLegacyEvent, deliver, recover, dispatcher, advance: (time = STAFF_LATER) => { now = time; } };
}

describe("privileged delivery and recovery with fake provider and real ledger orchestration", () => {
  it("failed send -> role revocation -> recovery persists skip -> later recovery never sends", async () => {
    const f = fixture(); f.sendAuthorized.mockRejectedValueOnce(new Error("provider unavailable"));
    expect(await f.deliver()).toMatchObject({ outcome: "failed" });
    f.current.auth!.customClaims!.admin = false; // no moderator authority
    Object.assign(f.current.security!, {desiredEnabled: false, desiredAdmin: false, accessReady: false, adminReady: false});
    f.readCurrentState.mockImplementation(async () => ({ ...f.current, auth: { ...f.current.auth!, customClaims: { enabled: false } } }));
    f.advance();
    expect(await f.recover()).toMatchObject({ skipped: 1, recovered: 0, failed: 0 });
    const row = [...f.rows.values()][0];
    expect(row).toMatchObject({ status: NotificationDeliveryStatus.SKIPPED, skipReason: "RECIPIENT_AUTHORITY_REVOKED", providerMessageId: null, sentAt: null });
    expect(row.skippedAt).toBe(STAFF_LATER);
    expect(await f.recover()).toMatchObject({ skipped: 1, recovered: 0 });
    expect(f.sendAuthorized).toHaveBeenCalledTimes(1);
  });
  it("failed send -> DB-first restriction with still-true Auth mirror -> recovery skips without another provider call", async () => {
    const f = fixture(); f.sendAuthorized.mockRejectedValueOnce(new Error("provider unavailable"));
    await f.deliver();
    Object.assign(f.current.security!, {desiredEnabled: false, accessReady: false, adminReady: false, syncStatus: "PENDING", securityVersion: 2});
    expect(f.current.auth!.customClaims).toMatchObject({enabled: true, admin: true, securityVersion: 1});
    f.advance();
    expect(await f.recover()).toMatchObject({skipped: 1, recovered: 0});
    expect([...f.rows.values()][0]).toMatchObject({status: NotificationDeliveryStatus.SKIPPED, skipReason: "RECIPIENT_AUTHORITY_REVOKED"});
    expect(f.sendAuthorized).toHaveBeenCalledTimes(1);
  });
  it.each(["pending", "version-lag", "enabled-lag"])("retries %s without sending, then sends the original UID exactly once after current readiness", async transient => {
    const f = fixture();
    f.current.security!.securityVersion = 2;
    if (transient === "pending") Object.assign(f.current.security!, {syncStatus: "PENDING", accessReady: false, adminReady: false});
    if (transient === "enabled-lag") f.current.auth!.customClaims!.enabled = false;
    expect(await f.deliver()).toMatchObject({outcome: "failed"});
    expect([...f.rows.values()][0].status).toBe(NotificationDeliveryStatus.FAILED);
    expect(f.sendAuthorized).not.toHaveBeenCalled();

    Object.assign(f.current.security!, {syncStatus: "READY", accessReady: true, adminReady: true});
    Object.assign(f.current.auth!.customClaims!, {enabled: true, admin: true, securityVersion: 2});
    f.advance();
    expect(await f.recover()).toMatchObject({recovered: 1, skipped: 0});
    expect(f.sendAuthorized).toHaveBeenCalledExactlyOnceWith("staff@example.com", "LIVE");
    expect([...f.rows.values()][0]).toMatchObject({status: NotificationDeliveryStatus.SENT, recipientUserId: "staff-1", attemptCount: 2});
    expect(await f.recover()).toMatchObject({alreadySent: 1});
    expect(await f.deliver()).toMatchObject({outcome: "duplicate", reason: "already_sent"});
    expect(f.sendAuthorized).toHaveBeenCalledOnce();
  });
  it("a deferred recipient revoked before recovery is terminally skipped and never resurrected by a later grant", async () => {
    const f = fixture(); Object.assign(f.current.security!, {syncStatus: "PENDING", accessReady: false, adminReady: false, securityVersion: 2});
    expect(await f.deliver()).toMatchObject({outcome: "failed"});
    Object.assign(f.current.security!, {desiredEnabled: false, desiredAdmin: false, securityVersion: 3});
    f.advance();
    expect(await f.recover()).toMatchObject({skipped: 1, recovered: 0});
    expect([...f.rows.values()][0]).toMatchObject({status: NotificationDeliveryStatus.SKIPPED, skipReason: "RECIPIENT_AUTHORITY_REVOKED"});
    Object.assign(f.current.security!, {desiredEnabled: true, desiredAdmin: true, accessReady: true, adminReady: true, syncStatus: "READY", securityVersion: 4});
    Object.assign(f.current.auth!.customClaims!, {enabled: true, admin: true, securityVersion: 4});
    expect(await f.recover()).toMatchObject({skipped: 1, recovered: 0});
    expect(await f.deliver()).toMatchObject({outcome: "skipped", reason: "already_skipped"});
    expect(f.sendAuthorized).not.toHaveBeenCalled();
  });
  it("recovers an authorized original UID at its current address, then deduplicates after another email change", async () => {
    const f = fixture(); f.sendAuthorized.mockRejectedValueOnce(new Error("temporary")); await f.deliver();
    f.current.auth!.email = "new@example.com"; f.current.profile!.email = "new@example.com"; f.advance();
    expect(await f.recover()).toMatchObject({ recovered: 1, skipped: 0 });
    expect(f.sendAuthorized).toHaveBeenLastCalledWith("new@example.com", "LIVE");
    f.current.auth!.email = "third@example.com"; f.current.profile!.email = "third@example.com";
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "already_sent" });
    expect(f.rows.size).toBe(1); expect(f.sendAuthorized).toHaveBeenCalledTimes(2);
  });
  it("keeps authorization outages retryable and never passes their details to a provider", async () => {
    const f = fixture(); f.readCurrentState.mockRejectedValueOnce(new PrivilegedRecipientLookupError());
    expect(await f.deliver()).toMatchObject({ outcome: "failed" });
    expect([...f.rows.values()][0].lastErrorCode).toBe("RECIPIENT_AUTHORIZATION_LOOKUP_FAILED");
    expect(f.sendAuthorized).not.toHaveBeenCalled(); f.advance();
    expect(await f.recover()).toMatchObject({ recovered: 1 });
  });
  it("legacy-event fencing suppresses UID replacements but leaves a member acknowledgement deliverable", async () => {
    const f = fixture(); f.hasLegacyEvent.mockResolvedValue(true);
    expect(await f.deliver()).toMatchObject({ outcome: "skipped", reason: "LEGACY_EVENT_ALREADY_RECORDED" });
    const memberProvider = vi.fn(async () => ({ providerMessageId: "member-receipt" }));
    expect(await sendNotificationOnce({ channel: NotificationChannel.EMAIL, notificationType: "BOOKING_PENDING_APPROVAL_MEMBER",
      deliveryKey: "member-key", send: memberProvider }, { repository: f.repository, now: () => STAFF_NOW })).toMatchObject({ outcome: "sent" });
    expect(f.sendAuthorized).not.toHaveBeenCalled(); expect(memberProvider).toHaveBeenCalledOnce();
  });
  it.each(["SENT", "FAILED", "PENDING"] as const)("legacy %s email-only recovery never looks up or retargets the old address", async (status) => {
    const f = fixture();
    const oldPayload: NotificationRecoveryPayload = { version: 1, kind: "BOOKING_PENDING_MODERATOR", bookingId: STAFF_BOOKING_ID,
      recipientEmail: "reassigned@example.com", deliveryMode: "LIVE" };
    const identity = notificationRecoveryIdentity(oldPayload);
    const key = govNotifyReferenceForMode(identity.deliveryKey, "LIVE");
    f.rows.set(key, { id: STAFF_BOOKING_ID, channel: STAFF_CHANNEL, notificationType: identity.notificationType, deliveryKey: key,
      recoveryPayload: JSON.stringify(oldPayload), status: NotificationDeliveryStatus[status], attemptCount: 1, createdAt: STAFF_NOW, lastAttemptedAt: STAFF_NOW });
    f.advance(); await f.recover();
    expect(f.rows.get(key)!.status).toBe(status === "SENT" ? "SENT" : "SKIPPED");
    expect(f.readCurrentState).not.toHaveBeenCalled(); expect(f.sendAuthorized).not.toHaveBeenCalled();
  });
  it.each(["recipient", "subject", "type", "key"])("rejects a mismatched v2 ledger %s before any provider call", async (mismatch) => {
    const f = fixture(); await f.deliver();
    const row = { ...[...f.rows.values()][0], status: NotificationDeliveryStatus.FAILED };
    if (mismatch === "recipient") row.recipientUserId = "another-user";
    if (mismatch === "subject") row.subjectBookingId = "another-booking";
    if (mismatch === "type") row.notificationType = "USER_PENDING_APPROVAL";
    if (mismatch === "key") row.deliveryKey = "unrelated-key";
    await expect(f.dispatcher(row, payload)).rejects.toThrow(/ledger identity/);
    expect(f.sendAuthorized).toHaveBeenCalledTimes(1);
  });
});

describe("provider boundary lease ownership", () => {
  it.each([
    "2026-10-24T13:42:01.884000Z",
    "2026-10-24T13:42:01.884000000Z",
    "2026-10-24T14:42:01.884000+01:00",
  ])("retains the normal privileged send lease across the equivalent database timestamp %s", async readTimestamp => {
    const f = fixture();
    const writtenAt = "2026-10-24T13:42:01.884Z";
    f.advance(writtenAt);
    const read = f.repository.getByChannelAndKey;
    vi.spyOn(f.repository, "getByChannelAndKey").mockImplementation(async args => {
      const row = await read(args);
      return row ? { ...row, lastAttemptedAt: readTimestamp } : null;
    });
    const complete = vi.spyOn(f.repository, "markSent");
    expect(await f.deliver()).toMatchObject({ outcome: "sent", attemptCount: 1 });
    expect(f.readCurrentState).toHaveBeenCalledOnce();
    expect(f.sendAuthorized).toHaveBeenCalledExactlyOnceWith("staff@example.com", "LIVE");
    expect(complete.mock.calls[0][0].lastAttemptedAt).toBe(writtenAt);
    expect([...f.rows.values()][0]).toMatchObject({ status: "SENT", attemptCount: 1, lastAttemptedAt: writtenAt });
  });

  it.each(["2026-10-24T13:42:01.884001Z", "2026-10-24T13:42:01.884000001Z"])(
    "does not call a normal privileged provider for a distinct sub-millisecond lease %s", async readTimestamp => {
      const f = fixture(); f.advance("2026-10-24T13:42:01.884Z");
      const read = f.repository.getByChannelAndKey;
      vi.spyOn(f.repository, "getByChannelAndKey").mockImplementation(async args => {
        const row = await read(args);
        return row ? { ...row, lastAttemptedAt: readTimestamp } : null;
      });
      expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "in_progress" });
      expect(f.sendAuthorized).not.toHaveBeenCalled();
      expect([...f.rows.values()][0]).toMatchObject({ status: "PENDING", attemptCount: 1 });
    }
  );

  it("does not call a provider if a newer worker takes ownership during authorization", async () => {
    const f = fixture();
    f.readCurrentState.mockImplementation(async () => {
      const row = [...f.rows.values()][0]; row.attemptCount += 1; row.lastAttemptedAt = STAFF_LATER;
      return f.current;
    });
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "in_progress" });
    expect(f.sendAuthorized).not.toHaveBeenCalled();
    expect([...f.rows.values()][0]).toMatchObject({ status: "PENDING", attemptCount: 2 });
  });
  it("does not call a provider if authorization exceeds the owned lease", async () => {
    const f = fixture(); f.readCurrentState.mockImplementation(async () => { f.advance(); return f.current; });
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "in_progress" });
    expect(f.sendAuthorized).not.toHaveBeenCalled();
  });
});

describe("preserved recovery identity after a delivery-mode decrease", () => {
  it.each(["false", "throw"])("retries a failed LIVE terminal skip when its first persistence returns %s without sending", async (failure) => {
    const f = fixture();
    const identity = notificationRecoveryIdentity(payload);
    const key = govNotifyReferenceForMode(identity.deliveryKey, "LIVE");
    f.rows.set(key, {
      id: STAFF_BOOKING_ID, channel: STAFF_CHANNEL, notificationType: identity.notificationType,
      deliveryKey: key, recoveryPayload: JSON.stringify(payload), status: NotificationDeliveryStatus.FAILED,
      recipientUserId: payload.recipientUserId, subjectBookingId: payload.bookingId,
      attemptCount: 1, createdAt: STAFF_NOW, lastAttemptedAt: STAFF_NOW,
    });
    vi.mocked(resolveRuntimeGovNotifyDeliveryMode).mockResolvedValue({
      requestedMode: "LIVE", siteMode: "SIMULATION", effectiveMode: "SIMULATION",
    });
    const markSkipped = vi.spyOn(f.repository, "markSkipped").mockImplementationOnce(async () => {
      if (failure === "throw") throw new Error("temporary skip persistence outage");
      return false;
    });
    f.advance();
    expect(await f.recover()).toMatchObject({ failed: 1, skipped: 0, recovered: 0, invalid: 0 });
    expect(f.rows.get(key)).toMatchObject({ status: NotificationDeliveryStatus.FAILED, attemptCount: 2, deliveryKey: key });
    expect(JSON.parse(f.rows.get(key)!.recoveryPayload!)).toMatchObject({ deliveryMode: "LIVE" });

    f.advance("2026-10-21T10:40:00Z");
    expect(await f.recover()).toMatchObject({ skipped: 1, failed: 0, recovered: 0, invalid: 0 });
    expect(f.rows.get(key)).toMatchObject({ status: NotificationDeliveryStatus.SKIPPED,
      skipReason: "DELIVERY_MODE_CHANGED", attemptCount: 3, sentAt: null, providerMessageId: null });
    expect(JSON.parse(f.rows.get(key)!.recoveryPayload!)).toMatchObject({ deliveryMode: "LIVE" });
    expect(await f.recover()).toMatchObject({ skipped: 1, failed: 0 });
    expect(markSkipped).toHaveBeenCalledTimes(2);
    expect(f.readCurrentState).not.toHaveBeenCalled();
    expect(f.sendAuthorized).not.toHaveBeenCalled();
    expect(f.rows.size).toBe(1);
  });
});
