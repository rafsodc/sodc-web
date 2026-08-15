# New production instance provisioning

This runbook provisions a new, isolated production instance of SODC Web. It is
for the **first** deployment into a new Firebase/Google Cloud project. For
subsequent releases, use [Dev, Beta, and Prod environments](./environments-dev-beta-prod.md).

The examples assume the checked-in production alias:

```text
alias:       prod
project ID:  sodc-web-production
region:      europe-west2
site URL:    https://sodc-web-production.web.app
```

If the real project ID differs, update `.firebaserc`, the Hosting CSP in
`firebase.json`, environment files, callback URLs, and the commands below before
deploying. Never point Prod at a Dev or Beta Firebase project, Stripe account,
webhook secret, Notify service, or reCAPTCHA key.

## 1. Owners, prerequisites, and change record

Before making changes, name one release operator and one reviewer. Record the
project ID, billing account, region, release commit, owners, planned launch time,
and rollback decision-maker in the private operations record. Do not put secret
values in the issue, repository, shell history, or screenshots.

The operator needs:

- Owner-equivalent project-bootstrap access, followed by least-privilege IAM;
- permission to attach the approved Google Cloud billing account;
- Firebase CLI access and a current Node/npm toolchain;
- production access to Stripe and GOV.UK Notify;
- control of any production DNS zone and reCAPTCHA configuration; and
- access to the team's secret manager and incident/alert destinations.

Start from the reviewed commit that passed Beta. Use a clean checkout:

```sh
git switch main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
npm ci
npm --prefix functions ci
firebase login
firebase projects:list
```

`git status --short` must be empty. Record the commit SHA.

## 2. Create the Firebase project and attach billing

Prefer the Firebase console when organization policy, billing, data location,
and IAM choices need review. Either create a new project there, or create it with:

```sh
firebase projects:create sodc-web-production --display-name "SODC Web Production"
```

For an existing Google Cloud project, add Firebase instead:

```sh
firebase projects:addfirebase sodc-web-production
```

In Google Cloud Billing, attach the approved billing account. Cloud Functions,
Secret Manager, and the Cloud SQL database used by Data Connect require a billed
project. Configure budget notifications as an early warning; budgets do not cap
spend automatically.

Confirm that `prod` maps to the intended project in `.firebaserc`:

```sh
firebase use --add
firebase use prod
firebase projects:list
```

Stop if the displayed project ID is not the production project. Keep using
`--project prod` on every mutating command even when the active alias is Prod.

## 3. IAM, audit, and operational safeguards

During bootstrap, keep the number of project owners minimal. After provisioning:

1. replace broad temporary roles with least-privilege operator, deployer, viewer,
   billing, and incident-response groups;
2. require MFA through the organization's identity policy;
3. use a dedicated CI identity with short-lived/workload identity credentials,
   not a downloaded long-lived service-account key;
4. retain Admin Activity, Data Access, Functions, SQL, Auth, and Secret Manager
   audit logs according to club policy; and
5. configure alerts for Functions errors, webhook failures, SQL availability and
   storage, unusual Auth activity, and budget thresholds.

Record who can deploy, administer users, read production data, manage secrets,
and restore backups. Test the incident contacts before launch.

## 4. Register the web app and Hosting site

Register one production Web app in Firebase Project settings. This can be done in
the console or with the CLI:

```sh
firebase apps:create web "SODC Web Production" --project prod
firebase apps:list web --project prod
firebase apps:sdkconfig web <app-id> --project prod
```

Use the returned SDK configuration to create the ignored root file
`.env.production.local`:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=sodc-web-production
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_RECAPTCHA_SITE_KEY=
```

Firebase web configuration and publishable keys are public identifiers, but the
file remains untracked to prevent accidental cross-environment builds. Verify:

```sh
git check-ignore .env.production.local
```

Hosting is created on the first Hosting deploy. It is safe, and recommended, to
provision and privately test Prod first at
`https://sodc-web-production.web.app`. A custom domain can be connected to the
same Hosting site later without recreating the Firebase project, database,
Functions, users, or deployed application. Keep the `web.app` address private
during commissioning and do not announce it as the permanent member URL.

