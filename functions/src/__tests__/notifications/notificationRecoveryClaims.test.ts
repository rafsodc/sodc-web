import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationChannel, NotificationDeliveryStatus } from "@dataconnect/admin-generated";
import { sendNotificationOnce, type SendNotificationOnceRequest } from "../../notificationDelivery";
import { createNotificationRecoveryClaim } from "../../notificationRecoveryClaim";
import { createNotificationRecoveryDispatcher, notificationRecoveryIdentity } from "../../notificationRecovery";
import { runNotificationRecoveryBatch, type RecoverableNotificationDelivery } from "../../notificationRecoveryEngine";
import { resolveRuntimeGovNotifyDeliveryMode } from "../../govNotifyDeliveryConfiguration";
import { govNotifyReferenceForMode } from "../../govNotifyDeliveryMode";
import { parseNotificationRecoveryPayload } from "../../notificationRecoveryPayload";
import { notificationTestRepository, type StoredTestDelivery } from "./notificationTestRepository";

vi.mock("../../govNotifyDeliveryConfiguration", () => ({
  resolveRuntimeGovNotifyDeliveryMode: vi.fn(async (mode = "LIVE") => ({ effectiveMode: mode })),
}));
const NOW = "2026-10-23T20:00:00.000Z";
const OLD = "2026-10-23T19:30:00.000Z";
const payload = { version: 2, kind: "USER_PENDING_APPROVAL", userId: "applicant", recipientUserId: "staff", emailVerified: true, deliveryMode: "TEAM_TEST" } as const;
function fixture(overrides: Partial<StoredTestDelivery> = {}, serverNow = NOW) {
  const identity = notificationRecoveryIdentity(payload);
  const original: StoredTestDelivery = { id: "11111111-1111-4111-8111-111111111111", channel: NotificationChannel.EMAIL,
    notificationType: identity.notificationType, deliveryKey: govNotifyReferenceForMode(identity.deliveryKey, "TEAM_TEST"),
    recoveryPayload: JSON.stringify(payload), status: NotificationDeliveryStatus.FAILED, attemptCount: 5,
    lastAttemptedAt: OLD, createdAt: OLD, deliveryMode: "TEAM_TEST", recipientUserId: "staff", subjectUserId: "applicant", ...overrides };
  const store = notificationTestRepository([original], () => serverNow);
  const snapshot = { ...original };
  const send = vi.fn(async () => ({ providerMessageId: "offline-only" }));
  const request = (): SendNotificationOnceRequest => ({ channel: original.channel, notificationType: original.notificationType,
    deliveryKey: original.deliveryKey, preserveDeliveryKey: true, provider: "govuk_notify", deliveryMode: "TEAM_TEST",
    recoveryClaim: createNotificationRecoveryClaim(snapshot), recipientUserId: payload.recipientUserId, recoveryPayload: payload, send });
  const deliver = () => sendNotificationOnce(request(), { repository: store.repository, now: () => NOW });
  return { ...store, original, snapshot, send, request, deliver, row: () => store.rows.get(original.deliveryKey)! };
}

beforeEach(() => {
  vi.mocked(resolveRuntimeGovNotifyDeliveryMode).mockImplementation(async (mode = "LIVE") => ({ requestedMode: mode, siteMode: "LIVE", effectiveMode: mode }));
});

