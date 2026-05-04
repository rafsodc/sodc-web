import { describe, expect, it } from "vitest";
import { classifyStripeWebhookDomain, eventBelongsToPaymentsDomain } from "../stripeWebhookRouting";

describe("stripeWebhookRouting", () => {
  it("routes payment lifecycle events to the payments domain", () => {
    expect(eventBelongsToPaymentsDomain("checkout.session.completed")).toBe(true);
    expect(eventBelongsToPaymentsDomain("charge.refunded")).toBe(true);
    expect(eventBelongsToPaymentsDomain("charge.dispute.created")).toBe(true);
  });

  it("marks unsupported events outside domain endpoints", () => {
    expect(eventBelongsToPaymentsDomain("payment_intent.succeeded")).toBe(false);
    expect(classifyStripeWebhookDomain("payment_intent.succeeded")).toBe("unsupported");
  });

  it("classifies supported events to payments domain", () => {
    expect(classifyStripeWebhookDomain("checkout.session.expired")).toBe("payments");
  });
});
