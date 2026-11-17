# Deployment configuration and health checks

Tracked in [GitHub issue #437](https://github.com/rafsodc/sodc-web/issues/437).

Before deploying Functions, follow the [runtime configuration guard workflow](./functions-runtime-config-guard.md).
The standard preflight/deployment wrappers and `npm run deploy:functions -- --env <dev|beta|prod>`
require fresh metadata checks and hash-bound configuration review; a raw Firebase
Functions deploy bypasses that supported guard.

The repository provides a read-only audit for Dev, Beta, and Prod. It compares
the selected Firebase alias with version-controlled expectations, inspects the
deployed Firebase/GCP resources, and performs non-destructive Hosting checks.
It never enables APIs, changes IAM, deploys resources, or reads secret values.

## Prerequisites

- Install and authenticate the Firebase CLI and Google Cloud CLI (`firebase
  login` and `gcloud auth login`). These are independent sessions.
- Use an identity with read access to the selected project. Typical permissions
  include Firebase Viewer, Cloud Functions Viewer, Cloud Run Viewer, Secret
  Manager Viewer, Service Usage Viewer, Storage Viewer, IAM Security Reviewer,
  Logs Viewer, and equivalent Data Connect/Hosting read permissions.
- The transactional-template audit also needs permission to execute read-only
  Data Connect service queries. It reads saved template-binding configuration,
  not member profiles, recipients, booking contents or notification payloads.
- Do not use an unrestricted production owner account in CI. Prefer Workload
  Identity Federation and a dedicated read-only service account.
- Run from a clean checkout of the release being inspected.

The CLI resolves `dev`, `beta`, or `prod` through `.firebaserc` and requires the
result to match `config/deployment-check.json`. Every Firebase and gcloud command
also receives the explicit project ID. A missing or mismatched alias stops the
audit before remote inspection.

## Usage

```sh
npm run deployment:check -- --env dev
npm run deployment:check -- --env beta --expected-sha "$(git rev-parse HEAD)"
npm run deployment:check -- --env prod --expected-sha "$(git rev-parse HEAD)" --json
npm run deployment:check -- --env beta --expected-sha "$(git rev-parse HEAD)" --json --out report.json
```

For a focused transactional-template configuration check, without the rest of
the deployment audit:

```sh
npm run deployment:template-readiness -- --env dev
npm run deployment:template-readiness -- --env prod --json --out template-readiness.json
```

The full deployment audit reports the same check as
`gov-notify-template-readiness`. It also runs during the standard deployment
preflight, so missing effective template configuration blocks that preflight.
It does not send a test message or repair bindings.

The command exits non-zero when a required check fails. Warnings identify
manual review or unexpected resources but do not change the exit status. JSON
output uses `sodc-deployment-check-report/v1` and is suitable for a short-lived
CI artifact; it contains summaries and resource names, not secret values,
tokens, signed URLs, or raw log messages. Pass `--out <path>` to also write the
JSON report to a file (the file is always the JSON form, regardless of
whether `--json` is set for stdout) — this is how an operator or a future
authenticated CI job retains a Beta/Production audit as a short-lived release
artifact.

## What is checked automatically

- the Firebase alias resolves to the expected explicit project ID;
- the Firebase project and at least one Web app are visible;
- required Google Cloud APIs are enabled;
- the expected Data Connect service and `api` connector exist;
- the declared Cloud SQL instance/database use the expected region and have
  automated backups, point-in-time recovery, and deletion protection enabled;
  this is a hard failure on Beta and Prod, and a warning-only check on Dev per
  each environment's `requireCloudSqlResilience` flag in
  `config/deployment-check.json` — Dev data is disposable and does not warrant
  the backup-storage cost;
- the expected Hosting site exists;
- every Function exported from `functions/src` is deployed, Gen 2, `ACTIVE`,
  and in `europe-west2`; unexpected Functions are reported as warnings;
- all transactional keys and their sender Functions in
  `config/notify-template-readiness.json` have a well-formed effective template
  ID: a saved Data Connect binding, or an environment fallback on each executing
  Function when that binding is absent. The contract covers the current template
  manifest, including the recovery sender and the reply-to verification test's
  use of `emailVerification`. Missing sender metadata, missing-both configuration,
  malformed or duplicate configuration and unreadable bindings fail the check;
- when the optional GOV.UK Notify migration reply-to value is present, it is a
  valid UUID and is consistent across every deployed Function; absence is valid
  because new environments use the admin-managed configuration;
- every deployed Function's underlying Cloud Run service has the expected
  invoker IAM policy: HTTP/callable transports in the reviewed allowlist are
  public, while scheduled/task Functions and unexpected services must not grant
  invocation to `allUsers` or `allAuthenticatedUsers`;
- required Secret Manager resources exist without reading their values;
- the environment-specific section-file bucket has uniform bucket-level
  access, public-access prevention, and the checked-in temporary-upload
  lifecycle rule;
- the upload Function runtime has explicit bucket object-admin and keyless
  signing permissions;
- the scale-to-zero malware-scanner Cloud Run service and definitions job
  exist, the scanner is not public, and the Functions runtime can invoke it;
- the Hosting root and `/account` deep link respond and carry the required
  security headers;
- Hosting serves `deployment-manifest.json` for the expected environment and,
  when supplied, the expected Git SHA; and
- the number—not the contents—of ERROR-level Cloud Logging entries from the
  previous 30 minutes is reported.

Expected Functions and Firebase secrets are discovered from checked-in source
contracts. The explicit `expectedPublicInvokerFunctions` allowlist must match
the source's HTTP and callable exports, so adding or removing an endpoint
requires a reviewed infrastructure-contract change. Environment-specific
resource expectations and required APIs live in `config/deployment-check.json`;
update and review that file whenever the infrastructure contract changes.

## Transactional-template readiness limits

The template audit joins saved binding metadata with each deployed sender's
environment metadata. A well-formed saved binding is sufficient: it does not
require an unnecessary environment fallback as well. When a binding exists but
is malformed, the audit fails instead of treating a fallback as a substitute,
because runtime sending gives that saved ID precedence. A failed binding read
also fails the audit; it cannot prove the binding is absent.

Keep the reviewed key-to-sender mapping in
`config/notify-template-readiness.json` up to date when adding a template or
moving a send path. Include scheduled recovery and administrative test senders,
not only the callable that first creates the domain record.

Use the canonical hyphenated UUID shape with no surrounding whitespace for both
saved IDs and fallback values. The audit applies this conservative format rule
uniformly, including the reply-to verification test, even though that particular
sender trims its environment fallback at runtime. Other configured mailers
preserve nonempty fallback values as supplied.

This check uses Google OAuth and the read-only Data Connect service operation
`executeGraphqlRead` (a POST carrying a query), plus Function metadata reads. It
does not use a member's browser token, access secret payloads, call Notify or
change any data. Keep its report alongside the release evidence.

A UUID-shaped ID is configuration evidence, not proof that the template exists
in the selected Notify service, has approved content or will be delivered. Review
the exact template name, ID, subject, body, placeholders and live version using
**Email Templates → Refresh**, following the
[registration runbook](./govuk-notify-template-registration.md). A version-review
reminder is separate from missing configuration and does not itself block
sending. Neither a green readiness report nor a reviewed version proves actual
email delivery; that needs a separately approved end-to-end test.

The audit observes a point-in-time deployed configuration. Coordinate concurrent
binding/environment changes and re-run it after deployment or a configuration
repair. It neither releases nor cancels a notification backlog. Review recovery
eligibility before applying bindings, and preserve the duplicate-suppression
history when stale notifications are explicitly cancelled as `SKIPPED`.

The older `npm --prefix functions run check:template-sync` drift checker is a
separate informational tool. It still uses `template-registry.json`, which is
retired as runtime configuration but retained for that checker; it does not read
the live bindings used by this readiness audit. The existing PR/nightly jobs pass
`GOV_NOTIFY_API_KEY`, while that checker expects `GOV_NOTIFY_LIVE_API_KEY` and
skips with a successful exit when the latter is absent. Neither a green nor a
skipped legacy result is live-binding or readiness evidence. Those jobs and the
checker are unchanged here; modernizing their credential wiring or adding an
authenticated readiness CI job requires a separate authentication review.

## Deployment manifest

Every Vite build emits `dist/deployment-manifest.json`:

```json
{
  "schemaVersion": "sodc-deployment-manifest/v1",
  "environment": "beta",
  "gitSha": "<full commit SHA>",
  "builtAt": "<UTC ISO timestamp>"
}
```

The manifest is deliberately non-sensitive. `build:dev`, `build:beta`, and
`build:prod` derive the environment from their fixed Vite mode. In GitHub
Actions the SHA comes from `GITHUB_SHA`; locally it comes from `git rev-parse
HEAD`.

## Optional authenticated smoke check

Use a dedicated short-lived test identity with the minimum application access
needed by the read-only admin configuration callable. Put its Firebase ID token
in an environment variable and never in a command argument, shell history,
file, GitHub issue, or CI artifact:

```sh
read -s SODC_DEPLOYMENT_CHECK_AUTH_TOKEN
export SODC_DEPLOYMENT_CHECK_AUTH_TOKEN
npm run deployment:check -- --env beta --authenticated
unset SODC_DEPLOYMENT_CHECK_AUTH_TOKEN
```

The token is sent only to the explicitly resolved environment's callable URL.
The report does not include it. Production use requires an approved dedicated
test identity and secret-handling mechanism; do not borrow a member or operator
session token.

## Automated checks added after initial release

The following were originally "manual checks that remain" (below) but are now
read-only automated checks, added once production use surfaced real gaps they
would have caught:

- **App Check enforcement** -- `firebaseappcheck.googleapis.com`'s services
  API reports per-service `enforcementMode`. FAILs if any configured service
  is absent; WARNs while every service is registered but at least one remains
  `UNENFORCED` (monitoring-only); PASSes only once every configured service is
  present and `ENFORCED`.
- **Auth providers and authorized domains** -- Identity Platform's admin
  config API confirms email/password sign-in is enabled, every expected
  canonical domain is authorized, and `localhost` is authorized only in `dev`.
- **Deployed Storage rules content and a negative unauthenticated probe** --
  the Firebase Security Rules API's deployed ruleset is byte-compared
  (whitespace-normalized) against the checked-in `storage.rules`, and an
  authenticated inventory selects a known existing object, then an
  unauthenticated fetch must receive an explicit HTTP 401/403 denial. Missing
  objects and provider errors fail the check rather than masquerading as a
  successful authorization denial.
- **Scanner service-account scope** -- confirms the malware scanner's service
  account carries no project-level IAM roles at all, only the specific
  resource-level grants checked elsewhere.
- **Malware-definition refresh health** -- confirms the Cloud Scheduler
  refresh job is `ENABLED` and its most recent attempt succeeded within the
  last few hours. Deliberately checks the scheduler's own execution health
  rather than the definitions file's content timestamp -- ClamAV's upstream
  `daily.cld` doesn't necessarily change every time the refresh job runs, so a
  content-age check would false-fail on a job that ran successfully but found
  nothing new to download.

These calls use an access token against Google/Firebase Management REST APIs
that have no `gcloud`/`firebase` CLI equivalent (App Check, Identity
Toolkit config, Firebase Security Rules) using the same credentials already
required for every other check -- no new authentication surface.
The transactional-template check additionally uses the Data Connect read-only
service operation described above.

## Manual checks that remain

The CLI deliberately reports a warning for controls that cannot be proved
safely and completely through the current read-only APIs:

- App Check valid-token traffic metrics (enforcement mode itself is now
  automated -- see above);
- SQL restore-test results (backups, point-in-time recovery, and deletion
  protection are automated; actually performing a restore is destructive and
  out of scope for a read-only audit);
- alerts, incident contacts, budget notifications, and external dashboard
  configuration; and
- end-to-end member journeys that require real test data.

Complete the relevant deployment-runbook checklist alongside the automated
report. A green command does not replace Beta UAT or production go/no-go review.

## CI usage

The **Deployment safety tests** job in `.github/workflows/pr-tests.yml` (`npm
run test:deploy-safety`) runs on every PR and covers the deploy/preflight/audit
scripts' own logic (plan ordering, `--from` resumption, drift/config checks,
report generation) — it does not deploy or inspect any real environment, so it
needs no cloud credentials.

