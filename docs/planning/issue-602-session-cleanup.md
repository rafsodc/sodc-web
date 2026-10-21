# Issue #602: logout and account session cleanup

Status: implemented and locally validated; draft PR awaiting review. Browser acceptance remains a release gate.

- Issue: https://github.com/rafsodc/sodc-web/issues/602
- Design and acceptance matrix: https://github.com/rafsodc/sodc-web/issues/602#issuecomment-6301903454
- Parent: https://github.com/rafsodc/sodc-web/issues/645
- Draft PR: https://github.com/rafsodc/sodc-web/pull/660
- PR target: `codex/security-privacy-foundation`

## Implemented behavior

A central document-session coordinator accepts initial restoration and the first anonymous sign-in, then permanently retires a document when its authenticated UID leaves or changes. It removes the private React tree synchronously, cancels/clears its provider-owned QueryClient and replaces the document. This discards Data Connect's internal cache without relying on the installed SDK's incomplete `terminate()` reset.

All existing logout entry points share the coordinator, including reauthentication, resignation and self-email changes. Failed logout keeps private data hidden and offers retry; a successful reset can carry a timestamp-only one-use confirmation. Device preference cookies and Firebase persistence are preserved.

UID/generation/request guards cover profile/claims, token refresh, profile-existence checks, recovery, imperative SDK operations, callable responses and generated mutation-hook follow-ons. First sign-in/registration remain in the original anonymous document so memory-only Auth is usable. Same-UID refresh does not reload. Public guest capabilities survive first login; fragment changes invalidate old guest actions. Auth-action follow-ons retain their original account owner.

`pagehide` removes private snapshots and persisted `pageshow` restarts at the current same-origin URL. The public retirement/sign-out API is the integration seam for #653; current-authority enforcement remains separate.

## Acceptance and evidence

- [x] Populated UID-free caches, A -> null/B and rapid replacement are fenced before a replacement account renders (state-machine/app integration tests).
- [x] Late reads/mutations/claims/token success, error and finally work cannot restore private UI or launch later-session follow-ons (owned hook/operation tests).
- [x] Central logout failure/retry and one-use confirmation are truthful; StrictMode does not duplicate logout/replacement.
- [x] Initial anonymous sign-in, same-UID updates, pending profile StrictMode replay and existing sign-in/registration flows pass local regression checks.
- [x] Public guest capability/hash isolation, persisted-page restart and device-cookie preservation pass local tests.
- [ ] Real-browser cross-tab/BFCache/blocked-storage acceptance against disposable local emulator identities. The runner is provided but these scenarios have not been executed in this implementation session.

Validation performed:

- Complete frontend coverage run: **120 files / 944 tests passed**; statements **80.70%**, branches **76.91%**, functions **77.24%**, lines **82.03%**. All configured coverage thresholds passed.
- The coverage run includes three local fixture destination guard tests; unsafe project/host input is rejected before Admin SDK loading or account creation.
- Lint and production build passed. The build notes that the fallback dynamic Firebase import shares an existing static chunk; it completes successfully.
- Browser discovery found three cases; a non-opted-in runner invocation reported **three skipped**, which is not browser acceptance evidence.
- No emulators, seed accounts, cloud services, deployments or real member data were used.

## Reproduce browser acceptance

See [the local session browser guide](../testing/session-isolation.md) for exact dependency, emulator, demo seed and runner commands. The frontend emulator mode requires both Vite development mode and an explicit opt-in; production defaults remain cloud-backed. The runner refuses remote application targets and blocks remote HTTP/WebSocket traffic before submitting credentials. Seed commands refuse any project/endpoints other than the fixed demo/loopback stack.

## Limits and delivery

The hard document replacement is a deliberate privacy boundary. An unexpected direct switch with memory-only persistence can require signing in again; initial login itself does not reload. Logout cannot reverse already accepted server writes, so old callbacks are fenced instead. Browser-engine BFCache behavior and the local stack still need recorded execution before production promotion.

Keep PR #660 draft pending root review and browser release evidence. No new caching is introduced. Ship independently of the event tabs/navigation work.
