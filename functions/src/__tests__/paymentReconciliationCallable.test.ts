import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";

const reconciliationMocks = vi.hoisted(() => ({
  reconcile: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn().mockImplementation((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("../paymentReconciliationService", () => ({
  reconcilePaidCheckoutSessionOrders: reconciliationMocks.reconcile,
}));

import { reconcileMyCheckoutSessionOrders } from "../paymentReconciliationCallable";

const consumeRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const ensureRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

type Handler = (request: {
  auth?: { uid: string; token: Record<string, unknown> };
  data: Record<string, unknown>;
}) => Promise<unknown>;

const handler = reconcileMyCheckoutSessionOrders as unknown as Handler;

describe("reconcileMyCheckoutSessionOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureRateLimitBucket.mockResolvedValue({ data: {} } as never);
    consumeRateLimit.mockResolvedValue({ data: {} } as never);
    reconciliationMocks.reconcile.mockResolvedValue({
      appliedCount: 1,
      reconciledOrderIds: [ORDER_ID],
      orderIds: [ORDER_ID],
    });
  });

  it("authorizes, rate-limits, validates, and forwards reconciliation", async () => {
    const result = await handler({
      auth: { uid: "user-1", token: { enabled: true } },
      data: { orderId: ORDER_ID },
    });

    expect(consumeRateLimit).toHaveBeenCalledWith({
      userId: "user-1",
      functionName: "reconcileMyCheckoutSessionOrders",
      windowStart: expect.any(String),
      limit: 20,
    });
    expect(reconciliationMocks.reconcile).toHaveBeenCalledWith({
      uid: "user-1",
      anchorOrderId: ORDER_ID,
      webhookEventId: `member-reconcile:${ORDER_ID}`,
    });
    expect(consumeRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      reconciliationMocks.reconcile.mock.invocationCallOrder[0]
    );
    expect(result).toEqual({
      appliedCount: 1,
      reconciledOrderIds: [ORDER_ID],
      orderIds: [ORDER_ID],
    });
  });

  it("rejects disabled users before rate limiting or reconciliation", async () => {
    await expect(
      handler({
        auth: { uid: "user-1", token: { enabled: false } },
        data: { orderId: ORDER_ID },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(reconciliationMocks.reconcile).not.toHaveBeenCalled();
  });

  it("rejects invalid order ids before calling the reconciliation service", async () => {
    await expect(
      handler({
        auth: { uid: "user-1", token: { enabled: true } },
        data: { orderId: "not-a-uuid" },
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(consumeRateLimit).toHaveBeenCalledOnce();
    expect(reconciliationMocks.reconcile).not.toHaveBeenCalled();
  });

  it("propagates service failures so the caller can retry safely", async () => {
    reconciliationMocks.reconcile.mockRejectedValueOnce(
      new Error("Stripe temporarily unavailable")
    );

    await expect(
      handler({
        auth: { uid: "user-1", token: { enabled: true } },
        data: { orderId: ORDER_ID },
      })
    ).rejects.toThrow("Stripe temporarily unavailable");
  });
});
