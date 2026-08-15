# Section file storage

Tracked by [#428](https://github.com/rafsodc/sodc-web/issues/428) under the
section-file feature [#427](https://github.com/rafsodc/sodc-web/issues/427).

This document defines the private object-storage and metadata foundation. The
upload/download callables and user interfaces are delivered separately by
#429, #430, and #431.

## Security boundary

Section files are not public Firebase objects. Data Connect holds the
authoritative section relationship and lifecycle state; a trusted Function
must authorize the current user before issuing any short-lived upload or
download grant.

- Firebase Storage client rules deny all reads and writes.
- Uniform bucket-level access and public access prevention must be enabled.
- Do not create Firebase download tokens or `allUsers`/`allAuthenticatedUsers`
  IAM bindings.
- Only the deployed Functions service identity receives object access.
- Clients supply a section ID and opaque file ID through an authorized API;
  they never supply or retrieve an internal object path.
- Signed URLs are short-lived capabilities. Do not log them, store them in
  Data Connect, or use them as the stable email URL.

The stable email URL remains an application route:

```text
${APP_BASE_URL}/sections/:sectionId/files/:fileId
```

That route must authenticate and re-evaluate current section access before
requesting a fresh short-lived download grant.

## Metadata and lifecycle

`SectionFile` records use the following states:

| State | Meaning | Member-visible |
|---|---|---|
| `PENDING` | Initial upload has been granted but not validated | no |
| `AVAILABLE` | The current immutable object has been validated | yes |
| `REPLACING` | A new object is pending; the current object remains authoritative | current object only |
| `DELETING` | Metadata is hidden before object cleanup | no |
| `DELETED` | Object cleanup completed and the tombstone remains for audit/reconciliation | no |

Initial and replacement uploads use:

```text
section-file-uploads/{sectionId}/{fileId}/{uploadId}
```

After validation, the backend copies/promotes the object to:

```text
section-files/{sectionId}/{fileId}/{generation}
```

The temporary prefix allows the bucket lifecycle rule in
`config/storage/section-files-lifecycle.json` to remove abandoned uploads
without touching available objects. Lifecycle deletion is asynchronous and is
only a safety net; the backend should delete rejected objects immediately and
the reconciliation work in #432 must report stale metadata and orphaned
objects.

This includes fully uploaded temporary objects whose browser never completed
the finalization call—for example after a closed tab, network failure, rejected
validation, failed replacement, or Function interruption. An HTTP upload that
never completes normally does not create a complete object, but any completed
temporary object left under `section-file-uploads/` is eligible for deletion
after one day. Permanent objects under `section-files/` do not match this rule.

Finalization must inspect the stored object rather than trusting browser
metadata. It must verify the expected temporary path, object generation,
actual byte size, approved content type, and checksum before atomically
promoting the Data Connect row. A zero-row compare-and-swap result means the
lifecycle changed and the caller must not continue.

The #429 backend enforces a 25 MiB per-file limit and an explicit content-type
allowlist. Upload grants expire after 15 minutes and download grants after 5
minutes. Available metadata never exposes either internal object path, and a
requested `sectionId` is always cross-checked against the file's authoritative
Data Connect relationship before a grant or mutation is issued.

## Enable Firebase Storage in each project

Cloud Storage for Firebase must be initialized separately in Dev, Beta, and
Prod. Creating a Firebase project, Hosting site, or web app does not create its
default Storage bucket.

1. Confirm the project is linked to a billing account and uses the Blaze plan.
   Firebase requires Blaze for Cloud Storage.
2. In Firebase console, select the exact project, then open **Databases &
   Storage → Storage**.
3. Select **Get started**.
4. Choose `europe-west2` unless the environment's approved data-location
   decision says otherwise. A bucket's location cannot be changed later.
5. Complete the wizard. Do not rely on the wizard's initial rules for release;
   deploy the repository's deny-all `storage.rules` immediately.
6. Record the generated default bucket name. New default buckets normally use
   `PROJECT_ID.firebasestorage.app`; older projects may use
   `PROJECT_ID.appspot.com`.

Verify that Firebase recognizes Storage and deploy the checked-in rules:

```sh
firebase use dev
firebase deploy --only storage --project dev
```

Repeat with `beta` and `prod` only at the corresponding promotion stage. A
Storage rules deployment replaces the rules currently edited in the Firebase
console, so the repository is authoritative.

## Configure the environment bucket

Use the Firebase project's default Storage bucket for section files unless an
approved architecture decision requires a separate bucket. This project does
not otherwise use browser-accessible Firebase Storage, and the repository rules
deny all client SDK access.

Set the exact bucket name in both locations:

- `VITE_FIREBASE_STORAGE_BUCKET` in the environment's ignored frontend config;
- `SECTION_FILES_BUCKET` in `functions/.env.<project-id>`.

The backend value must not be inferred from the project ID because legacy and
new default buckets use different suffixes.

```sh
export PROJECT_ID="sodc-web"
export SECTION_FILES_BUCKET_NAME="sodc-web.firebasestorage.app"
export FUNCTIONS_SERVICE_ACCOUNT="runtime-service-account@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud storage buckets update "gs://${SECTION_FILES_BUCKET_NAME}" \
  --uniform-bucket-level-access \
  --public-access-prevention \
  --lifecycle-file="config/storage/section-files-lifecycle.json"

gcloud storage buckets add-iam-policy-binding "gs://${SECTION_FILES_BUCKET_NAME}" \
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

Resolve the deployed Functions runtime service account from the Firebase/GCP
configuration; do not assume the example address. For a deployed Gen 2
function:

```sh
gcloud functions describe requestSectionFileUpload \
  --gen2 \
  --region="europe-west2" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.serviceAccountEmail)"
```

`roles/storage.objectAdmin` is scoped to the section-file bucket and permits the
runtime to inspect, copy, read, and delete objects without administering the
bucket. The self-binding for `roles/iam.serviceAccountTokenCreator` supplies
`iam.serviceAccounts.signBlob`, which lets that runtime identity create V4
signed URLs without a downloaded private key. Do not create a service-account
JSON key.

Verify both explicit grants:

```sh
gcloud storage buckets get-iam-policy \
  "gs://${SECTION_FILES_BUCKET_NAME}" \
  --flatten="bindings[].members" \
  --filter="bindings.members:${FUNCTIONS_SERVICE_ACCOUNT}" \
  --format="table(bindings.role,bindings.members)"

gcloud iam service-accounts get-iam-policy \
  "${FUNCTIONS_SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}"
```

The first output must include `roles/storage.objectAdmin`; the second must bind
the runtime identity to `roles/iam.serviceAccountTokenCreator`. Bucket policy
output does not include project-inherited roles, so require and verify these
explicit bindings for each environment.

Set `SECTION_FILES_BUCKET` in the project-specific ignored Functions env file,
for example:

```text
SECTION_FILES_BUCKET=sodc-web.firebasestorage.app
```

Replace the example with the exact bucket shown in the target Firebase console.
Repeat with independent names and identities for Dev, Beta, and Prod. Never
point two environments at the same bucket. If a separate additional bucket is
approved, create/import it through Firebase Storage first, bind its rules
release explicitly, and document that variance rather than assuming the
default `firebase deploy --only storage` target covers it.

## CORS

CORS is required only for browser-to-bucket signed uploads. Use exact deployed
application origins—never `*`—and keep the method/header list aligned with the
signed request constructed by #429. An operator can create an environment
specific file outside the repository:

```json
[
  {
    "origin": ["https://example.firebaseapp.com", "https://files.example.org"],
    "method": ["PUT"],
    "responseHeader": ["Content-Type", "ETag", "x-goog-generation"],
    "maxAgeSeconds": 3600
  }
]
```

Apply and verify it:

```sh
gcloud storage buckets update "gs://${SECTION_FILES_BUCKET_NAME}" \
  --cors-file="/secure/path/section-files-cors.json"

gcloud storage buckets describe "gs://${SECTION_FILES_BUCKET_NAME}" \
  --format="yaml(name,location,uniform_bucket_level_access,public_access_prevention,lifecycle_config,cors_config)"
```

The standardized output must include:

```text
uniform_bucket_level_access: true
public_access_prevention: enforced
```

Do not use `iamConfiguration`, `lifecycle`, or `cors` in the normal
`gcloud storage` format expression. Those are raw JSON API field names and may
silently produce no output in the standardized view. If the access fields are
missing or need deeper inspection, use:

```sh
gcloud storage buckets describe "gs://${SECTION_FILES_BUCKET_NAME}" \
  --raw \
  --format="yaml(iamConfiguration)"
```

The raw result must show
`iamConfiguration.uniformBucketLevelAccess.enabled: true` and
`iamConfiguration.publicAccessPrevention: enforced`.

Changing the application domain requires adding the new exact origin before
cutover. Remove the old origin after traffic and rollback windows have ended.

## Deployment order

1. Enable Firebase Storage and create the default bucket in the target project.
2. Deploy and verify deny-all Storage rules, IAM, lifecycle, and CORS.
3. Deploy the additive Data Connect schema and connector operations.
4. Regenerate both SDKs and confirm there is no generated drift.
5. Deploy #429 Functions only after the schema and bucket checkpoints pass.
6. Deploy the #430/#431 Hosting interfaces last.

Deploy the repository's deny-all Firebase Storage rules when using the
project's Firebase-managed default bucket:

```sh
firebase deploy --only storage --project dev
```

If an approved additional bucket is managed through GCS IAM, verify its IAM
policy and public access prevention directly; Firebase rules do not replace
bucket IAM.

## Verification checklist

- [ ] Firebase Storage is initialized in Dev, Beta, and Prod on Blaze billing.
- [ ] The exact default bucket name is recorded in frontend and Functions configuration.
- [ ] Dev, Beta, and Prod have different bucket names and service identities.
- [ ] Public access prevention and uniform bucket-level access are enabled.
- [ ] No public or broadly authenticated IAM principal can read objects.
- [ ] Direct Firebase Storage SDK reads/writes are denied.
- [ ] The Functions identity can create, inspect, copy, sign, and delete only
      the intended bucket objects.
- [ ] IAM Credentials API is enabled and the runtime identity has an explicit
      self-binding for `roles/iam.serviceAccountTokenCreator`.
- [ ] The lifecycle rule applies only to `section-file-uploads/`.
- [ ] CORS contains exact approved origins and only the required upload method.
- [ ] `PENDING`, `REPLACING`, `DELETING`, and `DELETED` records never appear in
      a member listing.
- [ ] Regenerating Data Connect SDKs produces no diff.

## Monitoring, retention, and recovery

Configure bucket byte-count and object-count dashboards and budget alerts per
environment before production enablement. Alert on unusual growth in the
temporary prefix and on authorization/signing failures in Functions.

Available objects are retained until an authorized deletion completes. The
current design does not promise user-facing undelete. Database backups do not
contain object bytes, so backup/recovery requirements for restricted files
must be approved before production; #432 owns the final quota, alert,
reconciliation, malware-scanning, incident, and recovery sign-off.

## Malware scanning policy

Beta and Production require malware scanning before a newly uploaded or
replacement object becomes available. A missing scanner, timeout, stale
definitions, inconclusive result, or internal error fails closed: the candidate
object remains private and the current clean object (for a replacement) remains
authoritative.

Use an authenticated ClamAV service on Cloud Run in `europe-west2` with:

```text
CPU:                 1 vCPU
Memory:              4 GiB
Billing:             request-based
Minimum instances:   0
Maximum instances:   1
Unauthenticated:      disabled
```

Scaling to zero is intentional for this workload. It removes the material idle
cost of a continuously warm ClamAV instance; the accepted trade-off is that the
first scan after inactivity can take 30–120 seconds while the service starts
and loads its definitions. The application must show a scanning state and must
not issue a member download grant during that interval.

The scanner operates on the exact immutable object generation recorded during
upload validation. A result for any other bucket, path, generation, checksum,
section, or file ID is ignored. Clean candidates are promoted by the trusted
backend. Infected candidates are quarantined and never exposed. Scan errors are
retried with a bounded policy and then require operator attention.

ClamAV definitions are mirrored in private Cloud Storage and refreshed every
two hours by Cloud Scheduler. Do not have every cold-started instance download
the full database from ClamAV's public CDN; the CDN is rate-limited. Alert when
the mirror or loaded definitions exceed the agreed maximum age.

Dev may use an explicit mock-scanner configuration to exercise clean,
infected, timeout, and error states. That configuration must be rejected when
the Firebase project/environment is Beta or Production. EICAR is the required
non-malicious detection smoke test; never upload real malware.

Functions configuration:

```dotenv
SECTION_FILE_MALWARE_SCAN_MODE=REQUIRED
SECTION_FILE_MALWARE_SCANNER_URL=https://SCANNER_SERVICE_URL
```

The Functions runtime service account must have `roles/run.invoker` on the
scanner service. The scanner service account needs only
`roles/storage.objectViewer` on `SECTION_FILES_BUCKET`; it cannot promote,
replace, or delete objects.

## Quotas and reconciliation

The trusted backend enforces a maximum of 25 MiB per file, 200 active files per
section, and 500 MiB of authoritative metadata allocation per section. A
replacement is charged only for growth over the current file size. These limits
are intentionally below infrastructure limits and must be reviewed before they
are increased.

`reconcileSectionFiles` runs every 30 minutes with one instance. After two
hours it:

- deletes and tombstones abandoned pending uploads;
- removes a stale replacement candidate and restores the existing clean file;
- completes stuck deletion object cleanup and tombstones the metadata.

Each repair writes a `SectionFileAudit` row. Failures are logged and retained
for the next run. Final-object orphan detection is report-only until an
operator confirms that an object is not referenced by a current backup or an
in-flight database deployment; never automatically delete a restricted final
object solely because a single reconciliation query cannot find it.

## Scanner deployment

Before building or promoting the scanner image, run its independent test and
coverage gate:

```sh
npm --prefix services/section-file-malware-scanner run test:coverage
```

The gate covers request validation, generation-bound downloads, checksum and
size enforcement, ClamAV result handling, temporary-file cleanup and fail-closed
HTTP responses. The remaining container, definitions-job and EICAR checks are
listed in the [executable coverage policy](./executable-coverage-policy.md).

Build `services/section-file-malware-scanner` into Artifact Registry. Create
separate scanner and definitions-updater service accounts, plus a private
regional definitions bucket. The scanner receives
`roles/storage.objectViewer` on the section-file and definitions buckets. The
updater receives `roles/storage.objectAdmin` only on the definitions bucket.

Seed and refresh definitions with the same image as a Cloud Run Job:

```sh
gcloud run jobs deploy section-file-clamav-definitions \
  --project="${FIREBASE_PROJECT}" \
  --region=europe-west2 \
  --image="${SCANNER_IMAGE}" \
  --service-account="${DEFINITIONS_UPDATER_SERVICE_ACCOUNT}" \
  --command=/app/update-definitions.sh \
  --memory=1Gi --cpu=1 --task-timeout=10m --max-retries=2 \
  --add-volume="name=definitions,type=cloud-storage,bucket=${DEFINITIONS_BUCKET},mount-options=uid=1000;gid=1000" \
  --add-volume-mount="volume=definitions,mount-path=/var/lib/clamav"

gcloud run jobs execute section-file-clamav-definitions \
  --project="${FIREBASE_PROJECT}" \
  --region=europe-west2 \
  --wait
```

Deploy the scanner with the seeded definitions bucket mounted read-only:

```sh
gcloud run deploy section-file-malware-scanner \
  --project="${FIREBASE_PROJECT}" \
  --region=europe-west2 \
  --image="${SCANNER_IMAGE}" \
  --service-account="${SCANNER_SERVICE_ACCOUNT}" \
  --no-allow-unauthenticated \
  --cpu=1 --memory=4Gi --concurrency=1 --min=0 --max=1 --timeout=240 \
  --set-env-vars="SCANNER_SOURCE_BUCKET=${SECTION_FILES_BUCKET_NAME}" \
  --add-volume="mount-path=/var/lib/clamav,type=cloud-storage,bucket=${DEFINITIONS_BUCKET},readonly=true"
```

Grant the deployed Functions runtime identity `roles/run.invoker` on this
service. Schedule the definitions job every two hours. Record the scheduler
identity, latest successful refresh and alert owner in the private environment
record.

## Rollback and incident response

If scanning is unhealthy, leave scanning required and keep candidate objects
private. Restore the previous known-good Cloud Run revision or image digest,
refresh definitions, and retry finalization. Do not weaken Storage rules,
public-access prevention or IAM during rollback. Deploy additive Data Connect
changes before Functions; never roll back the schema first.

For suspected malware, record only the audit ID, section/file identifiers,
object generation, scanner revision and definitions version. Never paste a
signed URL into a ticket or download the object to an unmanaged workstation.

## Dev and Beta smoke-test sign-off

Record tester, date, commit, domain, scanner revision and outcome:

- [ ] Signed-out canonical link returns through sign-in to the same file.
- [ ] Upload displays upload, verification and scanning stages.
- [ ] EICAR is rejected and never appears in the member list.
- [ ] Clean PDF and Office samples become downloadable.
- [ ] Failed or infected replacement leaves the old clean file unchanged.
- [ ] Revoked access and disabled administrators cannot use existing links.
- [ ] Cross-section ID substitution returns a non-enumerating failure.
- [ ] Direct Firebase SDK and public object URL access remain denied.
- [ ] Expired upload/download grants fail.
- [ ] Stale pending, replacement and deletion fixtures are reconciled.
- [ ] Custom-domain canonical URLs and sign-in continuation are correct.
- [ ] Audits contain actor, section, file, action, outcome and timestamp, but
  no signed URL or content.

Production requires recorded Dev and Beta sign-off and deployment in this
order: Data Connect → Functions → Hosting.
