# Environment and Secrets Matrix

This reference covers runtime configuration for frontend and functions.

For **how we use Dev, Beta, and Prod Firebase projects** (no emulators), promotion flow, and developer setup, see [environments-dev-beta-prod.md](./environments-dev-beta-prod.md).

Each environment should have its **own** values for the variables below (typically three Firebase web apps and three sets of secrets).

### Template files (committed)

| Template | Copy to (gitignored) | When loaded |
|----------|----------------------|-------------|
| `.env.development.example` | `.env.development.local` | `npm run dev` (default mode `development`) |
| `.env.staging.example` | `.env.staging.local` | `npm run build -- --mode staging` |

Do not put real keys in the `.example` files; copy them and fill in `.env.*.local` locally or inject vars in CI.

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
| `APP_BASE_URL` | env var | Checkout success/cancel URLs | yes for non-local |
| `ENV_NAME` | env var | dev reset guardrail | required for reset tooling |
| `PERMITTED_PROJECT_IDS` | env var | dev reset guardrail | required for reset tooling |

## Operational notes

- Do not commit secret values to repo.
- Rotate Stripe secrets if compromised and update Firebase secrets before redeploy.
- Keep environment docs and deployment settings aligned when adding new variables.
