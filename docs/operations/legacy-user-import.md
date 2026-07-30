# Legacy user import runbook

This runbook covers the resumable importer introduced by issue #419. Read
`legacy-user-migration-schema.md` first for the approved field mapping.

The importer is intentionally fail-closed:

- dry-run is the default;
- the GPG artifact is decrypted through a pipe and plaintext is never written;
- logs and the resume ledger contain aggregate counts and identifiers only;
- every target must be declared in `.firebaserc`;
- apply requires an exact project confirmation, UUID batch ID, and owner-only
  checkpoint file;
- production apply additionally requires the approved, input-bound issue #420
  artifact.

## Prerequisites

Install `gpg`, Node dependencies, the Firebase CLI, and Google Cloud CLI. From
the repository root:

```bash
cd functions
npm ci
gcloud auth application-default login
```

Application Default Credentials, rather than `firebase login`, authorize the
Firebase Admin and Data Connect SDKs. The operator also needs permission to
list/import Firebase Auth users and run the Data Connect admin connector.

Keep the encrypted JSONL, preflight, approval, and state files outside the
repository. Never commit them. Check the GPG recipient/fingerprint through the
separately agreed secure channel before running the import.

GPG may open its normal pinentry prompt when the private key is protected by a
passphrase. Enter it there; the importer does not receive, store, or log the
passphrase. If pinentry cannot open, verify decryption independently while
discarding plaintext:

```bash
gpg --decrypt /secure/path/legacy-users.jsonl.gpg >/dev/null
```

On terminals that require an explicit GPG TTY, run this in the same shell
before the importer:

```bash
export GPG_TTY="$(tty)"
```

`gpg-agent` may cache an unlocked key briefly, which explains why a direct
decryption check can make a subsequent importer run succeed without prompting.

## Input contracts

The preflight must have:

- `schemaVersion: sodc-legacy-user-preflight/v2`;
- `recordSchemaVersion: sodc-legacy-user/v1`;
- `overall.recordCount` equal to the decrypted non-empty JSONL record count.

Every JSONL object must contain exactly the fields listed in
`legacy-user-migration-schema.md`. Unexpected or missing fields fail closed.
The CLI computes SHA-256 over the exact decrypted byte stream; this checksum
binds provenance, resume state, and production approval to one source artifact.

## 1. Build and test

Deploy the Data Connect schema and connector operations before using the
importer in an environment:

```bash
npx firebase dataconnect:sdk:generate --project sodc-web
npx firebase deploy --only dataconnect --project sodc-web
npm run build
npm test
```

For beta or production, replace `sodc-web` with the exact project ID.

## 2. Dry-run

Dry-run decrypts and validates the complete artifact, snapshots Firebase Auth
and Data Connect, and emits an aggregate plan. It performs no writes.

```bash
npm run legacy-user-import -- \
  --input /secure/path/legacy-users.jsonl.gpg \
  --preflight /secure/path/legacy-user-preflight.json \
  --project sodc-web
```

When invalid contact values need operator review, run from a private local
terminal with interactive remediation enabled:

```bash
npm run legacy-user-import -- \
  --input /secure/path/legacy-users.jsonl.gpg \
  --preflight /secure/path/legacy-user-preflight.json \
  --project sodc-web \
  --interactive-remediation
```

This mode deliberately displays the affected member's name, service number, and
invalid value in the local terminal. Do not use it in CI, a recorded session,
shared terminal, or captured log. Invalid email addresses accept:

- a valid replacement;
- `LOST` to create a disabled, email-less Firebase identity and an empty-email
  Data Connect profile with `membershipStatus=LOST`; or
- `SKIP` to quarantine the complete record.

Invalid mobile numbers accept a replacement, with Enter defaulting to a null
mobile for completion during profile review.

The `LOST` exception is deliberately narrow. It omits the Firebase Auth email,
email-verification state, and imported password hash; sets `enabled=false`;
keeps the Auth account disabled; and stores an empty `User.email` only so the
restricted profile remains visible in administrative lost-member views. It can
never sign in or receive email until an administrator supplies and verifies a
real address through a separately controlled remediation flow.

Remediation values remain in memory and are not written to the resume ledger or
ordinary output. The reported `sourceChecksum` combines the decrypted artifact
checksum with the exact remediation decisions. Use
`--interactive-remediation` and enter the same answers for apply and resume;
different answers produce a different checksum and fail the approval/ledger
binding.

