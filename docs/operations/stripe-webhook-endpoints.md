# Stripe Webhook Endpoints

This runbook defines how Stripe webhook endpoints are configured for this project, including URL patterns, secret mapping, and migration from the legacy consolidated endpoint.

## Endpoints

- Preferred payments endpoint: `stripeWebhookPayments`
- Legacy compatibility endpoint: `stripeWebhook`

## URL Patterns

Use your Firebase project id in place of `<project-id>`.

- Production payments endpoint:
  - `https://europe-west2-<project-id>.cloudfunctions.net/stripeWebhookPayments`
- Production legacy endpoint:
  - `https://europe-west2-<project-id>.cloudfunctions.net/stripeWebhook`
- Local emulator payments endpoint:
  - `http://127.0.0.1:5001/<project-id>/europe-west2/stripeWebhookPayments`
- Local emulator legacy endpoint:
  - `http://127.0.0.1:5001/<project-id>/europe-west2/stripeWebhook`

## Stripe Dashboard Setup

1. In Stripe Dashboard, open `Developers -> Webhooks`.
2. Click `Add endpoint`.
3. Set the endpoint URL to the payments endpoint URL.
4. Select only the payments-domain event allowlist:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
5. Save, then reveal the signing secret for that endpoint.
6. Store the secret for Functions:
   - Primary: `STRIPE_WEBHOOK_SECRET_PAYMENTS`
   - Fallback during migration: `STRIPE_WEBHOOK_SECRET`

## Secret and Endpoint Mapping

- `STRIPE_WEBHOOK_SECRET_PAYMENTS`: signing secret for `stripeWebhookPayments`.
- `STRIPE_WEBHOOK_SECRET`: legacy endpoint secret, also used as fallback if the payments-specific secret is not yet configured.

## Cutover Plan

1. Deploy code with both `stripeWebhookPayments` and `stripeWebhook`.
2. Configure Stripe to deliver payment events to `stripeWebhookPayments`.
3. Monitor logs and payment state transitions for stable processing.
4. Keep legacy endpoint available during transition to avoid missed events.
5. After verification, remove payment event subscriptions from legacy endpoint.

## Local Testing and Replay

Use Stripe CLI to forward events to the payments endpoint:

```bash
stripe listen --forward-to "http://127.0.0.1:5001/<project-id>/europe-west2/stripeWebhookPayments"
```

Trigger representative events:

```bash
stripe trigger checkout.session.completed
stripe trigger checkout.session.expired
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
  - verify event includes `metadata.orderId`
- Duplicate delivery:
  - confirm webhook idempotency ledger recorded prior processing
- Missing order:
  - verify `orderId` exists and matches persisted `TicketOrder` id
