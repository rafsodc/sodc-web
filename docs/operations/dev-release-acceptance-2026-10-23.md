# Dev release acceptance — 23 October 2026

**Release acceptance is not complete.** The live 2,000-state reconciliation
finished correctly but exceeded its five-minute schedule interval. Do not
expand to 10,000 states or approve Beta/production until the performance
finding is resolved and the baseline passes again.

## Candidate and completed browser checks

- Integration Functions source: `ef89c37db8b76300bb4b6a6673776fd511c8b2ea`.
- Dev Hosting runtime: `20467ad228ed233b0309e14df749b365657a8a15`.
- Acceptance tooling and CI: `b3c00007b106af3f37de454e8e21e11d5576af63`.
  Application/Functions sources are unchanged between the hosting/tool commits.
- PR #667 fixes cold-auth Profile and Account Settings links by waiting for the
  initial Auth result and preserving the validated path, query and fragment
  through sign-in. This closes the startup/reload part of #647; its broader
  canonical-navigation work remains open.
- All eight CI checks passed at the tooling commit. Local validation included
  1,060 frontend tests, 1,514 Functions tests, lint, Dev builds and focused
  benchmark/lifecycle/provider tests (80 passed). The verified Hosting stage
  passed its environment audit with 29 passes, zero failures, three warnings
  and one authenticated-smoke skip.
- All seven live signed-token browser scenarios passed: both cold reload
  routes, own-status saves in both directions with token/profile recovery,
  explicit retry following a synthetic transport failure, cross-tab logout
  and account replacement, blocked storage, and actual browser-cache
  restoration (`pageshow.persisted=true`) without the old private snapshot.
  Both owned Auth accounts and their operational fixtures were removed;
  terminal security audit ledgers were retained and real authority was unchanged.
- App Check passed on an authenticated `GetCurrentUser` HTTP 200. A fresh
  successful reCAPTCHA Enterprise exchange supplied the exact request token;
  Google signatures, project/app/user bindings and validity periods were
  independently verified. The missing Dev provider site-key linkage was
  configured; TTL, risk threshold and enforcement settings were unchanged.
  Data Connect enforcement remained UNENFORCED: this proves valid attestation
  and use, not invalid-token rejection. No separate Auth revocation lookup was
  performed. No debug bypass was used, raw tokens were not persisted, and
  network inspection was stopped.

## Actual reconciliation capacity

The original Dev roster contained seven security states. The test added 1,993
owned disabled, email-free Auth identities with opted-out PENDING profiles and
coordinator-initialized denied READY states, producing exactly 2,000 states.
It did not create admitted members or simulate a large grant backlog.

| Observation | Actual result |
|---|---|
| Measurement | `volume-2000-enabled-first` |
| Function revision | `reconcilependingsecuritytransitions-00001-rep` |
| Execution | `leg8rcckfln1` |
| Dispatch | `2026-10-23T20:05:22.417Z` |
| Completion | `2026-10-23T20:12:09.546Z` |
| Handler duration | **404,672 ms** |
| Dispatch-to-completion wall time | **407,129 ms** |
| State / pending / failed attempts | **2,000 / 0 / 0** |
| Provider result | HTTP 200; one correlated Scheduler start/finish and one handler execution |
| Five-minute cadence | **Failed** (handler exceeded 300,000 ms by 104,672 ms) |
| Configured 540-second timeout | Not reached |
| 10,000-state stress | **Not run**: baseline cadence gate failed |

This is one real denied-READY scenario, not a stable p95 or pending-grant
capacity result. Native measurement verification independently matched actual
Cloud Logging, exact roster size and unchanged real-member authority. Handler
completion was independently recorded for safe cleanup; it does not change
the failed performance verdict.

An earlier operator launch was definitively rejected with HTTP 400 because
Cloud Scheduler requires the job to be ENABLED for RunJob. Fresh audits proved
no execution; that rejected arm was archived and retired without a capacity
measurement. The replacement enabled the exact original job briefly, verified
its next-run margin, submitted one RunJob request, and confirmed PAUSED one
second later. No accepted or uncertain dispatch was retried.

