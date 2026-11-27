# Startup UI chunking (#650)

This frontend slice moves later-used controls out of the eager UI bundle. It
keeps the shell, Home, theme engine, shared form context and transition helpers
together, and uses one shared `mui-task` chunk for controls used by section,
booking and administration tasks. Auth, App Check, data reads, session/cache
fences and mutation recovery are unchanged.

## Choice of boundary

The comparison baseline is main `21df99412a190e079164d318c86b8597b14ddc2b`.
Only `vite.config.ts` changes application output. Installed dependencies,
application source and build settings are identical across the pair.

Three local experiments informed the boundary:

- A conservative input-control split removed 21,222 startup gzip bytes. It added
  one file and 623 bytes to the cumulative administration-events closure.
- A broader split initially moved shared transition/Babel helpers into the task
  chunk. That created a core/task cycle and pulled the task back into startup;
  startup grew by 775 bytes. That experiment is retained and rejected.
- The selected boundary explicitly keeps those shared helpers in the core. It
  removes 51,629 startup gzip bytes, with one additional file and 711 bytes in
  the cumulative administration-events closure.

Both selected graphs contain the same 12,108 module IDs, with no duplicate
ownership or static chunk cycles. Core never imports the task chunk; the task
imports core and React. React, Firebase and generated Data Connect assets remain
byte-identical. MUI theme/system, Emotion and the form-context helpers stay in
core; moving the actual `FormControl` component does not move its context.

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
  --output .firebase/performance/650-startup-final.json
node --test e2e/performance/startup/fixture.test.mjs
node scripts/performance/startup-browser.mjs \
  --assets .firebase/performance/650-startup-final-assets \
  --output .firebase/performance/650-startup-browser-final.json \
  --pairs 10 --profile both --journey both
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

The invented fixture has one upcoming event section, one event with Markdown,
one ticket and a synthetic administrator/member. Real Firebase SDKs execute with
an unsigned local Auth token and narrowly intercepted Auth, App Check and read
responses. Unexpected requests, mutations and WebSockets are blocked and fail
the sample. Only loopback GET/HEAD asset requests can be forwarded. No live
service, credentials, cloud data or email is involved.

The member journey is cold Home → section → Markdown About → Book → section
administration hub → events → Add Event. A separate cold administration journey
starts directly at the hub, then opens events and Add Event, so prior member
tasks cannot hide a first-use administration cost. Each form check fills and
cancels an unsaved local title; no save or checkout is activated.

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

The [compact results](650-startup-chunking-results.json) retain every scenario,
all paired timings/ranges and the report/source hashes. Node 24.22.0, Vite
7.3.6 and Chromium 156.0.8078.4 were used. The measured candidate was uncommitted;
its complete runtime/build-input fingerprint is
`a85b262b5cdc242237f41685e95050481f18dc850b376018f09da3e713f632be`.
The base commit alone does not identify that candidate.

The following figures are cumulative source-derived JS gzip estimates, including
startup. CSS is unchanged. The compact result also includes the other routes.

| Requested code | Baseline bytes | Candidate bytes | JS files, before → after |
| --- | ---: | ---: | ---: |
| Startup | 308,968 | 257,339 | 5 → 5 |
| Member Home | 312,809 | 261,183 | 11 → 11 |
| EVENTS list | 322,334 | 323,007 | 17 → 18 |
| Markdown About | 359,425 | 360,134 | 19 → 20 |
| Book | 338,437 | 339,139 | 23 → 24 |
| Administration hub | 312,670 | 261,074 | 9 → 9 |
| Administration events | 409,553 | 410,264 | 24 → 25 |
| Administration files | 316,583 | 317,243 | 12 → 13 |
| Administration announcements | 329,685 | 330,341 | 14 → 15 |

Startup falls **51,629 bytes (16.7%)**. The full administration-events closure
grows 711 bytes and one file. This avoids the earlier exploratory all-or-nothing
split's 46-file administration closure; it still adds a first-use download.

