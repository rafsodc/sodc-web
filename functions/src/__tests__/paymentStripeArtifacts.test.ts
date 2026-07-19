import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import type { StripeClient } from "../paymentConfig";

const paymentConfigMocks = vi.hoisted(() => ({
  requireStripe: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn().mockImplementation((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("../paymentConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../paymentConfig")>()),
  requireStripe: paymentConfigMocks.requireStripe,
  stripeSecret: { value: () => "sk_test" },
}));

import {
  fetchStripeArtifactsForOrder,
  getMyTicketOrderStripeArtifactsBatch,
} from "../paymentStripeArtifacts";

const USER_ID = "user-1";
const ORDER_1 = "11111111-1111-4111-8111-111111111111";
const ORDER_2 = "22222222-2222-4222-8222-222222222222";
const consumeRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const ensureRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const getOrder = vi.spyOn(admin, "getTicketOrderStripeArtifactsForCallable");

type Handler = (request: {
  auth?: { uid: string; token: Record<string, unknown> };
  data: Record<string, unknown>;
}) => Promise<unknown>;

const handler = getMyTicketOrderStripeArtifactsBatch as unknown as Handler;

function stripeClientWith(args: {
  session?: unknown;
  paymentIntent?: unknown;
  charge?: unknown;
  chargeList?: unknown;
}) {
  const retrieveSession = vi.fn().mockResolvedValue(args.session ?? {});
  const retrievePaymentIntent = vi.fn().mockResolvedValue(args.paymentIntent ?? {});
  const retrieveCharge = vi.fn().mockResolvedValue(args.charge ?? {});
  const listCharges = vi.fn().mockResolvedValue(args.chargeList ?? { data: [] });
  const stripeClient = {
    checkout: { sessions: { retrieve: retrieveSession } },
    paymentIntents: { retrieve: retrievePaymentIntent },
    charges: { retrieve: retrieveCharge, list: listCharges },
  } as unknown as StripeClient;
  return {
    stripeClient,
    retrieveSession,
    retrievePaymentIntent,
    retrieveCharge,
    listCharges,
  };
}

describe("fetchStripeArtifactsForOrder", () => {
  it("uses the expanded checkout-session charge when available", async () => {
    const client = stripeClientWith({
      session: {
        payment_intent: {
          id: "pi_1",
          latest_charge: { id: "ch_1", receipt_url: "https://stripe.test/session-receipt" },
        },
      },
    });

    await expect(
      fetchStripeArtifactsForOrder({
        stripeClient: client.stripeClient,
        stripeCheckoutSessionId: "cs_1",
      })
    ).resolves.toEqual({ receiptUrl: "https://stripe.test/session-receipt" });
    expect(client.retrievePaymentIntent).not.toHaveBeenCalled();
  });

  it("falls back to the expanded payment-intent charge", async () => {
    const client = stripeClientWith({
      paymentIntent: {
        latest_charge: { id: "ch_2", receipt_url: "https://stripe.test/pi-receipt" },
      },
    });

    await expect(
      fetchStripeArtifactsForOrder({
        stripeClient: client.stripeClient,
        stripePaymentIntentId: "pi_2",
      })
    ).resolves.toEqual({ receiptUrl: "https://stripe.test/pi-receipt" });
  });

  it("retrieves a string-valued latest charge", async () => {
    const client = stripeClientWith({
      paymentIntent: { latest_charge: "ch_3" },
      charge: { receipt_url: "https://stripe.test/charge-receipt" },
    });

    await expect(
      fetchStripeArtifactsForOrder({
        stripeClient: client.stripeClient,
        stripePaymentIntentId: "pi_3",
      })
    ).resolves.toEqual({ receiptUrl: "https://stripe.test/charge-receipt" });
    expect(client.retrieveCharge).toHaveBeenCalledWith("ch_3");
  });

  it("uses the charge-list fallback for older payment intents", async () => {
    const client = stripeClientWith({
      paymentIntent: {},
      chargeList: { data: [{ receipt_url: "https://stripe.test/list-receipt" }] },
    });

    await expect(
      fetchStripeArtifactsForOrder({
        stripeClient: client.stripeClient,
        stripePaymentIntentId: "pi_4",
      })
    ).resolves.toEqual({ receiptUrl: "https://stripe.test/list-receipt" });
    expect(client.listCharges).toHaveBeenCalledWith({ payment_intent: "pi_4", limit: 1 });
  });
});

describe("getMyTicketOrderStripeArtifactsBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureRateLimitBucket.mockResolvedValue({ data: {} } as never);
    consumeRateLimit.mockResolvedValue({ data: {} } as never);
  });

  it("authorizes, rate-limits, verifies ownership, and returns Stripe artifacts", async () => {
    const client = stripeClientWith({
      paymentIntent: {
        latest_charge: { id: "ch_1", receipt_url: "https://stripe.test/receipt" },
      },
    });
    paymentConfigMocks.requireStripe.mockReturnValue(client.stripeClient);
    getOrder.mockResolvedValue({
      data: {
        ticketOrder: {
          id: ORDER_1,
          user: { id: USER_ID },
          stripeCheckoutSessionId: null,
          stripePaymentIntentId: "pi_1",
        },
      },
    } as never);

    await expect(
      handler({
        auth: { uid: USER_ID, token: { enabled: true } },
        data: { orderIds: [ORDER_1] },
      })
    ).resolves.toEqual({
      artifactsByOrderId: {
        [ORDER_1]: { receiptUrl: "https://stripe.test/receipt" },
      },
    });

    expect(consumeRateLimit).toHaveBeenCalledWith({
      userId: USER_ID,
      functionName: "getMyTicketOrderStripeArtifactsBatch",
      windowStart: expect.any(String),
      limit: 10,
    });
    expect(getOrder).toHaveBeenCalledWith({ id: ORDER_1 });
    expect(consumeRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      getOrder.mock.invocationCallOrder[0]
    );
    expect(paymentConfigMocks.requireStripe).toHaveBeenCalledWith("sk_test");
  });

  it("rejects disabled callers before rate limiting or reading orders", async () => {
    await expect(
      handler({
        auth: { uid: USER_ID, token: { enabled: false } },
        data: { orderIds: [ORDER_1] },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(getOrder).not.toHaveBeenCalled();
    expect(paymentConfigMocks.requireStripe).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty batch", []],
    ["more than 50 ids", Array.from({ length: 51 }, () => ORDER_1)],
  ])("rejects %s before reading orders", async (_label, orderIds) => {
    await expect(
      handler({
        auth: { uid: USER_ID, token: { enabled: true } },
        data: { orderIds },
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(consumeRateLimit).toHaveBeenCalledOnce();
    expect(getOrder).not.toHaveBeenCalled();
    expect(paymentConfigMocks.requireStripe).not.toHaveBeenCalled();
  });

  it("rejects malformed order ids before reading orders", async () => {
    await expect(
      handler({
        auth: { uid: USER_ID, token: { enabled: true } },
        data: { orderIds: ["not-a-uuid"] },
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(consumeRateLimit).toHaveBeenCalledOnce();
    expect(getOrder).not.toHaveBeenCalled();
  });

  it("rejects the whole batch when any order belongs to another user", async () => {
    getOrder
      .mockResolvedValueOnce({
        data: {
          ticketOrder: {
            id: ORDER_1,
            user: { id: USER_ID },
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: null,
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          ticketOrder: {
            id: ORDER_2,
            user: { id: "other-user" },
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: "pi_other",
          },
        },
      } as never);

    await expect(
      handler({
        auth: { uid: USER_ID, token: { enabled: true } },
        data: { orderIds: [ORDER_1, ORDER_2] },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(getOrder).toHaveBeenCalledTimes(2);
    expect(paymentConfigMocks.requireStripe).not.toHaveBeenCalled();
  });

  it("returns null artifacts for missing orders without leaking order details", async () => {
    paymentConfigMocks.requireStripe.mockReturnValue(stripeClientWith({}).stripeClient);
    getOrder.mockResolvedValue({ data: { ticketOrder: null } } as never);

    await expect(
      handler({
        auth: { uid: USER_ID, token: { enabled: true } },
        data: { orderIds: [ORDER_1] },
      })
    ).resolves.toEqual({
      artifactsByOrderId: {
        [ORDER_1]: {
          receiptUrl: null,
          hostedInvoiceUrl: null,
          invoicePdfUrl: null,
        },
      },
    });
  });

  it("propagates order lookup failures without initializing Stripe", async () => {
    getOrder.mockRejectedValueOnce(new Error("Data Connect unavailable"));

    await expect(
      handler({
        auth: { uid: USER_ID, token: { enabled: true } },
        data: { orderIds: [ORDER_1] },
      })
    ).rejects.toThrow("Data Connect unavailable");

    expect(paymentConfigMocks.requireStripe).not.toHaveBeenCalled();
  });
});