Source review identifies 6,007 sequential logical database/Auth SDK operations
for a healthy 2,000-state sweep. Conservative batched reads for healthy
non-admin records are a candidate optimization; every admin, pending, drifted,
missing or uncertain case must retain fresh coordinator checks before writes.
No performance implementation has been applied or deployed during acceptance.

Cleanup **verified**: all 1,993 created Auth identities and their operational
rows were removed, every one of the 9,993 reserved manifest slots was checked,
and the original counts were restored (9 Auth identities / 8 profiles / 7
security states). Both existing administrators remain healthy; real authority
and configuration fingerprints match the baseline. Terminal security/audit
ledgers were retained. The original reconciliation job is ENABLED, and the
local project-owner and active-process locks were removed. Cleanup receipt
SHA-256: `88d0554eb7e0188097d0a0039d354117fcdc50113c6834b7529360fd563ba555`.
Performance follow-up: [#669](https://github.com/rafsodc/sodc-web/issues/669).

## Current notification delivery

**Not run: blocked by a reproduced retry-cap race. No email was sent and no
notification test fixture was seeded.** The explicitly approved recipient was
verified as currently eligible; the reviewed template and one-UID recovery
fixture were prepared and tested offline.

Two overlapping recovery workers can each hold a candidate at attempt 5.
After one leaves the current ledger FAILED at attempt 6, the other worker's
stale candidate still passes the outer recovery check. The fresh inner claim
has no recovery-attempt ceiling and can claim attempt 7. This was reproduced
against the installed production recovery engine and send-once code. Retained
terminal SENT/SKIPPED keys prevent later sends after terminal success/disposal,
but do not remove the failed-attempt race before terminalization.

The single-message test is withheld until that claim-boundary defect is fixed.
No artificial scheduler freeze or direct provider send is used to hide it.
Notification follow-up: [#670](https://github.com/rafsodc/sodc-web/issues/670).

## Separate finding

[#668](https://github.com/rafsodc/sodc-web/issues/668) records a pre-existing
organiser-guest announcement callback parser defect. Colon-containing guest
IDs are truncated and their delivery history remains stale. A separately
reviewed private candidate and focused tests exist; no fix has been applied or
deployed, and ambiguous historical mode-suffix references require an explicit
compatibility decision.


## Acceptance tool corrections

The first cleanup query failed schema validation before any database deletion:
Data Connect forbids `_or` beside scalar fields in one filter object. The fix
places the unchanged scalar ownership/state guards and exact UID-operation
pair disjunction in separate `_and` operands. Offline schema compilation and a
forced-rollback Dev transaction validated the correction before cleanup resumed;
all before/after observations were unchanged during that probe. A regression
models the actual filter constraint and checks every denied-READY predicate,
exact pair ownership and preservation of real rows.

Stress setup now also rejects a latest completed baseline if either handler
or wall time reaches 300 seconds. Boundary tests include this actual slow run
and verify rejection before scheduler, checkpoint or fixture writes. Factual
`completed:true` history remains intact. These are operator-tool changes;
application and deployed Functions sources were unchanged.

After these corrections, all 13 deployment-safety test files passed (282
tests), and targeted lint passed. The application and Functions suites were
not rerun because their sources did not change.

## Evidence and remaining release work

Private receipts retain exact manifests, source/configuration hashes, immutable
launch journals, actual provider logs and verified cleanup observations.
They contain no persisted raw browser tokens. No current notification callback
proof exists because that live test was blocked. The aggregate receipt is held
outside the repository; this document contains the sanitized findings.

1. Fix reconciliation's cadence failure and repeat actual 2,000-state acceptance.
2. Only after that passes, run 10,000-state stress and report its independent result.
3. Fix #670 and complete the approved single-recipient live notification check,
   including actual delivery/callback evidence and duplicate observation.
4. Review the full acceptance record before staged Beta/production rollout.

No Beta or production deployment was performed or approved by this acceptance.
