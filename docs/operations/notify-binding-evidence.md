# Read-only Notify binding evidence

The first Dev rehearsal of the [binding repair](./notify-secret-binding-repair.md)
installed the intended secret references, but Google rebuilt the Function during
the secret-only configuration update. The original verifier correctly failed
`provider-baseline-drift`. Its approved contract required unchanged build/source
provenance. That failed result remains authoritative.

The `operations:notify-binding-evidence` command collects evidence for
[#744](https://github.com/rafsodc/sodc-web/issues/744). It has two read-only phases:
`reconcile` assesses an acknowledged Dev operation against its original records;
`capture` records a new observation with component fingerprints. Neither phase
applies changes, accepts risk, grants a waiver, replays a request or authorizes a
release. There is no apply, unlock or acceptance flag.

## Current Dev boundary

The known Dev update completed, and the expected three Notify version-1 bindings
are present alongside Stripe version 1. The target is active with max instances
20. Read-only comparison found the other 84 Functions, all 85 invoker policies,
the five Scheduler configurations and the secret version/policy baselines intact.
Only the target's normalized whole-Function fingerprint changed. Google created
a new build and container image.

The original proposal retained an opaque fingerprint of the target. It did not
retain the old component values or an independently usable historical source
archive hash. Therefore a new current-state capture cannot prove every old target
setting stayed unchanged, or that old/new source archives contain identical bytes.
Matching current critical settings is useful evidence, but does not fill those
historical gaps. A successful provider operation is not acceptance of the original
no-build contract.

Retain the original proposal, private comparison key, approval, intent, project
claim, operation acknowledgement and failed verification. Do not edit them, remove
the claim, retry apply or create a replacement baseline as proof of success. A
rollback would be another update and is outside this procedure.

## Prepare the two source checkouts

Use Node 24 and locked dependencies. The evidence tool must run from a clean,
reviewed checkout. `--source-root` identifies a separate clean application checkout
with its actual compiled Functions build and SDK 7.2.5.

For reconciliation, retain the exact original application checkout bound by the
approved proposal. Its commit, tree, tracked bytes, build, SDK and manifest must
still match. The new evidence tool's commit/tree and actual tracked bytes are
recorded separately; new verifier code cannot silently replace the original
source binding.

For a new capture, the application checkout must contain the reviewed Notify
secret declaration from #745, even if the live Function still has only Stripe.
This is candidate-source evidence, not proof that candidate source is deployed.
An observation accepts either the original Stripe-only binding set or the exact
four-key set. Other keys or ambiguous references fail closed.

Both checkouts' `.firebaserc` aliases must match the explicit environment. Only
Dev `sodc-web` and Production `sodc-web-production` are supported for capture;
reconciliation is limited to Dev. No production repair is enabled by this tool.

## Reconcile the known Dev operation

Use a **new** private output directory outside both source checkouts, the old run
directory and the repository's shared `.firebase/notify-binding-repair-locks`
directory. Output must not contain any of those protected directories either.
The command resolves the nearest existing ancestors, conservatively compares
case and Unicode aliases on macOS, and repeats this boundary check immediately
before initialization. These checks narrow local path races; they are not atomic
protection against a malicious local process renaming directories. On macOS
prefer `/private/tmp` because `/tmp` is a symlink. Do not copy the original run
into release evidence.

```sh
npm run operations:notify-binding-evidence -- \
  --phase reconcile --env dev \
  --source-root /private/tmp/sodc-approved-application-source \
  --run-dir /private/tmp/sodc-original-dev-binding-run \
  --output-dir /private/tmp/sodc-dev-binding-reconciliation-NEW
```

The reader requires private owned files and validates the original initialized
run, proposal, approval, intent, operation acknowledgement and project claim. The
approval must bind the exact proposal; the intent must bind both hashes and have
started inside the original one-hour window. Read-only reconciliation can occur
after that window. It cannot start a new operation.

A missing acknowledgement stays unknown before any provider request; current
metadata cannot manufacture one. For a known operation, the tool fetches a complete
current snapshot, then the operation, and requires the original target/update
scope. Pending and failed operations produce explicit unresolved results. A
successful operation is compared using the original collector's unchanged HMAC
transformations. Unrelated Function, access, Scheduler, secret or approved-binding
drift blocks the assessment.

The tool reads metadata for bound Run revisions, the current/operation Cloud Build
and a pinned managed source object where available. Reports project only selected
identities, checksums, statuses and timestamps. They omit containers' environment
values, arbitrary annotations, build steps, substitutions, request resources,
source tokens, bearer tokens and provider error bodies. Missing metadata is an
explicit evidence gap.

Reports use schema `sodc-notify-binding-reconciliation/v1`, and always contain
`originalContractAccepted: false`, `releaseAuthorized: false` and
`productionAuthorized: false`. Historical target preservation stays `UNKNOWN` when
its opaque fingerprint differs. A matching fingerprint is described only as a
matching opaque fingerprint. Historical source archive equality stays `UNPROVEN`.
The report never overwrites the original failure or creates a normal guard receipt.

## Capture prospective observations

```sh
npm run operations:notify-binding-evidence -- \
  --phase capture --env dev \
  --source-root /private/tmp/sodc-reviewed-application-source \
  --output-dir /private/tmp/sodc-binding-observation-NEW
```

Capture records the complete original-style baselines plus the target's full
fingerprint, selected-field fingerprints and a bounded fingerprint tree covering
unknown fields. Environment names and values have separate HMACs; arbitrary field
paths are also HMACs. Absent, empty and populated values remain distinguishable.
No entire `buildConfig` is discarded. A future verifier can distinguish build
identity/provenance changes from runtime/build option changes using evidence
actually captured before its request.

The directory is mode 0700, files are 0600, writes are exclusive and synced, and
`initialized.json` is written last. A new `comparison.key` accompanies capture.
Keep it private; never log it, upload it or put it in an evidence archive. A
reconciliation output never receives a copy of the original key. Old records and
the key are reread before output, and source/tool bindings are rechecked after
awaited reads. Changed inputs stop report creation.

Schema `sodc-notify-binding-capture/v1` means **observation only**. It is incompatible
with a v1 repair proposal and grants no mutation authority. A post-operation
observation must never be represented as historical pre-operation evidence.
Provider reads are bounded but not an atomic cloud snapshot.

## Evidence strength

- The same resolved bucket/object and positive generation identify one immutable
  source-object version. Names without a pinned generation establish less.
- A SHA-256 bound to the actual resolved input archive can establish archive-byte
  identity across different references. Arbitrary matching file hashes cannot.
- GCS MD5, CRC32C and size are supporting integrity data, not strong source identity
  or equivalent executable-image proof. Source payloads are never downloaded.
- A digest-pinned container image identifies an image artifact. A different digest
  is a different artifact, even if source may match.
- The operation build name matching the Function build associates a build with an
  update. It does not alone prove source identity or preservation of old settings.

Cloud Build may omit source hashes and result-image metadata. Empty fields remain
unknown. Reconciliation does not issue signed download capabilities or search
historical assets. A future recovery using historical data would need its own
review; recovered values must authenticate against the original fingerprint.

## Results and remaining gates

| Result | Exit | Meaning |
| --- | --- | --- |
| `CAPTURED_OBSERVATION_NOT_APPROVAL`, help | 0 | Observation/help completed; no approval or release authorization. |
| `REVIEW_REQUIRED_WITH_HISTORICAL_GAPS` | 3 | Known completed operation, with protected checks and explicit gaps for review. |
| `UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED` | 3 | No acknowledgement; no success inference and no replay. |
| `PENDING` | 3 | Repeat only read-only assessment later, to a new output directory. |
| `OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED` | 3 | Investigate the known failed operation. |
| `BLOCKED_DRIFT` or invalid inputs/provider data | 1 | Stop; protected state or evidence integrity is not established. |

The present Dev case still requires an explicit separately reviewed decision about
its historical evidence gaps, plus separately authorized runtime acceptance. An
authenticated invalid-order callable probe is not read-only: it consumes rate-limit
state before validation and does not establish Notify key access. Real paid-order
paths can mutate payment and notification data. No such probe is implicit here.

Production repair remains on hold. A future mutation procedure must explicitly
review the rebuild expectation, collect sufficient pre-operation component and
source/image evidence, retain one-shot/no-replay safeguards, and pass Dev acceptance.
It requires a separate PR/review and exact Production proposal/maintenance approval.
Fresh ordinary guard and full preflight remain necessary afterwards; these reports
cannot substitute for their receipts.

Primary API references: [Run revisions](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services.revisions),
[Cloud Build source provenance](https://docs.cloud.google.com/build/docs/api/reference/rest/v1/projects.builds#SourceProvenance),
[Storage generations](https://docs.cloud.google.com/storage/docs/metadata#generation-number),
and [object metadata](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/get).
