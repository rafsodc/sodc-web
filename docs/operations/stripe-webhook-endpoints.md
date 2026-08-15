# Stripe Webhook Endpoints

This runbook defines how the Stripe payments webhook endpoint is configured for this project, including URL patterns, secret mapping, deployment, and replay.

## Endpoints

- Payments endpoint: `stripeWebhookPayments`

## URL Patterns

Use your Firebase project id in place of `<project-id>`.

- Production payments endpoint:
  - `https://europe-west2-<project-id>.cloudfunctions.net/stripeWebhookPayments`
- Local emulator payments endpoint:
  - `http://127.0.0.1:5001/<project-id>/europe-west2/stripeWebhookPayments`

## Stripe Dashboard Setup

1. In Stripe Dashboard, open `Developers -> Webhooks`.
2. Click `Add endpoint`.
3. Set the endpoint URL to the payments endpoint URL.
4. Select only the payments-domain event allowlist:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `refund.created`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
5. Save, then reveal the signing secret for that endpoint.
6. Store the secret for Functions:
   - `STRIPE_WEBHOOK_SECRET_PAYMENTS`

## Secret and Endpoint Mapping

- `STRIPE_WEBHOOK_SECRET_PAYMENTS`: signing secret for `stripeWebhookPayments`.

## Retiring the Legacy Endpoint

Before removing an existing `stripeWebhook` deployment, confirm in every Stripe
environment that no webhook endpoint targets its URL. Deploy the current Functions
revision, then remove the legacy function if the deploy did not prompt for deletion:

```bash
firebase functions:delete stripeWebhook --region europe-west2 --project <project-alias>
```

After all deployed Functions have stopped referencing `STRIPE_WEBHOOK_SECRET`, prune
unused secret versions:

```bash
firebase functions:secrets:prune --project <project-alias>
```

Verify a representative payment event reaches `stripeWebhookPayments` before
considering the retirement complete.

## Local Testing and Replay

Use Stripe CLI to forward events to the payments endpoint:

```bash
stripe listen --forward-to "http://127.0.0.1:5001/<project-id>/europe-west2/stripeWebhookPayments"
```

Trigger representative events:

```bash
stripe trigger checkout.session.completed
stripe trigger checkout.session.expired
stripe trigger refund.created
```

Replay a known event id:

```bash
stripe events resend <event-id> --webhook-endpoint=<endpoint-id>
```

## Troubleshooting Checklist

- Signature errors:
  - verify endpoint URL and signing secret pairing
  - confirm secret is stored in the correct environment
- Event ignored:
  - check event type is in payments allowlist
  - verify checkout/dispute objects include order metadata
  - verify Refund objects include `ticketOrderId`, `allocationId`, `refundAmountMinor`, and `resultingRefundedAmountMinor`
- Duplicate delivery:
  - confirm webhook idempotency ledger recorded prior processing
- Missing order:
  - verify `orderId` exists and matches persisted `TicketOrder` id
