# On-demand view code measurement (#650)

This slice measures startup and task code independently from the data-read work in #696. The comparison uses the actual application production build and Rollup's module graph. It does not measure live page speed.

## Implementation

Member event descriptions, booking and attendee panels now load when their tab is requested. The event hero and tabs remain available while code loads. Once visited, the booking panel stays mounted across tab and history navigation to retain its draft. Each panel has its own loading/error boundary, so another panel failing does not discard that booking state.

Section administration loads only its selected events, files or announcement destination. A direct URL starts that public code import alongside existing permission checks; private components still mount only after those checks succeed. Resource keys reset a boundary when its destination changes, while task changes within the same event preserve its manager state.

The app shell no longer imports the unused Firebase Analytics helper. The disabled-account profile-existence check waits for this account's enabled claim to resolve, avoiding an unnecessary onboarding query during a normal member startup. Existing session and account guards remain in place.

Code-import promises are shared by URL-intent preload and React.lazy, including failures. A missing chunk offers the existing explicit reload recovery with an unsaved/recent-save warning. It does not automatically retry imports, reload the page or replay writes.

## Reproduce

Use Node 24 and the repository's installed lockfile dependencies, then run from this worktree:

```sh
node scripts/performance/on-demand-bundles.mjs \
  --baseline 77acae6cc3daba8660b8c9e85bedca7ec8bd7bc2 \
  --output .firebase/performance/650-on-demand-bundles.json
```

The runner archives the exact baseline commit into a temporary directory. It reuses installed dependency packages while resolving the baseline's generated Data Connect package to the baseline source. It rejects different lockfiles, removes inherited `VITE_*` values, and supplies identical inert public configuration to both builds. It never runs the application, connects an SDK or writes cloud data. It builds into separate measurement directories, leaving the usual `dist` untouched.

The report and both complete Rollup graphs are retained beside the measurement build assets in `.firebase/performance`. The graphs include source fingerprints, module ownership, static and dynamic import edges, emitted asset hashes and deterministic gzip sizes. The runner checks final output hashes against the captured graph and rejects source changes during the comparison. A dirty candidate is identified by its source fingerprint as well as its base commit; its commit field alone does not identify the measured working tree.

## What the numbers mean

Each scenario includes the application's entry plus the static dependency closure of its requested route/task modules. Shared JS, CSS and emitted imported assets are counted once. Dynamic imports are excluded until their task is requested. Strings in Vite's preload dependency lookup table are not treated as imports.

The scenarios distinguish entry startup, public/member Home, MEMBERS directory, EVENTS list, event About with empty/nonempty Markdown, Book, Attendees, selected member contact, My bookings, section administration landing, and the events/files/announcement tasks. Every explicit member-event URL preloads its selected/default panel code while event data loads. About therefore includes the description/Markdown code even when the eventual description is empty; a directory/list URL has no event id and does not request that code. The warm journey carries a loaded-file set through Home → list → About → Book → Attendees → list → Home, reporting only additional assets at each step. Earlier visits therefore cannot double-count a shared vendor or parser chunk.

These are source-derived code paths. A static graph cannot establish when a conditional component actually renders or when a browser starts fetching its code. Runtime tests must separately cover contact-dialog selection, URL-selected/default panel preload, and keeping the visited booking wizard mounted so a tab change retains its draft. Passing tests and code size measurements do not establish live Auth, App Check, server authorization or browser performance.

`gzipBytes` is gzip level 9 applied separately to each emitted asset, not a captured transfer size. The comparison excludes the HTML document, HTTP headers, CDN compression differences, public resources not imported by modules, API payloads, execution cost and latency. Identical inert build settings make the pair comparable; deployed public configuration can produce different exact assets.

No timing threshold is added to CI. A later cold-code browser measurement must apply network/CPU conditions before navigation and record first usable UI and first-task costs. The #696 synthetic data benchmark loaded code before its timer, so it cannot prove improvements from this code split. Extra lazy boundaries can add a first-use network round trip even when they reduce initial bytes; URL-selected task code should overlap existing data reads where possible.

## Results

Measured on 31 October 2026 with Node 24.22.0 and Vite 7.3.6. The baseline is exact main `77acae6cc3daba8660b8c9e85bedca7ec8bd7bc2`; the uncommitted candidate's build-input fingerprint is `ea90b7437aa7f15fe49715523ebde71c1b6c81b14a413af8e9eedd2fe74fa22a`. The [compact result](650-on-demand-bundles-results.json) retains every scenario, raw-byte metrics, source/graph hashes and warm journey. The ignored full report is `.firebase/performance/650-on-demand-bundles.json` (SHA-256 `76e2659a4da1d8bf11c884f91db2224f8256a255cfe0238569e4f4b0c7c931dc`). Both builds' emitted-file hashes matched their final Rollup graphs and the inputs stayed unchanged during the comparison.