Review:

- `recordCount` against the signed-off preflight;
- `sourceChecksum` against later runs and the approval artifact;
- create/link/already-mapped counts;
- password-reset and compatible-bcrypt counts;
- warning and quarantine reason counts.

The output deliberately contains no names, email addresses, phone numbers, or
password hashes. Investigate exceptions from the controlled source system, not
by adding PII logging to this CLI.

## 3. Non-production apply

First prove the legacy bcrypt variant in staging with test accounts. Supply
`--bcrypt-proven` only after that proof; without it even structurally compatible
hashes are omitted and those members use password reset.

Use a new UUID and a state path in an access-controlled directory:

```bash
MIGRATION_BATCH_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

npm run legacy-user-import -- \
  --input /secure/path/legacy-users.jsonl.gpg \
  --preflight /secure/path/legacy-user-preflight.json \
  --project sodc-web \
  --apply \
  --batch-id "${MIGRATION_BATCH_ID}" \
  --state /secure/path/sodc-web-import-state.json \
  --confirm-project sodc-web \
  --batch-size 500 \
  --interactive-remediation \
  --bcrypt-proven
```

If the plan contains quarantined source rows, apply stops unless the operator
acknowledges the exact distinct row count, for example:

```bash
--allow-quarantine-count 12
```

This is not approval of the exceptions; it prevents a changed quarantine count
from silently proceeding. Keep the reviewed exception decision separately.

## 4. Resume an interrupted apply

Use the same project, artifact, preflight, batch ID, state path, and options:

```bash
npm run legacy-user-import -- \
  --input /secure/path/legacy-users.jsonl.gpg \
  --preflight /secure/path/legacy-user-preflight.json \
  --project sodc-web \
  --apply \
  --resume \
  --batch-id "${MIGRATION_BATCH_ID}" \
  --state /secure/path/sodc-web-import-state.json \
  --confirm-project sodc-web \
  --batch-size 500 \
  --interactive-remediation \
  --bcrypt-proven
```

The state file is mode `0600` and contains only the project/batch/input binding,
legacy UUID, canonical UID, and completed stage names. Resume rejects any
project, checksum, schema, batch, or canonical-UID mismatch. Do not edit the
ledger manually.

There is no transaction spanning Firebase Auth and Data Connect. A failure
after Auth import leaves new accounts disabled. Profile writes complete before
the access pass begins; restricted memberships remain disabled. Existing Auth
accounts retain their `disabled` state and custom claims other than the
membership-derived `enabled` claim. Admin claims are never created.

## 5. Production approval and apply

Do not run production apply until issue #420 has approved the complete mapping
and exception set. Store the approval outside the repository:

```json
{
  "schemaVersion": "sodc-legacy-user-migration-approval/v1",
  "issue": 420,
  "approved": true,
  "projectId": "sodc-web-production",
  "sourceChecksum": "<64 lowercase hexadecimal characters from dry-run>",
  "recordSchemaVersion": "sodc-legacy-user/v1",
  "expectedRecordCount": 918
}
```

Then rerun dry-run against production, compare the complete aggregate plan, and
use the same artifact for apply:

```bash
npm run legacy-user-import -- \
  --input /secure/path/legacy-users.jsonl.gpg \
  --preflight /secure/path/legacy-user-preflight.json \
  --project sodc-web-production \
  --apply \
  --production \
  --approval /secure/path/issue-420-approval.json \
  --batch-id "${MIGRATION_BATCH_ID}" \
  --state /secure/path/production-import-state.json \
  --confirm-project sodc-web-production \
  --batch-size 500 \
  --interactive-remediation \
  --bcrypt-proven
```

After completion, retain the encrypted source, preflight, approval, aggregate
output, and protected ledger according to the agreed migration retention
policy. Run the issue #425 postflight reconciliation before cutover.

## Recovery rules

- Retry only with `--resume` and the exact original binding.
- Do not delete or update pre-existing Auth accounts or profiles as rollback.
- Do not manually create a second legacy mapping.
- Keep partial accounts disabled while investigating.
- Any compensation must first prove that the affected account was created by
  this migration batch; otherwise escalate rather than changing it.