Actually running the audit itself against a live environment from CI is a
separate, not-yet-taken step: it needs read-only Workload Identity Federation
and a dedicated CI identity, which have not been set up. Once they are, the
JSON form with `--out` is the intended shape:

```sh
npm run deployment:check -- \
  --env beta \
  --expected-sha "$GITHUB_SHA" \
  --json \
  --out deployment-check-report.json
```

Retain reports only for the release-audit period. Do not enable authenticated
checks until the CI identity/token exchange and dedicated application identity
have been separately reviewed.

## Troubleshooting

- **Alias mismatch:** update `.firebaserc` or the reviewed expectations; never
  bypass the check with a raw project ID.
- **Missing manifest:** redeploy Hosting with the environment-specific command;
  deployments created before #437 do not contain it.
- **SHA mismatch:** the live Hosting release is not the checkout being audited,
  or a stale build was deployed. Rebuild and redeploy the reviewed commit.
- **Unexpected Function:** establish ownership and whether it is still used
  before deleting anything. The audit never deletes it.
- **Notify reply-to failure:** if retaining the migration fallback, configure its
  environment-specific UUID using [the reply-to runbook](./govuk-notify-email-reply-to.md),
  deploy all Functions, and rerun the audit. A partial Functions deployment can
  leave inconsistent values and is reported as a failure. No fallback is required
  once verified admin-managed configuration is in place.
- **Function invoker mismatch:** review both the exported trigger type and
  `expectedPublicInvokerFunctions`. Never add an endpoint to the allowlist only
  to make the check green; confirm its Firebase/app-level authentication and
  authorization before approving public transport access.
- **Permission denied:** grant the audit identity only the missing read role and
  rerun. Do not switch to Owner merely to make the report green.
- **Warnings about recent errors:** inspect the bounded entries directly in
  Cloud Logging; raw log messages are intentionally omitted from the report.
