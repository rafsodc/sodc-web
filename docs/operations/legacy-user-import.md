# Legacy user import runbook

This runbook covers the resumable importer introduced by issue #419. Read
`legacy-user-migration-schema.md` first for the approved field mapping. Before
running dry-run, use
[`legacy-user-migration-review.md`](legacy-user-migration-review.md) to turn
the preflight report into a review worksheet and an approval-artifact stub for
issue #420. For the sequenced rehearsal-to-cutover procedure that uses this
importer, see
[`legacy-user-migration-runbook.md`](legacy-user-migration-runbook.md)
(issue #417).

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
- the persisted `legacyPasswordMigrated` outcome for migration-created
  profiles (`true` for an imported proven-compatible hash, otherwise `false`);
- warning and quarantine reason counts.

The output deliberately contains no names, email addresses, phone numbers, or
password hashes. Investigate exceptions from the controlled source system, not
by adding PII logging to this CLI.

## 3. Non-production apply

First prove the legacy bcrypt variant in staging with test accounts. Supply
`--bcrypt-proven` only after that proof; without it even structurally compatible
hashes are omitted and those members use password reset.

sodc-api's Symfony `auto` hasher stamps bcrypt hashes with the `$2y$` prefix
(PHP's `password_hash()` marker), which is less common than the `$2a$`/`$2b$`
prefixes most bcrypt tooling defaults to. Firebase Authentication's BCRYPT
import has not otherwise been proven against that specific prefix. Prove it
with a disposable synthetic account rather than real member data:

```bash
npm run legacy-bcrypt-pilot -- \
  --project sodc-web \
  --api-key <Firebase Web API key for that project>
```

This generates a fresh random password and a `$2y$`-prefixed bcrypt hash for
it, imports one throwaway test account (`...@sodc-legacy-bcrypt-pilot.invalid`)
using the same `admin.auth().importUsers(..., { hash: { algorithm: "BCRYPT" }
})` call the real importer uses, attempts to sign in with the generated
password via Firebase's REST API, then deletes the test account regardless of
outcome. No real passwords, hashes, or member data are read or displayed. The
Web API key is not secret -- it identifies the project, not a credential --
but should come from your own environment configuration
(`.env.<mode>.local`'s `VITE_FIREBASE_API_KEY`) rather than being hardcoded
anywhere. It refuses to target the project aliased `prod` in `.firebaserc`
unless `--allow-production` is passed; there is normally no reason to, since
Firebase's BCRYPT import behaviour is a platform property rather than a
per-project one, so proving it once in a non-production project is enough.
Re-run it if Beta/Prod ever need independent confirmation.

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
legacy UUID, canonical UID, completed stage names, and reason codes for records
excluded by destination reconciliation. It contains no contact details or
password hashes. Resume rejects any project, checksum, schema, batch, or
canonical-UID mismatch. Do not edit the ledger manually.

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
  "schemaVersion": "sodc-legacy-user-migration-approval/v2",
  "issue": 420,
  "approved": true,
  "projectId": "sodc-web-production",
  "sourceChecksum": "<64 lowercase hexadecimal characters from dry-run>",
  "preflightChecksum": "<64 lowercase hexadecimal characters emitted by the review tool>",
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

## 6. Postflight reconciliation

Run postflight immediately after a completed apply and before migrated members
can sign in or edit profiles. It decrypts the same source in memory, repeats the
same remediation questions, and first requires the resulting effective
checksum to match the protected importer ledger. Different answers fail closed
before destination comparison.

Before enabling migrated members, complete the target environment's
[Firebase password-policy setup](./firebase-password-policy.md). Rehearsal must
prove that a compatible imported password passes the deployed policy, while a
missing or non-compliant password reaches the in-app reset journey. It must also
exercise email verification followed by the combined profile and communication
review; migrated profiles retain a null `profileReviewedAt` until that complete
review succeeds.

Deploy the updated Data Connect connector before running postflight; its
server-only batch query exposes the fields needed for read-only comparison:

```bash
npx firebase deploy --only dataconnect --project sodc-web
```

Then run from `functions`, using the same `--bcrypt-proven` choice as apply:

```bash
npm run legacy-user-postflight -- \
  --input /secure/path/legacy-users.jsonl.gpg \
  --preflight /secure/path/legacy-user-preflight.json \
  --state /secure/path/sodc-web-import-state.json \
  --project sodc-web \
  --confirm-project sodc-web \
  --output /secure/path/sodc-web-postflight.json \
  --interactive-remediation \
  --bcrypt-proven
```

For production, use the production paths/project and add `--production`:

```bash
npm run legacy-user-postflight -- \
  --input /secure/path/legacy-users.jsonl.gpg \
  --preflight /secure/path/legacy-user-preflight.json \
  --state /secure/path/production-import-state.json \
  --project sodc-web-production \
  --confirm-project sodc-web-production \
  --output /secure/path/production-postflight.json \
  --interactive-remediation \
  --bcrypt-proven \
  --production
```

The command compares each imported identity across the ledger, immutable
legacy mapping, Data Connect, and Firebase Auth. Profiles created by the
migration receive an exact field comparison. Pre-existing linked profiles are
not overwritten by the importer, so postflight checks their identity and email
rather than treating their existing profile fields as migrated values. Planned
reconciliation exclusions must match the ledger and must have no mapping in
the migration batch.

Success prints `outcome: "match"` and exits zero. A mismatch exits non-zero and
reports only aggregate reason counts plus deterministic correlation IDs. The
retained report is written atomically with mode `0600` and contains no raw
names, emails, mobiles, source rows, or password hashes.

Firebase Auth does not expose imported password hashes. Postflight therefore
compares the persisted `legacyPasswordMigrated` evidence with the approved
plan, records compatible-bcrypt eligibility and completed importer stages, but
sets `credentialHashesDirectlyVerifiable` to zero and states this limitation
in the report. Credential sign-in compatibility remains the staging proof
required before `--bcrypt-proven` is used. The marker is historical; use it
with Firebase Auth `lastSignInTime` when assessing whether somebody has used
the new site.

## Recovery rules

- Retry only with `--resume` and the exact original binding.
- Do not delete or update pre-existing Auth accounts or profiles as rollback.
- Do not manually create a second legacy mapping.
- Keep partial accounts disabled while investigating.
- Any compensation must first prove that the affected account was created by
  this migration batch; otherwise escalate rather than changing it.
