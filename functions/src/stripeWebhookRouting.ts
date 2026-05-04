import { isSupportedStripeEventType } from "./paymentStateMachine";

export type StripeWebhookDomain = "payments";

export function eventBelongsToPaymentsDomain(eventType: string): boolean {
  return isSupportedStripeEventType(eventType);
}

export function classifyStripeWebhookDomain(eventType: string): StripeWebhookDomain | "unsupported" {
  return eventBelongsToPaymentsDomain(eventType) ? "payments" : "unsupported";
}
