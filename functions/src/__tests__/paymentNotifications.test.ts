import { describe, expect, it, vi } from "vitest";
import { NotificationChannel, type TicketOrderStatus } from "@dataconnect/admin-generated";
import { emitPaymentLifecycleNotification } from "../paymentNotifications";

describe("paymentNotifications", () => {
  it("routes payment notifications through the idempotent delivery helper", async () => {
    const dispatcher = vi.fn(async () => undefined);
    const notificationSender = vi.fn(async (request: {
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
    });

    await emitPaymentLifecycleNotification(
      {
        type: "PAYMENT_PAID",
        orderId: "00000000-0000-0000-0000-000000000001",
        eventId: "evt-1",
        stripeEventId: "stripe_evt_1",
        status: "PAID" as TicketOrderStatus,
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

  it("swallows delivery helper failures to keep payment path non-blocking", async () => {
    const dispatcher = vi.fn(async () => undefined);
    const notificationSender = vi.fn(async () => {
      throw new Error("delivery failed");
    });

    await expect(
      emitPaymentLifecycleNotification(
        {
          type: "PAYMENT_FAILED",
          orderId: "00000000-0000-0000-0000-000000000002",
          stripeEventId: "stripe_evt_2",
          status: "FAILED" as TicketOrderStatus,
          occurredAt: "2026-04-27T19:00:00.000Z",
        },
        dispatcher,
        notificationSender
      )
    ).resolves.toBeUndefined();
    expect(dispatcher).not.toHaveBeenCalled();
  });
});
