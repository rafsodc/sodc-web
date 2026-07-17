import { describe, expect, it, vi } from "vitest";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  runNotificationRecoveryBatch,
  type RecoverableNotificationDelivery,
} from "../notificationRecoveryEngine";
import {
  sendNotificationOnce,
  type NotificationDeliveryRepository,
} from "../notificationDelivery";
import {
  serializeNotificationRecoveryPayload,
  type NotificationRecoveryPayload,
} from "../notificationRecoveryPayload";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111" as UUIDString;
const BOOKING_ID = "22222222-2222-4222-8222-222222222222" as UUIDString;
const NOW = "2026-07-17T12:30:00.000Z";
const OLD = "2026-07-17T12:00:00.000Z";

const payload: NotificationRecoveryPayload = {
  version: 1,
  kind: "BOOKING_CONFIRMATION",
  bookingId: BOOKING_ID,
  idempotencyKey: "submission-1",
};

interface MutableDelivery extends RecoverableNotificationDelivery {
  providerMessageId?: string | null;
}

function candidate(
  status: NotificationDeliveryStatus,
  overrides: Partial<RecoverableNotificationDelivery> = {}
): MutableDelivery {
  return {
    id: DELIVERY_ID,
    channel: NotificationChannel.EMAIL,
    notificationType: "BOOKING_CONFIRMATION",
    deliveryKey: `booking-confirm:${BOOKING_ID}:submission-1`,
    recoveryPayload: serializeNotificationRecoveryPayload(payload),
    status,
    attemptCount: 1,
    lastAttemptedAt: OLD,
    createdAt: OLD,
    ...overrides,
  };
}

function recoveryHarness(initial: MutableDelivery, send: () => Promise<void>) {
  const stored = initial;
  const repository: NotificationDeliveryRepository = {
    async getByChannelAndKey() {
      return {
        id: stored.id,
        status: stored.status,
        attemptCount: stored.attemptCount,
        lastAttemptedAt: stored.lastAttemptedAt,
      };
    },
    async createPending() {
      throw new Error("unexpected create");
    },
    async tryMarkPending(args) {
      if (
        stored.status !== args.expectedStatus ||
        stored.attemptCount !== args.expectedAttemptCount
      ) {
        return false;
      }
      stored.status = NotificationDeliveryStatus.PENDING;
      stored.attemptCount = args.attemptCount;
      stored.lastAttemptedAt = args.lastAttemptedAt;
      return true;
    },
    async markSent(args) {
      if (
        stored.status !== NotificationDeliveryStatus.PENDING ||
        stored.attemptCount !== args.attemptCount
      ) {
        return false;
      }
      stored.status = NotificationDeliveryStatus.SENT;
      stored.lastAttemptedAt = args.lastAttemptedAt;
      stored.providerMessageId = args.providerMessageId;
      return true;
    },
    async markFailed(args) {
      if (
        stored.status !== NotificationDeliveryStatus.PENDING ||
        stored.attemptCount !== args.attemptCount
      ) {
        return false;
      }
      stored.status = NotificationDeliveryStatus.FAILED;
      stored.lastAttemptedAt = args.lastAttemptedAt;
      return true;
    },
  };

  const dispatch = vi.fn(async () => {
    await sendNotificationOnce(
      {
        channel: stored.channel,
        notificationType: stored.notificationType,
        deliveryKey: stored.deliveryKey,
        recoveryPayload: payload,
        send,
      },
      { repository, now: () => NOW }
    );
  });
  const getCurrent = vi.fn(async () => ({ ...stored }));
  return { stored, dispatch, getCurrent };
}

