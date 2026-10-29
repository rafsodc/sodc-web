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
  - Used for global administration (sections, group assignment, users and global payment reconciliation). Section moderation instead combines enabled access with current administrator authority or a current explicit/status-derived MODERATOR relationship to the resource's section.

- **Service-only / admin SDK access**
  - Pattern: `@auth(level: NO_ACCESS)`
  - Used by server-side functions via generated admin SDK.

## Permission matrix (representative)

| Surface | Operation / Function | Expected access |
|---|---|---|
| Data Connect query | `GetMyBookingsForEvent` | enabled user |
| Data Connect query | `ListTicketOrdersForAdmin` | current enabled section moderator or global administrator |
| Callable | `submitEventBooking` | enabled user |
| Callable | `createTicketCheckoutSession` | enabled user |
| Callable | `grantAdmin` / `revokeAdmin` / `listAdminUsers` | enabled admin |
| Callable | section-file list/download | enabled user with current section access, or enabled global admin |
| Callable | section-file upload/manage/delete | enabled moderator of that section, or enabled global admin |
| Webhook | `stripeWebhookPayments` | Stripe signature-verified request |

## Function guard model

Guard helpers in `functions/src/helpers.ts`:

- `requireAuth(request)`:
  - rejects unauthenticated requests.
- `requireEnabled(request)`:
  - awaits current ready authority, eligible profile status and exact token version, with `enabled: true` as an additional restrictive check.
- `requireAdmin(request)`:
  - awaits the same current-state check plus `adminReady`, with both `admin: true` and `enabled: true` as additional restrictive checks.
  - an admin claim never bypasses account revocation.

Typical usage:

- Member flows (`submitEventBooking`, checkout start, membership self-service): `requireEnabled`.
- Event/ticket configuration and per-event booking/payment reads use redacted current authority plus a resource-owned section check. Mutations repeat both checks inside the writing transaction; update IDs cannot move events or ticket types into another section. Booking decisions repeat actor security version and section relationship inside either approval transaction.
- Ticket access-group choices are restricted to groups linked to the section or already used by its ticket types, for administrators and moderators alike. Global group assignment remains administrator-only.
- Directory reads permit a current administrator without a section relationship, but MEMBER roster selection, Auth email verification and contact redaction remain unchanged. Seating labels resolve at most 100 requested IDs against that same verified population; unrelated IDs return no names.
- Section-file reads require current `ACCESS` or `MODERATOR` purpose after `requireEnabled`; management requires current `MODERATOR` purpose. Enabled global admins may bypass the relationship check, while disabled admins remain denied.
- PII-bearing member directories and all announcement template, preview, send, history, and recipient callables: `requireEnabled` before section/group checks.
- Admin-only operations: `requireAdmin`, which also enforces `enabled: true`.
- A caller with `admin: true` but `enabled !== true` is rejected; admin status is not an access-revocation bypass.

Member/admin access now requires server-owned `UserSecurityState`, ready current profile eligibility and an exact `securityVersion` in addition to restrictive Auth claims. Direct connector operations use redacted current-state lookups; protected mutations check before writes in a transaction. Functions await fresh current-state guards and use effective permissions for downstream bypasses. See [Current authorization and migration](../operations/current-authorization.md) for the durable transition contract, full operation inventory, staged rollout, operator path and capability limits. Auth claims alone cannot grant access, and refresh-token revocation alone does not recall an already-issued token.

The callable entry points intentionally using authentication without an enabled claim are explicit onboarding and own-session exceptions:

- `updateDisplayName`, used while establishing the account profile.
- `syncPendingUserClaims`, used to reconcile the pre-approval Auth/profile state.
- `requestEmailVerification`, which derives the recipient from Firebase Auth and
  sends no member data to the caller.
- `getMyAuthorizationStatus`, which returns only current own-session ready/role/version metadata, never member data; it cannot initialize/grant access or release a verification hold.
- `reconcileMyEmail`, which copies the signed-in user's verified Firebase Auth
  address to only their own Data Connect profile.

These exceptions must not return member-directory data, announcement data, or other enabled-member content. Adding another authentication-only callable requires an explicit security review and a contract-test update.

Callable abuse, enumeration, external-API, and fan-out risks are classified in [Callable abuse protection](./callable-abuse-protection.md). That document also records the centralized limits and concurrency-safe counter design.

## Webhook security

Stripe webhook uses signature verification in `functions/src/paymentWebhook.ts` (re-exported by `functions/src/payments.ts`):

- requires `stripe-signature` header
- verifies payload via `constructEvent(req.rawBody, signature, webhookSecret)`

This protects payment state transitions against forged webhook requests.

## Regression test coverage

Security/permission regression tests live in the domain-oriented Functions test
folders:

- `functions/src/__tests__/users-auth/authGuards.test.ts`
  - guard helper allow/deny behavior
- `functions/src/__tests__/cross-cutting/contracts/dataconnectAuthContracts.test.ts`
  - verifies required `@auth(...)` directives on critical operations
  - full sweep check over `dataconnect/api/*.gql` operation headers
- `functions/src/__tests__/cross-cutting/contracts/functionEntryGuardContracts.test.ts`
  - verifies callable entry points retain expected guard calls
  - verifies Stripe webhook signature-check contract markers

Run explicitly:

```sh
cd functions
npm run test -- src/__tests__/users-auth/authGuards.test.ts src/__tests__/cross-cutting/contracts/dataconnectAuthContracts.test.ts src/__tests__/cross-cutting/contracts/functionEntryGuardContracts.test.ts --run
```

## Troubleshooting

- **Permission denied on callables**
  - Check auth token claims (`enabled`, `admin`) and entry guard expectations.
  - If `enabled` disagrees with the Data Connect membership status, follow the
    [enabled-claim reconciliation procedure](../operations/enabled-claim-reconciliation.md).
- **Data Connect operation unexpectedly accessible/restricted**
  - Verify `@auth(...)` directive in source `.gql` and regenerate SDKs after changes.
- **Webhook processing failures**
  - Confirm `STRIPE_WEBHOOK_SECRET_PAYMENTS` is configured and signature header is present.
- **Security tests fail in CI**
  - Usually indicates changed auth directives/guards; update code or test expectations intentionally in the same PR.
