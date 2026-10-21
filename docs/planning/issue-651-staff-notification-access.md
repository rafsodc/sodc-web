# Issue #651: current access checks for staff notifications

Status: implemented in draft PR #661; coordinator review and non-production release verification remain outstanding.

- Issue: https://github.com/rafsodc/sodc-web/issues/651
- Reviewed approach and acceptance matrix: https://github.com/rafsodc/sodc-web/issues/651#issuecomment-6301905734
- PR: https://github.com/rafsodc/sodc-web/pull/661
- Parent tracking issue: https://github.com/rafsodc/sodc-web/issues/645
- PR target: `codex/security-privacy-foundation`
- Shared baseline: `adc5033ee588bfb33b3df68bfe36128f6dc812c4` from `main`

## Behavior

Booking-moderation alerts and new-applicant alerts now bind the recipient to an immutable Firebase UID. Discovery and the final claimed send check fresh Auth/profile state: the user must exist, be enabled, not disabled, have a verified email matching the profile, have an active membership status, and retain global admin or the required section's moderator authority. Explicit and status-inherited moderator access use the existing section-access resolver. An address change follows the original UID's newly verified address and retains the same delivery identity.

`privilegedNotificationRecipient.ts` owns the opt-in policy; `readCurrentRecipientState()` is the integration seam for #653's authoritative security record. That integration can deny missing/pending/revoked security state without changing the UID or ledger contract. This branch can ship independently before #653.

`privilegedNotificationDelivery.ts` runs the legacy-event fence, then the fresh authorization check, then verifies ownership of the current ledger lease immediately before provider submission. A definitive denial produces a persisted SKIPPED outcome. Temporary Auth/Data Connect/email-sync failures remain retryable FAILED attempts. The staff-failure ledger/log path retains safe codes instead of provider request contents. Ordinary member/customer notifications retain their domain rules; the booker's acknowledgement runs before staff discovery or suppression.

## Ledger and recovery

- `NotificationDeliveryStatus.SKIPPED`, `skippedAt`, `skipReason`, and a separate `recipientUserId` column preserve the distinction between subject and recipient.
- `MarkNotificationDeliverySkippedById` requires PENDING status, the exact attempt count and the exact attempt timestamp; skip completion clears sentAt/provider IDs. Failed writes or lost ownership never report an unpersisted skip.
- Staff recovery payloads use version 2 and UID-based keys. Applicant subject `userId` and booking subject `bookingId` retain their meanings. Recovery validates type, key, original recipient UID and subject against the ledger, retries only that UID and preserves the original physical delivery key.
- Legacy version-1 staff payloads have no independently trustworthy recipient UID and terminate as `LEGACY_RECIPIENT_IDENTITY_UNVERIFIABLE`. Their email is never rebound to today's user at that address.
- Any recorded legacy staff event fences UID-key replacements for that logical booking/applicant event, including SENT, FAILED, PENDING and subsequently SKIPPED records. Explicit modes are separate; missing or conflicting historical mode information conservatively fences all modes. The lookup fails closed if its bounded history could be truncated.
- A preserved physical recovery key retains its original payload mode even if the runtime ceiling changes. Tests cover failed LIVE records under a SIMULATION ceiling with a false/throwing first skip write, a later successful terminal skip, and zero provider calls.
- A recovered staff delivery whose requested mode is reduced by the current runtime ceiling is terminal-skipped as `DELIVERY_MODE_CHANGED`, rather than completing a live delivery by sending it in another mode.

## Acceptance evidence

- [x] Current verified eligible admins and exact-section moderators receive applicable staff alerts; ACCESS-only/other-section users do not gain moderator authority.
- [x] Deleted, disabled, unverified, restricted, missing-profile and revoked accounts are denied, including both directions of Auth/profile restriction drift.
- [x] Final authorization and lease checks catch revocation/contention before provider submission; lookup outages remain retryable.
- [x] Original UID, email changes, subject/recipient/type/key mismatches and legacy cutover are covered.
- [x] SKIPPED is terminal, truthfully persisted with CAS ownership, excluded from recovery counts/queries and never labeled SENT.
- [x] The member acknowledgement and ordinary transactional delivery behavior remain covered.
- [ ] Coordinator code review and integration with #653's security state.
- [ ] Deploy schema/operations to Dev/Beta and execute the opt-in connector release check there before promotion.

## Validation completed locally on 21 October 2026

- Functions lint: passed after the coordinator review fix.
- Focused delivery/recovery/payload regression run after that fix: 4 suites, 49 tests passed. Both newly added failure variants failed against the previous implementation before the fix.
- Full Functions tests with coverage, two workers: 105 suites, 1,318 tests passed; all existing thresholds passed. Coverage: 72.48% statements, 69.22% branches, 78.53% functions, 73.29% lines.
- Functions production build: passed.
- Frontend production build: passed.
- Full frontend tests, two workers: 114 suites, 914 tests passed.
- Both SDKs regenerated from source GraphQL and checked for identical output on a second generation after removing generator-only trailing whitespace in JavaScript. No generated logic was edited manually.
- Diff whitespace check: passed.

New tests include current-recipient policy, real in-process delivery/recovery with a fake provider and ledger, legacy mode classification, generated repository adapter/CAS/privacy behavior, and the integration runner's safety gate. Existing discovery, caller, payload, recovery, lifecycle and delivery-mode suites were extended.

## Non-production connector release check

`functions/scripts/run-notification-integration.mjs` is deliberately excluded from ordinary runs. It validates the explicit project/confirmation before importing Firebase or accessing credentials. Only `sodc-web` and `sodc-web-beta` are accepted; production/unknown projects, conflicting Google/Firebase project config and emulator overrides are rejected.

After the new schema and operations exist in the selected non-production project, use approved application-default credentials and run:

```sh
RUN_SECURITY_INTEGRATION=1 \
SECURITY_INTEGRATION_PROJECT=sodc-web-beta \
SECURITY_INTEGRATION_CONFIRM=sodc-web-beta \
npm --prefix functions run test:notification-integration
```

The runner imports no mailer/provider. It creates a random synthetic profile and nine ledger fixtures spanning SENT/FAILED/PENDING and the three delivery modes, verifies actual skip CAS/metadata, legacy lookup and terminal query exclusions, then removes its fixtures. Fixture attempts are above the scheduler retry limit, and their intentionally unsupported recovery kind cannot route to a provider. Cleanup also checks exact generated keys after an uncertain write response; incomplete cleanup reports the synthetic run ID and fails the check.

**This connector check has not been executed.** No cloud deployment, live account/data change or real email was performed for this implementation. Run it in Dev/Beta and retain its result as release evidence; the automated gate tests establish only that normal runs cannot start it accidentally.

## Delivery and limitations

Release schema/operations before coordinating delivery and recovery Functions. Review mixed legacy records and all modes during Dev/Beta verification. Keep the PR draft pending coordinator review and release evidence.

An already accepted provider request cannot be recalled if access is subsequently revoked. Legacy email-only alerts are suppressed, rather than silently migrated or resent; operators can use the existing approval interfaces to review outstanding work. No production deployment or merge is part of this branch task.
