import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import type { TicketOrderStatus } from "@dataconnect/admin-generated";
import { emitPaymentLifecycleNotification } from "../paymentNotifications";

describe("paymentNotifications", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it("dispatches notification payloads", async () => {
    const dispatcher = vi.fn(async () => undefined);
    await emitPaymentLifecycleNotification(
      {
        type: "PAYMENT_PAID",
        orderId: "00000000-0000-0000-0000-000000000001",
        eventId: "evt-1",
        stripeEventId: "stripe_evt_1",
        status: "PAID" as TicketOrderStatus,
        occurredAt: "2026-04-27T19:00:00.000Z",
      },
      dispatcher
    );

    expect(dispatcher).toHaveBeenCalledTimes(1);
    expect(dispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_PAID",
        orderId: "00000000-0000-0000-0000-000000000001",
      })
    );
  });

  it("swallows dispatcher failures to keep payment path non-blocking", async () => {
    const dispatcher = vi.fn(async () => {
      throw new Error("dispatch failed for buyer@example.com");
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
        dispatcher
      )
    ).resolves.toBeUndefined();

    const loggedMetadata = JSON.stringify(vi.mocked(logger.error).mock.calls[0][1]);
    expect(loggedMetadata).not.toContain("buyer@example.com");
    expect(loggedMetadata).toContain("[redacted-email]");
  });
});
