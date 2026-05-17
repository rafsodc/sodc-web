# GOV.UK Notify: internal payment ops templates

These templates send **internal** email to finance/ops when payment reconciliation exceptions open or when Stripe dispute side-state webhooks are processed. Implementation: [`functions/src/paymentOpsInternalAlerts.ts`](../../functions/src/paymentOpsInternalAlerts.ts), wired from [`functions/src/payments.ts`](../../functions/src/payments.ts).

Recipients are **`PAYMENT_OPS_ALERT_EMAILS`** (comma-separated). If unset or empty, no internal emails are sent.

**Source of truth:** Personalisation **keys** in this document must match the object sent to Notify.

## Configuration

| Logical key (code) | Firebase / runtime env var for template UUID |
|---------------------|-----------------------------------------------|
| `paymentReconciliationExceptionAlert` | `GOV_NOTIFY_TEMPLATE_PAYMENT_RECONCILIATION_EXCEPTION_ALERT` |
| `paymentDisputeOpsAlert` | `GOV_NOTIFY_TEMPLATE_PAYMENT_DISPUTE_OPS_ALERT` |

Env var names follow [`govNotifyTemplateEnvVarName`](../../functions/src/mailer.ts).

Also required for sends: `GOV_NOTIFY_API_KEY` (secret), optional `GOV_NOTIFY_EMAIL_REPLY_TO_ID`, and **`APP_BASE_URL`** for the reconciliation dashboard link (see [environment-and-secrets.md](./environment-and-secrets.md)).

## Notify `reference` field

Functions set short references for Notify logs, e.g. `reconciliation-ops:<orderId>:<exceptionType>:<stripeEventId>` and `dispute-ops:<orderId>:<stripeEventId>`.

## Template 1: reconciliation exception — `paymentReconciliationExceptionAlert`

**Trigger:** A reconciliation exception row becomes **OPEN** (new row or reopened from **RESOLVED**). For **`ACTIVE_DISPUTE`**, the reconciliation-path alert is skipped when the snapshot upsert runs on the **dispute webhook** path (the dispute-specific template covers that case).

| Key | Semantics |
|-----|-----------|
| `orderId` | Ticket order UUID |
| `eventTitle` | Event title from order |
| `customerDisplay` | Booker display, e.g. `Name <email>` |
| `exceptionType` | Enum string, e.g. `ACTIVE_DISPUTE`, `UNDERPAID`, … |
| `exceptionNote` | Stored exception note |
| `reconciliationDashboardUrl` | `APP_BASE_URL` (normalised) + `/admin/payments/reconciliation` |
| `stripeEventId` | Stripe webhook event id |

## Template 2: dispute side-state — `paymentDisputeOpsAlert`

**Trigger:** `dispute_side_state` branch in the payments Stripe webhook (after dispute persistence and ledger).

| Key | Semantics |
|-----|-----------|
| `orderId` | Ticket order UUID |
| `eventTitle` | Event title |
| `customerDisplay` | Booker display |
| `disputeStripeStatus` | Stripe dispute `status` |
| `disputeReason` | Stripe dispute `reason` |
| `disputeLocalState` | Normalised dispute state label from webhook routing |
| `stripeDisputeId` | Stripe dispute id |
| `stripeEventType` | Stripe event `type` string |
| `reconciliationDashboardUrl` | Same as template 1 |
| `stripeEventId` | Stripe webhook event id |

## Related docs

- [govuk-notify-ticket-order-templates.md](./govuk-notify-ticket-order-templates.md) — customer-facing ticket order lifecycle email
- [payment-state-machine.md](../architecture/payment-state-machine.md)
