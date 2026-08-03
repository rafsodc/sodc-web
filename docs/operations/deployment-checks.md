# Deployment configuration and health checks

Tracked in [GitHub issue #437](https://github.com/rafsodc/sodc-web/issues/437).

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
```

The command exits non-zero when a required check fails. Warnings identify
manual review or unexpected resources but do not change the exit status. JSON
output uses `sodc-deployment-check-report/v1` and is suitable for a short-lived
CI artifact; it contains summaries and resource names, not secret values,
tokens, signed URLs, or raw log messages.

## What is checked automatically

- the Firebase alias resolves to the expected explicit project ID;
- the Firebase project and at least one Web app are visible;
- required Google Cloud APIs are enabled;
- the expected Data Connect service and `api` connector exist;
- the declared Cloud SQL instance/database use the expected region and have
  automated backups, point-in-time recovery, and deletion protection enabled;
- the expected Hosting site exists;
- every Function exported from `functions/src` is deployed, Gen 2, `ACTIVE`,
  and in `europe-west2`; unexpected Functions are reported as warnings;
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

## Manual checks that remain

The CLI deliberately reports a warning for controls that cannot be proved
safely and completely through the current read-only APIs:

- App Check registration, valid-token metrics, and enforcement state;
- Authentication providers and authorized domains;
- the active Firebase Storage ruleset and a negative unauthenticated probe;
- scanner service-account scope beyond the required invocation permission;
- malware-definition freshness and the scheduled refresh job;
- SQL backups, point-in-time recovery, deletion protection, and restore tests;
- alerts, incident contacts, budget notifications, and external dashboard
  configuration; and
- end-to-end member journeys that require real test data.

Complete the relevant deployment-runbook checklist alongside the automated
report. A green command does not replace Beta UAT or production go/no-go review.

## CI usage

Run the JSON form after deployment using read-only Workload Identity Federation:

```sh
npm run deployment:check -- \
  --env beta \
  --expected-sha "$GITHUB_SHA" \
  --json
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
