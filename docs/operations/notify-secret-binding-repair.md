# Checkout reconciliation Notify binding repair

This is the bounded operational companion to [#745](https://github.com/rafsodc/sodc-web/pull/745)
for [#744](https://github.com/rafsodc/sodc-web/issues/744). The source fix declares the
Notify secrets used by `reconcileMyCheckoutSessionOrders`. The ordinary Functions
guard correctly rejects a change to an existing endpoint's secret contract, before
producing any proposal. An environment review cannot waive that rejection.

Review this procedure alongside #745 before merging the source fix. This tool can
merge first without changing the ordinary guard. Preparing a repair requires a
clean integration checkout containing both changes and a fresh Functions build.
Source approval alone does not establish deployed secret access or delivery.

**Dev rehearsal outcome:** Google rebuilt the target during the approved secret-only
PATCH, so the original unchanged-build/source verification correctly failed. Keep
the existing claim and failed result intact. Further repair execution, including
Production, is on hold pending a separately reviewed rebuild-aware procedure. The
[read-only evidence tool](./notify-binding-evidence.md) can assess the known Dev
operation and capture prospective component evidence; it cannot waive this failed
contract, authorize another PATCH or replay the operation.

## Exact scope and limits

The only provider write is one Cloud Functions v2 PATCH of
`serviceConfig.secretEnvironmentVariables` on
`europe-west2/reconcileMyCheckoutSessionOrders`, in Dev (`sodc-web`) or Production
(`sodc-web-production`). It preserves the existing numeric `STRIPE_SECRET` binding
and adds the existing numeric versions of `GOV_NOTIFY_LIVE_API_KEY`,
`GOV_NOTIFY_TEAM_API_KEY` and `GOV_NOTIFY_TEST_API_KEY`. The configured mailer eagerly
resolves all three modes, so all three are required even in SIMULATION.

It does not deploy source, use Firebase's release fabricator, change IAM, read secret
payloads, create/rotate keys, invoke reconciliation, send a test message, or replay
failed notifications. Once repaired, normal reconciliation can send its usual
messages according to the existing delivery ceiling and ledger.

Preparation requires all of the following, and refuses to infer a replacement:

- Node 24, the locked SDK 7.2.5, clean tracked source and the actual compiled SDK
  manifest; target callable declares exactly the four expected secrets.
- Complete matching active Functions inventories, and enabled Scheduler jobs.
  The target is Gen 2 Node 24, uses the project's default compute account, routes
  all traffic to the latest revision and has maximum instances **20**.
- Existing same-project bindings for each secret use one numeric version across
  the inventory. That version is enabled and equals the `latest` metadata.
- Each secret's resource IAM policy already directly grants the target runtime
  account unconditional `roles/secretmanager.secretAccessor`. Inherited-only,
  conditional-only or custom-role access is outside this workflow. This is
  evidence of a direct grant, not a proof about organization deny policies,
  effective runtime access, credential validity or email delivery.

The proposal binds the commit/tree, actual tracked bytes, compiled build, SDK and
manifest, all Function configurations and invoker policies, Scheduler configuration,
secret versions and secret IAM. All must still match before PATCH. Afterwards,
only the target's secret bindings, revision and update time may change. Target
build/source provenance and every other Function must stay unchanged; naturally
changing Scheduler attempt/schedule/status fields and IAM etags are excluded.

The [Function PATCH API](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch)
supports a field mask. Its [request contract](https://docs.cloud.google.com/functions/docs/reference/rpc/google.cloud.functions.v2#updatefunctionrequest)
provides no compare-and-swap or idempotency key. The documentation does not promise
that this update avoids a build. **Establish that behaviour in Dev before approving
Production**; an unexpected build/provenance change fails verification. Coordinate
a maintenance window with every operator/automation that can change Functions,
IAM, secrets or schedules. Local locking does not exclude a different clone,
machine or cloud administrator.

## Prepare privately, without a provider write

Use the reviewed integration commit and locked dependency trees, then build:

```sh
npm ci
npm ci --prefix functions
npm --prefix functions run build
npm run operations:notify-bindings -- --env dev --phase prepare --run-dir /private/tmp/sodc-notify-binding-dev-REPLACE
```

Use a new absolute directory under `/private/tmp`, with no symlink ancestors (on
macOS `/tmp` is a symlink). The tool creates it with mode 0700 and files with 0600.
Preparation reads project/Functions/Run/Scheduler/Secret Manager metadata only.
It never calls a secret payload access route or Notify. Provider errors use fixed
codes, without response bodies or CLI stderr.

The private directory contains:

- `proposal.json`: exact before/after numeric references, source binding and
  baseline fingerprints; it expires after one hour.
- `review-template.json`: deliberately unapproved review fields.
- `comparison.key`: private random HMAC comparison material, **not a Notify API
  key**. Never print it, upload it, put it in a PR/chat or include it in an evidence
  archive. Baseline fingerprints cannot be checked without this local file.
- `initialized.json`: confirms the private inputs completed durable initialization.

Inspect the exact proposal, source and inventory evidence. Confirm the preserved
Stripe reference, three additions, environment, target, numeric versions, scope,
limits and expiry. Copy `review-template.json` to `review.json` in the same private
directory. Retain mode 0600. Keep the proposal hash and schema intact; set
`decision` to `APPROVED`, and supply the actual `reviewedBy` and `reason`. This
review is for this operation only, and is distinct from normal deployment reviews.

An expired or changed proposal needs a new preparation/review **before any intent
has been recorded**. Stop on unexpected live settings instead of widening this
tool. It deliberately has no arbitrary endpoint, secret, IAM or override flags.

## Apply once, then verify by reads

Only after explicit approval of the exact Dev proposal:

```sh
npm run operations:notify-bindings -- --env dev --phase apply --run-dir /private/tmp/sodc-notify-binding-dev-REPLACE
npm run operations:notify-bindings -- --env dev --phase verify --run-dir /private/tmp/sodc-notify-binding-dev-REPLACE
```

Apply rechecks source, review, versions, policies and the live baseline. Before the
single PATCH it durably records both a repository-wide project claim and
`intent.json`. Claims live in the shared checkout's
`.firebase/notify-binding-repair-locks/<project>.json`, so worktrees share them.
They persist on success or failure. **There is no unlock/reset command.** The
boundary assumes the owning user and root are trusted; it does not defend against
an owner deliberately editing/deleting private state.

An accepted request records only its operation name. It is not a successful repair.
Verify reads that [long-running operation](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.operations/get),
checks its target/update scope, and collects a new complete inventory only once it
has finished successfully. It preserves immutable sanitized verification records.

| Result | Exit | Action |
| --- | --- | --- |
| `REVIEW_REQUIRED` / `HELP` | 0 | No mutation; proposal still needs exact approval. |
| `APPLY_ACCEPTED_VERIFY_REQUIRED` | 3 | Run verify; do not run apply again. |
| `PENDING` | 3 | Wait, then repeat verify (read-only). There is no automatic polling. |
| `PASS` | 0 | Metadata preservation verified; continue acceptance below. |
| `UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED` | 3 | The request may have committed. Stop for separate operator investigation. |
| `OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED` | 3 | Stop and investigate the recorded operation; no automatic retry. |
| Blocked input, drift or local failure | 1 | Stop; a durable intent/claim may already exist. Inspect before any next action. |

A timeout, lost response, malformed acknowledgement or failed acknowledgement-file
write after intent is an **unknown outcome**, even if a later manual metadata read
looks correct. No missing acknowledgement is reconstructed automatically, and no
second PATCH is sent. Never remove an intent/claim or edit an operation record to
force retry or PASS. A failed fsync can leave a claimed run without a usable local
intent; that also requires a separately reviewed recovery procedure. Verification
may continue after proposal expiry for an acknowledged request started in time.

## Dev acceptance, then separate Production approval

First establish the real API behaviour in Dev. Verify unchanged build/source,
maximum instances 20, environment, identity, invokers, all unrelated endpoints and
Scheduler settings, and the four exact enabled numeric bindings. If the API changes
other provenance or configuration, stop; do not adjust the baseline to accept it.
Collect a fresh ordinary Functions guard and full preflight from the final release
commit. This tool never writes or refreshes their receipts.

Metadata does not prove the runtime can use a key. Any controlled runtime/send
acceptance must be separately scoped and approved, use disposable data and respect
Dev's delivery ceiling. Do not replay old failed/skipped notifications or reconcile
real payments as an implicit test. Verify the source fix's intended mail paths as
part of that approved acceptance, then document the outcome and remaining limits.

Prepare Production separately from a fresh read-only baseline on the approved final
commit. Require a new exact review and maintenance authorization; the Dev review
cannot authorize Production. Repeat the same apply/verify and acceptance gates.
Only then can normal Functions releases resume. A Hosting-only release remains
independent of this repair, and neither PR should claim that merge alone fixed the
live callable.
