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

Finalization must inspect the stored object rather than trusting browser
metadata. It must verify the expected temporary path, object generation,
actual byte size, approved content type, and checksum before atomically
promoting the Data Connect row. A zero-row compare-and-swap result means the
lifecycle changed and the caller must not continue.

## Provision one bucket per environment

Choose a dedicated globally unique bucket name for each Firebase project. Keep
the bucket in `europe-west2` unless the environment's approved data-location
decision says otherwise.

```sh
export PROJECT_ID="sodc-web"
export SECTION_FILES_BUCKET_NAME="sodc-web-section-files"
export FUNCTIONS_SERVICE_ACCOUNT="runtime-service-account@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud storage buckets create "gs://${SECTION_FILES_BUCKET_NAME}" \
  --project="${PROJECT_ID}" \
  --location="europe-west2" \
  --uniform-bucket-level-access \
  --public-access-prevention

gcloud storage buckets update "gs://${SECTION_FILES_BUCKET_NAME}" \
  --lifecycle-file="config/storage/section-files-lifecycle.json"

gcloud storage buckets add-iam-policy-binding "gs://${SECTION_FILES_BUCKET_NAME}" \
  --member="serviceAccount:${FUNCTIONS_SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"
```

Resolve the deployed Functions runtime service account from the Firebase/GCP
configuration; do not assume the example address. If the implementation signs
URLs through IAM credentials rather than a local private key, grant only the
additional service-account signing permission required by that implementation
and document the exact principal.

Set `SECTION_FILES_BUCKET` in the project-specific ignored Functions env file,
for example:

```text
SECTION_FILES_BUCKET=sodc-web-section-files
```

Repeat with independent names and identities for Dev, Beta, and Prod. Never
point two environments at the same bucket.

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
  --format="yaml(name,location,iamConfiguration,lifecycle,cors)"
```

Changing the application domain requires adding the new exact origin before
cutover. Remove the old origin after traffic and rollback windows have ended.

## Deployment order

1. Provision and verify the private bucket, IAM, lifecycle, and CORS.
2. Deploy the additive Data Connect schema and connector operations.
3. Regenerate both SDKs and confirm there is no generated drift.
4. Deploy #429 Functions only after the schema and bucket checkpoints pass.
5. Deploy the #430/#431 Hosting interfaces last.

Deploy the repository's deny-all Firebase Storage rules when using the
project's Firebase-managed default bucket:

```sh
firebase deploy --only storage --project dev
```

If the dedicated bucket is managed only through GCS IAM, verify its IAM policy
and public access prevention directly; Firebase rules do not replace bucket
IAM.

## Verification checklist

- [ ] Dev, Beta, and Prod have different bucket names and service identities.
- [ ] Public access prevention and uniform bucket-level access are enabled.
- [ ] No public or broadly authenticated IAM principal can read objects.
- [ ] Direct Firebase Storage SDK reads/writes are denied.
- [ ] The Functions identity can create, inspect, copy, sign, and delete only
      the intended bucket objects.
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
