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

The committed `functions/.env` file is a comment-only template. For local
emulator overrides, copy it to `functions/.env.local` and add real non-secret
values there. Local secret overrides belong in `functions/.secret.local`.
Both local files are ignored by git.

| Name | Type | Used by | Required |
|---|---|---|---|
| `STRIPE_SECRET` | Firebase secret | `createTicketCheckoutSession`, `stripeWebhook` | yes for payments |
| `STRIPE_WEBHOOK_SECRET` | Firebase secret | `stripeWebhook` | yes for webhook processing |
| `STRIPE_WEBHOOK_SECRET_PAYMENTS` | Firebase secret | `stripeWebhook` payments endpoint | preferred for payment webhook processing; falls back to `STRIPE_WEBHOOK_SECRET` |
| `APP_BASE_URL` | env var | Checkout success/cancel URLs | yes for non-local |
| `ENV_NAME` | env var | dev reset guardrail | required for reset tooling |
| `PERMITTED_PROJECT_IDS` | env var | dev reset guardrail | required for reset tooling |

## Operational notes

- Do not commit secret values to repo.
- Keep committed dotenv templates comment-only; put developer-specific values in
  `.env.local` or `.secret.local`.
- Rotate Stripe secrets if compromised and update Firebase secrets before redeploy.
- Keep environment docs and deployment settings aligned when adding new variables.
