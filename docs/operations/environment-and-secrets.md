# Environment and Secrets Matrix

This reference covers runtime configuration for frontend and functions.

For **how we use Dev, Beta, and Prod Firebase projects** (no emulators), promotion flow, and developer setup, see [environments-dev-beta-prod.md](./environments-dev-beta-prod.md).

Each environment should have its **own** values for the variables below (typically three Firebase web apps and three sets of secrets).

## Frontend (Vite) variables

Defined via `.env*` files and read from `import.meta.env`:

| Variable | Purpose | Required |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase app config | yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase app config | yes |
| `VITE_FIREBASE_PROJECT_ID` | Firebase app config | yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase app config | yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase app config | yes |
| `VITE_FIREBASE_APP_ID` | Firebase app config | yes |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics (optional) | optional |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Checkout client init | yes for payments |

## Functions runtime env / secrets

| Name | Type | Used by | Required |
|---|---|---|---|
| `STRIPE_SECRET` | Firebase secret | `createTicketCheckoutSession`, `stripeWebhook` | yes for payments |
| `STRIPE_WEBHOOK_SECRET` | Firebase secret | `stripeWebhook` | yes for webhook processing |
| `GOV_NOTIFY_API_KEY` | Firebase secret | Transactional mailer / payment webhook notification path | yes for app-owned transactional email |
| `APP_BASE_URL` | env var | Checkout success/cancel URLs and internal ops email links | yes for non-local |
| `ENV_NAME` | env var | dev reset guardrail | required for reset tooling |
| `PERMITTED_PROJECT_IDS` | env var | dev reset guardrail | required for reset tooling |
| `GOV_NOTIFY_EMAIL_REPLY_TO_ID` | env var | Optional GOV.UK Notify reply-to selection | optional |
| `GOV_NOTIFY_TEMPLATE_<TEMPLATE_NAME>` | env var | GOV.UK Notify template IDs for app-owned transactional email templates | required for each enabled app email template |
| `PAYMENT_OPS_ALERT_EMAILS` | env var | Comma-separated internal recipient emails for payment reconciliation / dispute ops alerts (Stripe webhook path); unset disables sends | optional |
| `GOV_NOTIFY_TEMPLATE_PAYMENT_RECONCILIATION_EXCEPTION_ALERT` | env var | Notify template UUID for internal reconciliation-exception alerts | required when `PAYMENT_OPS_ALERT_EMAILS` is set |
| `GOV_NOTIFY_TEMPLATE_PAYMENT_DISPUTE_OPS_ALERT` | env var | Notify template UUID for internal dispute side-state alerts | required when `PAYMENT_OPS_ALERT_EMAILS` is set |

## Operational notes

- Do not commit secret values to repo.
- Rotate Stripe secrets if compromised and update Firebase secrets before redeploy.
- Rotate `GOV_NOTIFY_API_KEY` if compromised and update Firebase secrets before redeploy.
- Keep environment docs and deployment settings aligned when adding new variables.
- Configure GOV.UK Notify API keys and template IDs independently per Firebase environment.
- Template env var names are derived from typed template names in `functions/src/mailer.ts`; for example, `paymentConfirmation` maps to `GOV_NOTIFY_TEMPLATE_PAYMENT_CONFIRMATION`.
- Ticket order lifecycle emails (issue #186): template keys `ticketOrderPaid`, `ticketOrderFailed`, `ticketOrderRefunded` — full placeholder spec and env var mapping in [govuk-notify-ticket-order-templates.md](./govuk-notify-ticket-order-templates.md).
- Internal payment ops / finance alerts (reconciliation exceptions and dispute side-state): see [govuk-notify-payment-ops-internal-templates.md](./govuk-notify-payment-ops-internal-templates.md).
- Membership approval / account access emails (#188): template keys `membershipActivated`, `membershipAccessRestricted` — see [govuk-notify-membership-templates.md](./govuk-notify-membership-templates.md).
- Guest ticket request workflow (#189): template keys `guestTicketRequestSubmittedModerator`, `guestTicketRequestApproved`, `guestTicketRequestRejected` — moderator recipient rules in [govuk-notify-guest-ticket-request-templates.md](./govuk-notify-guest-ticket-request-templates.md).
- Booking confirmation / revision emails (#190): template keys `bookingConfirmation`, `bookingRevision` — see [govuk-notify-booking-templates.md](./govuk-notify-booking-templates.md).
- Stripe may send customer receipts/invoices for payment activity when enabled in Stripe. Use GOV.UK Notify for app-owned transactional messages that need application context, links, membership/booking workflow details, or internal operational recipients.
