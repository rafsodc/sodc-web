# Issue #654: concurrency-safe last administrator protection

Status: implemented for independent review in draft PR #663. Local automated checks pass; cloud signed-token/callable, notification and browser release gates remain unexecuted. No deployment or live account/data operation occurred.

- Issue: https://github.com/rafsodc/sodc-web/issues/654
- Reviewed approach/acceptance criteria: https://github.com/rafsodc/sodc-web/issues/654#issuecomment-6301908181
- Parent: #645; target `codex/security-privacy-foundation`, including reviewed #653 authorization foundation and merged #602/#651.
- Operational rollout: [current authorization and last-admin runbook](../operations/current-authorization.md).

## Implemented invariant and transaction boundary

`AdminSafetyControl("site-wide")` is separately precreated with a version, ready contribution count and BOOTSTRAP/READY/RECOVERY_REQUIRED status. Every supported security intent writes its conditional control version even when its count delta is zero. Service-only transactions check the current actor/version and target/profile, update control/count/state and insert the immutable operation together. A failed guard/CAS rolls back all changes.

`BeginSecurityTransition` withdraws the actual target's `adminReady` contribution before Auth work. Count > 1 is required for every normal readiness reduction, including active-to-active status edits, email reverification and supported disable. `CompleteSecurityTransition` increments only for the exact matching pending admin grant after fresh verified Auth synchronization. A pending grant cannot make another removal safe. Existing restricted-admin membership and resignation policies remain.

Healthy unchanged requests write full-intent READY no-op receipts while retaining user readiness/version and original state operation ownership. Replaying a no-op after a newer version never reapplies its old intent. All interactive role/status/resignation/email/Potential Lost/reconciliation actions supply stable operation IDs, retain them only for manual uncertain-result retries, and check actual Auth UID plus session generation. No automatic mutation retry or persistent per-member key map is introduced.

Operation hashes bind actor, target, explicit authority kind, semantic flags, normalized requested/expected email and review evidence. Initialization and operator repair also bind their canonical intent; supplied references cannot be reused for different flags/actions. Four bounded conflict attempts reread authority; uncertain commits reread and resume the recorded operation instead of applying another delta. Durable completion follows the already-authorized immutable intent even if its original actor later loses access; it does not authorize a new intent from that former actor. Auth has no cross-system CAS, so already-started stale Auth writes remain a documented mirror-drift boundary; database authority and repair remain decisive.

## Writer, identity and recovery coverage

- Role changes, admin/self status edits, resignation, exact-address email holds/releases, initial approval, operator bootstrap/enable/disable/role recovery and reconciliation use explicit service-owned actor kinds. Callers derive actor/version from the checked signed request, never request data.
- Potential Lost uses isolated `ConfirmPotentialLostWithAdminSafety`, preserving current actor/control, target non-admin enforcement and evidence/profile/review audit atomicity.
- All new authorization operations use `securityRepository`'s dedicated named Firebase App and installed generated SDK file dependency; source contracts enumerate every wrapper.
- Safety-reducing changes verify the entire bounded current ready roster against fresh Auth/profile evidence. Unknown/outage/inconsistent state fails closed. Known external disabled/deleted/unverified or malformed counted accounts are DRIFT-denied and their contribution corrected, even to zero; Auth is never restored to repair a count. Zero requires explicit operator recovery.
- Ordinary control creation requires fresh eligible roster evidence. Explicit frozen `control-create-recovery` creates BOOTSTRAP from actual database flag contributions only, with a distinct recovery intent hash/audit reason. It asserts no usability or grant. Separate recount/repair and explicit account recovery are required; activation independently verifies count/profile/Auth and at least one ready administrator. Unknown lookup failure preserves BOOTSTRAP.
- Operator repair records its own bound no-op receipt and cannot infer enablement or initialize missing authority. Explicit exact-email verification release and grant-admin provide audited recovery; restricted/missing identities require separately approved status/identity repair or another eligible member.
- Obsolete email-operation replay cannot start a fresh Auth email write after another operation restored/replaced its hold. The endpoint rechecks exact denied hold plus current operation/no-op receipt ownership before starting that write.
- Verified established sign-in reconciliation is a durable no-op; held identities use bounded session-fenced pre-refresh, exact verified reconciliation and post-refresh. Verified no-profile onboarding receives only fresh own Auth email, without profile/state creation or claims grants.
- Legacy import references are stable per project/batch/source checksum/UID and explicit OPERATOR context. Development reset behavior-tests fail-closed control/state/outage fencing before its first deletion. The local browser seed precreates control and uses a separate ready admin anchor while A/B remain members, with exact demo/loopback guards and no cloud ADC.

