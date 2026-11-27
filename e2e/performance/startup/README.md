This harness serves the complete production builds emitted by
`scripts/performance/on-demand-bundles.mjs`. It makes no source aliases, changes
no production feature flags, and never enables `import.meta.env.DEV`.

From the repository root, with Node 24, dependencies and Playwright Chromium:

```sh
node --test e2e/performance/startup/fixture.test.mjs
node scripts/performance/startup-browser.mjs \
  --assets .firebase/performance/650-startup-task-core-assets \
  --output .firebase/performance/650-startup-browser.json \
  --pairs 10 --profile both --journey both
```

Use `--pairs 1 --profile normal --journey admin --debug true` for a short diagnosis.
The default is 10 alternating baseline/candidate pairs for each of normal and slow
profiles and each of the independent member/admin journeys (80 samples).
Each variant and journey gets a fresh browser context. CPU and network emulation are set
before navigation; pre-document observers record cold Home or administration-hub readiness, paints,
long tasks and layout shifts. Subsequent journeys are same-document UI actions,
with capture-phase click timestamps and two consecutive correct animation frames.
The real breadcrumb and Admin links are used; no DOM view or route is fabricated.

The member journey is cold signed-in Home; first section; first Markdown About;
first Book wizard; section administration hub; event list; Add Event dialog.
The independent administration journey starts cold at the real section-management
deep link, then opens Events and Add Event without warming member routes first.
A title is
entered and cancelled locally. Save, checkout and preference mutations are never
activated. The adapter tests demonstrate refusal of mutations and unlisted reads.

Auth persistence contains an invented unsigned JWT. Actual Firebase Auth,
App Check, Data Connect and Functions SDKs execute; their narrowly listed reads
are fulfilled in the browser. The reCAPTCHA enterprise loader and App Check token
exchange are synthetic. No real key, login, service, attestation, member record,
or network response is used. Service workers and WebSockets are blocked, and
only the loopback GET/HEAD asset server can receive a forwarded request. Every
unexpected request is blocked and retained as a measurement failure. No secret
or authorization headers are recorded.

Static assets use gzip level 9 and immutable asset headers. Browser routing
disables the HTTP cache; later journeys reuse the document's evaluated modules.
CDP shapes asset requests, while synthetic SDK fulfillment does not model real
backend latency. These timings measure this local Chromium fixture, not live
Dev/Production, login, App Check attestation or database performance. Compare
paired variants only, keeping the same fixture, browser and throttle profile.
There is no fixed timing pass/fail threshold. Failures are retained in the report.

Reports bind all served file hashes to their emitted graphs and bind the adapter
and runner source hashes. They contain invented data only; body text on failures
is retained to explain readiness failures. Graphs are rechecked before serving,
and asset and harness hashes are checked again after the run.
