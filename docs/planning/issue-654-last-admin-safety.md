# Issue #654: concurrency-safe last administrator protection

Status: implementation not started. This document seeds the issue branch and draft PR.

- Issue: https://github.com/rafsodc/sodc-web/issues/654
- Detailed approach, acceptance criteria and test matrix: https://github.com/rafsodc/sodc-web/issues/654#issuecomment-6301908181
- Parent tracking issue: https://github.com/rafsodc/sodc-web/issues/645
- PR target: `codex/security-privacy-foundation`
- Shared baseline: `adc5033ee588bfb33b3df68bfe36128f6dc812c4` from `main`

## Problem

Separate administrator counting and Auth updates can race or count unusable administrators.

## Proposed approach

- Use the #653 authoritative security records with a pre-created singleton control row, versioned ready-admin count and durable operation/audit records.
- Server-only conditional atomic mutations must enforce count > 1 inside the same transaction as target-state, version, counter and audit changes. Recheck actor authority and bound retries on conflicts.
- Count a grant only after required Auth/profile synchronization. Make removal effective in the database before Auth mirroring, retain recoverable pending work and bind retries to an actor/target/action idempotency key.
- Route all supported role/access writers and reconciliation through the boundary. Preserve existing restricted-admin membership and self-resignation policies.
- Audit/bootstrap the roster and define operator-only drift recovery. Out-of-band Console changes are not atomic with application changes and must not be presented as protected by this invariant.

## Acceptance criteria

- [ ] Every successful supported removal leaves at least one usable effective administrator.
- [ ] Disabled, unverified, restricted, missing-profile, pending or unresolved drifted accounts cannot inflate the usable count.
- [ ] With two admins, simultaneous different-target removals cannot both succeed; with three, two valid removals can leave exactly one.
- [ ] Duplicate requests affect the role/count once; control, target, operation and audit changes commit or roll back together.
- [ ] Crashes, uncertain timeouts, partial Auth failure and stale workers cannot restore old effective access or count unfinished grants.
- [ ] Current policies and unrelated custom claims are preserved, stale actors cannot change roles, and zero-admin/drift recovery has an audited operator path.

## Test suite to implement

- Add adminRoleSafety.test.ts and adminAuthorizationChanges.test.ts covering eligibility, count boundaries, idempotency and current actor authorization.
- Use deterministic barriers and injected adapters for crashes and failures before/after database commit, Auth writes and acknowledgement; verify stale completion and repair.
- Extend auth/claim/membership/Potential Lost/validation suites plus service-only connector, awaited guard and transaction contracts.
- Add adminRoleSafety.integration.ts under an independent opt-in configuration: race independent clients/processes against real conditional Data Connect writes, including different/same targets, duplicate operations and grant/revoke overlap.
- Exercise actual non-production callables with disposable verified identities; prove a remaining admin can administer and direct client roster/control writes are denied.
- Regenerate SDKs and run full Functions tests, lint, coverage and build; require real concurrency evidence before promotion.

The detailed issue comment distinguishes existing baseline results from new coverage still required. No new tests or application changes are included in this setup commit.

## Dependencies and delivery

Coordinate the shared schema/workflow with #653, keeping separate focused implementation PRs. Audit/backfill before a controlled role-writer cutover. #602 and #651 are independent; deploy schema/operations before dependent Functions.

Keep this PR in draft until implementation, required tests and release evidence are complete. Update this plan and the PR description as implementation develops.
