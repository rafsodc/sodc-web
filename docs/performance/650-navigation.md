# Section and Home navigation performance

This part of #650 reduces both unnecessary work and waits between dependent
requests. It leaves the remaining bundle and full-application profiling work open.

## Changes

- A cold member-facing section requests metadata and only its required initial
  content through the existing `getSectionForUser` callable. The server chooses
  the content from the actual section type. A direct event request includes its
  event ID and checks that event's parent, including for administrators.
- The bundle reuses one current-account and section-access decision instead of
  repeating it in a second callable. Directory consent, profile review, email
  verification, population limits and rate limiting use the existing rules.
- Metadata-only callers retain their existing response. Older Functions that
  omit bundled content work with the new frontend through targeted fallback reads.
  A partial content failure retains verified metadata and presents an explicit
  read-only retry rather than silently issuing another request.
- Home and section lists share event summaries through the document's existing
  TanStack Query client: 30-second freshness, five-minute inactive retention,
  canonical section IDs and concurrent-request deduplication. A valid list is
  reused on Back and subsequent Home visits; pending Home reads can also be shared.
- Section metadata and moderator authority are checked afresh. Event detail and
  booking data, directory/contact information, payment information and tokens do
  not enter this new shared summary cache. No data is persisted to browser storage.

## Freshness and isolation

Summary keys include UID, session generation and the authorization-read epoch.
Cache hits pass `runSessionRead`, including its blocked/suspended/retired-session
checks. The existing `PrivateSessionBoundary` clears the QueryClient at logout,
account replacement and document retirement. Own-status changes use new keys;
Home also hides old rows while the authority scope changes. Ordinary permission
denials remove previously displayed cards and summaries.

Access/section changes, booking refreshes and event/ticket edits invalidate these
summaries. Subscription and event/ticket invalidation starts before a write
attempt, so a committed write with a lost response cannot leave the old list fresh. Explicit retries
bypass the TTL and propagate refresh errors. Invalidation removes pending query
entries and advances a per-client fence; late query results and page bundles
cannot restore them. Bundle consumption checks the fence again and discards
content for a different route or surface.

Remote edits by another browser can remain in summaries for up to the 30-second
freshness period on subsequent reads. This is summary freshness, never proof of
current write permission or booking availability. A continuously mounted Home
view is not a live subscription; shortening that interval or adding a background
refresh needs a separate measured decision.

## Reproduce the local comparison

Use Node 24, locked repository dependencies and installed Playwright Chromium:

```sh
node scripts/performance/unused-reads.mjs .firebase/performance/650-navigation.json
npx tsc -p e2e/performance/unused-reads/tsconfig.json
```

The runner production-builds the actual baseline/candidate SectionDetail and Home
hook. It uses real QueryClient/session-read/cache helpers, with synthetic identity,
inert Firebase transports and lightweight child views. It binds loopback only,
rejects writes and blocks nonlocal requests. Ten alternating paired repetitions
cover five journeys under normal and slow conditions: 200 samples. The extended
Home journey has three event sections, with 25 events per section; the directory
fixture has 1,000 synthetic members.

Slow conditions are 150 ms network latency, 1.6 Mbps download, 750 Kbps upload and
four-times CPU throttling. Assets load before timing. JSON GET bodies replace
Firebase's callable protocol. The local bundle models one combined response; it
does not execute Functions or model its database/Auth processing time. Functions
tests independently check the reduction in repeated authority/section reads.

The runner records exact request/JSON counts, browser transfer sizes, click to
correct-DOM times, main-thread task time and long tasks. DOM readiness is recorded
in a layout effect, not a paint/LCP measurement or isolated React render duration.
With ten repetitions, nearest-rank p95 is the largest sample and is not a reliable
tail estimate. It records source hashes and retains raw synthetic samples with
their hash. This is not a full-application, real-Firebase or browser-cache test.

## Results

Validation: 151 frontend files / 1,499 tests pass with coverage thresholds met
(85.19% statements, 81.36% branches, 81.40% functions, 86.84% lines). The Functions
suite passes 133 files / 2,055 tests and its coverage thresholds. Both applications'
lint and production builds pass, as do the dedicated probe TypeScript checks.
Focused regressions cover bundle selection/failures, old-backend fallback,
summary reuse/expiry, ambiguous writes, ignored cancellation, stale bundles,
permission loss and account/authorization isolation.