The Firebase-generated domain remains available after a custom domain is added.
Use one custom domain as the canonical public origin and avoid publishing both
addresses. Browser Auth state is origin-specific, so a user who signs in on the
temporary `web.app` address may have to sign in again on the custom domain.

Complete the [custom-domain cutover](#13-custom-domain-cutover-optional) after the
first deployment and before public launch. Before using a custom domain, revisit
the HSTS decision and follow
[Firebase Hosting security headers](./firebase-hosting-security-headers.md).

## 5. Configure Authentication

In Firebase console **Authentication → Sign-in method**, enable Email/Password.
Do not enable additional identity providers unless the application supports and
the team has reviewed them. In **Authentication → Settings**:

- add only the Firebase Hosting domain and approved custom production domains;
- review user-account creation and deletion controls;
- configure production-facing email sender/template settings; and
- confirm that Dev/Beta domains are not authorized in Prod.

Complete registration, verification, sign-in, password-reset, and sign-out tests
before admitting real users. Do not copy Firebase Auth users from Dev or Beta.

## 6. Provision Data Connect and Cloud SQL

The checked-in `dataconnect/dataconnect.yaml` defines:

```text
service:   sodc-web-service
region:    europe-west2
instance:  sodc-web-instance
database:  fdcdb
connector: api
```

Review Cloud SQL pricing, sizing, availability, retention, point-in-time recovery,
maintenance window, deletion protection, and data residency with the project
owner. The first deployment interactively provisions the declared production
resources and can take several minutes:

```sh
npx firebase dataconnect:sdk:generate
git diff --exit-code -- src/dataconnect-generated functions/src/dataconnect-admin-generated
git status --short -- src/dataconnect-generated functions/src/dataconnect-admin-generated
npm run build:prod
npm --prefix functions run build
firebase deploy --only dataconnect --project prod
firebase dataconnect:services:list --project prod
```

Read every provisioning and migration prompt. Do not use `--force` to bypass a
breaking or destructive migration warning. Confirm the exact service, region,
instance, database, schema, and `api` connector in the Firebase console. Configure
automated backups and point-in-time recovery, then record and test the restore
procedure before holding irreplaceable production data.

Do not load `dataconnect/seed_data.gql` into Prod.

### 6a. Enable Firebase Storage and provision section-file storage

Before enabling the section-file feature:

1. confirm Prod is on Blaze billing;
2. in Firebase console, open **Databases & Storage → Storage**, select
   **Get started**, and create the default bucket in the approved location
   (`europe-west2` unless the data-location decision says otherwise);
3. record the exact generated bucket name—normally
   `sodc-web-production.firebasestorage.app` for a new project;
4. set that exact name as `VITE_FIREBASE_STORAGE_BUCKET` and
   `SECTION_FILES_BUCKET`;
5. deploy the repository's deny-all rules:

   ```sh
   firebase deploy --only storage --project prod
   ```

6. complete the IAM, public-access prevention, lifecycle, CORS, and verification
   steps in [section-file-storage.md](./section-file-storage.md).

Use the real production values below. Do not copy the Dev project number,
bucket, or service account:

```sh
export PROJECT_ID="sodc-web-production"
export SECTION_FILES_BUCKET_NAME="sodc-web-production.firebasestorage.app"

gcloud storage buckets update "gs://${SECTION_FILES_BUCKET_NAME}" \
  --uniform-bucket-level-access \
  --public-access-prevention \
  --lifecycle-file="config/storage/section-files-lifecycle.json"

firebase deploy --only storage --project prod
```

After the #429 Functions have been deployed—but before invoking an upload or
download—resolve the actual Gen 2 runtime service account:

```sh
gcloud functions describe requestSectionFileUpload \
  --gen2 \
  --region="europe-west2" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.serviceAccountEmail)"
```

Copy the exact returned address into this variable:

```sh
export FUNCTIONS_SERVICE_ACCOUNT="<returned-runtime-service-account>"
```

Grant only the required object and keyless-signing permissions:

```sh
gcloud storage buckets add-iam-policy-binding \
  "gs://${SECTION_FILES_BUCKET_NAME}" \
  --member="serviceAccount:${FUNCTIONS_SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"

gcloud services enable iamcredentials.googleapis.com \
  --project="${PROJECT_ID}"

gcloud iam service-accounts add-iam-policy-binding \
  "${FUNCTIONS_SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${FUNCTIONS_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Verify the bucket configuration and both explicit IAM grants:

```sh
gcloud storage buckets describe "gs://${SECTION_FILES_BUCKET_NAME}" \
  --format="yaml(name,location,uniform_bucket_level_access,public_access_prevention,lifecycle_config,cors_config)"

gcloud storage buckets get-iam-policy \
  "gs://${SECTION_FILES_BUCKET_NAME}" \
  --flatten="bindings[].members" \
  --filter="bindings.members:${FUNCTIONS_SERVICE_ACCOUNT}" \
  --format="table(bindings.role,bindings.members)"

gcloud iam service-accounts get-iam-policy \
  "${FUNCTIONS_SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}"
```

The bucket policy must show `roles/storage.objectAdmin`; the service-account
policy must show the runtime identity bound to
`roles/iam.serviceAccountTokenCreator`. The bucket description must show
uniform access enabled, public-access prevention enforced, and lifecycle
deletion restricted to `section-file-uploads/`. Apply the exact production CORS
file using the command in [section-file-storage.md](./section-file-storage.md);
never use a wildcard origin.

Do not continue if Storage has not been initialized or if the CLI deploy targets
a Dev/Beta bucket. Resolve the actual production Functions runtime service
account and explicitly grant it `roles/storage.objectAdmin` on the production
bucket. Enable `iamcredentials.googleapis.com` and grant that same identity
`roles/iam.serviceAccountTokenCreator` on itself for keyless V4 signed URLs.
Verify both policies before the upload/download smoke test. Do not share the Dev
or Beta bucket or runtime identity with Prod, and do not create a downloaded
service-account key.

## 7. Configure Functions environment and secrets

Cloud Functions loads project-specific non-secret values from
`functions/.env.<project-id>`. Create the ignored file
`functions/.env.sodc-web-production` using the complete matrix in
[Environment and secrets](./environment-and-secrets.md). At minimum:

```dotenv
APP_BASE_URL=https://sodc-web-production.web.app
ENV_NAME=prod
PERMITTED_PROJECT_IDS=
SECTION_FILES_BUCKET=
# Optional migration fallback; prefer the admin-managed reply-to configuration.
GOV_NOTIFY_EMAIL_REPLY_TO_ID=

# Add the GOV_NOTIFY_TEMPLATE_* values for every enabled template.
# Add optional payment-ops recipients and expiry tuning only when used.
```

`PERMITTED_PROJECT_IDS` must not include the production project. The Dev reset
helper must remain unusable in Prod. Confirm the file is ignored:

```sh
git check-ignore functions/.env.sodc-web-production
```

Set secrets interactively so values do not appear in command history:

```sh
firebase functions:secrets:set STRIPE_SECRET --project prod
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_PAYMENTS --project prod
firebase functions:secrets:set GOV_NOTIFY_LIVE_API_KEY --project prod
firebase functions:secrets:set GOV_NOTIFY_TEST_API_KEY --project prod
firebase functions:secrets:set GOV_NOTIFY_TEAM_API_KEY --project prod
firebase functions:secrets:set UNSUBSCRIBE_SECRET --project prod
firebase functions:secrets:set NOTIFY_CALLBACK_BEARER_TOKEN --project prod
```

Use independent, cryptographically random values for the unsubscribe and Notify
callback bearer tokens. `STRIPE_WEBHOOK_SECRET_PAYMENTS` comes from the dedicated
payments endpoint. Redeploy every Function that references a secret whenever its
value rotates.

Before deploying, review the CLI output showing which environment file was loaded.
Stop if it names a Dev/Beta file or if `APP_BASE_URL` is not the production origin.

## 8. Configure Stripe live mode

Use Stripe **live mode**, not test mode:

1. put the live publishable key in `.env.production.local`;
2. set the live secret key as `STRIPE_SECRET` in the production Firebase project;
3. after Functions deployment, create a live webhook endpoint for
   `https://europe-west2-sodc-web-production.cloudfunctions.net/stripeWebhookPayments`;
4. select only the event allowlist in
   [Stripe webhook endpoints](./stripe-webhook-endpoints.md); and
5. store that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET_PAYMENTS`.

Never reuse a Beta endpoint secret. Record the Stripe account, mode, endpoint ID,
owner, event list, and rotation date in the private operations record.

## 9. Configure GOV.UK Notify

Use the production Notify service/API key and follow
[GOV.UK Notify template registration](./govuk-notify-template-registration.md).
Create and test every required template, record its UUID outside the repository,
put each `GOV_NOTIFY_TEMPLATE_*` UUID in the production Functions environment
file, set `GOV_NOTIFY_DELIVERY_MODE=SIMULATION` for the initial rollout, and
set all three mode-specific API keys as Firebase secrets. Follow
[GOV.UK Notify delivery modes](./govuk-notify-delivery-modes.md) before making
the production ceiling more permissive. After Data Connect and Functions are
deployed, open **Admin → Email Delivery** and verify that the persisted runtime
mode defaults to **Simulation**. Day-to-day mode changes are made there, with a
reason and audit trail; the environment value remains the hard upper ceiling.

Configure and verify reply-to addresses in the admin UI using the
[GOV.UK Notify email reply-to runbook](./govuk-notify-email-reply-to.md), along
with internal payment-alert recipients and the Notify callback using production
values. Configure the callback to send the bearer token
stored as `NOTIFY_CALLBACK_BEARER_TOKEN`. Run the template drift check and one
end-to-end trigger per email domain before launch.

## 10. Register App Check

The current client initializes Firebase App Check only when
`VITE_RECAPTCHA_SITE_KEY` is present. Register a production reCAPTCHA key whose
allowed domains contain only the production Hosting/custom domains. In Firebase
console **App Check**, register the production Web app with the matching secret,
then put the public site key in `.env.production.local`.

Deploy first with tokens being sent but enforcement disabled. Monitor App Check
metrics for legitimate production traffic. Enable enforcement service by service
only after valid traffic is healthy and all clients are registered. The current
callable Functions do not set `enforceAppCheck: true`, so enabling/strengthening
Functions enforcement requires a reviewed code change and regression testing.

Dev configuration alone does not configure Prod and does not complete #345.
Repeat the Web app registration and allowed-domain setup in the production
Firebase/GCP project. `npm run build:prod` loads the production public site key;
after deploying it, record valid-token metrics and the reviewed enforcement
decision before enabling callable enforcement.

The existing implementation uses reCAPTCHA v3. Firebase recommends reCAPTCHA
Enterprise for new integrations; migrating providers is a separate reviewed change,
not a launch-day configuration switch.

## 11. Bootstrap the first administrator

The `devResetAndSeed` callable and `functions/scripts/cli-dev-reset.ts` are
explicitly Dev/Stage-only and must never be relaxed or run against Prod.

Use this audited bootstrap procedure:

1. deploy Data Connect, Functions, and Hosting;
2. have the designated administrator register, verify their email, and complete
   their profile so the Auth UID and Data Connect user row already exist;
3. have two operators verify the UID, email, and Data Connect row;
4. through an approved, authenticated Admin SDK/Cloud Shell session in the Prod
   project, update that existing user's membership to an allowed status using the
   checked-in Admin connector operation, then set custom claims
   `{ admin: true, enabled: true }` while preserving any existing claims;
5. have the user sign out/in (or force-refresh their ID token), then confirm Admin
   access; and
6. record operator, reviewer, UID, timestamp, and outcome in the private audit
   record without recording tokens or credentials.

Do not create a second, disconnected Data Connect row, edit Auth custom claims in
an unreviewed browser extension, or grant `admin` without `enabled`. Once the first
administrator works, use the application's reviewed approval and `grantAdmin`
flows for later users. Confirm there are at least two production administrators
before launch to avoid a single-person recovery dependency.

## 12. First deployment

Return to the exact commit that passed Beta. Recheck project targeting and build
configuration, then follow the schema-first order:

Before attempting a real deploy, run the non-mutating preflight as a dry run.
It is safe to run repeatedly while bootstrap is still in progress -- it never
calls `firebase deploy` or otherwise changes remote state:

```sh
npm run deployment:preflight -- --env prod
```

On a freshly created project this commonly fails its first few times on
"Confirm required Google Cloud APIs are enabled": creating a Firebase project
enables Firebase's own baseline APIs, but not every API Functions Gen2,
Secret Manager, or App Check need (typically `artifactregistry`, `cloudbuild`,
`firebaseappcheck`, `iamcredentials`, `run`, and `secretmanager`). Enable
whatever the check reports missing -- reading the authoritative list straight
from `config/deployment-check.json` rather than retyping it here, so this stays
correct if that list changes:

```sh
gcloud services enable \
  $(node -e "console.log(require('./config/deployment-check.json').requiredApis.join(' '))") \
  --project prod
```

Re-run the preflight until it passes end to end (it also runs frontend and
Functions lint/test/build, and confirms `.env.production.local` has every
required `VITE_FIREBASE_*` value from step 4). Once it passes, the reviewed
application deployment can be run as one fail-fast command -- it runs this
same preflight automatically before its first remote mutation:

```sh
npm run deploy:prod
```

That command verifies the `prod` alias resolves to `sodc-web-production`,
generates and checks the SDKs, deploys Data Connect and all Functions, rebuilds
Hosting with `.env.production.local`, deploys it last, and runs the live
revision audit. It intentionally does not repeat Storage setup or deploy
Storage rules. The expanded commands below remain the manual troubleshooting
sequence.

```sh
export FIREBASE_PROJECT=prod
git status --short
git rev-parse HEAD
firebase projects:list
firebase dataconnect:services:list --project "$FIREBASE_PROJECT"

npx firebase dataconnect:sdk:generate
git diff --exit-code -- src/dataconnect-generated functions/src/dataconnect-admin-generated
git status --short -- src/dataconnect-generated functions/src/dataconnect-admin-generated
npm run build:prod
npm --prefix functions run build

firebase deploy --only dataconnect --project "$FIREBASE_PROJECT"
firebase dataconnect:services:list --project "$FIREBASE_PROJECT"
firebase deploy --only functions --project "$FIREBASE_PROJECT"

# This rebuilds with .env.production.local before deploying to the prod alias.
npm run deploy:hosting:prod

npm run deployment:check -- \
  --env prod \
  --expected-sha "$(git rev-parse HEAD)"
```

Complete and record each checkpoint before proceeding. If Data Connect validation
fails, do not deploy Functions or Hosting. If Functions fail, do not deploy
Hosting. Use the rollback guidance in
[Dev, Beta, and Prod environments](./environments-dev-beta-prod.md#partial-failure-and-rollback-checkpoints).

## 13. Custom-domain cutover (optional)

Use this section when commissioning on the Firebase-generated domain and attaching
the final domain later. The Stripe webhook URL points directly to Cloud Functions,
so changing the website domain does not change that endpoint.

1. In Firebase console **Hosting**, add the final domain to the existing production
   site. Choose the canonical hostname and, where appropriate, redirect the other
   custom hostname (for example, apex to `www`, or `www` to apex).
2. Prove domain ownership and add exactly the DNS records Firebase requests. Do
   not remove a working old record until the planned cutover window. Wait until
   Firebase reports the domain connected and its TLS certificate is valid.
3. In **Authentication → Settings → Authorized domains**, add the final domain.
   Keep the Firebase Hosting domain authorized for operations unless there is a
   reviewed reason to remove it. Do not add Dev or Beta domains.
4. Add the final domain to the production reCAPTCHA/App Check key's allowed
   domains. If the existing site key is retained, no frontend rebuild is required
   for this step. If a new site key is issued, update
   `VITE_RECAPTCHA_SITE_KEY`, rebuild, and redeploy Hosting.
5. Change `APP_BASE_URL` in `functions/.env.sodc-web-production` to the canonical
   HTTPS origin, with no trailing slash, then redeploy Functions:

   ```dotenv
   APP_BASE_URL=https://members.example.org
   ```

   ```sh
   firebase deploy --only functions --project prod
   ```

   This changes Stripe Checkout return URLs, application links in Notify emails,
   internal operations links, and announcement unsubscribe redirects. Previously
   sent emails can still contain the `web.app` URL, so keep that Hosting address
   working.
6. The Firebase SDK's existing `VITE_FIREBASE_AUTH_DOMAIN` can remain the
   project-provided Firebase domain. Changing it to the custom domain is optional,
   requires a reviewed frontend rebuild, and is unnecessary for the current
   Email/Password flow.
7. Revisit HSTS for the custom domain. Do not add `includeSubDomains` or `preload`
   until every affected subdomain is HTTPS-capable and controlled by the club.
8. Run the following checks on the canonical domain before publishing it:
   registration, email verification, sign-in/out, password reset, App Check,
   Data Connect read, callable action, Stripe live Checkout return, Notify links,
   `/unsubscribe`, SPA deep links, TLS, CSP, and all configured security headers.
9. Update the public website, member communications, operational records, support
   material, Stripe branding, Notify service links, monitoring probes, and any CI
   smoke-test URL to use the canonical domain.

Do not publicly launch during DNS or certificate provisioning. If cutover checks
fail, leave the custom domain unpublished, restore `APP_BASE_URL` to the working
`web.app` origin, redeploy Functions, and investigate without altering Data
Connect or user data.

## 14. Go-live checklist

- [ ] Project ID, billing account, region, commit SHA, and owners recorded.
- [ ] `npm run deployment:preflight -- --env prod` passes cleanly (required APIs, SDK drift, environment config, lint/test/build).
- [ ] IAM reduced from temporary bootstrap access; CI uses short-lived identity.
- [ ] SQL backups, point-in-time recovery, deletion protection, and restore test recorded.
- [ ] Production environment files loaded and ignored by Git.
- [ ] All six required Firebase secrets exist in Prod and referenced Functions were redeployed.
- [ ] Email/password Auth, authorized domains, verification, and password reset work.
- [ ] Canonical domain is connected with valid DNS/TLS, or the launch is explicitly approved for the `web.app` domain.
- [ ] `APP_BASE_URL`, reCAPTCHA allowed domains, monitoring, and member-facing links use the canonical origin.
- [ ] Operators understand that users moving from `web.app` to the custom domain may need to sign in again.
- [ ] App Check tokens are valid; enforcement decision and metrics are recorded.
- [ ] Data Connect read and a non-destructive callable action succeed.
- [ ] Firebase Storage is initialized in Prod and the exact bucket name is recorded in both frontend and Functions configuration.
- [ ] Section-file bucket isolation, IAM, lifecycle, CORS, deployed deny-all rules, and direct-access denial are verified before the feature is enabled.
- [ ] Production Functions runtime has explicit bucket `roles/storage.objectAdmin` and self `roles/iam.serviceAccountTokenCreator` grants; IAM Credentials API is enabled.
- [ ] Stripe live Checkout redirect/return and signed webhook delivery succeed.
- [ ] Notify template drift check and one send per email domain succeed.
- [ ] First and second administrators can sign in; an ordinary member cannot access Admin routes/actions.
- [ ] Root URL, deep link, `/unsubscribe`, custom domain, TLS, CSP, and security headers pass.
- [ ] Functions/webhook error alerts, SQL alerts, incident contacts, and budget notifications were tested.
- [ ] No Dev/Beta IDs, keys, URLs, users, seed data, or callbacks appear in Prod.
- [ ] Rollback owner, previous release SHA, and decision criteria are recorded.

After sign-off, restrict registration if that is the agreed launch policy, monitor
Auth, Functions, SQL, Stripe, Notify, App Check, and Hosting closely through the
launch window, and update this runbook with any provisioning variance.

## Official references

- [Firebase CLI project and app commands](https://firebase.google.com/docs/cli)
- [Firebase SQL Connect quickstart](https://firebase.google.com/docs/sql-connect/quickstart)
- [Cloud Functions environment and secrets](https://firebase.google.com/docs/functions/config-env)
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Connect a custom domain to Firebase Hosting](https://firebase.google.com/docs/hosting/custom-domain)
