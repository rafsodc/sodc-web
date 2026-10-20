# Issue #602: logout and account session cleanup

Status: implementation not started. This document seeds the issue branch and draft PR.

- Issue: https://github.com/rafsodc/sodc-web/issues/602
- Detailed approach, acceptance criteria and test matrix: https://github.com/rafsodc/sodc-web/issues/602#issuecomment-6301903454
- Parent tracking issue: https://github.com/rafsodc/sodc-web/issues/645
- PR target: `codex/security-privacy-foundation`
- Shared baseline: `adc5033ee588bfb33b3df68bfe36128f6dc812c4` from `main`

## Problem

Private cached data and delayed callbacks can survive logout or an account change.

## Proposed approach

- Introduce one session coordinator above private hooks and screens. Retire the old private UI immediately when an authenticated identity leaves or changes, then replace the document to discard the installed Data Connect SDK cache and module state.
- Unify logout entry points, scope the private QueryClient to the accepted session, and guard asynchronous results and follow-on actions with UID, session generation and request ownership.
- Preserve initial sign-in/registration, safe public guest/auth-action URLs and deliberate device preferences. Handle failed sign-out and browser Back/Forward restoration explicitly.

## Acceptance criteria

- [ ] Logout, direct account replacement and rapid A → null → B transitions cannot show A's data or privileges to B.
- [ ] Old reads, mutations, claims, token refresh and finally callbacks cannot restore private state or act in a later session.
- [ ] Every logout route shares the same boundary, and failed logout provides truthful recovery.
- [ ] Initial restoration, first sign-in and registration work with normal and memory-only persistence; same-UID refresh does not reload.
- [ ] Cross-tab transitions and browser history cannot reveal a private snapshot; public guest links and device preferences still work.

## Test suite to implement

- Add sessionLifecycle.test.ts and App.sessionIsolation.test.tsx with a real QueryClient, actual observer callbacks and controlled delayed reads/mutations.
- Extend profile, claim, token refresh, recovery, auth/register and sign-out entry-point tests. Exercise owner mismatch and stale success/error/finally callbacks.
- Add an unmocked installed-SDK boundary test; do not mistake TanStack clearing for complete Data Connect cache isolation.
- Introduce an opt-in Playwright session-isolation suite for two disposable identities, blocked storage, multiple tabs and browser Back/Forward.
- Run focused and full frontend tests, lint, coverage and build during implementation; record Dev/Beta browser evidence before promotion.

The detailed issue comment distinguishes existing baseline results from new coverage still required. No new tests or application changes are included in this setup commit.

## Dependencies and delivery

This issue can ship independently of #651, #653 and #654. Server-side token enforcement remains #653. Do not add new caching until the session boundary is proven.

Keep this PR in draft until implementation, required tests and release evidence are complete. Update this plan and the PR description as implementation develops.
