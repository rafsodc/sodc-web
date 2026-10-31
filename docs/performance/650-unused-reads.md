# #650 first slice: unused-read component measurement

Historical first experiment. The [revised navigation design](650-navigation.md)
addresses the measured cold-load and Back regressions before release.

This slice removes unused section reads; it does not implement the complete #650
cache or profiling backlog. The benchmark runs locally with synthetic fixtures,
without Firebase configuration, credentials, emulators, cloud calls or writes.

## Reproduce

Use Node 24 and the repository's installed dependencies and Playwright Chromium.
From the repository root:

```sh
node scripts/performance/unused-reads.mjs .firebase/performance/650-unused-reads.json
```

Harness-only checks: `npx tsc -p e2e/performance/unused-reads/tsconfig.json`
and ESLint on `scripts/performance/unused-reads.mjs` plus the fixture TS/TSX files.

The default is ten runs per source variant, scenario and network profile: 160
samples. `SODC_PERF_RUNS=1` provides a short smoke run, not the reported baseline.
The optional `SODC_PERF_BASELINE` selects another Git reference; the default is
`77acae6cc3daba8660b8c9e85bedca7ec8bd7bc2`. Git must retain that source revision.
The script builds in a fresh temporary directory, binds only loopback, blocks
nonlocal browser requests and rejects writes. It removes its build/server/browser
resources on completion. The summary and adjacent `.samples.jsonl` file are retained
after temporary build cleanup. With no output argument, they default to
`.firebase/performance/unused-reads*`. The committed summary records raw sample
count/SHA-256; raw samples remain local under the ignored `.firebase/performance/`.

## What is measured

Both variants use the actual `SectionDetail.tsx`: baseline through `git show`,
candidate from the working tree. Their source SHA-256 values are recorded. They
share current React/MUI/router dependencies and real parent state, effects,
filtering, sorting and request guards. Query/auth adapters are inert, already
loaded access-group/navigation data is fixed, and heavy child views are replaced
by lightweight readiness/navigation surfaces. This is a production Vite build,
without StrictMode or React's profiling build; it is not a full application build.

Fixtures contain 1,000 synthetic directory records and 25 synthetic events. The
four scenarios are an EVENTS list, cold direct event, MEMBERS directory, and
EVENTS list → event detail → Back. Each source/scenario/profile gets a fresh
browser context; variant order alternates to reduce systematic warmup bias.

Normal uses unthrottled loopback/CPU. Slow uses Chromium CDP throttling: 150 ms
latency, 1.6 Mbps download, 750 Kbps upload, 4× CPU. Static assets are loaded
*before* throttling and measurement; initial bundle/route-download cost is absent.
Local JSON responses have no artificial backend compute delay and no compression.

- Operation counts cover the four parent section/event callables only.
- JSON bytes are exact UTF-8 response bodies. Browser ResourceTiming separately
  records encoded/decoded bodies and transfer bytes; these are synthetic HTTP
  GETs, not Firebase callable/TLS/protobuf costs.
- Ready time starts in the click handler and ends in the expected child's layout
  effect after correct data commits. It is DOM-ready time, not paint, FCP or LCP.
  Back/detail phases are recorded separately. Median/p95 use nearest-rank values;
  with ten samples the p95 is the largest observation, not a reliable tail model.
- CDP main-thread task/script/layout/style durations and browser long tasks are
  recorded. They include the parent and lightweight children; they are not an
  isolated React render duration or a production performance guarantee.
- The runner waits for outstanding reads before taking final counts, so an
  unused directory request is counted even if the visible page became ready first.

## Results and interpretation

Measured 31 October 2026 with Node 24.22.0 / Chromium 156.0.8078.4, ten runs for
every source/scenario/profile combination (160 samples). Candidate source SHA-256
was `ffa8887d18bedd8668fbe1b1bccdf5403092238c1efa587b38c70d022134cc0f`
throughout the run. [Committed aggregates](650-unused-reads-results.json) include
the baseline hash, raw sample count/hash, exact counts/bytes and timing statistics.
The local raw artifact is `.firebase/performance/650-unused-reads.samples.jsonl`.
No browser/read errors or unexpected requests occurred. Browser encoded/decoded
body totals matched server JSON bytes in all 160 samples.

