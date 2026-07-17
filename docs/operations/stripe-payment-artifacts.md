# Stripe Payment Artifacts in My Payments

`My Payments` can show Stripe-hosted artifacts per order when Stripe provides them.

The callable and Stripe lookup fallback chain are implemented in `functions/src/paymentStripeArtifacts.ts` and re-exported through the stable `functions/src/payments.ts` barrel.

## Supported links

- Receipt link (`receiptUrl`) from the latest charge.

## Prerequisites

- Functions secret `STRIPE_SECRET` must be configured.
- The ticket order must have `stripePaymentIntentId`.
- The Stripe payment intent must have a retrievable latest charge.

## Fallback behavior

- If Stripe artifacts are unavailable, the UI shows no Stripe artifact links.
- This does not impact payment history visibility.
