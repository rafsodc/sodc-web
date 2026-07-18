# Callable abuse protection

Firebase callable functions use authentication and authorization as the first access boundary. Callables with material abuse, enumeration, external-API, or fan-out cost also consume a per-user fixed-window allowance through `functions/src/rateLimiter.ts`.

`CALLABLE_RATE_LIMITS` is the canonical limit configuration. Call sites must reference a named policy; do not add inline limit or window values.

## Concurrency model

`enforceRateLimit` makes two sequential Data Connect calls, not one:

1. `EnsureCallableRateLimitBucket` — an idempotent upsert that guarantees the current window's `CallableRateLimitBucket` row exists, whose count has a database default of zero. Not wrapped in `@transaction`; always fully committed before the next call starts.
2. `ConsumeCallableRateLimit` — a Data Connect `@transaction` that conditionally increments the now-guaranteed-to-exist row with `count_update: { inc: 1 }` only while `count < limit`, requiring exactly one affected row and rolling the transaction back with `RATE_LIMIT_EXCEEDED` otherwise, then deletes older buckets for the same user and callable after a successful consumption.

These two steps cannot be combined into a single `@transaction`. A row created by `callableRateLimitBucket_upsert` is not visible to a same-transaction `callableRateLimitBucket_updateMany`'s `where` filter — the original single-mutation design (upsert then conditionally update, both in one `@transaction`) rejected every request unconditionally, because the update's affected-row count came back 0 against a same-transaction sibling row, tripping the `@check` and rolling the upsert back too, on every window boundary, for every user, forever (#401). Splitting bucket creation into its own already-committed call fixes this: `ConsumeCallableRateLimit`'s conditional update now only ever runs against a row from a prior, separately-committed transaction, which is the scenario Postgres actually guarantees correct visibility for.

The bucket key is `(userId, functionName, windowStart)`. PostgreSQL serializes concurrent updates to the same bucket, so parallel function instances cannot overwrite one another's counts — splitting the ensure step out does not weaken this: two concurrent `EnsureCallableRateLimitBucket` calls racing to create the same row are idempotent (`ON CONFLICT DO NOTHING`-equivalent upsert semantics), and the actual limit enforcement still happens entirely inside `ConsumeCallableRateLimit`'s single conditional `UPDATE`. `CallableInvocation` and its old operations remain temporarily available only to permit a connector-first rollout; new Functions code does not use them.

Deploy Data Connect schema and connector changes before deploying Functions. Generated frontend and Admin SDKs must be regenerated and both consumers compiled before that deployment. Follow the per-environment checkpoints in the [central rollout runbook](../operations/environments-dev-beta-prod.md#full-stack-rollout-sequence). After all environments run the new Functions version, the legacy counter can be removed in a separate cleanup.

## Central limits

| Callable | Limit | Window | Primary risk |
|---|---:|---:|---|
| `grantAdmin` | 20 | 1 hour | Firebase Auth claim write |
| `revokeAdmin` | 20 | 1 hour | Firebase Auth enumeration and claim write |
| `listAdminUsers` | 30 | 5 minutes | Firebase Auth enumeration |
| `updateDisplayName` | 5 | 1 hour | Firebase Auth write |
| `updateUserDisplayName` | 30 | 1 hour | Firebase Auth write |
| `searchUsers` | 60 | 5 minutes | Account enumeration |
| `listUsersWithoutDataConnectProfile` | 30 | 5 minutes | Full Auth/Data Connect enumeration |
| `listUsersPendingApproval` | 30 | 5 minutes | Full Auth/Data Connect enumeration |
| `syncPendingUserClaims` | 10 | 1 hour | Firebase Auth read/write |
| `submitEventBooking` | 20 | 1 hour | Mutation and transactional email |
| `submitGuestTicketRequest` | 20 | 1 hour | Mutation and transactional email |
| `reviewGuestTicketRequest` | 30 | 1 hour | Mutation and transactional email |
| `updateMembershipStatus` | 20 | 1 hour | Auth/Data Connect writes and transactional email |
| `resignMembership` | 3 | 1 hour | Auth/Data Connect writes and transactional email |
| `getSectionMembersMerged` | 60 | 5 minutes | Member-directory enumeration |
| `createTicketCheckoutSession` | 10 | 15 minutes | Stripe session creation |
| `createEventBookingCheckoutSession` | 10 | 15 minutes | Stripe session creation |
| `reconcileMyCheckoutSessionOrders` | 20 | 15 minutes | Stripe retrieval and reconciliation writes |
| `getMyTicketOrderStripeArtifactsBatch` | 10 | 15 minutes | Batched Stripe retrieval |
| `getTemplateSyncStatus` | 10 | 5 minutes | GOV.UK Notify template enumeration |
| `getAnnouncementTemplates` | 30 | 5 minutes | GOV.UK Notify template enumeration |
| `previewAnnouncementTemplate` | 30 | 5 minutes | GOV.UK Notify preview API |
| `sendSectionAnnouncement` | 5 | 1 hour | Recipient resolution and bulk task/email fan-out |
| `getAnnouncementSendRecipients` | 60 | 5 minutes | Recipient PII enumeration |

## Complete callable classification

Risk levels are relative to other authenticated callables in this application. “External API” includes Firebase Auth, Stripe, and GOV.UK Notify; ordinary bounded Data Connect access is recorded under cost instead.

| Callable | Abuse | Enumeration | External API | Cost / fan-out | Control |
|---|---|---|---|---|---|
| `grantAdmin` | High | Low | Firebase Auth | Medium | Admin + enabled; 20/hour |
| `revokeAdmin` | High | Medium | Firebase Auth | Medium | Admin + enabled; 20/hour; last-admin guard |
| `listAdminUsers` | Medium | High | Firebase Auth | Medium | Admin + enabled; 30/5 minutes |
| `updateDisplayName` | Medium | None | Firebase Auth | Low | Authenticated onboarding exception; 5/hour |
| `updateUserDisplayName` | Medium | None | Firebase Auth | Low | Admin + enabled; 30/hour |
| `searchUsers` | High | High | Firebase Auth | High | Admin + enabled; 60/5 minutes; bounded page size |
| `listUsersWithoutDataConnectProfile` | Medium | High | Firebase Auth | High | Admin + enabled; 30/5 minutes |
| `listUsersPendingApproval` | Medium | High | Firebase Auth | High | Admin + enabled; 30/5 minutes |
| `syncPendingUserClaims` | Medium | None | Firebase Auth | Medium | Authenticated onboarding exception; 10/hour |
| `updateMembershipStatus` | High | None | Firebase Auth, GOV.UK Notify | High | Enabled; ownership/transition checks; 20/hour |
| `resignMembership` | Medium | None | Firebase Auth, GOV.UK Notify | Medium | Enabled; terminal transition; 3/hour |
| `getSectionMembersMerged` | High | High | None | High | Enabled + section access; 60/5 minutes |
| `getSectionForUser` | Low | Low | None | Low | Enabled + section access; bounded lookup |
| `getSectionEventsForUser` | Low | Medium | None | Medium | Enabled + section access; bounded section query |
| `getEventForUser` | Low | Low | None | Low | Enabled + section access; single-event query |
| `submitEventBooking` | High | None | GOV.UK Notify | High | Enabled; validation/idempotency; 20/hour |
| `submitGuestTicketRequest` | High | None | GOV.UK Notify | High | Enabled; validation; 20/hour |
| `reviewGuestTicketRequest` | High | None | GOV.UK Notify | Medium | Admin + enabled; transition check; 30/hour |
| `createTicketCheckoutSession` | High | None | Stripe | High | Enabled; ownership/eligibility; 10/15 minutes |
| `createEventBookingCheckoutSession` | High | None | Stripe | High | Enabled; booking ownership; 10/15 minutes |
| `reconcileMyCheckoutSessionOrders` | High | None | Stripe | High | Enabled; order ownership; 20/15 minutes |
| `getMyTicketOrderStripeArtifactsBatch` | High | Medium | Stripe | High | Enabled; ownership; max 50 IDs; 10/15 minutes |
| `subscribeToUserGroup` | Low | None | None | Low | Enabled; subscribable-group check; idempotent upsert |
| `registerForSectionCallable` | Medium | None | None | Low | Enabled; registration rules; idempotent upsert |
| `getTemplateSyncStatus` | Medium | High | GOV.UK Notify | High | Admin + enabled; 10/5 minutes |
| `getAnnouncementTemplates` | Medium | Medium | GOV.UK Notify | High | Enabled + moderator; 30/5 minutes |
| `previewAnnouncementTemplate` | Medium | Low | GOV.UK Notify | High | Enabled + moderator; 30/5 minutes |
| `sendSectionAnnouncement` | High | High | GOV.UK Notify | Very high | Enabled + moderator; 5/hour; queued delivery |
| `getAnnouncementSendHistory` | Low | Medium | None | Low | Enabled + moderator; bounded history query |
| `getAnnouncementSendRecipients` | High | High | None | Medium | Enabled + moderator; 60/5 minutes; send/section binding |

## App Check relationship

Per-user limits remain necessary after Firebase App Check is enabled under #345. App Check rejects requests that do not come from an attested app instance; it does not cap an authenticated user operating through a legitimate app instance. The controls are complementary.
