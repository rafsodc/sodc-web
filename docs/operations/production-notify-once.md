# One Production Notify binding update

This is the narrowly scoped operator transport for the
[prospective verification procedure](./notify-binding-prospective-verification.md).
Preparing this command, its code or its records makes no Production change.
Independent code/transport review and separate approval of the exact Production
proposal remain required before execution. Earlier Dev approvals do not transfer.

## Fixed request and consequence

The command can submit one Cloud Functions PATCH to
`projects/sodc-web-production/locations/europe-west2/functions/reconcileMyCheckoutSessionOrders`.
Its only update mask is `serviceConfig.secretEnvironmentVariables`. The complete
binding set is fixed:

| Secret | Numeric version | Change |
| --- | --- | --- |
| `STRIPE_SECRET` | `2` | Retain |
| `GOV_NOTIFY_LIVE_API_KEY` | `1` | Add |
| `GOV_NOTIFY_TEAM_API_KEY` | `1` | Add |
| `GOV_NOTIFY_TEST_API_KEY` | `2` | Add |

These are proposal-specific references, not secret values or `latest` aliases.
The request asks for no IAM, delivery-ceiling or unrelated change and uploads no
application source. Google may rebuild stored source during the update. It uses
the existing restricted provider PATCH with an explicit field mask.
There is no alternative project, endpoint, host, phase, retry, rollback or unlock.

The current ceiling remains **LIVE**. Restoring these keys can immediately let
ordinary application activity send real purchaser or operations emails. Approval
must include that effect even though this command invokes no reconciliation,
payment fixture, test send or backlog replay.

## Preparation and exact review

1. Use Node 24 and clean, reviewed tooling plus the clean, compiled application
   candidate. A candidate source binding does not prove that source is deployed.
2. Prepare a fresh GET-only capture and a complete Run limit sidecar through the
   prospective procedure. Require a matching `BASELINE_MATCH` before report and
   bind the exact capture, limits, request, application source and verifier tool.
   The original capture keeps its private comparison key; never copy it into the
   operator run, repository or evidence archive.
3. Use the GET-only preparation command below. It checks the paths, source/tool
   bindings and inputs, runs the reviewed verifier's real before comparison and
   requires `BASELINE_MATCH`. It rechecks inputs after awaited work, then creates
   an owned mode-0700 run with mode-0600 `plan.json`, `request.json`,
   `review-template.json` and `initialized.json` written last. These four files
   are unapproved metadata: no credentials, comparison key, claim or intent.
4. Review the exact plan/request, operator code binding and all five verifier
   context digests: `captureReportSha256`, `limitsBaselineSha256`, `requestSha256`,
   `sourceBindingSha256` and `comparisonToolBindingSha256`. Bind the actual clean
   operator code as well as the application and GET-only verifier tool.
5. Obtain separate exact Production mutation authorization after code/transport
   review, including the provenance boundary and LIVE consequence. Coordinate a window
   with anyone who can change Functions, source, IAM, secrets or schedulers;
   synchronize the operator clock and start only with enough review time left.
6. Only after that authorization, record it as `review.json` with `APPROVED`,
   the actual human reviewer, a concrete reason and approval/expiry times. The
   lifetime must be no more than one hour. Both explicit risk-acceptance booleans
   must be true. This file records the exact mutation authorization; general code
   approval, a template or an implicit instruction is insufficient.

Generation-pinned source metadata does not prove archive-byte or executable
equality. Both remain **UNPROVEN**. The review must expressly accept that
Production provenance boundary; it cannot borrow the earlier Dev decision.
The ordinary Functions guard and old v1 verification are unchanged, and the old
failed Dev verification remains failed.

From the clean, reviewed operator checkout on Node 24, prepare the records:

```sh
node scripts/prepare-production-notify-once.mjs \
  --verifier-root /private/tmp/sodc-reviewed-verifier-REPLACE \
  --source-root /private/tmp/sodc-reviewed-application-REPLACE \
  --capture-dir /private/tmp/sodc-production-capture-REPLACE \
  --limits-baseline /private/tmp/sodc-production-review-REPLACE/limits.json \
  --check-output-dir /private/tmp/sodc-production-prep-before-NEW \
  --before-output-dir /private/tmp/sodc-production-execution-before-NEW \
  --run-dir /private/tmp/sodc-production-operator-NEW
```

