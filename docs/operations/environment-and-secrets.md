# Environment and Secrets Matrix

This reference covers runtime configuration for frontend and functions.

For **how we use Dev, Beta, and Prod Firebase projects** (no emulators), promotion flow, and developer setup, see [environments-dev-beta-prod.md](./environments-dev-beta-prod.md).

Before merging epic **#231** (`231-epic-ui-improvements` → `main`), run the manual checklist in [epic-231-member-ux-uat.md](./epic-231-member-ux-uat.md) ([#250](https://github.com/rafsodc/sodc-web/issues/250)).

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
| `VITE_RECAPTCHA_SITE_KEY` | App Check reCAPTCHA v3 site key (see #345) — public value, safe to commit to `.env*.local`. Registered per Firebase web app under Project Settings → App Check; the paired secret key is entered directly into that same Firebase Console screen, not as an env var. | optional — App Check init is skipped entirely if unset |

## Functions runtime env / secrets

| Name | Type | Used by | Required |
|---|---|---|---|
| `STRIPE_SECRET` | Firebase secret | `createTicketCheckoutSession`, `stripeWebhook` | yes for payments |
| `STRIPE_WEBHOOK_SECRET` | Firebase secret | `stripeWebhook` | yes for webhook processing |
| `STRIPE_WEBHOOK_SECRET_PAYMENTS` | Firebase secret | `stripeWebhookPayments` (with legacy fallback during migration) | yes for the dedicated payments webhook |
| `GOV_NOTIFY_LIVE_API_KEY` | Firebase secret | GOV.UK Notify unrestricted live key | required when site/request ceiling can resolve to `LIVE` |
| `GOV_NOTIFY_TEST_API_KEY` | Firebase secret | GOV.UK Notify test key; accepts fan-out without delivery | required when mode can resolve to `SIMULATION` |
| `GOV_NOTIFY_TEAM_API_KEY` | Firebase secret | GOV.UK Notify team-and-guest-list key | required when mode can resolve to `TEAM_TEST` |
| `GOV_NOTIFY_DELIVERY_MODE` | env var | Mandatory deployment ceiling: `SIMULATION`, `TEAM_TEST`, or `LIVE`; admins choose the runtime mode below this ceiling in **Admin → Email Delivery** | required |
| `UNSUBSCRIBE_SECRET` | Firebase secret | Signed announcement unsubscribe links | yes when announcements are enabled |
| `NOTIFY_CALLBACK_BEARER_TOKEN` | Firebase secret | Authenticates GOV.UK Notify delivery callbacks | yes when delivery callbacks are enabled |
| `SECTION_FILES_BUCKET` | env var | Private GCS bucket used by the section-file backend | required when section files are enabled |
| `SECTION_FILE_MALWARE_SCAN_MODE` | env var | `REQUIRED`; emulator-only tests may use `MOCK_CLEAN` or `MOCK_INFECTED` when `FUNCTIONS_EMULATOR=true` | required when section files are enabled |
| `SECTION_FILE_MALWARE_SCANNER_URL` | env var | HTTPS URL of the authenticated scale-to-zero Cloud Run scanner | required when scan mode is `REQUIRED` |
| `APP_BASE_URL` | env var | Public site origin used for checkout, internal ops, and Firebase Auth action links | yes for non-local |
| `ENV_NAME` | env var | dev reset guardrail | required for reset tooling |
| `PERMITTED_PROJECT_IDS` | env var | dev reset guardrail | required for reset tooling |
| `GOV_NOTIFY_EMAIL_REPLY_TO_ID` | env var | Optional GOV.UK Notify reply-to selection | optional |
| `GOV_NOTIFY_TEMPLATE_<TEMPLATE_NAME>` | env var | GOV.UK Notify template IDs for app-owned transactional email templates | required for each enabled app email template |
| `GOV_NOTIFY_TEMPLATE_PASSWORD_RESET` | env var | Notify template UUID for the site-managed password-reset email | required for password reset |
| `GOV_NOTIFY_TEMPLATE_EMAIL_VERIFICATION` | env var | Notify template UUID for the site-managed email-verification message | required for registration and verification resend |
| `GOV_NOTIFY_TEMPLATE_EMAIL_CHANGE_VERIFICATION` | env var | Notify template UUID for verified email-address changes | required for self-service email change |
| `PAYMENT_OPS_ALERT_EMAILS` | env var | Comma-separated internal recipient emails for payment reconciliation / dispute ops alerts (Stripe webhook path); unset disables sends | optional |
| `GOV_NOTIFY_TEMPLATE_PAYMENT_RECONCILIATION_EXCEPTION_ALERT` | env var | Notify template UUID for internal reconciliation-exception alerts | required when `PAYMENT_OPS_ALERT_EMAILS` is set |
| `GOV_NOTIFY_TEMPLATE_PAYMENT_DISPUTE_OPS_ALERT` | env var | Notify template UUID for internal dispute side-state alerts | required when `PAYMENT_OPS_ALERT_EMAILS` is set |
| `BOOKING_DRAFT_EXPIRY_MINUTES` | env var | TTL for abandoned `DRAFT` bookings before scheduled cleanup cancels them (`expireUnpaidStagedBookings`) | optional (default `60`) |
| `TICKET_ORDER_PENDING_EXPIRY_MINUTES` | env var | TTL for unpaid `PENDING` ticket orders before scheduled cleanup marks them `FAILED` | optional (default `60`) |
| `STAGED_EXPIRY_BATCH_LIMIT` | env var | Max rows processed per category per scheduled run | optional (default `100`) |

## Operational notes

- **Transactional email overview** (triggers, idempotency, per-domain flows): [transactional-email-workflows.md](./transactional-email-workflows.md).
- **Section file storage** (private bucket, IAM, lifecycle, CORS, and rollout): [section-file-storage.md](./section-file-storage.md).
- **Notify template copy and registration** (paste into dashboard, record UUIDs per env): [govuk-notify-template-copy.md](./govuk-notify-template-copy.md), [govuk-notify-template-registration.md](./govuk-notify-template-registration.md).
- **Email policy** (operational vs optional): [transactional-email-policy.md](./transactional-email-policy.md).
- Do not commit secret values to repo.
- For project-specific non-secret Functions configuration, use the ignored file
  `functions/.env.<project-id>` (for example,
  `functions/.env.sodc-web-production`). Firebase selects it by project ID at
  deploy time; verify the CLI reports the intended file before continuing.
- Rotate Stripe secrets if compromised and update Firebase secrets before redeploy.
- Rotate the affected mode-specific Notify key if compromised and update Firebase secrets before redeploy.
- Follow [GOV.UK Notify delivery modes](./govuk-notify-delivery-modes.md) for safe mode changes and verification.
- Keep environment docs and deployment settings aligned when adding new variables.
- Configure GOV.UK Notify API keys and template IDs independently per Firebase environment.
- Template env var names are derived from typed template names in `functions/src/mailer.ts`; for example, `paymentConfirmation` maps to `GOV_NOTIFY_TEMPLATE_PAYMENT_CONFIRMATION`.
- Site-managed password reset (#410): template key `passwordReset` maps to `GOV_NOTIFY_TEMPLATE_PASSWORD_RESET`; `APP_BASE_URL` must be the canonical HTTPS site origin so emailed links return to `/auth/action`.
- Site-managed verification (#411): template key `emailVerification` maps to `GOV_NOTIFY_TEMPLATE_EMAIL_VERIFICATION` and uses the same `/auth/action` route.
- Verified email change (#446): template key `emailChangeVerification` maps to `GOV_NOTIFY_TEMPLATE_EMAIL_CHANGE_VERIFICATION`; completion uses `mode=verifyAndChangeEmail` on `/auth/action`.
- Ticket order lifecycle emails (issue #186): template keys `ticketOrderPaid`, `ticketOrderFailed`, `ticketOrderRefunded` — full placeholder spec and env var mapping in [govuk-notify-ticket-order-templates.md](./govuk-notify-ticket-order-templates.md).
- Internal payment ops / finance alerts (reconciliation exceptions and dispute side-state): see [govuk-notify-payment-ops-internal-templates.md](./govuk-notify-payment-ops-internal-templates.md).
- Membership approval / account access emails (#188): template keys `membershipActivated`, `membershipAccessRestricted` — see [govuk-notify-membership-templates.md](./govuk-notify-membership-templates.md).
- Guest ticket request workflow (#189): template keys `guestTicketRequestSubmittedModerator`, `guestTicketRequestApproved`, `guestTicketRequestRejected` — moderator recipient rules in [govuk-notify-guest-ticket-request-templates.md](./govuk-notify-guest-ticket-request-templates.md).
- Booking confirmation / revision emails (#190): template keys `bookingConfirmation`, `bookingRevision` — see [govuk-notify-booking-templates.md](./govuk-notify-booking-templates.md).
- **Staged booking / payment hold expiry (#235):** scheduled Cloud Function `expireUnpaidStagedBookings` runs every 15 minutes. It cancels stale `DRAFT` bookings and marks stale unpaid `PENDING` ticket orders as `FAILED`. Tune TTLs with `BOOKING_DRAFT_EXPIRY_MINUTES` and `TICKET_ORDER_PENDING_EXPIRY_MINUTES`. Check function logs for `staged expiry job completed` and the per-run `summary` counts (`applied`, `skipped`, `failed`). If `failed` is non-zero, inspect Data Connect connectivity and mutation errors. Increasing `STAGED_EXPIRY_BATCH_LIMIT` raises per-run throughput when backlogs build up.
- Stripe may send customer receipts/invoices for payment activity when enabled in Stripe. Use GOV.UK Notify for app-owned transactional messages that need application context, links, membership/booking workflow details, or internal operational recipients.
