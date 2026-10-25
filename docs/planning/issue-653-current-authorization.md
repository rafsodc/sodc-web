# Issue #653: enforcement of issued-token revocation

Status: implemented and root reviewed, with #602/#651 integrated. #654 uses the shared boundary next. Non-production signed-token and browser release gates remain unexecuted. No deployment or live account/data changes have been made.

- Issue: https://github.com/rafsodc/sodc-web/issues/653
- Detailed approach, acceptance criteria and test matrix: https://github.com/rafsodc/sodc-web/issues/653#issuecomment-6301906956
- Parent tracking issue: https://github.com/rafsodc/sodc-web/issues/645
- PR target: `codex/security-privacy-foundation`
- Shared baseline: `adc5033ee588bfb33b3df68bfe36128f6dc812c4` from `main`

## Problem

An already-issued token can retain access after stored enabled/admin claims are revoked.

## Implemented approach

- Share a server-owned Data Connect security record and durable transition workflow with #654. Protected requests require current ready access, a matching monotonic securityVersion and the required current resource permission.
- Check the record in direct client connector operations with auth.uid lookups and @check/@redact; put mutation checks before writes in @transaction. Replace claim-only Function guards with awaited current-state guards.
- Migrate backend uses of shared client operations to dedicated NO_ACCESS service operations where needed. Preserve ownership, section isolation and explicit public/onboarding/service authorization boundaries.
- Commit restriction/version/audit before retryable Auth synchronization. Increment on revocation and restoration; failed or stale synchronization cannot restore effective database access.
- Roll out additively with backfill, compatible writers and bounded client refresh/recovery before enabling strict gates. Document in-flight effects, existing signed URLs and out-of-band Console changes.

## Acceptance criteria

- [ ] The exact unchanged pre-revocation signed token fails protected Functions and direct Data Connect reads and writes without leaking data or applying a write.
- [x] Version increments on restriction/restoration, old-version and demoted-role admission are covered by deterministic and actual local connector checks; the retained signed-JWT release gate remains below.
- [x] Missing, mismatched, failed or pending security state denies access; all supported writers and downstream privilege bypasses use current authority.
- [x] Backend service calls still work after client checks are introduced; all client operations have an explicit authorization classification.
- [x] Frontend denial handling has bounded refresh/retry and invokes #602 cleanup for terminal loss of access without stale private rendering.
- [ ] Measure the proposed denial target for newly started checks after the restriction commit; document operator and already-issued-capability limits before sign-off.

## Validation

- Complete Functions coverage suite: **112 files / 1,400 tests passed**. Statements **72.64%**, branches **70.03%**, functions **78.23%**, lines **73.77%**; all thresholds passed.
- Complete combined frontend coverage suite: **122 files / 971 tests passed**. Statements **80.99%**, branches **77.21%**, functions **77.41%**, lines **82.30%**; all thresholds passed. The strengthened real-helper refresh-promotion coordinator suite passed **12/12** afterward.
- Deployment-safety suite: **64 tests passed**. Frontend and Functions lint/build passed; Functions build also loads the compiled repository to verify generated package resolution. Operator/migration scripts passed TypeScript checking.
- CI lockfile repair: regenerated the two missing optional `@emnapi/core`/`@emnapi/runtime` records with exact CI **Node 24.22.0 / npm 11.19.1** in an isolated copy. Clean install, Linux/x64 optional resolution and Functions build passed; existing dependency versions and security overrides were preserved.
- Every one of **245** connector operations is classified, and current-admin operations must include the current admin-ready check. Generated SDKs were regenerated and normalized without remaining drift.
- An isolated `demo-sodc-security` Data Connect/PostgreSQL emulator smoke passed missing-state denial, current read/write, restriction, denied-write rollback, restoration/stale-version/admin rejection, explicit service/authorization connector coexistence, concurrent same-version CAS (one success), and profile-CAS rollback of state/ledger. This used emulator auth contexts, not signed JWTs.
- `test:security-integration -- --check` passed target guards without network. The separate real signed-token Dev/Beta harness is implemented with retained immutable JWTs, real callable/direct connector read/write proofs, no-side-effect assertions and proposed five-second measurement. It has **not run**; no cloud deployment, real account or live data changed.
- The #602 browser seed now uses the compiled versioned authorization boundary for strict connectors. Real-browser cross-tab/BFCache/blocked-storage scenarios remain **unexecuted** before production promotion.

Implementation, rollout and validation details: [current authorization runbook](../operations/current-authorization.md). The real-token release gate is isolated from normal mocked suites and remains unexecuted until the reviewed non-production deployment is available.

## Dependencies and delivery

The concrete shared state/transition contract is implemented and documented for #654. #602/#651 are integrated from parent `1567b203465739d6a7ea9b7cfd8dcc875a736ee6`; #654 remains a separate implementation. Schema/service operations precede dependent Functions and Hosting; remove temporary legacy compatibility before closing.

Keep PR #662 draft for root review and CI integration; do not close #653 before non-production release evidence. Follow the staged additive API/backfill/Functions/strict API procedure. The normal deployment command is gated by a one-time project/epoch/verified-commit-ancestry receipt.