`--check-output-dir` is the new directory for preparation's GET-only comparison.
`--before-output-dir` is a different, still-absent directory pinned in the plan
for execution's fresh comparison. The run and both output directories must be
new and satisfy the protected-path checks. Preparation takes no approval input
and never creates an `APPROVED` review. Inspect its records before seeking the
separate exact authorization and recording `review.json`.

## Execute once after authorization

From the clean, reviewed operator checkout on Node 24:

```sh
node scripts/production-notify-once.mjs \
  --run-dir /private/tmp/sodc-production-operator-REPLACE
```

The path must identify the prepared private run. There are no environment or
phase selectors. Do not substitute a broad Firebase deploy or another transport.

Before any write, the command validates the initialized plan, exact request,
review, source/tool bindings and current capture/limits context. It runs a fresh
GET-only prospective before comparison and requires `BASELINE_MATCH`. After
awaited work it rechecks the plan, review, application and tooling rather than silently
adopting changed inputs or an expired approval.

The execution before-output path is pinned as `beforeOutputDirectory`. Once the
comparison creates it, any later block makes that plan/review non-reusable, even
if no claim was written. Do not rerun the command or delete the output to reuse
the plan. Investigate the cause first. If there is no claim or intent, prepare a
new run with new preparation/execution output paths and obtain a new exact review.
If a claim or intent exists, a replacement run must not bypass it: retain the
records and require separate operator review before any further mutation.

The durable order is:

1. Exclusively claim the fixed Production project in the shared repository's
   `.firebase/production-notify-once-locks` namespace, separate from v1 claims.
2. Write and sync `intent.json` with the exact prospective verifier intent
   schema and five context digests, plus the request start time.
3. Submit the single approved PATCH once, without a retry.
4. Validate the returned operation's project, region, target and `update` scope,
   then retain only its name as `operation.json` containing exactly `{name}`.

The claim comes before the intent, and both come before the provider write.
The exclusive claim covers this repository's worktrees on this machine. It does
not lock another clone, machine or cloud administrator; the coordinated window
is still required. Keep all claim and journal records.
These checks, including checks around dynamic verifier loading, are not atomic
against a malicious local writer changing files between validation and use.
Use a trusted local account and the coordinated window; code-binding checks do
not establish a lock against that attacker.

## Acknowledgement, unknown outcomes and verification

`ACKNOWLEDGED_VERIFY_REQUIRED` exits **3**, because GET-only verification is still
required. It does not prove operation completion, preservation, key validity or
delivery, and it grants no deployment receipt or runtime acceptance.

`BLOCKED_BEFORE_DISPATCH_CLAIM_RETAINED` means a guard stopped the operation after
journalling but before the actual fetch: `providerWritesAttempted` is 0 and the
exit is 3. Once the fetch is called, a lost response, malformed acknowledgement,
timeout, non-success response or failed acknowledgement persistence is
`UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED`, with `providerWritesAttempted` 1 and
exit 3. Both retain the claim/intent and prohibit a retry. Do not infer an
acknowledgement from live state, resubmit, remove a claim, unlock or roll back as
an implicit retry. Local blocks outside the submission attempt exit 1 and can
already have left a claim or intent; help exits 0. Inspect the retained records
and arrange separate operator review before any further mutation.

For a retained acknowledgement, use only the prospective verifier's **after**
phase with the same capture, limits baseline, source and operator run. Give each
read-only attempt a new output directory. `PENDING` or a snapshot/operation race
can require another observation; it never permits another PATCH. Keep failed
reports and their qualification intact.

The after comparator protects the 84 unrelated whole Functions, invoker policies,
schedulers and the four target secrets' version/policy metadata. It checks the
complete serving-limit inventory, including maintenance caps of 1, and permits
only the reviewed target changes. Its qualified metadata result preserves the
source/archive and executable-equality limits; it is not Production authorization.

After separately approved metadata acceptance, collect fresh ordinary guard/full
preflight evidence. Runtime or delivery tests need their own exact approval.
Keep [#744](https://github.com/rafsodc/sodc-web/issues/744) open until the agreed
Production acceptance is complete.