describe("runNotificationRecoveryBatch", () => {
  it.each([
    NotificationDeliveryStatus.FAILED,
    NotificationDeliveryStatus.PENDING,
  ])("recovers eligible %s deliveries through the normal ledger claim", async (status) => {
    const send = vi.fn(async () => undefined);
    const harness = recoveryHarness(candidate(status), send);

    const summary = await runNotificationRecoveryBatch({
      candidates: [harness.stored],
      now: NOW,
      dispatch: harness.dispatch,
      getCurrent: harness.getCurrent,
    });

    expect(summary.recovered).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(harness.stored.status).toBe(NotificationDeliveryStatus.SENT);
    expect(harness.stored.attemptCount).toBe(2);
  });

  it("does not redispatch an already-sent delivery", async () => {
    const send = vi.fn(async () => undefined);
    const harness = recoveryHarness(
      candidate(NotificationDeliveryStatus.SENT),
      send
    );

    const summary = await runNotificationRecoveryBatch({
      candidates: [harness.stored],
      now: NOW,
      dispatch: harness.dispatch,
      getCurrent: harness.getCurrent,
    });

    expect(summary.alreadySent).toBe(1);
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("leaves a fresh pending lease in progress", async () => {
    const send = vi.fn(async () => undefined);
    const harness = recoveryHarness(
      candidate(NotificationDeliveryStatus.PENDING, {
        lastAttemptedAt: "2026-07-17T12:25:00.000Z",
      }),
      send
    );

    const summary = await runNotificationRecoveryBatch({
      candidates: [harness.stored],
      now: NOW,
      dispatch: harness.dispatch,
      getCurrent: harness.getCurrent,
    });

    expect(summary.inProgress).toBe(1);
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it("allows only one concurrent recovery to send", async () => {
    let releaseSend: (() => void) | undefined;
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    const send = vi.fn(async () => sendGate);
    const harness = recoveryHarness(
      candidate(NotificationDeliveryStatus.FAILED),
      send
    );
    const dependencies = {
      candidates: [harness.stored],
      now: NOW,
      dispatch: harness.dispatch,
      getCurrent: harness.getCurrent,
    };

    const first = runNotificationRecoveryBatch(dependencies);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const secondSummary = await runNotificationRecoveryBatch(dependencies);
    releaseSend?.();
    const firstSummary = await first;

    expect(send).toHaveBeenCalledTimes(1);
    expect(firstSummary.recovered).toBe(1);
    expect(secondSummary.inProgress).toBe(1);
  });

  it("stops retrying after the configured attempt limit", async () => {
    const send = vi.fn(async () => undefined);
    const harness = recoveryHarness(
      candidate(NotificationDeliveryStatus.FAILED, { attemptCount: 6 }),
      send
    );

    const summary = await runNotificationRecoveryBatch({
      candidates: [harness.stored],
      now: NOW,
      dispatch: harness.dispatch,
      getCurrent: harness.getCurrent,
    });

    expect(summary.exhausted).toBe(1);
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it("records malformed recovery payloads as bounded failed attempts", async () => {
    const malformed = candidate(NotificationDeliveryStatus.FAILED, {
      recoveryPayload: "not-json",
    });
    const recordFailure = vi.fn(async () => true);

    const summary = await runNotificationRecoveryBatch({
      candidates: [malformed],
      now: NOW,
      dispatch: vi.fn(),
      getCurrent: vi.fn(),
      recordFailure,
    });

    expect(summary.invalid).toBe(1);
    expect(summary.failed).toBe(0);
    expect(recordFailure).toHaveBeenCalledWith(malformed);
  });

  it("records a bounded failure when dispatch leaves the ledger unchanged", async () => {
    const unchanged = candidate(NotificationDeliveryStatus.FAILED);
    const recordFailure = vi.fn(async () => true);

    const summary = await runNotificationRecoveryBatch({
      candidates: [unchanged],
      now: NOW,
      dispatch: vi.fn(async () => undefined),
      getCurrent: vi.fn(async () => ({ ...unchanged })),
      recordFailure,
    });

    expect(summary.failed).toBe(1);
    expect(recordFailure).toHaveBeenCalledWith(unchanged);
  });
});
