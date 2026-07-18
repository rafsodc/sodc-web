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
- Replay of the same Stripe event: do not mutate the order; reconcile any missing post-transition notification and exception state before acknowledging.
- Same-target transition from a different event: acknowledge webhook (2xx), no mutation or customer notification.
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
- The webhook event ledger remains the source of event-level replay detection.
- Exact-event recovery also requires `TicketOrder.webhookEventId` to match the replayed Stripe event, preventing a different same-target event from creating another customer notification.

## Reconciliation Primitives

The payment domain exposes deterministic exception signals for operator triage:

- `MISSING_PAYMENT_INTENT`
- `REFUND_AMOUNT_MISMATCH`
- `ACTIVE_DISPUTE`

Signals are evaluated from persisted order metadata and upserted to reconciliation exception records with remediation metadata (`status`, `ownerUserId`, `lastAttemptedAt`, `resolvedAt`). New records use a deterministic primary UUID derived from `(ticketOrder, exceptionType)`; existing records retain their current ID. Concurrent snapshot retries therefore converge on the same record without requiring a data migration.

## Post-transition side-effect recovery

Order state is committed before external notification and reconciliation work. If notification-delivery setup or exception persistence fails after that commit, the webhook returns an error so Stripe can retry. On an exact retry, Functions detects that the target status and stored `webhookEventId` already match, then reruns only the post-transition work:

- customer email uses the original deterministic `NotificationDelivery` key, so sent or in-progress deliveries are not duplicated and failed deliveries can be reclaimed;
- reconciliation exceptions use the deterministic order/type-derived primary ID and an upsert, so partial or concurrent retries converge;
- once both steps complete, the event ledger is recorded or the existing duplicate event is acknowledged.

The member checkout reconciliation callable uses the same rule with its deterministic synthetic event id, allowing it to recover its own partial completion without replaying side effects from a different Stripe event.

## Customer notification emails (issue #186)

After a successful `TicketOrder` status transition applied from the Stripe payments webhook (`PAID`, `FAILED`, `REFUNDED`), Functions send a Gov.UK Notify email to the purchaser’s registered email, using the idempotent `NotificationDelivery` ledger keyed per Stripe event. Dispute side-state updates do not send customer lifecycle emails from this path.

## Internal ops notification emails (issue #187)

Reconciliation exceptions that newly open or reopen send internal alerts to `PAYMENT_OPS_ALERT_EMAILS`. Dispute side-state webhooks send a separate internal dispute alert (and skip duplicate `ACTIVE_DISPUTE` reconciliation emails when opened from the dispute path).

Workflow index: [`docs/operations/transactional-email-workflows.md`](../operations/transactional-email-workflows.md). Template specs: [`govuk-notify-ticket-order-templates.md`](../operations/govuk-notify-ticket-order-templates.md), [`govuk-notify-payment-ops-internal-templates.md`](../operations/govuk-notify-payment-ops-internal-templates.md).

## Scope Boundary

- #128 and #131 cover transition contract and execution guards.
- #132 extends persistence for refund/dispute metadata.
- #133+ builds reconciliation and operator workflows on top of this model.
