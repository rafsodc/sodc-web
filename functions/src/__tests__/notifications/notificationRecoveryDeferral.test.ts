import { afterEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import { NotificationChannel, NotificationDeliveryStatus, NotificationRecoveryDeferredReason } from "@dataconnect/admin-generated";
import { fairNotificationRecoveryCandidates, runNotificationRecoveryBatch, type RecoverableNotificationDelivery } from "../../notificationRecoveryEngine";
import { NotificationRecoveryDeferredError } from "../../notificationRecoveryClaim";
import { notificationRecoveryIdentity } from "../../notificationRecoveryIdentity";
import { markNotificationRecoveryDeferred, applyNotificationRecoveryRelease, planNotificationRecoveryRelease, type NotificationRecoveryReleaseRow } from "../../notificationRecoveryDeferral";
import { createNotificationRecoveryDispatcher } from "../../notificationRecovery";

const OLD = "2026-10-23T19:30:00.123456Z";
const NOW = "2026-10-24T08:00:00.000Z";
const UNKNOWN = NotificationRecoveryDeferredReason.RECOVERY_DELIVERY_MODE_UNVERIFIABLE;
const PROOF = { actorId: "reviewer-1", evidenceReference: "issue-671/verified-template-history" };
function row(index = 0, status = NotificationDeliveryStatus.FAILED): NotificationRecoveryReleaseRow {
  const payload = { version: 1, kind: "BOOKING_APPROVED", bookingId: "22222222-2222-4222-8222-222222222222" } as const;
  const identity = notificationRecoveryIdentity(payload);
  return { id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`, channel: NotificationChannel.EMAIL,
    notificationType: identity.notificationType, deliveryKey: identity.deliveryKey, recoveryPayload: JSON.stringify(payload),
    status, attemptCount: 2, lastAttemptedAt: OLD, createdAt: OLD, recipientUserId: null, deliveryMode: null,
    recoveryDeferredAt: NOW, recoveryDeferredReason: UNKNOWN };
}

describe("durable nonterminal deferral and bounded scan fairness", () => {
  it("moves past more than 25 deferred rows in both lanes across bounded repeated runs", async () => {
    const rows = [NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.PENDING].flatMap((status, lane) =>
      Array.from({ length: 33 }, (_, index) => ({ ...row(lane * 100 + index, status), deliveryKey: `${lane}:${index}`,
        recoveryDeferredAt: null, recoverable: index === 32 })));
    const original = rows.map((entry) => ({ ...entry }));
    const sent: string[] = [];
    const failures = vi.fn(async () => true);
    const defer = vi.fn(async (candidate: RecoverableNotificationDelivery, reason: string) => {
      const current = rows.find((entry) => entry.id === candidate.id)!;
      if (current.recoveryDeferredAt || current.status !== candidate.status || current.attemptCount !== candidate.attemptCount) return false;
      current.recoveryDeferredAt = NOW; current.recoveryDeferredReason = reason as typeof UNKNOWN;
      return true;
    });
    for (let run = 0; run < 3; run += 1) {
      const lane = (status: NotificationDeliveryStatus) => rows.filter((entry) => entry.status === status && !entry.recoveryDeferredAt).slice(0, 25).map((entry) => ({ ...entry }));
      const candidates = fairNotificationRecoveryCandidates(lane(NotificationDeliveryStatus.FAILED), lane(NotificationDeliveryStatus.PENDING));
      const before = defer.mock.calls.length + sent.length;
      const summary = await runNotificationRecoveryBatch({ candidates, now: NOW, recordFailure: failures, defer,
        dispatch: async (candidate) => {
          const current = rows.find((entry) => entry.id === candidate.id)!;
          if (!current.recoverable) throw new NotificationRecoveryDeferredError(UNKNOWN);
          sent.push(current.id); current.status = NotificationDeliveryStatus.SENT;
        }, getCurrent: async (candidate) => rows.find((entry) => entry.id === candidate.id)! });
      expect(summary.scanned).toBeLessThanOrEqual(25);
      expect(defer.mock.calls.length + sent.length - before).toBeLessThanOrEqual(25);
      expect(summary.failed).toBe(0);
    }
    expect(sent).toHaveLength(2); expect(failures).not.toHaveBeenCalled();
    expect(rows.filter((entry) => entry.recoveryDeferredAt)).toHaveLength(64);
    for (const entry of rows.filter((entry) => !entry.recoverable)) {
      const before = original.find((original) => original.id === entry.id)!;
      expect(entry).toEqual({ ...before, recoveryDeferredAt: NOW, recoveryDeferredReason: UNKNOWN });
    }
  });

  it("does not let one saturated lane take all recovery slots", () => {
    const failed = Array.from({ length: 25 }, (_, index) => row(index));
    const pending = Array.from({ length: 25 }, (_, index) => row(index + 100, NotificationDeliveryStatus.PENDING));
    const selected = fairNotificationRecoveryCandidates(failed, pending).slice(0, 25);
    expect(selected.filter((candidate) => candidate.status === "PENDING")).toHaveLength(12);
    expect(selected.filter((candidate) => candidate.status === "FAILED")).toHaveLength(13);
  });

  it("uses a separate deferred summary/log and never charges fallback attempts", async () => {
    const candidate = { ...row(), recoveryDeferredAt: null };
    const defer = vi.fn(async () => true); const onDeferred = vi.fn(); const onError = vi.fn(); const recordFailure = vi.fn();
    const summary = await runNotificationRecoveryBatch({ candidates: [candidate], now: NOW,
      dispatch: createNotificationRecoveryDispatcher("https://app.example"), getCurrent: vi.fn(), defer, onDeferred, onError, recordFailure });
    expect(summary).toMatchObject({ deferred: 1, failed: 0, recovered: 0 });
    expect(defer).toHaveBeenCalledWith(candidate, UNKNOWN); expect(onDeferred).toHaveBeenCalledWith(candidate, UNKNOWN, true);
    expect(onError).not.toHaveBeenCalled(); expect(recordFailure).not.toHaveBeenCalled();
  });

  it("does not dispatch a previously selected row that is already marked", async () => {
    const dispatch = vi.fn();
    expect(await runNotificationRecoveryBatch({ candidates: [row()], now: NOW, dispatch, getCurrent: vi.fn() }))
      .toMatchObject({ deferred: 1, failed: 0 });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("non-sending verified release planning", () => {
  it("requires explicit evidence and mode for a genuinely unknown bare-key row", () => {
    const candidate = row(); const before = { ...candidate };
    expect(() => planNotificationRecoveryRelease(candidate, PROOF)).toThrow("VERIFIED_MODE_REQUIRED");
    const plan = planNotificationRecoveryRelease(candidate, { ...PROOF, verifiedMode: "TEAM_TEST" });
    expect(plan.variables).toMatchObject({ expectedDeferredAt: NOW, expectedDeferredReason: UNKNOWN, expectedDeliveryMode: null,
      expectedDeliveryModeIsNull: true, verifiedDeliveryMode: "TEAM_TEST", expectedRecipientUserId: null, expectedRecipientUserIdIsNull: true });
    expect(plan.summary).toMatchObject({ fillsMissingDeliveryMode: true, verifiedMode: "TEAM_TEST", ...PROOF });
    expect(candidate).toEqual(before);
  });

  it.each(["ledger", "payload", "suffix"])("preserves consistent known %s evidence without inventing a mode", (source) => {
    const candidate = row();
    if (source === "ledger") candidate.deliveryMode = "LIVE";
    if (source === "payload") candidate.recoveryPayload = JSON.stringify({ ...JSON.parse(candidate.recoveryPayload!), deliveryMode: "LIVE" });
    if (source === "suffix") candidate.deliveryKey += ":notify-live";
    expect(planNotificationRecoveryRelease(candidate, PROOF).summary.verifiedMode).toBe("LIVE");
    expect(() => planNotificationRecoveryRelease(candidate, { ...PROOF, verifiedMode: "TEAM_TEST" })).toThrow("MODE_CONFLICT");
  });

  it("never overrides conflicting evidence even with operator proof", () => {
    const candidate = { ...row(), deliveryMode: "LIVE" as const, deliveryKey: row().deliveryKey + ":notify-team_test" };
    expect(() => planNotificationRecoveryRelease(candidate, { ...PROOF, verifiedMode: "LIVE" })).toThrow("MODE_CONFLICT");
  });

  it.each([{ actorId: undefined, evidenceReference: undefined }, { actorId: "" }, { evidenceReference: "" }, { actorId: "private@example.com" }, { evidenceReference: "https://example.test/?secret=bad" }])("rejects missing or unsafe audit reference %j", (change) => {
    expect(() => planNotificationRecoveryRelease(row(), { ...PROOF, verifiedMode: "LIVE", ...change } as never)).toThrow();
  });

  it.each([{ recoveryDeferredAt: null }, { recoveryDeferredReason: "UNKNOWN_REASON" }, { attemptCount: 6 }, { status: NotificationDeliveryStatus.SENT },
    { deliveryKey: "unrelated-key" }, { notificationType: "WRONG_TYPE" }])("rejects non-current or inconsistent release %j", (change) => {
    expect(() => planNotificationRecoveryRelease({ ...row(), ...change }, { ...PROOF, verifiedMode: "LIVE" })).toThrow();
  });

  it("binds privileged subject and recipient identity before release", () => {
    const payload = { version: 2, kind: "USER_PENDING_APPROVAL", userId: "applicant", recipientUserId: "staff", emailVerified: true } as const;
    const identity = notificationRecoveryIdentity(payload);
    const candidate = { ...row(), ...identity, recoveryPayload: JSON.stringify(payload), recipientUserId: "staff", subjectUserId: "applicant" };
    expect(planNotificationRecoveryRelease(candidate, { ...PROOF, verifiedMode: "TEAM_TEST" }).variables.expectedRecipientUserId).toBe("staff");
    expect(() => planNotificationRecoveryRelease({ ...candidate, recipientUserId: "replacement" }, { ...PROOF, verifiedMode: "TEAM_TEST" })).toThrow("PRIVILEGED_IDENTITY_MISMATCH");
    expect(() => planNotificationRecoveryRelease({ ...candidate, subjectUserId: "replacement" }, { ...PROOF, verifiedMode: "TEAM_TEST" })).toThrow("PRIVILEGED_IDENTITY_MISMATCH");
  });
});


afterEach(() => vi.restoreAllMocks());

describe("guarded deferral/release SDK adapters", () => {
  it.each([0, 1])("marks nonterminal quarantine only when the snapshot CAS affects %i rows", async (affected) => {
    const candidate = { ...row(), recoveryDeferredAt: null };
    const mark = vi.spyOn(sdk, "markNotificationRecoveryDeferredForClaimById").mockResolvedValue({ data: { notificationDelivery_updateMany: affected } } as never);
    expect(await markNotificationRecoveryDeferred(candidate, UNKNOWN)).toBe(affected === 1);
    expect(mark).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: candidate.id, expectedAttemptCount: 2,
      expectedLastAttemptedAt: OLD, expectedRecipientUserId: null, expectedRecipientUserIdIsNull: true,
      deferredReason: UNKNOWN }));
    expect(mark.mock.calls[0][0]).not.toHaveProperty("lastAttemptedAt");
    expect(mark.mock.calls[0][0]).not.toHaveProperty("attemptCount");
  });

  it("refuses an arbitrary deferred reason before reaching the SDK", async () => {
    const mark = vi.spyOn(sdk, "markNotificationRecoveryDeferredForClaimById");
    await expect(markNotificationRecoveryDeferred(row(), "PRIVATE_PROVIDER_ERROR")) .rejects.toThrow("DEFERRED_REASON_INVALID");
    expect(mark).not.toHaveBeenCalled();
  });

  it.each([0, 1])("applies the exact reviewed non-sending release variables when CAS affects %i rows", async (affected) => {
    const plan = planNotificationRecoveryRelease(row(), { ...PROOF, verifiedMode: "TEAM_TEST" });
    const release = vi.spyOn(sdk, "releaseNotificationRecoveryDeferralForClaimById").mockResolvedValue({ data: { notificationDelivery_updateMany: affected } } as never);
    expect(await applyNotificationRecoveryRelease(plan)).toBe(affected === 1);
    expect(release).toHaveBeenCalledExactlyOnceWith(plan.variables);
  });
});


it("rejects a recipient UID on an ordinary nonstaff release", () => {
  expect(() => planNotificationRecoveryRelease({ ...row(), recipientUserId: "unexpected-staff" }, { ...PROOF, verifiedMode: "TEAM_TEST" }))
    .toThrow("RECIPIENT_IDENTITY_UNSUPPORTED");
});

it("permits a null-UID legacy staff record to re-enter its existing non-sending terminal skip", () => {
  const payload = { version: 1, kind: "USER_PENDING_APPROVAL", userId: "applicant", emailVerified: true, recipientEmail: "legacy@example.invalid" } as const;
  const candidate = { ...row(), ...notificationRecoveryIdentity(payload), recoveryPayload: JSON.stringify(payload), recipientUserId: null };
  expect(planNotificationRecoveryRelease(candidate, { ...PROOF, verifiedMode: "TEAM_TEST" }).variables.expectedRecipientUserId).toBeNull();
  expect(() => planNotificationRecoveryRelease({ ...candidate, recipientUserId: "unexpected-staff" }, { ...PROOF, verifiedMode: "TEAM_TEST" }))
    .toThrow("RECIPIENT_IDENTITY_UNSUPPORTED");
});


it("reports a concurrently persisted quarantine as deferred without charging a fallback failure", async () => {
  const candidate = { ...row(), recoveryDeferredAt: null };
  const failure = vi.fn();
  const summary = await runNotificationRecoveryBatch({ candidates: [candidate], now: NOW,
    dispatch: async () => undefined, getCurrent: async () => ({ ...candidate, recoveryDeferredAt: NOW, recoveryDeferredReason: UNKNOWN }),
    recordFailure: failure });
  expect(summary).toMatchObject({ deferred: 1, failed: 0, recovered: 0 });
  expect(failure).not.toHaveBeenCalled();
});
