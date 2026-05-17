# Payment State Machine

This document defines the canonical payment lifecycle contract for `TicketOrder` and the Stripe webhook event mapping used by Functions.

## Primary Order States

`TicketOrderStatus` remains:

- `PENDING`
- `PAID`
- `FAILED`
- `REFUNDED`

Disputes are intentionally modeled as **side-state metadata** for now (issue #128 scope), not as additional `TicketOrderStatus` values.

## Transition Rules

| From | To | Allowed | Trigger intent |
|---|---|---|---|
| `PENDING` | `PAID` | yes | `MARK_PAID` |
| `PENDING` | `FAILED` | yes | `MARK_FAILED` |
| `PAID` | `REFUNDED` | yes | `MARK_REFUNDED` |
| all other combinations | - | no | illegal |

### Replay semantics

- If the order is already in the target status for an incoming intent, treat as replay/no-op.
- Illegal transitions are no-op and logged with reason.

## Stripe Event Mapping (Current)

| Stripe event type | Internal kind | Intent / side-state | Notes |
|---|---|---|---|
| `checkout.session.completed` | payment transition | `MARK_PAID` | requires `metadata.orderId` |
| `checkout.session.expired` | payment transition | `MARK_FAILED` | requires `metadata.orderId` |
| `checkout.session.async_payment_failed` | payment transition | `MARK_FAILED` | requires `metadata.orderId` |
| `charge.refunded` | payment transition | `MARK_REFUNDED` | requires `metadata.orderId` |
| `charge.dispute.created` | dispute side-state | `DISPUTE_OPEN` | no `TicketOrderStatus` change |
| `charge.dispute.updated` | dispute side-state | `DISPUTE_UPDATED` | no `TicketOrderStatus` change |
| `charge.dispute.closed` | dispute side-state | `DISPUTE_CLOSED` | no `TicketOrderStatus` change |
| anything else | ignore | n/a | logged as ignored |

### Supported-event allowlist

Functions maintain an explicit Stripe event allowlist in code (`SUPPORTED_STRIPE_EVENT_TYPES`), used by routing and observability:

- supported events are normalized into transition or dispute side-state handling
- unsupported events are acknowledged (2xx) and logged as ignored
- this keeps webhook processing non-destructive for unknown event types

## Webhook Outcome Contract

- Missing `orderId` metadata: acknowledge webhook (2xx), no mutation.
- Unknown order: acknowledge webhook (2xx), no mutation.
- Replay transition: acknowledge webhook (2xx), no mutation.
- Illegal transition: acknowledge webhook (2xx), no mutation.
- Valid transition: apply mutation and acknowledge webhook (2xx).

## Endpoint Topology

Stripe webhooks are split by domain starting with a dedicated payments endpoint:

- `stripeWebhookPayments` (preferred): handles payment lifecycle allowlisted events.
- `stripeWebhook` (legacy compatibility): still accepts payment lifecycle events during cutover.

See `docs/operations/stripe-webhook-endpoints.md` for endpoint URLs, Stripe dashboard setup, secret mapping, local replay/testing, and migration steps.

## Refund/Dispute Persistence Model

`TicketOrder` now stores lifecycle side-state metadata required for reconciliation and support workflows:

- refund fields: `stripeRefundId`, `refundedAmountMinor`, `refundedAt`
- dispute fields: `stripeDisputeId`, `disputeStatus`, `disputeReason`, `disputeAmountMinor`, `disputeOpenedAt`, `disputeUpdatedAt`, `disputeClosedAt`

Webhook handling continues to treat disputes as side-state metadata (no `TicketOrderStatus` change), while still persisting the latest dispute state and timestamps for auditability.

## Migration and Compatibility Notes

- These are additive nullable fields on `TicketOrder`; existing rows remain valid without backfill.
- Existing `TicketOrderStatus` semantics are unchanged.
- Existing webhook idempotency behavior (event ledger keyed by Stripe event id) remains the source of replay protection.

## Reconciliation Primitives

The payment domain exposes deterministic exception signals for operator triage:

- `MISSING_PAYMENT_INTENT`
- `REFUND_AMOUNT_MISMATCH`
- `ACTIVE_DISPUTE`

Signals are evaluated from persisted order metadata and upserted to reconciliation exception records with remediation metadata (`status`, `ownerUserId`, `lastAttemptedAt`, `resolvedAt`).

## Customer notification emails (issue #186)

After a successful `TicketOrder` status transition applied from the Stripe payments webhook (`PAID`, `FAILED`, `REFUNDED`), Functions send a Gov.UK Notify email to the purchaser’s registered email, using the idempotent `NotificationDelivery` ledger keyed per Stripe event. Dispute side-state updates do not send customer lifecycle emails from this path; internal dispute alerting is tracked separately (e.g. issue #187).

Template IDs and personalisation keys: see [`docs/operations/govuk-notify-ticket-order-templates.md`](../operations/govuk-notify-ticket-order-templates.md).

## Scope Boundary

- #128 and #131 cover transition contract and execution guards.
- #132 extends persistence for refund/dispute metadata.
- #133+ builds reconciliation and operator workflows on top of this model.