## Migration and operational gates

The runbook requires approved server-enforced provider blocking of every security-writing entrypoint, paused scheduler/CLI writers, drained pending/in-flight legacy work, and a recorded old-tab/direct-request refusal before changing signatures or activating count. Hosting maintenance alone is insufficient. Additive schema/authorization connector deployment is mandatory for every installation; an already strict #653 installation must never deploy the legacy compatibility artifact.

The combined epoch `current-authorization-admin-safety/v2` requires `adminSafetyControlReady: true` and `securityWriteFreezeVerified: true` plus the existing project/ancestry/evidence fields. #653-only receipts are rejected. Counter precreation and final activation commit separately. No cutover, reset, migration or cloud gate ran during this implementation.

## Validation actually performed

- Functions full coverage on Node **24.22.0** / npm **11.19.1**: **117 suites / 1,477 tests**, all existing gates; statements **72.99%**, branches **70.05%**, functions **78.08%**, lines **74.45%**. Exact final figures are recorded in the PR validation evidence.
- Functions lint, clean production build and operator script TypeScript passed.
- Frontend full coverage: **125 suites / 1,023 tests**; statements **81.67%**, branches **77.78%**, functions **78.02%**, lines **82.98%**, existing gates; lint/build passed.
- Deployment/rollout/local-fixture targeting: **72 tests**, including all 64 existing deployment safety checks and eight new pure seed-target guards. Old epoch/missing control-ready/missing provider-freeze assertions are rejected.
- Actual local SQL: **19 scenarios passed** against the compiled Data Connect operations and a fresh owned disposable PGlite database, using independent OS processes and an IPC barrier. Covers two/three-admin races, same/different operation IDs and targets, duplicate completion, grant/removal overlap, pending grants, stale completions/actors, profile-CAS rollback, sole-admin no-op and readiness drops, corrupt/zero-count drift, current SELF profile checks and ordinary-client service-op denial. **16 runner guards** also pass. This proves real conditional SQL behavior, not real Auth/JWT/callable availability.
- All three SDKs regenerated from authoritative GQL and normalized for generated JS trailing whitespace; repeated generation produced identical hashes across **25 files**. Authorization inventory verifies **253** explicitly classified operations. Whitespace checks pass.

Core behavioral suites include `adminRoleSafety.test.ts`, `adminAuthorizationChanges.test.ts`, `developmentResetSafety.test.ts`, extended current-authorization/email/reconciliation/Potential Lost suites and service/writer contracts. SQL integration is separate from mocked normal tests:

```sh
RUN_ADMIN_SAFETY_INTEGRATION=1 ADMIN_SAFETY_INTEGRATION_PROJECT=demo-sodc-admin-safety npm --prefix functions run test:admin-safety-integration
```

The opt-in runner validates targeting before SDK/network access, copies strict sources with generation disabled, creates only its own temporary data directory, shuts down its emulator and cleans only that owned directory. It cannot use a cloud project or reset a shared counter. The separate Dev/Beta signed-token harness now requires an active control/healthy unrelated baseline admin and retires fixture contributions through supported operator transitions before scoped deletion; cleanup never resets the global count or deletes Auth after failed retirement/database cleanup.

## Required release evidence still pending

- [ ] Reviewed Dev/Beta deployment, control bootstrap/freeze audit and actual signed-token/callable gate.
- [ ] Real browser session isolation/verification acceptance using the updated local seed and browser runner.
- [ ] Cloud notification integration release gate from #651; no provider email sent here.
- [ ] Exact pushed-SHA CI and coordinator review before readiness/merge or environment promotion.

Keep PR #663 draft until coordinator review. Refs #654; this implementation does not prematurely close the issue or claim unexecuted release evidence.
