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
