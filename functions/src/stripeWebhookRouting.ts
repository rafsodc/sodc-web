import { isSupportedStripeEventType } from "./paymentStateMachine";

export const STRIPE_WEBHOOK_DOMAINS = {
  PAYMENTS: "payments",
  UNSUPPORTED: "unsupported",
} as const;

export type StripeWebhookDomain =
  typeof STRIPE_WEBHOOK_DOMAINS[keyof typeof STRIPE_WEBHOOK_DOMAINS];

export function eventBelongsToPaymentsDomain(eventType: string): boolean {
  return isSupportedStripeEventType(eventType);
}

export function classifyStripeWebhookDomain(eventType: string): StripeWebhookDomain {
  return eventBelongsToPaymentsDomain(eventType) ? STRIPE_WEBHOOK_DOMAINS.PAYMENTS : STRIPE_WEBHOOK_DOMAINS.UNSUPPORTED;
}
