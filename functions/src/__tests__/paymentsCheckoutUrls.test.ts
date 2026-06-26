import { describe, expect, it } from "vitest";
import { buildStripeCheckoutReturnUrls, MEMBER_PAYMENTS_PATH } from "../payments";

describe("buildStripeCheckoutReturnUrls", () => {
  const orderId = "550e8400-e29b-41d4-a716-446655440000";

  it("uses /payments path aligned with frontend ROUTES.MY_PAYMENTS", () => {
    expect(MEMBER_PAYMENTS_PATH).toBe("/payments");
    const urls = buildStripeCheckoutReturnUrls("https://app.example", orderId);
    expect(urls.successUrl).toContain("/payments?checkout=success");
    expect(urls.cancelUrl).toContain("/payments?checkout=cancel");
    expect(urls.successUrl).not.toContain("/my-payments");
    expect(urls.cancelUrl).not.toContain("/my-payments");
  });

  it("strips trailing slash from app base URL", () => {
    const urls = buildStripeCheckoutReturnUrls("https://app.example/", orderId);
    expect(urls.successUrl).toBe(
      `https://app.example/payments?checkout=success&orderId=${encodeURIComponent(orderId)}`
    );
    expect(urls.cancelUrl).toBe(
      `https://app.example/payments?checkout=cancel&orderId=${encodeURIComponent(orderId)}`
    );
  });

  it("includes orderId query param on both URLs", () => {
    const urls = buildStripeCheckoutReturnUrls("http://localhost:5173", orderId);
    expect(urls.successUrl).toContain(`orderId=${encodeURIComponent(orderId)}`);
    expect(urls.cancelUrl).toContain(`orderId=${encodeURIComponent(orderId)}`);
  });
});
