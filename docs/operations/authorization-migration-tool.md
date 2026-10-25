# Authorization migration tool

Use this workflow for the one-time current-authorization/admin-safety migration in each Firebase project. The [authorization runbook](./current-authorization.md#one-time-migration-in-each-project) defines the security boundaries and recovery rules; this tool records and checks the individual cutover phases.

The active release path is **Dev (`sodc-web`) → Production (`sodc-web-production`)**. There is no Beta environment for this release. The tool's implementation and local tests do not establish that Production has been migrated. Each project needs its own observed state, approved maintenance window, acceptance evidence and migration receipt. Follow [environment promotion](./environments-dev-beta-prod.md) after migration, using the same reviewed revision accepted in Dev.

The corrected reusable provider adapter still needs a separately authorized live rehearsal in Dev at the reviewed release revision. The earlier Dev cutover used one-off operator helpers; its evidence does not establish that these reusable commands have been rehearsed. Local provider mocks do not prove IAM propagation, accepted SQL migrations or signed-token behavior in a real project.

## Preparation and targeting

Use Node 24 for `prepare`, `gate`, `audit` and `apply`, and a clean checkout of the reviewed commit for the run. Offline `plan` and `status` do not require cloud SDKs, credentials or the Node 24 runtime gate. The tool accepts literal project IDs: `sodc-web` (Dev), `sodc-web-beta` (optional Beta) or `sodc-web-production` (Production). A Firebase alias or the CLI's current default project does not select the migration target.

Each run has a stable run ID, operator and change reference. Keep these when resuming; do not create another run to bypass a failed phase. Plans, journals and evidence are private local operational records under the gitignored `.firebase/authorization-migration/runs/<project>/<run-id>/` directory. Preserve the run and its evidence for another operator to review.

The commands have different effects:

| Command | Effect |
|---|---|
| `plan` | Prints the proposed phase sequence offline. Does not load a cloud SDK or require cloud credentials. |
| `prepare` | Creates the local run, pins the source revision and records a new artifact location outside the checkout. Does not deploy or migrate cloud resources. |
| `status` | Reads the local run offline. It does not establish that the live target still matches the journal. |
| `audit` | Performs explicit live read-only inspection, with or without a run ID. Requires target-project credentials. |
| `gate` | Records a local operator attestation from structured evidence. Does not establish live provider state by itself. |
| `apply` | Runs one named phase. Every invocation requires the same literal `--confirm-project`; phases that write cloud resources remain separate operator decisions. |
| `unlock` | Removes only a demonstrably stale local process lock, with a recorded reason. Does not change cloud state. |

Create a plan without authenticating:

```sh
npm run authorization:migrate -- plan --project sodc-web-production --installation legacy
```

`legacy` and `strict` describe the intended starting installation. `plan` can omit `--installation`; `prepare` requires an explicit choice. Live inspection must confirm that classification. An inconsistent or unexpected installation requires review; it must not be treated as legacy automatically. An already strict connector must never receive the temporary compatibility API.

Prepare a Production run, replacing the sample operator, reason, run ID and artifact path with the reviewed values:

```sh
npm run authorization:migrate -- prepare \
  --project sodc-web-production \
  --run-id prod-auth-reviewed \
  --operator "approved-operator-id" \
  --reason "approved-change-reference" \
  --installation legacy \
  --artifact-directory /private/tmp/sodc-auth-prod-reviewed
```

The artifact directory must be new, absolute and outside the checkout. Add `--import-admins` only when the migration approval explicitly permits importing eligible legacy administrator roles. It is not a routine role-repair option.

Inspect the local status at any time:

```sh
npm run authorization:migrate -- status --project sodc-web-production --run-id prod-auth-reviewed
```

Preparation authorizes no live action. Obtain the required environment approval before issuing live inspection or cutover commands. The Dev backup waiver does not apply to Beta or Production: automated backups, point-in-time recovery and deletion protection remain required there, with reviewed restore evidence and the production cutover backup reference.

## Inspect and review the evidence

Once live inspection is authorized, run the read-only audit. Omit `--run-id` when inspecting a project before preparing a run:

```sh
npm run authorization:migrate -- audit --project sodc-web-production --run-id prod-auth-reviewed
```

The explicit `inspect` phase captures the baseline used by the subsequent cutover:

```sh
npm run authorization:migrate -- apply \
  --project sodc-web-production --run-id prod-auth-reviewed \
  --phase inspect --confirm-project sodc-web-production
```

Review the actual installed connector, schema, Functions, callable IAM, schedulers, administrator roster and database resilience. Review source artifacts and their hashes before deploying them. A compatibility artifact is bound to its project and expiry, which must be no more than 48 hours away. Generate a new artifact for a new environment; an expired Dev artifact is not a Beta or Production release artifact.

Inspection retains the provider baseline and source-artifact review data in the private run directory. Use its `provider-sql-review.json` record to review the proposed diff and copy its `diffSha256` into the SQL-review gate. If a fresh diff changes, review that new diff rather than reusing the previous hash.

The named operator gates are:

| Gate | Required review |
|---|---|
| `backup` | Target-specific backup, recovery and restore evidence; an explicit waiver is permitted only for Dev. |
| `freeze-scope` | The complete security-writing surface, affected jobs, outstanding work and approved refusal/drain proof method. Hosting maintenance alone does not freeze writes. |
| `old-writers` | Exact frozen inventory, explicitly reviewed successor revision identities and outstanding external operations; fresh provider reads must prove the original revision infrastructure is retired. |
| `sql-review` | The exact proposed schema changes and connector effects. Stop on unreviewed destructive SQL or automatic connector deletion. |
| `acceptance` | Backend/migration acceptance and reviewed release evidence for the same revision, including the browser review and unresolved post-Hosting work. Production must reference the matching Dev evidence. |

Submit the structured evidence file for the relevant gate:

```sh
npm run authorization:migrate -- gate \
  --project sodc-web-production --run-id prod-auth-reviewed \
  --name freeze-scope --evidence /private/tmp/prod-auth-freeze-scope.json
```

Gate evidence uses the following envelope. Replace every placeholder and provide the `details` required by the selected gate:

```json
{
  "schemaVersion": "sodc-authorization-migration-gate/v1",
  "gate": "backup",
  "projectId": "sodc-web-production",
  "gitSha": "<full reviewed commit SHA>",
  "runId": "prod-auth-reviewed",
  "reviewedBy": "<approved operator identity>",
  "observedAt": "<UTC ISO review timestamp>",
  "evidence": "<retained operational evidence reference>",
  "details": {
    "backupReference": "<verified backup reference>",
    "restoreTestReference": "<reviewed restore-test evidence>"
  }
}
```

| Gate | Required `details` |
|---|---|
| `backup` | `backupReference` and `restoreTestReference`. Only Dev may instead use `waiverReference` identifying its explicit waiver. |
| `freeze-scope` | `entrypoints` and `jobNames` arrays matching the approved scope; `externalWritersReference`, `probeUserId` and `probeReference`. The probe identity must be an approved existing non-administrator profile in the target project. |
| `old-writers` | `method: "cloud-run-retirement"`, `freezeStateHash`, `inventoryHash`, `successorRevisions` and `externalOperationsReference`. See the retirement procedure below. |
| `sql-review` | `diffSha256`, binding the review to the exact generated SQL diff. |
| `acceptance` | `sourceProjectId`, `backendTestReference`, `browserReviewReference`, `notificationsReference`, `schedulerVolumeReference` and `appCheckReference`. `sourceProjectId` must be the target for Dev/Beta, and `sodc-web` for Production. |

`observedAt` records the actual review time. The tool rejects reviews older than 24 hours or more than 30 seconds in the future. Retain the underlying evidence rather than refreshing its timestamp without another review. Gates are local operator attestations; their references do not themselves prove live provider state. Live inspection and phase verification remain separate requirements.

A journal flag, informal note or supplied `passed: true` does not replace provider observations or acceptance testing. Stale or mismatched evidence must be refreshed and reviewed before continuing. The acceptance gate before the receipt covers backend/migration readiness and the review of matching release evidence. `browserReviewReference` must accurately identify any post-Hosting acceptance still pending; the migration receipt never claims full browser or user acceptance is complete.

## Apply one phase at a time

The command shape is the same for each phase; choose one phase explicitly:

```sh
npm run authorization:migrate -- apply \
  --project sodc-web-production --run-id prod-auth-reviewed \
  --phase freeze --confirm-project sodc-web-production
```

There is no automatic command to apply every phase. Review the result and live state before proceeding.

| Phase | Checkpoint |
|---|---|
| `inspect` | Capture and validate the target baseline and reviewed source artifacts. This phase reads cloud state. |
| `freeze` | Apply the approved server-enforced write restrictions, verify direct refusal and no side effects, pause affected jobs and drain old work. |
| `schema` | Deploy the additive schema and authorization-service connector while preserving the existing API boundary. |
| `compatibility` | For a legacy installation only, deploy the reviewed temporary API while retaining the direct onboarding denial and callable/job freeze. |
| `control-create` | Create the administrator-safety control separately, under the freeze, or verify the appropriate existing control. |
| `backfill` | Initialize the approved eligible identities using stable operation references; review denied/orphan/onboarding cases and synchronization outcomes. |
| `functions` | Deploy the replacement boundary while retaining the freeze. Defer new repair/status endpoints and the security scheduler until controlled opening; verify actual policies, handlers and existing job state after deployment. |
| `activate` | Freshly verify the Auth/profile/security-state roster, ready administrator count and synchronization state, then activate separately. |
| `strict-api` | Deploy the reviewed strict API after old writers have drained, retaining the temporary direct profile-creation denial; verify the strict source and absence of historical Potential Lost writers. |
| `open` | After the strict boundary and acceptance gates hold, deploy the exact reviewed strict API with onboarding restored, complete the endpoint deployment and restore the intended invocation/job configuration. |
| `receipt` | Verify the final state and retain the evidence-backed, project-specific migration receipt. This does not deploy Hosting. |

Provider changes are not instantaneous. A successful IAM update or deployment command is not refusal proof: check the actual request path and keep the environment frozen while propagation is unresolved.

Callable freeze probes use a handler-inert `GET`, so a still-propagating IAM restriction cannot accidentally execute a security action such as resignation. The provider independently validates the approved target Firebase JWT, App Check token and probe identity first. Only an identifiable Cloud Run ingress **HTTP 403 HTML denial** counts as the callable freeze proof. HTTP 400 invalid-request responses, handler role denials, invalid/expired-token responses and transport failures do not pass. Do not replace this probe with a `POST` to a security-writing callable.

This proves invocation was refused at the provider boundary; it does not prove that a valid callable request would pass or fail application authorization. The direct Data Connect profile-creation probe separately requires the intended authorization refusal and unchanged profile/authority state.

Provide the signed refusal probe through the approved environment mechanism:

| Environment variable | Required value |
|---|---|
| `AUTHORIZATION_MIGRATION_PROBE_TOKEN` | A current, verified Firebase ID token for the approved existing non-administrator probe identity. |
| `AUTHORIZATION_MIGRATION_PROBE_API_KEY` | The target project's Firebase web API key. |
| `AUTHORIZATION_MIGRATION_PROBE_APP_CHECK_TOKEN` | A valid App Check token from the target project's approved attestation flow. |

Do not put tokens in command arguments, gate documents, run records, Git or shared logs. The provider verifies the token identities and target before probing. Do not weaken App Check or substitute an invalid token to manufacture refusal evidence. Refresh expiring probe tokens through the approved flow before retrying verification.

Run separate valid signed-token callable and connector acceptance tests in Dev; ingress-only refusal evidence cannot replace them. Do not create mutation-test identities or run the non-production security integration suite against Production. Production uses the separately reviewed safe ingress proof and smoke-test procedure. Dev/Beta integration fixtures require the documented notification simulation and cleanup controls. Preserve actual test limitations; do not convert a failed browser run into acceptance because several individual scenarios passed.

The strict-installation path skips compatibility and must preserve existing authorization versions and legitimate denied/verification-held states. An unexpected live state or a different project/revision stops the run. Do not change installation type to make a phase pass.

## Positive old-writer retirement

The initial `freeze` invocation captures every revision of each affected Cloud Run service **before** changing invocation policies. It persists the service/revision UIDs and immutable container image digests in `provider-old-writer-inventory.json`, bound into `provider-freeze.json`. The freeze pauses jobs, removes public invocation and denies direct onboarding. Its minimum request-timeout wait remains a scheduling precaution. An expired timeout, zero pending database transitions, a READY row, zero traffic/instances, a new ACTIVE revision or a refused ingress probe **cannot establish that an already admitted handler has stopped**. Cloud Run documents that a timed-out handler can continue running in its container ([request timeout](https://docs.cloud.google.com/run/docs/configuring/request-timeout)).

The freeze intentionally stays incomplete until a separately reviewed `old-writers` gate and live provider proof both pass. Use `status` to obtain `retirement.freezeStateHash`, `inventoryHash` and `inventoryFile` from the actual incomplete freeze result. After the minimum wait, retrying the freeze also saves sanitized service/revision observations in `provider-old-writers-observed.json` and the blocking reason in `provider-old-writers-blocked.json`. These records omit container environment values and credentials. Keep the server restrictions in place while reviewing them.

An operator must separately approve any provider action needed to retire the original revisions. For example, a reviewed Functions v2 environment-epoch-only update can create a maintenance successor while preserving the installed source, image and configuration. Review its exact update mask/configuration and preserve the freeze and paused jobs; a normal Functions deployment can recreate schedules and is not a substitute. The migration verifier performs **only reads** for retirement; it never patches, deletes or redeploys a revision. Do not improvise such a provider change in Production: rehearse the chosen procedure in Dev and retain its actual outcome first. If the provider cannot positively report retirement, stop with the environment frozen.

Review each successor's full revision resource name, UUID4 UID and immutable image digest against the approved provider operation. Record every successor explicitly; the tool never approves a revision merely because it is current. The gate `details` have this shape (replace all placeholders with reviewed observations):

```json
{
  "method": "cloud-run-retirement",
  "freezeStateHash": "<64-character SHA-256 from this run>",
  "inventoryHash": "<64-character SHA-256 from this run>",
  "successorRevisions": [
    {
      "name": "projects/sodc-web-production/locations/europe-west2/services/<service>/revisions/<revision>",
      "uid": "<provider UUID4>",
      "images": ["<registry>/<image>@sha256:<64-character digest>"]
    }
  ],
  "externalOperationsReference": "<reviewed external writers, queues, child processes and submitted provider operations>"
}
```

Submit these details in the normal target/SHA/run-bound gate envelope:

```sh
npm run authorization:migrate -- gate \
  --project sodc-web-production --run-id prod-auth-reviewed \
  --name old-writers --evidence /private/tmp/prod-auth-old-writers.json
```

The verifier exhausts Cloud Run v2 revision pagination and obtains an exact successful GET for every original and approved successor. Services and revisions must retain their captured UIDs and image identities, with settled generations. Each original must have one `Active` condition with `state: CONDITION_FAILED` and `revisionReason: RETIRED`, without contradictory lifecycle conditions. Cloud Run’s ancillary `ResourcesAvailable / CONDITION_RECONCILING / RETIRED` condition is accepted only alongside that exact positive `Active` retirement; other pending/reconciling conditions block. Both desired and observed traffic, tags and latest-revision references must point only to approved successors. `RETIRING`, `RESERVE`, `RECREATING`, disappearance, HTTP 404, missing metadata, an unreviewed new revision or identity drift all block the run. This uses the documented [revision lifecycle](https://docs.cloud.google.com/run/docs/managing/revisions) and [v2 condition fields](https://docs.cloud.google.com/run/docs/reference/rest/v2/Condition), not an inferred timeout barrier.

Retirement proves the original revision infrastructure has retired. It does not cancel an already submitted remote write, long-running provider operation, queue task, child process or another service-account caller. The `freeze-scope` and `externalOperationsReference` reviews must account for those writers and verify their submitted work has settled; unresolved or unobservable work remains a blocker. Review the fresh authority audit as well. Do not attest that the tool independently observes every external operation.

Every phase after `freeze` requires the bound gate and repeats the provider proof, including retries of completed checkpoints and final receipt verification. It checks again immediately before reopening the API, IAM or schedules. The replacement Functions deployment will create new revisions. Review those actual candidate identities and record an updated gate containing all approved successors before resuming verification; new revisions block until explicitly approved. If deployment completed and only verification stopped, retry the **same** phase/run: its durable provider checkpoint avoids redeployment while rechecking live proof. Once replacement Functions are proven, every captured service must serve only its exact reviewed candidate revision, bound by the Functions source/service/revision proof. All earlier maintenance successors must also positively retire; approving their identities does not approve their old code for reopening. Candidate metadata plus traffic or a zero-percent tag still targeting maintenance blocks opening. Retain the gate history; do not edit hashes or fabricate a new inventory to hide original revisions.

## Dev rehearsal and Production acceptance

Rehearse this corrected adapter in a clean checkout of the exact reviewed revision in Dev. Preserve Dev's existing migration receipt and use a new run ID; an existing receipt cannot be overwritten by another run. Keep one coordinated operator/window even when using separate local checkouts. Never downgrade Dev's strict connector to exercise legacy compatibility.

Dev is already strict. A strict-path rehearsal covers this adapter's freeze, retirement, retry and reopening behavior; it does **not** prove a first legacy backfill or compatibility cutover. Inspect Production read-only when authorized. If its installation is legacy, review the exact generated artifacts/SQL and retained legacy test coverage, then record an explicit go/no-go for that limitation or rehearse the legacy path in an isolated non-production project. A nonexistent Beta environment is not a gate, and no Beta project needs to be provisioned.

Production's `acceptance.sourceProjectId` is `sodc-web`; the gate remains bound to the exact Production run and reviewed Git SHA. Retain the Dev browser/session/cache recovery, signed-token, App Check, notification and reconciliation-volume evidence, with their actual limitations and approved exceptions. Evidence accepted for an earlier SHA does not silently accept a new revision. The current volume target is 1,000 members with a 2,000-member stress case; a healthy denied/READY roster does not prove retry-backlog throughput. The shared Notify callback was accepted as a Dev exception; verification of the newly deployed Production callback remains post-deployment work, not a reason to send another unapproved test email.

Production already has backups. Verify the existing backup/PITR/deletion-protection settings and retain the reviewed backup and restore references; no new backup system is required. The Dev waiver remains Dev-only. Plan the Production maintenance window, review the target-specific audit and obtain the Production go/no-go before any Production mutation.

## Failure, resume and rollback

On failure, retain the run and inspect both its local status and fresh live audit. Keep the freeze in place until the failed phase is understood. A command can fail after committing part of its work; do not infer that the target is unchanged from its exit status.

Resume the same run and phase after correcting the cause. The source revision, artifact hashes, gate evidence and live prerequisites must still match. Stable operation references let the operator distinguish a committed transition from work that needs retrying. If backfill commits a PENDING transition before an Auth failure, the same backfill phase may resume only work with this run’s exact per-user operation reference. Unrelated pending work remains blocked for explicit review; the next phase cannot proceed until backfill’s full audit passes. Recheck IAM and jobs after a deployment: new Functions or schedules can have different invocation behavior from an updated resource.

Inspection can recover fully sealed local artifacts if the process stopped before recording their locations. Incomplete artifact output is preserved for review. If inspection stopped during local generation, confirm that no cloud-mutation phase began, move that incomplete output aside for evidence, and resume inspection using the original planned path. Do not edit a manifest or extend its expiry to bypass verification.

The pinned deployment adapter captures the two affected scheduler definitions without creating or updating their jobs during Functions deployment. Existing jobs stay paused; new jobs stay absent. The opening phase applies the captured definitions only after checking the deployed Functions, schema and current authority, then restores original job states. Newly introduced jobs are enabled at that controlled opening.

Do not run two operators or unfinished runs against the same project concurrently. Project ownership and process locks protect runs in this checkout; operators using other checkouts or computers must coordinate the maintenance window separately. A stale process lock requires explicit operator recovery with a recorded reason; do not remove a live process's lock or force another phase through it:

```sh
npm run authorization:migrate -- unlock \
  --project sodc-web-production --run-id prod-auth-reviewed \
  --reason "reviewed interrupted-process recovery reference"
```

Unlocking does not complete a phase or release any server restriction. A dead parent process does not establish that its Firebase/gcloud children or a submitted provider operation have finished. Before unlocking, verify those processes and provider operations have settled, retain that evidence with the recovery reason, then audit live state before resuming the same run.

If the live API is already strict, an earlier journal entry does not permit redeploying compatibility. Resolve uncertain outcomes forward. Restore only the intended invocation bindings using fresh policy versions, preserving unrelated changes; do not blindly overwrite current IAM with an old snapshot.

Rollback retains the schema, security versions and current authority. Prefer a reviewed Hosting rollback or Functions correction while leaving strict checks in place. Never restore claim-only connectors, historical Potential Lost signatures, old authorization versions or an old Auth claim snapshot after strict cutover.

The receipt at `.firebase/authorization-migration/<project-id>.json` records this project's migration epoch and reviewed evidence. It is not a substitute for the audit, and the tool must not create it merely to unlock deployment. Do not copy a receipt between projects or fabricate one after a failed phase.

Functions verification binds a clean reviewed checkout and structured deployment to the recorded storage source, revision, update time and runtime metadata, then checks those identities again before opening and issuing the receipt. It does not independently download, hash or rebuild deployed archives. Local tests use simulated providers; the reusable adapter still needs a live rehearsal and the separate environment acceptance evidence before production use.

After the Production migration receipt, backend readiness, matching Dev acceptance and Production go/no-go are complete, use the ordinary `npm run deploy:prod` workflow from the reviewed checkout. Complete the remaining Production browser smoke/acceptance checks after Hosting deployment. Those commands perform their own preflight and deploy Data Connect, Functions and Hosting in order. The migration receipt does not waive broader browser, App Check, realistic-volume, Dev acceptance or Production go/no-go requirements.
