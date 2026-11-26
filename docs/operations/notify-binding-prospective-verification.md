# Prospective verification of the Production Notify binding repair

This procedure is for review with [#744](https://github.com/rafsodc/sodc-web/issues/744).
It describes one configuration change and its before/after evidence. It does not
authorize that change, supply an apply engine, or modify the ordinary Functions
guard. The comparator performs GETs only and cannot grant Production authority.

The original [v1 repair](./notify-secret-binding-repair.md) required unchanged
build/source metadata. Its Dev verification remains failed. Do not run that
Production apply/verify workflow unchanged, remove its claims, or relabel the old
failure. The new procedure needs independent review and exact Production approval.

## Exact change and operational effect

The 26 November 2026 observation of
`europe-west2/reconcileMyCheckoutSessionOrders` in `sodc-web-production` has
Stripe version 2 only. Its proposed binding set is:

| Existing secret | Numeric version | Action |
| --- | --- | --- |
| `STRIPE_SECRET` | `2` | Retain |
| `GOV_NOTIFY_LIVE_API_KEY` | `1` | Add |
| `GOV_NOTIFY_TEAM_API_KEY` | `1` | Add |
| `GOV_NOTIFY_TEST_API_KEY` | `2` | Add |

These are observation-specific versions, not aliases or enduring approval. The
prepared request updates only `serviceConfig.secretEnvironmentVariables` on that
one Function, with an explicit field mask and all four references. It uploads no
application source and requests no IAM, key, delivery-mode or unrelated change.
If refreshed metadata differs, stop and review a new proposal.

The existing ceiling is **LIVE**. Restoring the keys can allow ordinary user or
application reconciliation to resume real purchaser or operations emails
immediately. That consequence belongs in the exact approval even when the operator
will make no test call. No payment fixture, reconciliation invocation, test email,
backlog replay or delivery-mode change is implicit in this procedure.

## Evidence and review before the write

1. Use reviewed Node 24 tooling and a clean, compiled application checkout. Candidate
   source declarations are not proof that that source is currently deployed.
2. Make a fresh [prospective capture](./notify-binding-evidence.md#capture-prospective-observations)
   into a new private directory outside source checkouts, original runs and shared
   claims. Capture binds Function components, invokers and schedulers. Secret
   version/policy metadata covers the four target secrets in the table above;
   it does not inventory other secrets' versions or IAM policies. Keep
   `comparison.key` private and out of evidence archives.
3. Capture a matching limit sidecar for every Function: its Run service maximum,
   latest serving revision maximum, readiness and traffic. The observed inventory
   is 85 Functions: 82 effective maxima of 20 and three maintenance maxima of 1.
   Bind the exact endpoint inventory and sidecar digest to the review.
4. Run the prospective comparator's **before** phase using that capture's same
   private HMAC context. Require exact source/baseline, target revision/update
   time and Stripe-only bindings. Independent captures have different keys;
   their HMACs are not interchangeable. A matching result is not write approval.
5. Review the exact request, source-provenance limit below, operator transport,
   one-shot records and maintenance window. The review must bind their digests,
   actual reviewer/reason and current baseline. Coordinate concurrent source,
   Functions, IAM, secret, scheduler and configuration administrators.
6. Obtain separate exact Production mutation authorization, including the LIVE
   effect. Dev's preparation, historical-risk and runtime approvals do not transfer.

The comparator and journal format must be reviewed before this sequence is used.
An output that is missing, failed, pending or based on drift is not permission to
submit the request. Never manufacture a passing ordinary guard receipt.

From the clean reviewed tooling checkout, run the read-only before comparison:

```sh
node scripts/notify-binding-prospective.mjs --phase before \
  --capture-dir /private/tmp/sodc-production-capture-REPLACE \
  --source-root /private/tmp/sodc-reviewed-application-REPLACE \
  --limits-baseline /private/tmp/sodc-production-review-REPLACE/limits-baseline.json \
  --output-dir /private/tmp/sodc-production-before-NEW
```

The environment is fixed to Production; there is no apply flag. The limit sidecar
has `{projectId, functions}` with one row per captured Function containing `name`,
`revision`, `serviceMaximum`, `revisionMaximum`, `effectiveMaximum`, `ready` and
`allTrafficOnLatestRevision`. Preserve its reviewed bytes and digest. Every output
directory must be new, private and outside the tooling/application checkouts,
capture, operator run and shared claims. Never copy the comparison key into it.

The GET-only provider obtains the service and exact revision settings for each
Function. It requires automatic scaling and checks readiness, configuration
generation, and both configured and observed traffic. Observed traffic must send
100% to the inspected revision with no tag or split. An absent/empty configured
traffic list uses the API's latest-revision default, while missing observed
traffic never supplies that proof. See Google's [Service and traffic reference](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services).

## Source-provenance boundary

Google can rebuild stored source during a secret-only update. The observed managed
source object is generation-pinned and has size, MD5 and CRC metadata. Cloud Build
does not expose a generic source/resolved-source object or archive SHA-256 in this
case. No source archive bytes were downloaded. Those observations do not prove
archive-byte or executable equivalence, and matching image metadata does not fill
the gap. See the [evidence-strength limits](./notify-binding-evidence.md#evidence-strength).

The Production reviewer must explicitly decide whether this evidence boundary is
acceptable before mutation. Preserve the exact source and source-provenance
references and generation; if they change or disappear, stop rather than infer
equality from MD5/CRC/size. A different acceptance boundary requires new review.
Neither the comparator nor a successful provider operation accepts this risk for
the user. Keep the source-equality qualification in the result for both build cases.

## One supervised configuration operation

The operator transport is a separate review gate; the GET-only comparator cannot
execute these steps. Review a transport that submits the approved request once,
keeps authentication out of arguments/logs/files, and retains the response safely.
Do not substitute a broad deploy or a raw Firebase deployment workaround.

Immediately before submission, repeat the **before** comparison and review checks.
Then durably record the target claim and intent before any provider write. The
intent binds the exact request, capture, limit sidecar and source/tool inputs, with
the request start time. Retain the separate exact review and approval record. A
local claim does not lock another machine or a cloud administrator; the coordinated
window remains necessary.

Keep the operator run in an owned mode-0700 directory and its journal files in
mode 0600. The comparator's `intent.json` input has exactly `schemaVersion`
(`sodc-notify-binding-operator-intent/v1`), `projectId`, `target`,
`captureReportSha256`, `limitsBaselineSha256`, `requestSha256`,
`sourceBindingSha256`, `comparisonToolBindingSha256` and `startedAt`. Use all five
canonical digests returned by the matching before result, not report-file byte
hashes. The comparator checks those bindings again after the provider read; this
journal is not an approval.
Confirm the operator clock is synchronized before recording the UTC start time.

Submit exactly one Cloud Functions update with the approved field mask and body.
Retain Google's operation acknowledgement and validate its project, region, target
and `update` verb. Acknowledgement means accepted for processing, not verified.
Use only GETs to poll the retained operation and collect post-operation evidence.
The comparator reads `operation.json` as exactly `{name}`, taken from the actual
provider acknowledgement, never inferred from a subsequent live-state read.

A lost response, malformed acknowledgement, timeout or failed durable
acknowledgement write is **UNKNOWN**. Retain all intent/claim records and inspect
read-only. Do not submit again, reconstruct an acknowledgement from current state,
remove a claim, or run rollback as an implicit retry. A failed operation similarly
requires operator review; there is no unlock, retry or waiver command here.

## After-state acceptance

Run the after comparison against that same capture, sidecar and source:

```sh
node scripts/notify-binding-prospective.mjs --phase after \
  --capture-dir /private/tmp/sodc-production-capture-REPLACE \
  --source-root /private/tmp/sodc-reviewed-application-REPLACE \
  --limits-baseline /private/tmp/sodc-production-review-REPLACE/limits-baseline.json \
  --operator-run-dir /private/tmp/sodc-production-operator-REPLACE \
  --output-dir /private/tmp/sodc-production-after-NEW
```

The **after** comparator must preserve all 84 unrelated whole-Function fingerprints,
normalized invoker policies, scheduler configurations, and version/policy metadata
for the four target secrets. Other Functions' secret references are protected by
their whole-Function fingerprints; other secrets' version state and IAM policies
are outside this capture's scope. For the target it compares the union of actual
component paths, including added/removed and unknown fields. It may allow only:

- Exactly the four approved secret references, with no extra key, version, project
  or grant. The prepared request retains the existing Stripe reference spelling;
  semantic binding validation does not depend on array order.
- The target's identified revision/update and successful build/image outputs.
  Aggregate `serviceConfig`/`buildConfig` hashes are not blanket exceptions: their
  other components, including runtime/build options and environments, stay exact.
- Omission of the target's former revision maximum 20 only when a freshly observed
  explicit Run service maximum 20 establishes the same effective configured cap.
  Keep the actual absent field absent; do not synthesize it to satisfy v1.

Runtime identity, entry point, memory/CPU/concurrency/timeout, ingress/networking,
environment, labels, source/provenance and latest-traffic policy remain protected.
Final state must be ACTIVE/latest, with no unexplained state messages or deltas.
Verify the complete bound limit sidecar, especially the three serving maintenance
revision caps of 1. Effective configured maxima use the lower applicable service
and revision limit; an absent field is never inferred to mean 20.

A **changed build** requires a completed successful operation with the exact
target/update scope, matching operation/Function/build identities, successful build
status and creation at or after the recorded intent. An **unchanged build** is a
separate branch requiring the recorded successful build, source and image identities
to match. A failed or unattributed rebuild cannot fall back to that branch.

Keep the result as a qualified metadata observation. Pending/unknown/failed states
remain so; no failed comparison is overwritten or relabelled. A qualified metadata
verification does not accept the old v1 contract or grant release authority.
Results are `BASELINE_MATCH`, `METADATA_VERIFIED_WITH_PROVENANCE_LIMIT`, `PENDING`
or `FAIL`. All retain false release/Production authorization. Repeat only the
read-only after phase with a new output directory when an operation is pending.
The inventory snapshot precedes the operation read. If an operation completes
between those reads, the earlier snapshot can produce `FAIL` rather than a final
observation. Retain that report and repeat only the read-only after comparison
into a new directory; a transient mismatch does not authorize another update.
`BASELINE_MATCH` exits 0; `FAIL` or a local/provider block exits 1; `PENDING` and
`METADATA_VERIFIED_WITH_PROVENANCE_LIMIT` exit 3. A qualified result deliberately
cannot be chained as successful deployment authorization.

After separately approved metadata acceptance, collect fresh ordinary Production
guard/full preflight from the final clean integration commit. Runtime/delivery
acceptance still needs its own exact scope; metadata verifies the four target
bindings/direct grants, not key validity or delivered mail. Keep #744 open until
the agreed Production acceptance is complete.
