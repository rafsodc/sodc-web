# Security and Permissions Architecture

This document summarizes how access is enforced across Data Connect and Firebase Functions.

## Layers

1. **Data Connect operation-level auth**
   - GraphQL operations define required auth via `@auth(...)`.
   - Source files: `dataconnect/api/*.gql`.

2. **Functions entry guards**
   - Callables enforce authentication/claims at runtime:
     - `requireAuth`
     - `requireEnabled`
     - `requireAdmin`
   - Source: `functions/src/helpers.ts`.

3. **Rules and business constraints**
   - Booking/payment eligibility checks run in functions/business logic after basic auth checks.

## Data Connect auth model

- **User-level enabled access**
  - Pattern: `@auth(expr: "auth.token.enabled == true")`
  - Used for member-facing reads/writes.

- **Admin-level enabled access**
  - Pattern: `@auth(expr: "auth.token.admin == true && auth.token.enabled == true")`
  - Used for admin workflows and moderation.

- **Service-only / admin SDK access**
  - Pattern: `@auth(level: NO_ACCESS)`
  - Used by server-side functions via generated admin SDK.

## Permission matrix (representative)

| Surface | Operation / Function | Expected access |
|---|---|---|
| Data Connect query | `GetMyBookingsForEvent` | enabled user |
| Data Connect query | `ListGuestTicketRequestsForAdmin` | enabled admin |
| Data Connect query | `ListTicketOrdersForAdmin` | enabled admin |
| Data Connect mutation | `CreateGuestTicketRequest` | enabled user |
| Data Connect mutation | `AdminReviewGuestTicketRequest` | enabled admin |
| Callable | `submitEventBooking` | enabled user |
| Callable | `createTicketCheckoutSession` | enabled user |
| Callable | `grantAdmin` / `revokeAdmin` / `listAdminUsers` | enabled admin |
| Webhook | `stripeWebhook` | Stripe signature-verified request |

## Function guard model

Guard helpers in `functions/src/helpers.ts`:

- `requireAuth(request)`:
  - rejects unauthenticated requests.
- `requireEnabled(request)`:
  - requires authenticated caller with `enabled: true`.
- `requireAdmin(request)`:
  - requires authenticated caller with `admin: true`.

Typical usage:

- Member flows (`submitEventBooking`, checkout start): `requireEnabled`.
- Admin-only operations: `requireAdmin`.
- Mixed/self-service operations (`updateMembershipStatus`, section member rollups): `requireAuth` + in-function ownership checks.

## Webhook security

Stripe webhook uses signature verification in `functions/src/payments.ts`:

- requires `stripe-signature` header
- verifies payload via `constructEvent(req.rawBody, signature, webhookSecret)`

This protects payment state transitions against forged webhook requests.

## Regression test coverage

Security/permission regression tests live in `functions/src/__tests__/`:

- `authGuards.test.ts`
  - guard helper allow/deny behavior
- `dataconnectAuthContracts.test.ts`
  - verifies required `@auth(...)` directives on critical operations
  - full sweep check over `dataconnect/api/*.gql` operation headers
- `functionEntryGuardContracts.test.ts`
  - verifies callable entry points retain expected guard calls
  - verifies Stripe webhook signature-check contract markers

Run explicitly:

```sh
cd functions
npm run test -- authGuards dataconnectAuthContracts functionEntryGuardContracts --run
```

## Troubleshooting

- **Permission denied on callables**
  - Check auth token claims (`enabled`, `admin`) and entry guard expectations.
- **Data Connect operation unexpectedly accessible/restricted**
  - Verify `@auth(...)` directive in source `.gql` and regenerate SDKs after changes.
- **Webhook processing failures**
  - Confirm `STRIPE_WEBHOOK_SECRET` is configured and signature header is present.
- **Security tests fail in CI**
  - Usually indicates changed auth directives/guards; update code or test expectations intentionally in the same PR.
