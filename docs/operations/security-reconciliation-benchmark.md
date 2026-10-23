# Reconciliation capacity acceptance

The agreed targets are **2,000 total security states as the baseline** and
**10,000 as stress capacity**. Count existing states in each total. A fast local
test or a seven-member Dev sweep does not establish either target's provider
capacity.

## Local production-code regression benchmark

Run with Node 24 from the repository root:

```sh
node scripts/benchmark-security-reconciliation.mjs --runs 5 --output /private/tmp/reconciliation-local.json
```

The output must be a new file. It is written with owner-only permissions. Each
measurement runs in a separate process, transpiles the current production
scheduler/coordinator, and supplies local Data Connect/Auth transports. The
restricted loader rejects unexpected dependencies; it does not load Firebase,
discover credentials, create members, deliver notifications, or contact cloud
services. Reports contain aggregate data and hashes of the four source files.

The scenarios cover healthy grants; disabled, email-free denied identities;
the first 100 pending grant retries; and mirror drift with transient Auth
failures. The last scenario must finish the roster with no remaining pending
operations or incorrect mirrors. Its injected failed-attempt count is expected.

The scheduler processes states sequentially. A healthy sweep of `N` states uses
`2N + floor(N/500) + 3` database reads and `N` Auth reads. These are logical SDK
boundary operations; underlying HTTP requests, SDK retries and credential
refreshes are not measured. A pending grant adds eight logical operations;
mirror repair adds two. The benchmark exercises the actual completion and
retry implementation rather than replacing the coordinator with a cost formula.

On 23 October 2026, five isolated runs of each of four scenarios at each of
100, 1,000, 2,000, 5,000 and 10,000 states completed: **100 local measurements**.
The checkout was `f312cf05fae65b5bccc190d7e86540d7f7024743` (the four
reconciliation source hashes were unchanged from integration commit
`ef89c37db8b76300bb4b6a6673776fd511c8b2ea`);
Node was 24.22.0 on an Apple M3 Max. All final pending/mirror counts were zero.

| Healthy scenario | SDK operations | Median local wall time | Local p95 | Median CPU | Peak process RSS |
|---|---:|---:|---:|---:|---:|
| 2,000 states | 6,007 | 13.2 ms | 14.0 ms | 17.2 ms | 129.1 MiB |
| 10,000 states | 30,023 | 60.8 ms | 65.0 ms | 68.8 ms | 139.2 MiB |

These times exclude provider work. Memory includes the fixture maps,
transpiler and test scaffolding; execution heap deltas are also reported. Five
runs provide a local regression sample, not a reliable production p95. The
machine-specific receipt remains outside the repository; repeat the command to
generate a current receipt for the reviewed release.

An optional `--latency-model FILE` accepts only numeric non-negative
`databaseRead`, `databaseWrite`, `authRead`, and `authWrite` milliseconds. It adds
virtual sequential cost without delaying the benchmark. Optional
`--provider-samples FILE` accepts aggregate, source-hash-bound Dev natural-sweep
receipts using the schema in the script. Both produce explicitly labelled
projections and always leave `liveVolumeAcceptancePassed:false`.

## Review the live Dev plan before creating fixtures

`scripts/reconciliation-volume-acceptance.mjs` coordinates a private run
manifest and before-write checkpoints. `scripts/reconciliation-volume-cloud.mjs`
contains its lazy ADC-backed provider. Neither is invoked by deployment.
Importing either performs no cloud operations. **Preparing a live run is
read-only in Dev; setup/cleanup pause or restore a scheduler and create/delete
only manifest-owned fixtures. Review the manifest before either write phase.**

1. Finish other fixture work and choose a quiet Dev window. Build Functions
   from the reviewed checkout. Use Node 24 and Dev ADC credentials; this path
   does not depend on refreshing the gcloud user's credential.
2. Prepare a new private directory outside the checkout:

   ```sh
   node scripts/reconciliation-volume-acceptance.mjs prepare /private/tmp/reconciliation-volume-RUN
   ```

   Review `manifest.json`, the printed hash, original roster counts, two usable
   administrators, current deployed revision, exact scheduler target and
   notification configuration. The fixed Dev project is `sodc-web`; Beta,
   production, emulator overrides, changed manifests and expired mutation
   approval are rejected. Approval expires after 48 hours; scoped cleanup
   remains available afterwards.
