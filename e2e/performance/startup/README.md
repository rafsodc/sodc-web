This harness serves the complete production builds emitted by
`scripts/performance/on-demand-bundles.mjs`. It makes no source aliases, changes
no production feature flags, and never enables `import.meta.env.DEV`.

From the repository root, with Node 24, dependencies and Playwright Chromium:

```sh
node --test e2e/performance/startup/*.test.mjs
node scripts/performance/startup-browser.mjs \
  --assets .firebase/performance/650-startup-review-final-assets \
  --output .firebase/performance/650-startup-browser-review-final.json \
  --pairs 10 --profile both --journey all
```

Use `--pairs 1 --profile normal --journey admin --debug true` for a short diagnosis.
The default is 10 alternating baseline/candidate pairs for each of normal and slow
profiles and each of the independent member/admin journeys (80 samples).
`--journey both` deliberately retains those historical member/admin semantics.
Additional selectors are `public`, `guest`, `register`, and `reset`;
`--journey signed-out` runs all four signed-out journeys (160 samples with the
default pair/profile settings), and `--journey all` includes all six journeys.
Each variant and journey gets a fresh browser context. CPU and network emulation are set
before navigation; pre-document observers record destination-specific cold readiness, paints,
long tasks and layout shifts. Subsequent journeys are same-document UI actions,
with capture-phase click timestamps and two consecutive correct animation frames.
The real breadcrumb and Admin links are used; no DOM view or route is fabricated.

The member journey is cold signed-in Home; first section; first Markdown About;
first Book wizard; section administration hub; event list; Add Event dialog.
The independent administration journey starts cold at the real section-management
deep link, then opens Events and Add Event without warming member routes first.
A title is entered and cancelled locally. The public journey starts at signed-out
Home, opens Sign in, then follows the real links to Register and Password reset.
The direct Register and Password reset journeys start in separate cold contexts.
Each authentication form is checked for styled, editable fields and an enabled
submit button after invented input; no form is submitted and no sign-in, account
creation, password reset or email request is made.

The guest journey starts directly at a guest-ticket URL with an invented fragment
capability. Its one synthetic read returns a usable, reserved, unpaid ticket,
with an enabled Pay button and editable dietary field. An unsaved dietary draft
is entered; Pay, Save and Refresh are never activated. This measures the usable
ticket rather than the unavailable-link error state.

Save, checkout and preference mutations are never
activated. The adapter tests demonstrate refusal of mutations and unlisted reads.

Member/admin Auth persistence contains an invented unsigned JWT. Signed-out
contexts have no seeded user/token, and their private reads are refused. Actual Firebase Auth,
App Check, Data Connect and Functions SDKs execute; their narrowly listed reads
are fulfilled in the browser. The reCAPTCHA enterprise loader and App Check token
exchange are synthetic. No real key, login, service, attestation, member record,
or network response is used. Service workers and WebSockets are blocked, and
only the loopback GET/HEAD asset server can receive a forwarded request. Every
unexpected request is blocked and retained as a measurement failure. No secret
or authorization headers are recorded.

The adapter also supports the fixed `deployment: "recovery"` profile for the real
App deployment-recovery browser suite. It uses only that suite's hard-coded inert
demo project and key; measurement remains the default profile. Unknown deployment
profiles are rejected before browser setup. There are no arbitrary project/key
options and neither profile forwards SDK traffic.

Static assets use gzip level 9 and immutable asset headers. Browser routing
disables the HTTP cache; later journeys reuse the document's evaluated modules.
CDP shapes asset requests, while synthetic SDK fulfillment does not model real
backend latency. These timings measure this local Chromium fixture, not live
Dev/Production, login, App Check attestation or database performance. Compare
paired variants only, keeping the same fixture, browser and throttle profile.
There is no fixed timing pass/fail threshold. Failures are retained in the report.
Summaries join successful variants by profile, journey and pair ID, and list any
unmatched successful observations. They never shift rows to replace a failed
counterpart. `--keep-going true` retains later observations after a failure, while
the completed command still exits unsuccessfully if any sample failed.

Reports bind all served file hashes to their emitted graphs and bind the adapter
and runner source hashes. They contain invented data only; body text on failures
is retained to explain readiness failures. Graphs are rechecked before serving,
and asset and harness hashes are checked again after the run.
