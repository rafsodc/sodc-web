# GOV.UK Notify: ticket order lifecycle templates

These templates send **app-owned transactional email** when a `TicketOrder` is marked **PAID**, **FAILED**, or **REFUNDED** from the Stripe payments webhook. Implementation: [`functions/src/paymentLifecycleEmailDispatcher.ts`](../../functions/src/paymentLifecycleEmailDispatcher.ts).

**Source of truth:** Personalisation **keys** in this document must match the object sent to Notify. If the dashboard placeholder names do not match the API payload, sends fail at runtime.

## Configuration

| Logical key (code) | Firebase / runtime env var for template UUID |
|---------------------|-----------------------------------------------|
| `ticketOrderPaid` | `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_PAID` |
| `ticketOrderFailed` | `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_FAILED` |
| `ticketOrderRefunded` | `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_REFUNDED` |

Env var names follow [`govNotifyTemplateEnvVarName`](../../functions/src/mailer.ts) (`GOV_NOTIFY_TEMPLATE_` + upper snake case of the template key).

Also required for sends: `GOV_NOTIFY_API_KEY` (secret), optional `GOV_NOTIFY_EMAIL_REPLY_TO_ID`, and `APP_BASE_URL` for checkout links (see [environment-and-secrets.md](./environment-and-secrets.md)).

## Placeholder format

GOV.UK Notify templates use double brackets. Use the **same identifier** as the JSON key sent by Functions, e.g. `((customerFirstName))`, `((eventTitle))`.

Numbers are sent as JSON numbers where noted (`quantity`).

## Notify `reference` field

Functions set: `PAYMENT_<TYPE>:<orderId>:<stripeEventId>` (e.g. `PAYMENT_PAID:…:evt_…`). Useful for correlation in Notify logs and support.

## Template 1: payment confirmed — `ticketOrderPaid`

**Trigger:** Stripe webhook applies `MARK_PAID`; internal type `PAYMENT_PAID`.

**Recipient:** Purchaser email from `GetTicketOrderForWebhook.user.email` (lowercased).

| Key | Type | Semantics |
|-----|------|-----------|
| `customerFirstName` | text | User first name, or `there` if missing/blank |
| `eventTitle` | text | Event title |
| `ticketTypeTitle` | text | Ticket type title |
| `quantity` | number | Line quantity |
| `totalFormatted` | text | Order total, e.g. `50.00 GBP` — `totalAmountMinor / 100` plus uppercased currency |
| `currencyDisplay` | text | Uppercased currency code, e.g. `GBP` |
| `orderStatusLabel` | text | Always `Paid` for this template |
| `orderId` | text | Ticket order UUID |
| `myPaymentsUrl` | text | `APP_BASE_URL` without trailing slash + `/payments` |

## Template 2: payment failed — `ticketOrderFailed`

**Trigger:** Stripe webhook applies `MARK_FAILED` (e.g. expired session, async payment failed); internal type `PAYMENT_FAILED`.

**Recipient:** Same as template 1.

Same keys as **ticketOrderPaid**, except:

| Key | Type | Semantics |
|-----|------|-----------|
| `orderStatusLabel` | text | `Payment failed` |

All other keys: `customerFirstName`, `eventTitle`, `ticketTypeTitle`, `quantity`, `totalFormatted`, `currencyDisplay`, `orderId`, `myPaymentsUrl` — same meaning as template 1.

## Template 3: refund processed — `ticketOrderRefunded`

**Trigger:** Stripe webhook applies `MARK_REFUNDED`; internal type `PAYMENT_REFUNDED`.

**Recipient:** Same as template 1.

Includes **all** keys from the paid/failed set, plus:

| Key | Type | Semantics |
|-----|------|-----------|
| `refundFormatted` | text | Refund amount: uses `refundedAmountMinor` when set, otherwise `totalAmountMinor`; same display format as `totalFormatted` |
| `orderStatusLabel` | text | `Refunded` |

## What does *not* use these templates

**Dispute** side-state events (`charge.dispute.*`) update dispute metadata only; they do **not** send customer lifecycle email through this path. Internal / ops alerting is handled separately (see epic #183 / follow-up issues).

## Related docs

- [payment-state-machine.md](../architecture/payment-state-machine.md) — when transitions fire
- [environment-and-secrets.md](./environment-and-secrets.md) — secrets and env matrix