The [frozen-source comparison](650-navigation-results.json) completed on
31 October 2026 with Node 24.22.0 / Chromium 156.0.8078.4. All 200 samples passed,
with no browser/read errors or unexpected requests. Browser encoded/decoded body
totals matched server JSON totals in every sample. Executed-source hashes and
the unexecuted backend-contract hash remained unchanged. Raw samples are retained
locally at `.firebase/performance/650-navigation-final.samples.jsonl`, SHA-256
`5526117902535573be71849be37c05afed15276a4247fe1d1a879fbc178c0bdf`.

| Journey | Tracked calls, baseline → candidate | JSON bytes, baseline → candidate |
| --- | --- | --- |
| Cold EVENTS list | 3 → 1 | 181,152 → 6,510 |
| Cold direct event | 4 → 1 | 181,503 → 549 |
| Cold MEMBERS directory | 3 → 1 | 181,209 → 174,887 |
| List → detail → Back | 4 → 2 | 181,503 → 6,861 |
| Home → section → detail → Back → Home | 10 → 5 | 219,593 → 19,551 |

Slow-profile correct-DOM readiness, milliseconds (median / p95):

| View or phase | Baseline | Candidate |
| --- | --- | --- |
| Cold EVENTS list | 262.7 / 274.4 | 229.9 / 234.6 |
| Cold direct event | 214.2 / 222.7 | 198.5 / 211.3 |
| Cold MEMBERS directory | 1,119.5 / 1,135.2 | 1,083.3 / 1,095.0 |
| Roundtrip Back | 14.2 / 16.1 | 17.1 / 18.9 |
| Home journey: cold Home | 284.0 / 288.2 | 287.4 / 291.2 |
| Home journey: section | 274.4 / 282.3 | 203.7 / 216.5 |
| Home journey: return to Home | 315.5 / 321.6 | 16.4 / 20.0 |

Back and the candidate Home return make no fresh request in these journeys.
The largest measured benefit is warm Home reuse, while cold Home is unchanged.
Cold sections avoid the first experiment's metadata/content HTTP waterfall.
These local results do not establish the deployed bundle's total latency:
Functions database/Auth compute is not simulated, and a combined response can
delay the first header until its content is ready.

There are costs rather than a universal improvement. Cold Home is slightly
slower, and cached Back adds a few milliseconds in the slow fixture. Task-duration
results are mixed: slow MEMBERS median main-thread task time increases
138.9 → 155.9 ms, and the full Home journey 182.8 → 208.7 ms, despite lower
navigation waits. Normal MEMBERS readiness improves 46.5 → 44.9 ms. No long tasks
were observed in the lightweight fixture. The aggregate retains every
phase/profile and task metric; these are not isolated React render timings, and
OS/background load is not controlled. Further CPU work needs full-UI profiling.

The earlier [unused-read-only experiment](650-unused-reads.md) and [its
aggregates](650-unused-reads-results.json) remain as historical evidence: its
metadata waterfall and Back refetch made slow navigation worse, which is why that
implementation was revised before release. Check out `ab8e95a` to reproduce that
earlier implementation and runner.

## Remaining performance work

The source/build audit found these candidates for separate measured changes:

1. Split member/event task code further. `SectionDetailViews.tsx` imports the
   contact dialog, booking wizard, Markdown details and attendees for directory
   and list routes too. Load these when their task opens, keeping required state.
2. Review initial vendor payload, including optional Analytics bundled with the
   eager Firebase vendor chunk. Existing route-level lazy imports already help;
   avoid creating extra request chains just to make individual chunks smaller.
3. Gate `useUnenabledProfileCheck` on the enabled claim being resolved, so ordinary
   enabled accounts do not start an avoidable profile-existence probe during
   startup. Verify recovery/onboarding orderings before changing this.
4. Give Home a lighter upcoming-event summary response. It still makes one cold
   callable per event section and receives full event history before filtering.
   Measure section count and payload size before choosing aggregation/pagination.
5. Measure full signed-in journeys in Dev after review and deployment, including
   real server/Auth/App Check time and a large directory. Compare first usable
   header as well as complete content; a combined response waits for its content.

No shared metadata permission cache, component memoization, persistent private
cache, database schema change or deployment is included here.

After review and merge, release the compatible Functions change to Dev before
Hosting, then measure full signed-in navigation with real service timings and
test save/retry/logout paths. Old Hosting continues to use metadata-only calls;
old Functions remain compatible through the frontend's fallback. A Hosting
rollback does not depend on rolling back Functions or migrating data.