3. Use the reviewed manifest hash for every subsequent phase:

   ```sh
   node scripts/reconciliation-volume-acceptance.mjs setup-baseline /private/tmp/reconciliation-volume-RUN --approve-manifest HASH
   ```

   The provider pauses only `reconcilePendingSecurityTransitions` and records
   the pause privately. Pausing does not cancel an existing execution. A
   missing drain proof stops setup before any fixture creation; follow the
   provider's drain requirements and resume the same command. It does not sleep
   or automatically dispatch a job. The notification scheduler stays untouched.
4. Setup creates only the difference between the baseline state count and
   2,000, sequentially. Each Auth user is disabled and unverified, with **no
   email, password, phone or provider identity**. Its PENDING profile is marked
   with the run ID, opts out of announcements, and uses an `.invalid` placeholder
   address. An explicit insert cannot overwrite another profile. The existing
   coordinator initializes its denied READY state with a stable operation ID,
   `OPERATOR` authority and `allowAdminBootstrap:false`. No raw authority or
   administrator-count writes are used.
5. Arm a distinct measurement ID before the operator dispatches anything:

   ```sh
   node scripts/reconciliation-volume-acceptance.mjs arm-baseline /private/tmp/reconciliation-volume-RUN --approve-manifest HASH --measurement-id volume-2000-first
   ```

   This verifies the exact 2,000-state roster and persists the earliest allowed
   execution time. Have the operator dispatch the actual deployed scheduler
   **once** under a reviewed invocation procedure.
   The helper intentionally does not guess whether a PAUSED job can be Run.
   Official [Run documentation](https://docs.cloud.google.com/scheduler/docs/reference/rest/v1/projects.locations.jobs/run)
   says running jobs can be dispatched again, so do not retry an uncertain
   invocation. Resolve its actual execution in Cloud Logging first. Keep the
   job paused or restore its paused state after a controlled invocation.
6. Supply the private measurement receipt described by the cloud provider,
   including its exact execution ID, deployed revision, log insert ID and time
   window. The provider independently reads Cloud Logging and verifies the
   completion or timeout; a caller-supplied `passed` flag is insufficient.

   ```sh
   node scripts/reconciliation-volume-acceptance.mjs measure-baseline /private/tmp/reconciliation-volume-RUN --approve-manifest HASH --measurement-id volume-2000-first
   ```

   Successful evidence requires exactly 2,000 state attempts, zero pending
   attempts/failures, no warning/error and an unchanged real-member authority
   audit. A verified timeout is recorded as a failed baseline capacity result;
   it cannot unlock stress setup. Repeating this command resolves the same
   execution rather than dispatching another.
7. After the latest baseline measurement succeeds, `setup-stress` extends the same owned run to
   **10,000 total states**. Use `arm-stress` before dispatch, then
   `measure-stress` to verify the actual execution using a distinct
   `volume-10000-...` measurement ID. Capture timeouts as
   capacity findings. Before another distinct arm, the helper requires the
   previous armed execution's actual handler completion, including after a
   timeout receipt. A single successful sweep proves that observed scenario;
   use at least ten independent runs before presenting p95 as a stable target.
8. Request cleanup after incomplete setup or failed measurement. After a forced
   execution, deletion remains blocked until its actual handler completion is
   independently verified:

   ```sh
   node scripts/reconciliation-volume-acceptance.mjs cleanup /private/tmp/reconciliation-volume-RUN --approve-manifest HASH
   ```

   Cleanup pauses/drains reconciliation, checks every manifest slot (including
   uncertain creates), resolves owned pending transitions through the
   coordinator, and removes only exact run-marked denied states, profiles and
   rate-limit/invocation rows. Database absence is verified before Auth deletion.
   It **retains terminal SecurityTransition and AdminSafetyAudit records**;
   they do not reference the deleted profile. It never resets the control's
   advanced version or saved counter. Cleanup verifies the current real-member
   authority is healthy before restoring the scheduler's original state.
   Legitimate unrelated member edits, roster additions or administrator-count
   changes invalidate the acceptance run but do not strand exact owned denied
   fixtures. It records the drift and preserves the current real data. Setup
   and measurements still require the original baseline. The delivery
   configuration must remain unchanged and owned
   notification/delivery receipts must stay zero throughout.

The private checkpoint precedes uncertain writes. After interruption, reuse the
same manifest and phase; never allocate a replacement run to hide residue.
The run directory's `active.lock` prevents concurrent local invocations. A
project owner file in `/private/tmp` prevents competing local volume runs and
is removed only after verified cleanup. Remove a stale process lock only after
checking that its recorded process has stopped; preserve the manifest,
checkpoint, immutable phase receipts and retained database audit ledgers.
Cross-host concurrent operations require operator coordination.

If current administrator authority is unsafe, or the deployed revision,
scheduler configuration or notification configuration changed, automatic
cleanup deliberately stops. Preserve the owner lock, original manifest and
checkpoint; pause new fixture work. The operator must first inspect the fresh
current authority audit and provider metadata. Repair unsafe current authority
through the supported coordinator/operator workflow, never by restoring an old
counter or real-member snapshot. If an intentional deployment/configuration
change must remain, review a separate cleanup-only recovery plan bound to that
current source/configuration and the **original exact fixture IDs, markers and
operation IDs**, retaining the same ownership predicates, atomic database
deletion, Auth absence checks and audit retention. Do not weaken the existing
manifest, reset the database, delete by a broad prefix, or resume an unreviewed
job. The standard CLI has no drift override; this exceptional recovery needs
an explicitly reviewed operator procedure.

## Provider evidence files

The provider records `provider-pause.json` itself after an exact Dev Scheduler
REST read confirms PAUSED. It binds the reviewed manifest, scheduler
configuration, deployed revision, provider Date header and latest durable arm,
including an arm already recorded as a completed or timed-out measurement.
Scheduler responses may omit both attempt timestamps. Their unchanged empty
hash is explicitly uninformative; it cannot prove that a forced execution has
finished. A newer arm renews the capture once from a fresh provider timestamp;
retrying the same epoch reuses that capture.

The capture requires a 600-second observation window (540-second configured
timeout plus 60 seconds), then independently verifies Cloud Logging. This
window is **not a cancellation guarantee**. A Cloud Run 504 closes the request
connection while its container may continue processing.
[Cloud Run request timeout](https://docs.cloud.google.com/run/docs/configuring/request-timeout).
With request-based CPU allocation, work after an aborted request might not make
progress, so a late completion could remain unavailable indefinitely.
[Container runtime contract](https://docs.cloud.google.com/run/docs/container-contract).

Every visible execution must have the application's actual
`Security reconciliation completed` message. After an arm, the exact execution
additionally needs a private `handler-drain-<measurement-id>.json` receipt,
independently matched to that message. Missing logs, HTTP 504, a request-finished
or timeout message, and elapsed time alone never permit fixture deletion,
stress expansion or another distinct arm. The first invocation stops with
`WAIT_FOR_RECONCILIATION_DRAIN`; after the observation window it may instead
stop with `DRAIN_HANDLER_COMPLETION_REQUIRED`. Resolve the same execution;
do not dispatch another to make it progress. Configuration, revision or attempt
changes invalidate the proof. A drain proof is separate from capacity evidence.

For a completed execution, create the following owner-only regular file as
`measurement-volume-2000-first.json` in the private run directory. Populate
resource/hash fields from the reviewed manifest and the engine's manifest hash;
populate revision, execution ID, insert ID and timestamps from actual Cloud
Logging observations. The time window must begin after the durable arm time,
include the selected log and span no more than 20 minutes.

```json
{
  "schemaVersion": "sodc-reconciliation-volume-measurement/v1",
  "projectId": "sodc-web",
  "runId": "REVIEWED_RUN_UUID",
  "manifestHash": "REVIEWED_MANIFEST_SHA256",
  "schedulerResource": "projects/sodc-web/locations/europe-west2/jobs/firebase-schedule-reconcilePendingSecurityTransitions-europe-west2",
  "configurationHash": "BASELINE_SCHEDULER_CONFIGURATION_HASH",
  "deploymentProofHash": "BASELINE_DEPLOYMENT_PROOF_HASH",
  "evidenceReference": "PRIVATE_LOG_OBSERVATION_RECEIPT",
  "measurementId": "volume-2000-first",
  "targetSize": 2000,
  "revision": "ACTUAL_REVIEWED_REVISION",
  "executionId": "ACTUAL_PROVIDER_EXECUTION_ID",
  "insertId": "ACTUAL_COMPLETION_LOG_INSERT_ID",
  "startedAt": "ACTUAL_EXECUTION_WINDOW_START_ISO",
  "completedAt": "ACTUAL_EXECUTION_WINDOW_END_ISO",
  "completed": true,
  "timedOut": false
}
```

The helper reads provider logs independently; it does not trust copied counts
or durations in this file. For a timeout, set `completed:false`, `timedOut:true`
and use the actual timeout ERROR log's insert ID. It must match the exact
project, region, revision and execution. Missing or ambiguous provider evidence
leaves the measurement pending. Preserve the same ID while resolving it.

For `handler-drain-volume-2000-first.json`, use the same project/run/manifest,
scheduler/configuration/deployment hashes, evidence reference, measurement ID,
target size, revision, execution ID, insert ID and actual log-window fields as
the measurement example. Change `schemaVersion` to
`sodc-reconciliation-volume-handler-drain/v1`, add `notBefore` from the durable
arm, and omit `completed`/`timedOut`. Its selected insert ID must be the actual
handler-completion message. A completed sweep with failed attempts can establish
that the loop ended; it does not pass the performance or correctness gate.
A previously recorded timeout receipt remains failed evidence even if a later
handler completion allows safe cleanup.

## Exceptional recovery when a timed-out handler never completes

This is a separately reviewed operator procedure, not a standard CLI override.
Review and authorize its exact resource/configuration requests before creating
live volume fixtures. Keep the reconciliation job PAUSED throughout. Preserve
the original arm, failed measurement, manifest, owner lock and all audit files.
Do not delete fixtures while the original revision might still execute.

1. Capture the exact Dev Function, underlying Run service, old revision/image
   digest, source provenance, full configuration, IAM and Scheduler settings.
   Prepare a Functions v2 PATCH limited to
   `serviceConfig.environmentVariables,serviceConfig.allTrafficOnLatestRevision`:
   preserve the entire current environment map, add one reviewed unused drain
   epoch marker, and route traffic to the resulting latest revision. Do not
   include source/build fields or use a normal Firebase deploy that could
   recreate the paused Scheduler job. The API supports a field mask and
   latest-revision routing; this replacement plan is an operator inference from
   those supported operations, not an immediate-cancellation API.
   [Functions PATCH](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch),
   [ServiceConfig](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions#ServiceConfig).
2. Await the update operation and verify the new healthy revision uses the
   exact reviewed image digest/source and unchanged settings apart from the
   epoch marker. Verify 100% traffic goes to it, the old revision has no
   traffic or tags, and the exact Scheduler configuration remains PAUSED.
   A changed image, ambiguous operation or unintended settings change stops
   recovery for review.
3. Require positive provider evidence that the old revision is `RETIRED`.
   Google's definition is: "Cloud Run has retired the infrastructure needed
   for that particular revision." Zero traffic, a replica count, a timeout
   and elapsed time do not establish that status.
   [Manage revisions](https://docs.cloud.google.com/run/docs/managing/revisions).
   Do not invent an API condition mapping; retain the actual provider status.
4. For that exact non-serving old revision, review an etag-bound
   `DELETE https://run.googleapis.com/v2/projects/sodc-web/locations/europe-west2/services/REVIEWED_SERVICE/revisions/REVIEWED_OLD_REVISION`.
   The API accepts only retired revisions. Await its successful long-running
   operation and verify the old revision's deletion/tombstone or absence.
   A submitted or timed-out deletion request is insufficient.
   [DeleteRevision precondition](https://docs.cloud.google.com/run/docs/reference/rpc/google.cloud.run.v2#deleterevisionrequest),
   [Revision DELETE](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services.revisions/delete).
5. Only after positive old-infrastructure retirement/deletion, prepare a new
   cleanup-only recovery plan bound to the current replacement source/settings
   and **original exact fixture IDs, markers and operation IDs**. Preserve all
   normal ownership, healthy-current-authority, atomic deletion, verified Auth
   absence, zero-notification and terminal-ledger checks. Never alter the
   original immutable manifest to bypass revision protection. Verify zero
   operational fixture residue before restoring the exact original Scheduler
   state; retain the advanced control versions and failed capacity result.

Retirement is not guaranteed to become observable promptly. If actual handler
completion or positive infrastructure retirement/deletion cannot be proven,
leave the disabled denied fixtures intact, keep the job paused and seek
provider support. The normal runner deliberately remains blocked. No runtime
code change or speculative service-instance termination call is part of this
procedure.

## Acceptance decision

Report baseline and stress separately, including execution count, exact roster
size, revision, duration, failures, timeout evidence and verified cleanup.
Baseline must complete before the five-minute schedule can safely keep pace;
the suggested operating budget is p95 ≤180 seconds and maximum ≤240 seconds.
These are proposed release budgets for review, not an existing service-level
agreement. The deployed function's hard timeout is 540 seconds. Stress must
report whether the 300-second cadence or 540-second limit was exceeded; do not
turn a timeout into a passing capacity result.

Provider request counts and memory require provider telemetry if they are
needed for cost/capacity approval; local logical operation counts and local
RSS are not substitutes. The live denied-state scenario does not establish
large pending-grant backlogs or simultaneous membership writes. If baseline
times out, stop, establish actual completion or reviewed infrastructure
retirement before cleanup, and address the measured bottleneck before expanding
to stress volume or approving Beta/production.