describe("recovery-only notification claims", () => {
  it("does not turn a stale FAILED5 list snapshot into a seventh provider attempt", async () => {
    const f = fixture();
    Object.assign(f.row(), { attemptCount: 6, lastAttemptedAt: NOW });
    const create = vi.spyOn(f.repository, "createPending");
    const claim = vi.spyOn(f.repository, "tryMarkPendingForRecovery");
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "recovery_candidate_changed", attemptCount: 6 });
    expect(f.send).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled();
    expect(f.row()).toMatchObject({ status: "FAILED", attemptCount: 6, lastAttemptedAt: NOW });
  });

  it.each([
    ["attempt", { attemptCount: 6 }],
    ["timestamp", { lastAttemptedAt: "2026-10-23T19:59:00.000Z" }],
    ["payload", { recoveryPayload: JSON.stringify({ ...payload, userId: "replacement" }) }],
    ["type", { notificationType: "OTHER_TYPE" }],
    ["channel", { channel: "SMS" }],
    ["key", { deliveryKey: "replacement-key" }],
    ["physical row", { id: "22222222-2222-4222-8222-222222222222" }],
    ["mode", { deliveryMode: "LIVE" }],
    ["recipient", { recipientUserId: "different-staff" }],
    ["recipient nullness", { recipientUserId: null }],
    ["deferral", { recoveryDeferredAt: NOW }],
  ])("atomically rejects a %s change after the sender's read", async (_name, change) => {
    const f = fixture();
    const atomicClaim = f.repository.tryMarkPendingForRecovery;
    vi.spyOn(f.repository, "tryMarkPendingForRecovery").mockImplementation(async (args) => {
      Object.assign(f.row(), change);
      return atomicClaim(args);
    });
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "recovery_claim_lost" });
    expect(f.send).not.toHaveBeenCalled();
    expect(f.row().status).toBe("FAILED");
  });

  it("enforces database-clock cooldown even when the worker clock is ahead", async () => {
    const f = fixture({ lastAttemptedAt: "2026-10-23T19:44:59.000Z" }, "2026-10-23T19:45:00.000Z");
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "recovery_claim_lost" });
    expect(f.send).not.toHaveBeenCalled(); expect(f.row().attemptCount).toBe(5);
  });

  it.each([
    [NotificationDeliveryStatus.FAILED, "2026-10-23T19:45:00.001Z"],
    [NotificationDeliveryStatus.PENDING, "2026-10-23T19:50:00.001Z"],
  ])("does not prematurely reclaim a fresh %s candidate", async (status, lastAttemptedAt) => {
    const f = fixture({ status, lastAttemptedAt });
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "recovery_not_due" });
    expect(f.send).not.toHaveBeenCalled(); expect(f.row().attemptCount).toBe(5);
  });

  it.each([
    [NotificationDeliveryStatus.FAILED, "2026-10-23T19:45:00.000Z"],
    [NotificationDeliveryStatus.PENDING, "2026-10-23T19:50:00.000Z"],
  ])("allows an exactly due %s candidate to consume the final slot once", async (status, lastAttemptedAt) => {
    const f = fixture({ status, lastAttemptedAt });
    f.send.mockRejectedValueOnce(new Error("offline provider failure"));
    expect(await f.deliver()).toMatchObject({ outcome: "failed", attemptCount: 6 });
    expect(f.row()).toMatchObject({ status: "FAILED", attemptCount: 6, lastAttemptedAt: NOW });
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "recovery_candidate_changed" });
    const dispatch = vi.fn();
    expect(await runNotificationRecoveryBatch({ candidates: [{ ...f.row() }], now: NOW, dispatch,
      getCurrent: async () => ({ ...f.row() }) })).toMatchObject({ exhausted: 1, recovered: 0 });
    expect(dispatch).not.toHaveBeenCalled(); expect(f.send).toHaveBeenCalledOnce();
  });

  it("allows only one worker to claim the same FAILED5 snapshot", async () => {
    const f = fixture();
    const [first, second] = await Promise.all([f.deliver(), f.deliver()]);
    expect([first.outcome, second.outcome].sort()).toEqual(["duplicate", "sent"]);
    expect(f.send).toHaveBeenCalledOnce(); expect(f.row()).toMatchObject({ status: "SENT", attemptCount: 6 });
  });

  it.each(["missing", "replaced"])("never recreates a %s recovery row", async (kind) => {
    const f = fixture(); const create = vi.spyOn(f.repository, "createPending");
    if (kind === "missing") f.rows.clear();
    else f.row().id = "22222222-2222-4222-8222-222222222222";
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: kind === "missing" ? "recovery_row_missing" : "recovery_candidate_changed" });
    expect(create).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
  });

  it("keeps direct/manual retries independent from the scheduler cap and cooldown", async () => {
    const f = fixture({ attemptCount: 6, lastAttemptedAt: NOW });
    const request = { channel: NotificationChannel.EMAIL, notificationType: payload.kind,
      deliveryKey: f.original.deliveryKey, preserveDeliveryKey: true, send: f.send };
    expect(await sendNotificationOnce(request, { repository: f.repository, now: () => NOW })).toMatchObject({ outcome: "sent", attemptCount: 7 });
    expect(f.send).toHaveBeenCalledOnce();
  });

  it("keeps a mode decrease on the exact physical row and skips before provider I/O", async () => {
    const f = fixture();
    vi.mocked(resolveRuntimeGovNotifyDeliveryMode).mockResolvedValue({ requestedMode: "TEAM_TEST", siteMode: "SIMULATION", effectiveMode: "SIMULATION" });
    expect(await f.deliver()).toMatchObject({ outcome: "skipped", reason: "DELIVERY_MODE_CHANGED", attemptCount: 6 });
    expect(f.rows.size).toBe(1); expect(f.row()).toMatchObject({ deliveryKey: f.original.deliveryKey, status: "SKIPPED" });
    expect(f.row().recoveryPayload).toBe(f.snapshot.recoveryPayload); expect(f.send).not.toHaveBeenCalled();
  });

  it("never accepts a persisted payload's claimed retry policy", () => {
    const parsed = parseNotificationRecoveryPayload(JSON.stringify({ ...payload, recoveryClaim: { attemptCount: 0 }, maxAttempts: 999 }));
    expect(parsed).not.toHaveProperty("recoveryClaim"); expect(parsed).not.toHaveProperty("maxAttempts");
  });

  it.each([
    ["different recipient", "staff", "different-staff"],
    ["missing recipient", "staff", undefined],
    ["recipient added to a general delivery", null, "staff"],
  ] as const)("rejects a %s before any repository or configuration I/O", async (_name, recipientUserId, requestedRecipient) => {
    const f = fixture({ recipientUserId });
    const request = { ...f.request(), recipientUserId: requestedRecipient };
    const read = vi.spyOn(f.repository, "getByChannelAndKey");
    const claim = vi.spyOn(f.repository, "tryMarkPendingForRecovery");
    const create = vi.spyOn(f.repository, "createPending");
    vi.mocked(resolveRuntimeGovNotifyDeliveryMode).mockClear();
    await expect(sendNotificationOnce(request, { repository: f.repository, now: () => NOW }))
      .rejects.toThrow("NOTIFICATION_RECOVERY_CLAIM_IDENTITY_MISMATCH");
    expect(read).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
    expect(resolveRuntimeGovNotifyDeliveryMode).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
    expect(f.row()).toMatchObject({ status: "FAILED", attemptCount: 5, recipientUserId });
  });

  it.each(["different-staff", null] as const)("rejects recipient drift to %s after a successful atomic claim before a sender ignoring the callback", async (recipientUserId) => {
    const f = fixture();
    const atomicClaim = f.repository.tryMarkPendingForRecovery;
    vi.spyOn(f.repository, "tryMarkPendingForRecovery").mockImplementation(async (args) => {
      const claimed = await atomicClaim(args);
      f.row().recipientUserId = recipientUserId;
      return claimed;
    });
    expect(await f.deliver()).toMatchObject({ outcome: "duplicate", reason: "in_progress" });
    expect(f.send).not.toHaveBeenCalled();
    expect(f.row()).toMatchObject({ status: "PENDING", attemptCount: 6, recipientUserId });
  });

  it("rechecks recipient identity in the final domain ownership callback", async () => {
    const f = fixture();
    const provider = vi.fn();
    const request = f.request();
    request.send = async (_mode, assertOwnership) => {
      f.row().recipientUserId = "different-staff";
      await assertOwnership?.(); await provider(); return {};
    };
    expect(await sendNotificationOnce(request, { repository: f.repository, now: () => NOW })).toMatchObject({ outcome: "duplicate" });
    expect(provider).not.toHaveBeenCalled();
    expect(f.row()).toMatchObject({ status: "PENDING", attemptCount: 6, recipientUserId: "different-staff" });
  });

  it("uses only the trusted candidate recipient rather than nested persisted claim extras", async () => {
    const f = fixture();
    const malicious = { ...f.snapshot, recoveryClaim: { recipientUserId: "different-staff", attemptCount: 0 }, maxAttempts: 999 };
    const claim = createNotificationRecoveryClaim(malicious);
    expect(claim.recipientUserId).toBe("staff");
    expect(claim).not.toHaveProperty("recoveryClaim"); expect(claim).not.toHaveProperty("maxAttempts");
    expect(Object.isFrozen(claim)).toBe(true);
  });

  it("binds the physical row ID again at the final provider ownership check", async () => {
    const f = fixture();
    const send = vi.fn();
    const request = f.request();
    request.send = async (_mode, assertOwnership) => {
      f.row().id = "22222222-2222-4222-8222-222222222222";
      await assertOwnership?.(); await send(); return {};
    };
    expect(await sendNotificationOnce(request, { repository: f.repository, now: () => NOW })).toMatchObject({ outcome: "duplicate" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("legacy delivery-mode recovery retention", () => {
  const bookingPayload = { version: 1, kind: "BOOKING_CONFIRMATION", bookingId: "22222222-2222-4222-8222-222222222222", idempotencyKey: "original" } as const;
  function legacy(mode?: "LIVE" | null, keySuffix = ""): RecoverableNotificationDelivery {
    const identity = notificationRecoveryIdentity(bookingPayload);
    return { id: "11111111-1111-4111-8111-111111111111", channel: NotificationChannel.EMAIL,
      notificationType: identity.notificationType, deliveryKey: identity.deliveryKey + keySuffix, status: NotificationDeliveryStatus.FAILED,
      attemptCount: 2, lastAttemptedAt: OLD, createdAt: OLD, recoveryPayload: JSON.stringify(bookingPayload), deliveryMode: mode };
  }
  it.each([null, undefined] as const)("preserves a general booking delivery's nullable recipient (%s) through dispatch and the final send boundary", async (recipientUserId) => {
    const row = { ...legacy("LIVE"), recipientUserId };
    const store = notificationTestRepository([row], () => NOW);
    const provider = vi.fn(async () => ({ providerMessageId: "offline-booking" }));
    const dispatch = createNotificationRecoveryDispatcher("https://app.example", {
      notifyBookingConfirmation: async (args) => {
        await sendNotificationOnce({ channel: row.channel, notificationType: row.notificationType,
          deliveryKey: row.deliveryKey, preserveDeliveryKey: true, provider: "govuk_notify",
          bookingId: args.bookingId, userId: "booker-is-a-subject-not-a-recipient-binding",
          deliveryMode: args.deliveryMode, recoveryPayload: bookingPayload, recoveryClaim: args.recoveryClaim,
          send: provider }, { repository: store.repository, now: () => NOW });
      },
    });
    await dispatch(row, bookingPayload);
    expect(provider).toHaveBeenCalledOnce();
    expect(store.rows.get(row.deliveryKey)).toMatchObject({ status: "SENT", attemptCount: 3 });
  });

  it.each([["persisted mode", "LIVE", ""], ["physical key suffix", null, ":notify-live"]] as const)("uses an unambiguous %s when the payload has no mode", async (_name, mode, suffix) => {
    const notifyBookingConfirmation = vi.fn(async () => undefined);
    const row = legacy(mode, suffix);
    await createNotificationRecoveryDispatcher("https://app.example", { notifyBookingConfirmation })(row, bookingPayload);
    expect(notifyBookingConfirmation).toHaveBeenCalledWith(expect.objectContaining({ deliveryMode: "LIVE",
      recoveryClaim: expect.objectContaining({ deliveryKey: row.deliveryKey, deliveryMode: mode }) }));
  });
  it.each(["unknown", "conflicting"])("retains a legacy row with %s mode without claiming or consuming a fallback slot", async (kind) => {
    const row = legacy(kind === "conflicting" ? "LIVE" : null, kind === "conflicting" ? ":notify-team_test" : "");
    const before = { ...row };
    const notifyBookingConfirmation = vi.fn(async () => undefined);
    const recordFailure = vi.fn(async () => true);
    const onError = vi.fn();
    const onDeferred = vi.fn();
    const summary = await runNotificationRecoveryBatch({ candidates: [row], now: NOW,
      dispatch: createNotificationRecoveryDispatcher("https://app.example", { notifyBookingConfirmation }),
      getCurrent: async () => row, recordFailure, onError, onDeferred });
    expect(summary.deferred).toBe(1); expect(summary.failed).toBe(0); expect(row).toEqual(before);
    expect(notifyBookingConfirmation).not.toHaveBeenCalled(); expect(recordFailure).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onDeferred).toHaveBeenCalledWith(row, expect.stringMatching(/^RECOVERY_DELIVERY_MODE_/), false);
  });
});


it("does not interpret a legacy logical idempotency-key tail as a transport mode", async () => {
  const payload = { version: 1, kind: "BOOKING_CONFIRMATION", bookingId: "22222222-2222-4222-8222-222222222222", idempotencyKey: "logical:notify-live" } as const;
  const identity = notificationRecoveryIdentity(payload);
  const row: RecoverableNotificationDelivery = { id: "11111111-1111-4111-8111-111111111111", channel: NotificationChannel.EMAIL,
    notificationType: identity.notificationType, deliveryKey: identity.deliveryKey, recoveryPayload: JSON.stringify(payload),
    status: NotificationDeliveryStatus.FAILED, attemptCount: 1, lastAttemptedAt: OLD, createdAt: OLD, deliveryMode: null };
  const notifyBookingConfirmation = vi.fn(async () => undefined);
  await expect(createNotificationRecoveryDispatcher("https://app.example", { notifyBookingConfirmation })(row, payload))
    .rejects.toThrow("RECOVERY_DELIVERY_MODE_UNVERIFIABLE");
  expect(notifyBookingConfirmation).not.toHaveBeenCalled();
});

it("retains a trusted ledger mode when a bare logical key has a different mode-looking tail", async () => {
  const f = fixture({ deliveryKey: "bare-logical-key:notify-live", deliveryMode: "TEAM_TEST" });
  expect(await f.deliver()).toMatchObject({ outcome: "sent", attemptCount: 6 });
  expect(f.send).toHaveBeenCalledOnce(); expect(f.rows.size).toBe(1);
  expect(f.row().deliveryMode).toBe("TEAM_TEST");
});
