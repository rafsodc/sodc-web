import { describe, expect, it, vi } from "vitest";
import type { StripeClient } from "../paymentConfig";
import { fetchStripeArtifactsForOrder } from "../paymentStripeArtifacts";

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
