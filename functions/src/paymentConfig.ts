import { HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";

export type StripeClient = InstanceType<typeof Stripe>;

export const stripeSecret = defineSecret("STRIPE_SECRET");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
export const stripeWebhookPaymentsSecret = defineSecret("STRIPE_WEBHOOK_SECRET_PAYMENTS");

export const APP_BASE_URL = (() => {
  const url = process.env.APP_BASE_URL || "http://localhost:5173";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`APP_BASE_URL must use http or https, got: ${parsed.protocol}`);
    }
  } catch {
    throw new Error(`APP_BASE_URL is not a valid URL: "${url}"`);
  }
  return url;
})();

export function requireStripe(secretValue: string | undefined): StripeClient {
  if (!secretValue) {
    throw new HttpsError("failed-precondition", "Stripe is not configured on the server");
  }
  return new Stripe(secretValue);
}
