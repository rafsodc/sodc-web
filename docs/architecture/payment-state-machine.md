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

## Webhook Outcome Contract

- Missing `orderId` metadata: acknowledge webhook (2xx), no mutation.
- Unknown order: acknowledge webhook (2xx), no mutation.
- Replay transition: acknowledge webhook (2xx), no mutation.
- Illegal transition: acknowledge webhook (2xx), no mutation.
- Valid transition: apply mutation and acknowledge webhook (2xx).

## Scope Boundary

- #128 includes transition contract + runtime guards + event mapping.
- Full dispute persistence/reporting remains for #132/#133.
