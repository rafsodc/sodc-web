# Callable abuse protection

Firebase callable functions normally use authentication and authorization as the first access boundary. Public account-recovery callables instead use a pseudonymous request key and a neutral response. Callables with material abuse, enumeration, external-API, or fan-out cost consume a fixed-window allowance through `functions/src/rateLimiter.ts`.

`CALLABLE_RATE_LIMITS` is the canonical limit configuration. Call sites must reference a named policy; do not add inline limit or window values.

`enforceRateLimit` accepts an optional weighted `cost` (default 1) so a single call can consume more than one unit of its window allowance. `submitEventBooking` is the one caller that uses this: cost scales with the raw, unvalidated line count in the request (`Math.ceil(lineCount / 5)`, clamped to the policy's `limit`), so a booking at the `MAX_ATOMIC_BOOKING_LINES` (100, see `docs/architecture/booking-submission-api.md`) fan-out ceiling exhausts the caller's entire hourly allowance in one call instead of being repeatable up to 20 times an hour. Typical bookings (a handful of lines) still cost the historical flat 1 unit. See `functions/src/bookings.ts` (`submitEventBookingRateLimitCost`) and #541.

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
| `requestPasswordReset` | 5 | 1 hour | Account enumeration, Firebase Auth and GOV.UK Notify |
| `requestEmailVerification` | 5 | 1 hour | Firebase Auth and GOV.UK Notify resend abuse |
| `requestEmailChange` | 5 | 1 hour | Sensitive Firebase Auth action and GOV.UK Notify |
| `reconcileMyEmail` | 10 | 1 hour | Firebase Auth read and profile mutation |
| `grantAdmin` | 20 | 1 hour | Firebase Auth claim write |
| `revokeAdmin` | 20 | 1 hour | Firebase Auth enumeration and claim write |
| `listAdminUsers` | 30 | 5 minutes | Firebase Auth enumeration |
| `updateDisplayName` | 5 | 1 hour | Firebase Auth write |
| `updateUserDisplayName` | 30 | 1 hour | Firebase Auth write |
| `searchUsers` | 60 | 5 minutes | Account enumeration |
| `listUsersWithoutDataConnectProfile` | 30 | 5 minutes | Full Auth/Data Connect enumeration |
| `listUsersPendingApproval` | 30 | 5 minutes | Full Auth/Data Connect enumeration |
| `syncPendingUserClaims` | 10 | 1 hour | Firebase Auth read/write |
| `submitEventBooking` | 20 (weighted 1–20 by line count, see below) | 1 hour | Mutation and transactional email |
| `submitEventBookingReplayLookup` | 60 | 5 minutes | Bounded idempotency recovery lookup before weighted submission work |
| `reviewBookingRevision` | 30 | 1 hour | Exact-revision approval mutation and transactional email |
| `updateMembershipStatus` | 20 | 1 hour | Auth/Data Connect writes and transactional email |
| `resignMembership` | 3 | 1 hour | Auth/Data Connect writes and transactional email |
| `getSectionMembersMerged` | 60 | 5 minutes | Member-directory enumeration |
| `searchSectionMembers` | 60 | 5 minutes | Member-directory enumeration (bounded, name-match only) |
| `createTicketCheckoutSession` | 10 | 15 minutes | Stripe session creation |
| `createEventBookingCheckoutSession` | 10 | 15 minutes | Stripe session creation |
| `reconcileMyCheckoutSessionOrders` | 20 | 15 minutes | Stripe retrieval and reconciliation writes |
| `getMyTicketOrderStripeArtifactsBatch` | 10 | 15 minutes | Batched Stripe retrieval |
| `getTemplateSyncStatus` | 10 | 5 minutes | GOV.UK Notify template enumeration |
| `setNotifyTemplateBinding` | 30 | 1 hour | GOV.UK Notify template lookup and binding write |
| `moveAllNotifyTemplateBindingsToLatestVersion` | 10 | 1 hour | GOV.UK Notify template enumeration and bulk binding write |
| `getAnnouncementTemplates` | 30 | 5 minutes | GOV.UK Notify template enumeration |
| `previewAnnouncementTemplate` | 30 | 5 minutes | GOV.UK Notify preview API |
| `sendSectionAnnouncement` | 5 | 1 hour | Recipient resolution and bulk task/email fan-out |
| `retryAnnouncementPreparation` | 10 | 1 hour | Moderator recovery of a durable bulk-send preparation attempt |
| `sendNotifyReplyToVerificationTest` | 10 | 1 hour | GOV.UK Notify provider verification sends |
| `getAnnouncementSendRecipients` | 180 | 5 minutes | Database-filtered recipient PII browsing, paging and refresh |
| `requestSectionFileUpload` | 20 | 1 hour | Signed upload capability and storage allocation |
| `finalizeSectionFileUpload` | 30 | 1 hour | Object validation, hashing, copy, and metadata write |
| `listSectionFiles` | 60 | 5 minutes | Restricted metadata enumeration |
| `requestSectionFileDownload` | 120 | 5 minutes | Signed download capability and storage egress |
| `updateSectionFileMetadata` | 60 | 1 hour | Restricted metadata mutation |
| `requestSectionFileReplacement` | 20 | 1 hour | Signed upload capability and lifecycle mutation |
| `finalizeSectionFileReplacement` | 30 | 1 hour | Object validation, copy, cleanup, and metadata mutation |
| `cancelSectionFileReplacement` | 30 | 1 hour | Replacement rollback and temporary-object cleanup |
| `deleteSectionFile` | 30 | 1 hour | Object deletion and lifecycle mutation |

## Complete callable classification

Risk levels are relative to other authenticated callables in this application. “External API” includes Firebase Auth, Stripe, and GOV.UK Notify; ordinary bounded Data Connect access is recorded under cost instead.

| Callable | Abuse | Enumeration | External API | Cost / fan-out | Control |
|---|---|---|---|---|---|
| `requestPasswordReset` | High | High | Firebase Auth, GOV.UK Notify | Medium | Public; email/IP-derived pseudonymous key; neutral success response; 5/hour |
| `requestEmailVerification` | High | None | Firebase Auth, GOV.UK Notify | Medium | Authenticated onboarding exception; recipient derived from Auth; 5/hour |
| `requestEmailChange` | High | Low | Firebase Auth, GOV.UK Notify | Medium | Enabled + recent authentication; current identity derived from Auth; 5/hour |
| `reconcileMyEmail` | Medium | None | Firebase Auth | Low | Authenticated; verified Auth email copied to caller-owned profile; 10/hour |
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
| `searchSectionMembers` | Medium | Medium | None | Low | Enabled + section access; 60/5 minutes; name-match only, capped result set |
| `getSectionForUser` | Low | Low | None | Low | Enabled + section access; bounded lookup |
| `getSectionEventsForUser` | Low | Medium | None | Medium | Enabled + section access; bounded section query |
| `getEventForUser` | Low | Low | None | Low | Enabled + section access; single-event query |
| `submitEventBooking` | High | None | GOV.UK Notify | High | Enabled; validation/idempotency; 20/hour weighted by line count (#541) |
| `submitEventBookingReplayLookup` | Medium | None | None | Low | Enabled; caller/event/key-scoped completed-booking lookup; 60/5 minutes |
| `reviewBookingRevision` | High | None | GOV.UK Notify | Medium | Admin + enabled; exact revision and transition checks; 30/hour |
| `createTicketCheckoutSession` | High | None | Stripe | High | Enabled; ownership/eligibility; 10/15 minutes |
| `createEventBookingCheckoutSession` | High | None | Stripe | High | Enabled; booking ownership; 10/15 minutes |
| `reconcileMyCheckoutSessionOrders` | High | None | Stripe | High | Enabled; order ownership; 20/15 minutes |
| `getMyTicketOrderStripeArtifactsBatch` | High | Medium | Stripe | High | Enabled; ownership; max 50 IDs; 10/15 minutes |
| `subscribeToUserGroup` | Low | None | None | Low | Enabled; subscribable-group check; idempotent upsert |
| `registerForSectionCallable` | Medium | None | None | Low | Enabled; registration rules; idempotent upsert |
| `getTemplateSyncStatus` | Medium | High | GOV.UK Notify | High | Admin + enabled; 10/5 minutes |
| `setNotifyTemplateBinding` | Medium | Low | GOV.UK Notify | Medium | Admin + enabled; server-side exact-name re-validation; 30/hour; audit |
| `moveAllNotifyTemplateBindingsToLatestVersion` | Medium | Low | GOV.UK Notify | High | Admin + enabled; bulk write across all bindings; 10/hour; audit |
| `getAnnouncementTemplates` | Medium | Medium | GOV.UK Notify | High | Enabled + moderator; 30/5 minutes |
| `getAnnouncementDeliveryConfiguration` | Low | None | None | Low | Enabled + moderator; returns non-secret site mode |
| `getGovNotifyDeliveryAdminConfiguration` | Medium | Low | None | Low | Admin + enabled; bounded configuration and audit history |
| `updateGovNotifyDeliveryMode` | High | None | None | Medium | Admin + enabled; deployment ceiling, optimistic lock, reason and immutable audit row |
| `getNotifyReplyToAdminConfiguration` | Medium | Low | None | Low | Admin + enabled; bounded reply-to configuration and audit history |
| `createNotifyReplyToAddress` | High | None | None | Low | Admin + enabled; validated metadata, reason and immutable audit row |
| `updateNotifyReplyToAddress` | High | None | None | Low | Admin + enabled; optimistic lock; resets verification and availability |
| `sendNotifyReplyToVerificationTest` | High | None | GOV.UK Notify | Medium | Admin + enabled; recipient fixed to the verified admin identity; 10/hour; provider test and audit |
| `confirmNotifyReplyToVerification` | High | None | None | Low | Admin + enabled; requires prior provider acceptance, optimistic lock and audit |
| `updateNotifyReplyToAvailability` | High | None | None | Medium | Admin + enabled; verified-only enablement and atomic default replacement/clear |
| `changeNotifyReplyToDefault` | High | None | None | Medium | Admin + enabled; verified enabled target, optimistic lock and audit |
| `setNotifyTemplateReplyToOverride` | High | None | None | Medium | Admin + enabled; manifest allowlist, verified enabled target and audit |
| `previewAnnouncementTemplate` | Medium | Low | GOV.UK Notify | High | Enabled + moderator; 30/5 minutes |
| `sendSectionAnnouncement` | High | High | GOV.UK Notify | Very high | Enabled + moderator; 5/hour; queued delivery |
| `retryAnnouncementPreparation` | High | High | Cloud Tasks | High | Enabled + moderator; send/section binding; 10/hour; idempotent attempt ID |
| `getAnnouncementSendHistory` | Low | Medium | None | Low | Enabled + moderator; bounded history query |
| `getAnnouncementSendRecipients` | High | High | None | Medium | Enabled + moderator; 180/5 minutes; database-filtered; send/section binding |
| `requestSectionFileUpload` | High | None | Cloud Storage | High | Enabled + section moderator/admin; 20/hour; validated size/type; generated path |
| `finalizeSectionFileUpload` | High | None | Cloud Storage | High | Enabled + section moderator/admin; 30/hour; stored-object validation; lifecycle CAS |
| `listSectionFiles` | Medium | Medium | None | Medium | Enabled + current section access; 60/5 minutes; available objects only |
| `requestSectionFileDownload` | High | Low | Cloud Storage | High | Enabled + current section access; 120/5 minutes; 5-minute signed URL |
| `updateSectionFileMetadata` | Medium | None | None | Low | Enabled + section moderator/admin; 60/hour; lifecycle CAS |
| `requestSectionFileReplacement` | High | None | Cloud Storage | High | Enabled + section moderator/admin; 20/hour; generated temporary path |
| `finalizeSectionFileReplacement` | High | None | Cloud Storage | Very high | Enabled + section moderator/admin; 30/hour; validation, CAS, deferred cleanup |
| `cancelSectionFileReplacement` | High | None | Cloud Storage | High | Enabled + section moderator/admin; 30/hour; trusted pending-path rollback |
| `deleteSectionFile` | High | None | Cloud Storage | High | Enabled + section moderator/admin; 30/hour; metadata hidden before cleanup |

## App Check relationship

Per-user limits remain necessary after Firebase App Check is enabled under #345. App Check rejects requests that do not come from an attested app instance; it does not cap an authenticated user operating through a legitimate app instance. The controls are complementary.