The table shows cumulative JS gzip estimates including startup. CSS bytes were unchanged.

| Requested code | Baseline gzip bytes | Candidate gzip bytes | Change | JS files, before → after |
| --- | ---: | ---: | ---: | ---: |
| Entry startup | 313,273 | 308,180 | −5,093 | 5 → 5 |
| Public Home | 313,986 | 308,891 | −5,095 | 6 → 6 |
| Member Home | 316,572 | 311,558 | −5,014 | 9 → 10 |
| MEMBERS directory / EVENTS list / selected contact | 375,592 | 319,519 | −56,073 | 17 → 15 |
| Event About, empty or nonempty description | 375,592 | 356,610 | −18,982 | 17 → 17 |
| Event Book | 375,592 | 334,746 | −40,846 | 17 → 21 |
| Event Attendees | 375,592 | 320,749 | −54,843 | 17 → 16 |
| My bookings | 317,296 | 312,191 | −5,105 | 10 → 10 |
| Section administration landing | 406,118 | 311,886 | −94,232 | 20 → 9 |
| Administration: events | 406,118 | 402,106 | −4,012 | 20 → 24 |
| Administration: files | 406,118 | 315,803 | −90,315 | 20 → 12 |
| Administration: announcements | 406,118 | 328,911 | −77,207 | 20 → 14 |

Beyond startup, the directory/list requires 62,319 → 11,339 gzip bytes and the administration landing 92,845 → 3,706. About still preloads the parser even for an empty eventual description, as intended. The baseline graph contains 43,245 rendered module characters from Firebase Analytics; the candidate graph contains no Analytics module. Those characters are not a separate compressed-byte estimate.

The tradeoff is visible in the graph. Book adds more individual JS files, and administration events grows from 92,845 to 93,926 gzip bytes beyond startup while increasing the cumulative JS file count from 20 to 24. Its total still falls because startup is smaller. Member Home gains one small shared chunk and 79 gzip bytes beyond startup. These are reasons to measure first-use delays separately, rather than infer them from byte reduction.

On the modeled warm journey, the candidate adds 10,291 gzip bytes for Home → list, then 37,091 for About, 15,227 for Book and 1,230 for Attendees. The baseline had loaded all those task modules at the list step (61,333 additional gzip bytes). Both versions add zero code on the final returns to list and Home. This demonstrates deferred code loading and code reuse, not faster task transitions; each candidate task can incur its own first-use request cost.

## Validation and release acceptance

With the measured runtime source unchanged, the final Node 24 frontend run passed **153 files / 1,459 tests** in 84.50 seconds. Coverage thresholds passed: 84.84% statements, 81.08% branches, 81.07% functions and 86.48% lines. Full frontend lint and the TypeScript/production build passed. The runner also passed syntax and ESLint checks; independent review reconciled the raw report, source fingerprints, both complete graphs and every emitted asset against the compact results.

Regression coverage includes delayed imports and shared preload promises, unused destinations, permission-gated mounting, local module failures, explicit reload recovery without replay, booking draft retention through tabs/history and another panel's failure, and claim-resolution/account/session changes around the onboarding probe. An existing event-tab assertion now waits for the actual loaded booking panel. The same independent empty-state and authoritative-refresh test pacing fixes included in #696 are present here; suite-wide deadlines are unchanged.

These checks use inert child components/transports where needed. Before release, Dev acceptance must exercise real direct About/Book/Attendees and administration tasks, booking and event draft retention, logout while a chunk is pending, and missing-chunk manual recovery. Capture a cold-code network/CPU baseline before navigation and compare first usable UI and first-task delays. There has been no deployment or live browser acceptance for this slice.

## Remaining Home payload opportunity

Home currently displays event id/link, title, start/end time, location and section name. Its source query also returns full event descriptions, sponsors, guest-of-honour and booking configuration, and Home filters past events in the client. A later authorized summary DTO could reduce those response bytes and server work. It must preserve the current `endDateTime >= now` upcoming rule, including in-progress events, and use a separate cache shape/key: a filtered/light Home response is not a complete section-event list. This code-loading slice makes no server or cache-contract change.
