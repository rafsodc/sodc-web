import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { NotificationChannel, TicketOrderStatus } from "@dataconnect/admin-generated";
import { GOV_NOTIFY_PROVIDER } from "../mailer";
import { emitPaymentLifecycleNotification } from "../paymentNotifications";

describe("paymentNotifications", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it("routes payment notifications through the idempotent delivery helper", async () => {
    const dispatcher = vi.fn(async () => undefined);
    const notificationSender = vi.fn(
      async (request: {
        channel: NotificationChannel;
        notificationType: string;
        deliveryKey: string;
        send: () => Promise<unknown>;
      }) => {
        expect(request.channel).toBe(NotificationChannel.EMAIL);
        expect(request.notificationType).toBe("PAYMENT_PAID");
        expect(request.deliveryKey).toBe("payment:00000000-0000-0000-0000-000000000001:PAYMENT_PAID:stripe_evt_1");
        await request.send();
        return { outcome: "sent" as const };
      }
    );

    await emitPaymentLifecycleNotification(
      {
        type: "PAYMENT_PAID",
        orderId: "00000000-0000-0000-0000-000000000001",
        eventId: "evt-1",
        stripeEventId: "stripe_evt_1",
        status: TicketOrderStatus.PAID,
        occurredAt: "2026-04-27T19:00:00.000Z",
      },
      dispatcher,
      notificationSender
    );

    expect(notificationSender).toHaveBeenCalledTimes(1);
    expect(dispatcher).toHaveBeenCalledTimes(1);
    expect(dispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_PAID",
        orderId: "00000000-0000-0000-0000-000000000001",
      })
    );
  });

  it("passes userId and provider extras to the delivery helper", async () => {
    const dispatcher = vi.fn(async () => ({ providerMessageId: "mid" }));
    const notificationSender = vi.fn(async () => ({ outcome: "sent" as const }));

    await emitPaymentLifecycleNotification(
      {
        type: "PAYMENT_FAILED",
        orderId: "00000000-0000-0000-0000-000000000002",
        stripeEventId: "stripe_evt_2",
        status: TicketOrderStatus.FAILED,
        occurredAt: "2026-04-27T19:00:00.000Z",
      },
      dispatcher,
      notificationSender,
      { userId: "uid-1", provider: GOV_NOTIFY_PROVIDER }
    );

    expect(notificationSender).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "uid-1",
        provider: GOV_NOTIFY_PROVIDER,
      })
    );
  });

  it("swallows delivery helper failures after awaiting them", async () => {
    const dispatcher = vi.fn(async () => undefined);
    const notificationSender = vi.fn(async () => {
      throw new Error("delivery failed for buyer@example.com");
    });

    await expect(
      emitPaymentLifecycleNotification(
        {
          type: "PAYMENT_FAILED",
          orderId: "00000000-0000-0000-0000-000000000002",
          stripeEventId: "stripe_evt_2",
          status: TicketOrderStatus.FAILED,
          occurredAt: "2026-04-27T19:00:00.000Z",
        },
        dispatcher,
        notificationSender
      )
    ).resolves.toBeUndefined();

    const loggedMetadata = JSON.stringify(vi.mocked(logger.error).mock.calls[0][1]);
    expect(loggedMetadata).not.toContain("buyer@example.com");
    expect(loggedMetadata).toContain("[redacted-email]");
    expect(dispatcher).not.toHaveBeenCalled();
  });
});