Counts and payloads were identical across all runs/profiles of each variant:

| Scenario | Tracked calls, baseline → candidate | JSON bytes, baseline → candidate | Payload reduction |
| --- | --- | --- | --- |
| EVENTS list | 3 → 2 | 181,152 → 6,466 | 96.4% |
| Direct event | 4 → 2 | 181,503 → 506 | 99.7% |
| MEMBERS | 3 → 2 | 181,153 → 174,842 | 3.5% |
| List → detail → Back | 4 → 4 | 181,503 → 13,128 | 92.8% |

EVENTS makes no directory call; MEMBERS makes no event-list call; direct event
makes neither unused call. The roundtrip replaces one directory read with a second
event-list read on Back, so its total call count does **not** fall.

Cold correct-DOM readiness, milliseconds (median / p95):

| Profile / scenario | Baseline | Candidate |
| --- | --- | --- |
| Normal / EVENTS | 46.1 / 53.7 | 41.5 / 44.3 |
| Normal / direct event | 47.1 / 49.7 | 43.0 / 46.6 |
| Normal / MEMBERS | 46.2 / 48.9 | 45.4 / 50.0 |
| Normal / roundtrip initial list | 46.0 / 49.7 | 43.3 / 44.7 |
| Slow / EVENTS | 268.2 / 275.2 | 392.4 / 404.6 |
| Slow / direct event | 212.0 / 218.8 | 358.6 / 369.7 |
| Slow / MEMBERS | 1,126.8 / 1,134.0 | 1,246.5 / 1,258.9 |
| Slow / roundtrip initial list | 267.7 / 272.3 | 392.8 / 401.8 |

Roundtrip navigation, milliseconds (median / p95):

| Profile / phase | Baseline | Candidate |
| --- | --- | --- |
| Normal / detail | 18.9 / 19.3 | 19.3 / 20.9 |
| Normal / Back | 15.3 / 17.2 | 18.7 / 20.2 |
| Slow / detail | 182.8 / 186.1 | 180.4 / 184.0 |
| Slow / Back | 13.8 / 16.0 | 206.9 / 214.5 |

The slow cold views became **slower**, by about 120–147 ms at the median: the
candidate waits for matching metadata before starting its needed content read,
whereas baseline starts reads in parallel. Back also waits for a fresh event list
instead of retaining baseline's loaded list. This is an explicit round-trip cost
of the first slice, not evidence of faster site navigation. A later reviewed
metadata/summary reuse design can address it without restoring unused reads.

Median main-thread task time over the complete sample, including outstanding
reads (normal baseline → candidate; slow baseline → candidate, milliseconds):
EVENTS 47.7 → 39.7 / 142.6 → 123.3; direct event 46.2 → 42.7 / 138.3 → 120.5;
MEMBERS 46.4 → 43.0 / 137.9 → 143.2; roundtrip 56.9 → 54.4 / 188.6 → 156.7.
No long tasks were observed in this lightweight fixture. These figures do not
establish the full UI's render cost or a real-service latency benefit.

## Boundaries and remaining work

This synthetic comparison proves request elimination and illustrates its timing
trade-offs under fixed conditions. It does not prove live-site latency, server
authorization, logout safety, App Check behavior or the complete booking UI.
Separate behavioral tests exercise request selection, saved-refresh outcomes and
late-result fences; those assertions are not live-site acceptance. No private data,
headers, tokens, account identifiers or full application responses are retained.

Home → section request sharing, short-lived summary caching, admin task/bundle
profiling, real-browser full-journey measurements and broader #650 invalidation
and identity-isolation acceptance remain explicit follow-up work. No production
shared/persistent data cache or server authorization policy is added. The fixture
stores only inert variant/scenario labels in sessionStorage inside each isolated
browser context, which is discarded after its sample.
