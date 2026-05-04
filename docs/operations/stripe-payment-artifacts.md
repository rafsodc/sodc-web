# Stripe Payment Artifacts in My Payments

`My Payments` can show Stripe-hosted artifacts per order when Stripe provides them.

## Supported links

- Receipt link (`receiptUrl`) from the latest charge.
- Hosted invoice link (`hostedInvoiceUrl`) when an invoice exists.
- Invoice PDF link (`invoicePdfUrl`) when an invoice exists and Stripe provides PDF URL.

## Prerequisites

- Functions secret `STRIPE_SECRET` must be configured.
- The ticket order must have `stripePaymentIntentId`.
- The Stripe payment intent must have a retrievable latest charge.

## Fallback behavior

- If Stripe artifacts are unavailable, the UI shows no Stripe artifact links.
- This does not impact payment history visibility.
