# Issue #651: current access checks for staff notifications

Status: implementation not started. This document seeds the issue branch and draft PR.

- Issue: https://github.com/rafsodc/sodc-web/issues/651
- Detailed approach, acceptance criteria and test matrix: https://github.com/rafsodc/sodc-web/issues/651#issuecomment-6301905734
- Parent tracking issue: https://github.com/rafsodc/sodc-web/issues/645
- PR target: `codex/security-privacy-foundation`
- Shared baseline: `adc5033ee588bfb33b3df68bfe36128f6dc812c4` from `main`

## Problem

Former or ineligible staff can remain recipients of private alerts, including recovered deliveries.

## Proposed approach

- Create a shared, opt-in current-recipient policy for privileged staff notifications. Bind recipients to stable UIDs and verify current Auth, profile and exact-purpose admin/moderator eligibility during discovery and immediately before provider submission.
- Version recovery payloads with a recipientUserId separate from the booking/applicant subject. Deduplicate by logical event and original recipient UID; recovery must not retarget a historical email to a different account.
- Introduce a truthful terminal SKIPPED ledger outcome with an ownership-aware conditional completion. Distinguish definitive ineligibility from temporary authorization lookup failure.
- Plan legacy identity/key migration so existing alerts cannot be replayed under new keys. Preserve ordinary member transactional-email behavior.

## Acceptance criteria

- [ ] Only current eligible admins or moderators of the exact relevant section receive the applicable privileged alert.
- [ ] Deleted, disabled, unverified, restricted, missing-profile or revoked recipients receive no new or recovered private staff email.
- [ ] Revocation before the final authorization check prevents a provider call; temporary lookup failures remain bounded and retryable.
- [ ] Recovery remains bound to the original UID; email changes and legacy-key cutover cannot duplicate or retarget a logical delivery.
- [ ] Skipped deliveries are persisted as SKIPPED, excluded from retries and never reported SENT; ledger ownership remains correct under contention.
- [ ] Staff suppression does not suppress the member's separate acknowledgement or other ordinary transactional messages.

## Test suite to implement

- Add privilegedNotificationRecipient.test.ts for eligibility, section scope, Auth/profile drift, email identity and outage cases.
- Extend booking moderator/dispatcher, pending approval, payload, ledger and recovery suites, including revocation between discovery and submission.
- Add privilegedNotificationDelivery.test.ts using real orchestration with an in-memory ledger and fake Auth/database/provider.
- Use an opt-in non-production connector suite for SKIPPED CAS, terminal-query exclusions, mixed legacy records and delivery modes; stub all provider sends.
- Regenerate both SDKs for schema/operation changes; run full Functions tests, lint, coverage and build plus affected frontend checks.

The detailed issue comment distinguishes existing baseline results from new coverage still required. No new tests or application changes are included in this setup commit.

## Dependencies and delivery

This issue can ship before #653. Its recipient helper must adopt #653's authoritative security state when available. Release schema/operations before coordinated delivery/recovery Functions.

Keep this PR in draft until implementation, required tests and release evidence are complete. Update this plan and the PR description as implementation develops.
