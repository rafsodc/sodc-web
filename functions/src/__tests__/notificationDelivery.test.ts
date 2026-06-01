import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  sendNotificationOnce,
  type NotificationDeliveryRepository,
} from "../notificationDelivery";

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

interface StoredDelivery {
  id: UUIDString;
  channel: NotificationChannel;
  deliveryKey: string;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  provider?: string | null;
  providerMessageId?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

function createRepository(initialRecords: StoredDelivery[] = []): {
  repository: NotificationDeliveryRepository;
  records: Map<string, StoredDelivery>;
} {
  const records = new Map<string, StoredDelivery>();
  for (const record of initialRecords) {
    records.set(`${record.channel}:${record.deliveryKey}`, { ...record });
  }

  function key(channel: NotificationChannel, deliveryKey: string): string {
    return `${channel}:${deliveryKey}`;
  }

  function getById(id: UUIDString): StoredDelivery {
    const record = [...records.values()].find((candidate) => candidate.id === id);
    if (!record) {
      throw new Error(`Missing record ${id}`);
    }
    return record;
  }

  const repository: NotificationDeliveryRepository = {
    async getByChannelAndKey(args) {
      const record = records.get(key(args.channel, args.deliveryKey));
      return record
        ? {
            id: record.id,
            status: record.status,
            attemptCount: record.attemptCount,
          }
        : null;
    },

    async createPending(args) {
      const mapKey = key(args.channel, args.deliveryKey);
      if (records.has(mapKey)) {
        throw new Error("duplicate key value violates unique constraint");
      }
      const record: StoredDelivery = {
        id: `delivery-${records.size + 1}` as UUIDString,
        channel: args.channel,
        deliveryKey: args.deliveryKey,
        status: NotificationDeliveryStatus.PENDING,
        attemptCount: args.attemptCount,
        provider: args.provider ?? null,
      };
      records.set(mapKey, record);
      return {
        id: record.id,
        status: record.status,
        attemptCount: record.attemptCount,
      };
    },

    async markPending(args) {
      const record = getById(args.id);
      record.status = NotificationDeliveryStatus.PENDING;
      record.attemptCount = args.attemptCount;
      record.provider = args.provider ?? null;
    },

    async markSent(args) {
      const record = getById(args.id);
      record.status = NotificationDeliveryStatus.SENT;
      record.attemptCount = args.attemptCount;
      record.provider = args.provider ?? null;
      record.providerMessageId = args.providerMessageId ?? null;
      record.lastErrorCode = null;
      record.lastErrorMessage = null;
    },

    async markFailed(args) {
      const record = getById(args.id);
      record.status = NotificationDeliveryStatus.FAILED;
      record.attemptCount = args.attemptCount;
      record.provider = args.provider ?? null;
      record.lastErrorCode = args.lastErrorCode ?? null;
      record.lastErrorMessage = args.lastErrorMessage ?? null;
    },
  };

  return { repository, records };
}

describe("notificationDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends once and marks the delivery as sent", async () => {
    const { repository, records } = createRepository();
    const send = vi.fn(async () => ({ providerMessageId: "provider-message-1" }));
    const now = vi
      .fn<() => string>()
      .mockReturnValueOnce("2026-05-14T20:00:00.000Z")
      .mockReturnValueOnce("2026-05-14T20:00:01.000Z");

    const result = await sendNotificationOnce(
      {
        channel: NotificationChannel.EMAIL,
        notificationType: "PAYMENT_PAID",
        deliveryKey: "payment:order-1:PAYMENT_PAID:evt_1",
        provider: "unit-test",
        send,
      },
      { repository, now }
    );

    expect(result).toEqual({
      outcome: "sent",
      deliveryId: "delivery-1",
      attemptCount: 1,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(records.get("EMAIL:payment:order-1:PAYMENT_PAID:evt_1")).toMatchObject({
      status: NotificationDeliveryStatus.SENT,
      attemptCount: 1,
      provider: "unit-test",
      providerMessageId: "provider-message-1",
    });
  });

  it("skips duplicates that were already sent", async () => {
    const { repository } = createRepository([
      {
        id: "delivery-1" as UUIDString,
        channel: NotificationChannel.EMAIL,
        deliveryKey: "payment:order-1:PAYMENT_PAID:evt_1",
        status: NotificationDeliveryStatus.SENT,
        attemptCount: 1,
      },
    ]);
    const send = vi.fn(async () => undefined);

    const result = await sendNotificationOnce(
      {
        channel: NotificationChannel.EMAIL,
        notificationType: "PAYMENT_PAID",
        deliveryKey: "payment:order-1:PAYMENT_PAID:evt_1",
        send,
      },
      { repository }
    );

    expect(result).toEqual({
      outcome: "duplicate",
      reason: "already_sent",
      deliveryId: "delivery-1",
      attemptCount: 1,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("retries failed deliveries with the same key", async () => {
    const { repository, records } = createRepository([
      {
        id: "delivery-1" as UUIDString,
        channel: NotificationChannel.EMAIL,
        deliveryKey: "payment:order-1:PAYMENT_FAILED:evt_2",
        status: NotificationDeliveryStatus.FAILED,
        attemptCount: 1,
        lastErrorCode: "ProviderError",
        lastErrorMessage: "Timed out",
      },
    ]);
    const send = vi.fn(async () => ({ providerMessageId: "provider-message-2" }));

    const result = await sendNotificationOnce(
      {
        channel: NotificationChannel.EMAIL,
        notificationType: "PAYMENT_FAILED",
        deliveryKey: "payment:order-1:PAYMENT_FAILED:evt_2",
        provider: "unit-test",
        send,
      },
      { repository }
    );

    expect(result).toEqual({
      outcome: "sent",
      deliveryId: "delivery-1",
      attemptCount: 2,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(records.get("EMAIL:payment:order-1:PAYMENT_FAILED:evt_2")).toMatchObject({
      status: NotificationDeliveryStatus.SENT,
      attemptCount: 2,
      providerMessageId: "provider-message-2",
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  });

  it("records failures without throwing sender errors back to the caller", async () => {
    const { repository, records } = createRepository();
    const send = vi.fn(async () => {
      const error = new Error("x".repeat(700));
      (error as Error & { code?: string }).code = "ERR_" + "y".repeat(200);
      throw error;
    });

    const result = await sendNotificationOnce(
      {
        channel: NotificationChannel.EMAIL,
        notificationType: "PAYMENT_REFUNDED",
        deliveryKey: "payment:order-1:PAYMENT_REFUNDED:evt_3",
        provider: "unit-test",
        send,
      },
      { repository }
    );

    expect(result).toEqual({
      outcome: "failed",
      reason: "send_failed",
      deliveryId: "delivery-1",
      attemptCount: 1,
    });
    expect(records.get("EMAIL:payment:order-1:PAYMENT_REFUNDED:evt_3")).toMatchObject({
      status: NotificationDeliveryStatus.FAILED,
      attemptCount: 1,
    });
    expect(logger.error).toHaveBeenCalledWith(
      "notification delivery failed",
      expect.objectContaining({
        channel: NotificationChannel.EMAIL,
        notificationType: "PAYMENT_REFUNDED",
        errorCode: expect.stringMatching(/^ERR_/),
      })
    );
    const loggedMetadata = vi.mocked(logger.error).mock.calls[0]?.[1] as {
      errorCode?: string | null;
      errorMessage?: string | null;
    };
    expect(loggedMetadata.errorCode?.length ?? 0).toBeLessThanOrEqual(120);
    expect(loggedMetadata.errorMessage?.length ?? 0).toBeLessThanOrEqual(500);
  });
});
