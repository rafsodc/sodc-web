# Issue #653: enforcement of issued-token revocation

Status: implementation not started. This document seeds the issue branch and draft PR.

- Issue: https://github.com/rafsodc/sodc-web/issues/653
- Detailed approach, acceptance criteria and test matrix: https://github.com/rafsodc/sodc-web/issues/653#issuecomment-6301906956
- Parent tracking issue: https://github.com/rafsodc/sodc-web/issues/645
- PR target: `codex/security-privacy-foundation`
- Shared baseline: `adc5033ee588bfb33b3df68bfe36128f6dc812c4` from `main`

## Problem

An already-issued token can retain access after stored enabled/admin claims are revoked.

## Proposed approach

- Share a server-owned Data Connect security record and durable transition workflow with #654. Protected requests require current ready access, a matching monotonic securityVersion and the required current resource permission.
- Check the record in direct client connector operations with auth.uid lookups and @check/@redact; put mutation checks before writes in @transaction. Replace claim-only Function guards with awaited current-state guards.
- Migrate backend uses of shared client operations to dedicated NO_ACCESS service operations where needed. Preserve ownership, section isolation and explicit public/onboarding/service authorization boundaries.
- Commit restriction/version/audit before retryable Auth synchronization. Increment on revocation and restoration; failed or stale synchronization cannot restore effective database access.
- Roll out additively with backfill, compatible writers and bounded client refresh/recovery before enabling strict gates. Document in-flight effects, existing signed URLs and out-of-band Console changes.

## Acceptance criteria

- [ ] The exact unchanged pre-revocation signed token fails protected Functions and direct Data Connect reads and writes without leaking data or applying a write.
- [ ] Old tokens remain invalid after disable/restore or role revoke/regrant; a refreshed enabled member retains only permitted member access.
- [ ] Missing, mismatched, failed or pending security state denies access; all supported writers and downstream privilege bypasses use current authority.
- [ ] Backend service calls still work after client checks are introduced; all client operations have an explicit authorization classification.
- [ ] Frontend denial handling has bounded refresh/retry and invokes #602 cleanup for terminal loss of access without stale private rendering.
- [ ] Measure the proposed denial target for newly started checks after the restriction commit; document operator and already-issued-capability limits before sign-off.

## Test suite to implement

- Extend auth guards, claim/membership reconciliation, Potential Lost, admin email, connector/entry/schema contracts and affected domain permission suites.
- Cover database-first restriction, ready-grant ordering, concurrent transitions, duplicate retries, Auth failure and stale mirror completion.
- Extend frontend authentication-failure and recovery tests using actual Functions/Data Connect error shapes.
- Add accessRevocation.integration.ts under a separate opt-in configuration without global Auth mocks, using allowlisted non-production projects.
- Retain a real signed JWT in memory before revocation, then reuse its exact bytes against deployed callable and client connector read/write endpoints. Verify no side effect and measure denial latency; repeat restore/regrant and partial-failure cases.
- Regenerate SDKs and run full frontend/Functions tests, lint, coverage and builds. Record real-token Dev/Beta release evidence.

The detailed issue comment distinguishes existing baseline results from new coverage still required. No new tests or application changes are included in this setup commit.

## Dependencies and delivery

Agree the shared state and transition contract with #654 before implementation. #602 and #651 can proceed independently. Schema/service operations precede dependent Functions and Hosting; remove temporary legacy compatibility before closing.

Keep this PR in draft until implementation, required tests and release evidence are complete. Update this plan and the PR description as implementation develops.