All **80 browser runs / 400 readiness observations passed**, with zero unexpected
requests or browser errors. Synthetic transport counts are identical between
variants: 14 per member run and 7 per administration run. Served assets and
harness sources passed the end-of-run hash checks. The final raw browser report
is `.firebase/performance/650-startup-browser-final.json`, SHA-256
`0056666d81a7d901fbf66de89fbf412dfe79b2dd55f17e82a90bb05f691afd73`.

Slow-profile readiness, milliseconds. Each row has ten pairs; paired differences
are calculated before taking their median, so they need not equal the difference
between the two separate medians.

| Journey / step | Baseline median | Candidate median | Paired change, median (range) |
| --- | ---: | ---: | ---: |
| Member: cold Home | 2,555.1 | 2,297.6 | −259.3 (−274.6 to −247.3) |
| Member: first section | 482.1 | 665.2 | +183.4 (+178.4 to +202.4) |
| Direct administration: cold hub | 2,555.4 | 2,289.8 | −266.6 (−283.7 to −236.2) |
| Direct administration: first Events | 845.7 | 1,110.6 | +266.8 (+248.5 to +350.4) |

Normal-profile paired median changes range from −2.3 to +0.8 ms, with little
demonstrated timing benefit. Other slow-profile paired median changes range from −2.4 to
+6.3 ms. The first section now transfers 64,313 rather than 12,010 encoded JS
bytes (9 rather than 8 files), following a cold Home transfer of 261,900 rather
than 313,520 bytes (12 files in both). These are observed local encoded bodies,
separate from the source-derived startup estimates above.

The cold administration benefit moves almost entirely to first Events: that
step transfers 149,190 rather than 96,883 encoded JS bytes (16 rather than 15
files). This establishes earlier hub readiness and a later first-task wait,
with no demonstrated overall administration speedup. Keep the boundary for its
smaller startup payload and earlier slow-profile Home; carry the first-use cost
into Dev acceptance. Section-code intent preload can be assessed separately.

The original 40-run member-first matrix, exploratory adapter failures, the
cyclic split and both alternative build reports are retained as historical
evidence. They are not substituted for the final cohort. The repeated matrix
was needed to isolate administration's first use and binds one final harness.
The final graph refresh emits identical application assets to the selected
experiment; only the deployment manifest's build timestamp changes. Both graph
builds retain the existing mixed static/dynamic Firebase import notice, with no
new chunk cycle.

## Validation and release acceptance

The final frontend coverage gate passes **163 files / 1,853 tests**, with 86.24%
statements, 82.68% branches, 82.90% functions and 87.93% lines. Root lint and the
TypeScript/production build pass; all **12 production-browser regression tests**
and all **10 transport controls** pass. The first browser run passed its tests
but the warning wrapper rejected an inherited `NO_COLOR`/`FORCE_COLOR` conflict;
clearing `NO_COLOR` produced a clean run, and the later strengthened theme
assertion also passed the complete suite. No deadlines or thresholds changed.

Production-browser regressions cover cold public Home without the task chunk,
first sign-in control use, real light/dark theme changes with a retained input,
and a missing shared-control asset followed by explicit reload. Existing
deployment-recovery cases retain their pending-write/account-switch coverage.
The synthetic transport controls reject mutations, wrong fixture IDs, real
projects, unlisted reads/callables, lookalike hosts and nonstandard ports.

Before Production, compare the reviewed candidate on Dev with the same existing
account/data and pre-navigation profiles. Include cold Home, immediate first
section, direct administration entry, booking/event drafts, theme changes,
logout/account switch while code is pending and missing-chunk manual recovery.
Sign-in controls are a new first-use boundary and need a live smoke check too.
Do not infer a live speed percentage from this local fixture. Section-code
intent preload remains a separate future PR; this change adds no speculative
imports or hidden data reads. #650 remains open.
