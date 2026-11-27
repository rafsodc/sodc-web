# Startup UI chunking (#650)

This frontend slice moves later-used controls out of the eager UI bundle. It
keeps the shell, Home, auth/onboarding/guest forms, theme engine and transition
helpers together, and uses one shared `mui-task` chunk for heavier controls used
by section, booking and administration tasks. Auth, App Check, data reads,
session/cache fences and mutation recovery are unchanged.

## Choice of boundary

The comparison baseline is main `21df99412a190e079164d318c86b8597b14ddc2b`.
Dependencies, application source and inert public Firebase configuration are
identical across the pair. The candidate changes chunk assignment and adds
build validation; business logic is unchanged.

The original PR boundary reduced startup by 51,629 gzip bytes (16.7%). Review
identified an unmeasured first-use cost on signed-out routes. An additional slow
one-pair pilot found Home 274 ms sooner but Sign in 261 ms later. Those are
exploratory samples, retained separately from the final cohort.

The selected boundary now keeps the full auth static control closure in core:
TextField and its Input/FormControl dependencies, Link and the onboarding
Stepper family. AuthGate imports OnboardingShell even on its sign-in branch,
so moving TextField alone would leave the same task dependency. Sign-in,
registration, reset and guest-ticket code now exclude `mui-task` and keep their
baseline file counts. Startup savings are **37,366 gzip bytes (12.1%)**; the
administration-events closure adds 1,412 bytes and one file.

Earlier conservative, cyclic and wider-task experiments remain historical. The
cyclic experiment was rejected. The final pair contains the same 12,108 module
IDs, with no duplicate ownership or static chunk cycles. Core never imports the
task chunk; the task imports core and React. React, Firebase and generated Data
Connect assets remain byte-identical. Theme/system, Emotion, FormControl and the
common transition helpers stay together.

A production build guard now checks the final emitted JS graph after Vite's CSS
and preload hooks. It rejects static cycles and an entry path to `mui-task`, with
the offending dependency chain. An actual ButtonBase-in-task control failed the
build with this diagnostic. Tests cover disconnected/self cycles, indirect
entry paths and removed CSS-only/external nodes. Changes to eager shell imports
must preserve this invariant.

This uses the pinned Rollup manual-chunk behavior and Vite's dynamic-import
preloading. One additional file is not necessarily another serial round trip:
Vite preloads a dynamic import's static dependencies in parallel. The emitted
graph and the browser, rather than chunk names alone, determine what is eager.
See the pinned [Rollup manual-chunk documentation](https://github.com/rollup/rollup/blob/v4.62.2/docs/configuration-options/index.md#outputmanualchunks)
and [Vite build optimizations](https://github.com/vitejs/vite/blob/v7.3.6/docs/guide/features.md#build-optimizations).

## Reproduce

Use Node 24, `npm ci` and installed Playwright Chromium:

```sh
node scripts/performance/on-demand-bundles.mjs \
  --baseline 21df99412a190e079164d318c86b8597b14ddc2b \
  --output .firebase/performance/650-startup-review-final.json
node --test e2e/performance/startup/*.test.mjs
node scripts/performance/startup-browser.mjs \
  --assets .firebase/performance/650-startup-review-final-assets \
  --output .firebase/performance/650-startup-browser-review-final.json \
  --pairs 10 --profile both --journey all
```

The existing graph runner builds the actual complete application twice with
identical inert public configuration and locked dependencies. Its report binds
the runtime source, configuration, emitted graphs and asset hashes. Gzip figures
are level-9 per-file estimates; they exclude HTML, headers, API responses and
deployed CDN compression differences.

The browser runner serves those complete production builds without application
aliases or a development-mode override. Every variant/journey gets a fresh
Chromium context. Both variants' files are read and gzip-compressed before any
timed navigation. CPU/network settings apply before navigation, and each pair
alternates baseline/candidate order.

The invented fixtures contain one upcoming event section, one event with
Markdown, one member ticket, one unpaid guest reservation and synthetic
administrator/member identity. Signed-out journeys seed no identity. Real
Firebase SDKs execute with narrowly intercepted Auth, App Check and read
responses; member/admin use an unsigned local Auth token. Unexpected requests,
mutations and WebSockets are blocked and fail
the sample. Only loopback GET/HEAD asset requests can be forwarded. No live
service, credentials, cloud data or email is involved.

Six independent journeys use fresh contexts: member Home → section → Markdown
About → Book → administration hub → events → Add Event; direct administration
hub → events → Add Event; signed-out Home → Sign in → Register → Reset; and
direct guest-ticket, registration and reset entry. Form edits are local and
cancelled or left unsent. Save, Sign in submit, Create account, reset send, guest
Save/Pay and checkout are never activated.

The same adapter also has a fixed recovery-only inert identity for actual-App
CI tests. Only the measurement and recovery profiles are accepted; arbitrary
projects are refused before context setup. This adds no application mode or
source aliases. CI runs the transport, graph and statistics controls through
`node --test e2e/performance/startup/*.test.mjs` before the root build.

Paired statistics join successful samples by profile, journey and pair ID.
`--keep-going true` retains failures and labels unmatched pairs; an incomplete
run exits nonzero. It cannot pair an older surviving baseline with another
pair's candidate. Marginal medians and matched-pair counts are reported
separately. Runner, fixture, statistics helper and served assets are hash-bound.

Readiness is destination-specific correct DOM over two animation frames,
observed before entry execution or before the real click. It is not paint/LCP
or React commit timing. Normal is CPU1 without network throttling. Slow is
150 ms latency, 200,000 B/s down, 93,750 B/s up and CPU4 at 1280×800.

These are local HTTP/1.1 Chromium measurements, not Firebase Hosting HTTP/2/3
or live authentication, App Check attestation, Functions/database or Notify
latency. Interception disables the HTTP cache; later steps reuse evaluated
modules in the same document. SDK fulfillment is synthetic and does not model
backend delays. CPU/observer fields are diagnostic: observations accumulate and
CPU windows include instrumentation/driver work. Use paired DOM-readiness
deltas and emitted-byte graphs for conclusions. Ten samples support medians
and ranges; the maximum would be a weak p95 estimate. There is no CI timing
threshold.

## Results — 27 November 2026

The [compact results](650-startup-chunking-results.json) retain all 21 build
scenarios, every paired timing and range, observed encoded bodies and source
hashes. Node 24.22.0, Vite 7.3.6 and Chromium 156.0.8078.4 were used. The measured
candidate was uncommitted and is identified by its recorded runtime/build-input
fingerprint `1533153f96ecbd4d326c76a00d3a928e2dd85469441e2d3b5fb8df9ca2b0d6b2`;
the parent commit alone does not identify it. The snapshot includes both build
guard files. The executed runner, fixture and statistics helper are bound
separately in the browser report.

These are cumulative source-derived JS gzip estimates, including startup. CSS
is unchanged. The critical signed-out routes keep their original file counts.

| Requested code | Baseline bytes | Candidate bytes | JS files, before → after |
| --- | ---: | ---: | ---: |
| Startup | 308,968 | 271,602 | 5 → 5 |
| Public Home | 309,679 | 272,317 | 6 → 6 |
| Sign in | 317,040 | 279,698 | 14 → 14 |
| Register | 316,182 | 278,825 | 11 → 11 |
| Password reset | 312,617 | 275,260 | 8 → 8 |
| Guest ticket | 311,026 | 273,667 | 8 → 8 |
| Member Home | 312,809 | 275,448 | 11 → 11 |
| EVENTS list | 322,334 | 323,695 | 17 → 18 |
| Markdown About | 359,425 | 360,789 | 19 → 20 |
| Book | 338,437 | 339,837 | 23 → 24 |
| Administration hub | 312,670 | 275,333 | 9 → 9 |
| Administration events | 409,553 | 410,965 | 24 → 25 |

All **240 runs / 680 readiness observations passed**, with zero unexpected
requests or browser errors. Every summary has ten complete pair IDs and no
unmatched observations. Synthetic request counts are identical between
variants: member 14, administration 7, public 2, guest 3, register 2 and reset 2
per run. Asset and executed-source end hashes match. The final raw report is
`.firebase/performance/650-startup-browser-review-final.json`, SHA-256
`28895fb83eaa73a3d37ab0d5ec6bdea065fa89b5a922aa7420d52f20f1cf5e1e`.

Slow-profile DOM readiness, milliseconds. Paired changes are computed before
taking their median, so they need not equal the difference between the two
separate medians. The compact result retains every range and individual value.

| Journey / step | Baseline median | Candidate median | Paired median change |
| --- | ---: | ---: | ---: |
| Member: cold Home | 2,540.4 | 2,342.1 | −195.6 |
| Member: first section | 467.5 | 616.6 | +141.8 |
| Direct administration: cold hub | 2,525.1 | 2,340.2 | −187.8 |
| Direct administration: first Events | 830.7 | 1,031.9 | +201.4 |
| Public: cold Home | 2,406.4 | 2,208.8 | −198.0 |
| Public: first Sign in | 426.5 | 431.0 | −1.8 |
| Direct usable guest ticket | 2,372.9 | 2,178.8 | −201.9 |
| Direct Register | 2,408.6 | 2,214.8 | −190.5 |
| Direct password reset | 2,406.5 | 2,210.5 | −195.8 |

Normal-profile paired median changes range from −4.7 to +1.2 ms, with little
demonstrated timing benefit. Sign in has no added task file: its observed JS
bodies are 8,072 → 8,096 bytes in nine requests in both variants. Direct guest,
registration and reset bodies match the cumulative graph totals above. These
are local encoded JS bodies, separate from deployed transfer sizes.

Private task costs remain explicit. After member Home, the first section loads
12,010 → 50,735 JS bytes (8 → 9 requests). After direct administration startup,
Events loads 96,883 → 135,632 bytes (15 → 16). This largely moves the hub's
startup saving to its first Events interaction; no overall administration
speedup is established. Later tasks reuse the loaded control chunk. Keep this
first-use trade-off in Dev acceptance alongside the signed-out improvement.

The original 16.7% boundary and its measurements remain historical in Git and
the sealed original archive. Exploratory/setup failures and the one-pair
decision pilots remain separate from this final cohort. A fresh complete
matrix was needed because the selected application chunk boundary changed.
Both graph builds retain the same existing mixed static/dynamic Firebase import
notice. No new cycle is accepted or suppressed.

## Validation and release acceptance

The final frontend coverage gate passes **163 files / 1,853 tests**, with 86.24%
statements, 82.68% branches, 82.90% functions and 87.93% lines. Root lint and the
TypeScript/production build pass; all **13 production-browser regression tests**
and all **33 transport, graph and statistics controls** pass. No deadlines or
thresholds changed.

Production-browser regressions cover cold public Home and sign-in without a
task request, real light/dark theme changes with a retained input, and actual
member navigation to styled, keyboard-usable deferred Tabs and booking controls.
A missing task asset permits a bounded one or two failed preload/import fetches,
then requires manual reload; the reload recovers the same route with one success.
Existing pending-write/account-switch recovery cases remain. Setup/sandbox and
selector-readiness failures are retained separately from the passing final run;
no deadlines or thresholds changed.

Before Production, compare the reviewed candidate on Dev with the same existing
account/data and pre-navigation profiles. Include cold Home, immediate first
section, direct administration entry, booking/event drafts, theme changes,
logout/account switch while code is pending and missing-chunk manual recovery.
Time signed-out Home → sign-in and direct guest, registration and reset entry too.
Do not infer a live speed percentage from this local fixture. Section-code
intent preload remains a separate future PR; this change adds no speculative
imports or hidden data reads. #650 remains open.
