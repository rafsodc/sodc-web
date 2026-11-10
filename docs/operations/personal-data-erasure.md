# Personal data erasure

## Admin screen

Manage Users now offers **Delete account** for non-admin accounts. The callable
requires fresh enabled administrator authority, rejects self-deletion, runs a
read-only inventory and requires email confirmation plus a no-retention decision.
It supports initialized non-admin accounts and their owned announcement recipient
entries, version-1 shared announcement snapshots, notification deliveries without
financial references, callback receipts and completed non-admin security history.
Only the selected member's entries are removed from shared snapshots; surviving
entries and summary fields are preserved and recipient counts are adjusted.
Financial records, unsupported snapshots, ambiguous shared addresses, shared
content and administrator audit evidence remain blockers.

Apply establishes a durable per-member suppression record before disabling access
and revoking sessions. Announcement tasks are cancelled by deterministic ID, and
new recipients, snapshots, notification deliveries and callback receipts are
blocked at the database boundary. Workers check suppression before sending.
The function waits at least 330 seconds for previously running send/preparation
work, then repeats the inventory. Active delivery leases cause a retry response.
Other recipients continue normally; this workflow needs no global sending pause.

Shared snapshots are redacted one at a time using an authorized compare-and-swap
transaction on the original contents and counts. The profile and owned records
are then removed under administrator and target security-version fences. Auth is
deleted last and absence is verified. An interruption leaves the account disabled
and suppressed; retry from the screen to resume. Recovery after profile deletion
requires the durable marker proving that this workflow removed it. Unknown
Auth-only accounts still require operator review.

The restricted `AccountErasure` ledger retains only the UID, normalized email
hashes and deletion stage timestamps. It contains no name, raw address or message
content. Historical address hashes prevent late provider callbacks from
recreating records. Backups, provider-held messages and other external records
still require separate operational review; the screen does not claim complete
GDPR erasure.

Roll out the schema and guarded connector operations first, then all announcement,
notification, callback and security writers, then the new deletion callable and
frontend. Do not enable deletion before those workers are updated. The deletion runtime
identity must have `cloudtasks.tasks.delete` for the announcement queue; verify
that permission before release. Cancellation failure stops the erasure. After the first
erasure, old snapshot writers without the complete recipient-ID list fail closed.
Do not roll back suppression guards or restore a deleted UID without operator
review. A database restore must reapply the restricted ledger before enabling
writers or exposing restored personal data.

Use a restricted operator session and a case reference that contains no personal
data. Record the request, identity verification, scope and retention decision in
the restricted case system. Do not put the subject's details in Git or tickets.

## Legacy operator tool scope

Use the admin screen for supported communication erasure and retries. The legacy
operator tool does not implement communication cleanup or the online suppression
protocol; do not use it to bypass an admin-screen blocker.

`functions/scripts/erase-personal-data.mjs` supports an inactive non-admin account
with no domain activity or external customer record. It removes the profile,
legacy identity link, group memberships, announcement opt-outs, rate counters,
ready non-admin security state and self-authored completed security transitions.
It scans every schema table, every scalar field and direct relation for the UID,
email and normalized email hash. Other matches stop the workflow before writes.
Bookings, payments, announcements (including serialized snapshots), shared
content, operator audit evidence and provider delivery records require a reviewed
extension. A no-retention decision does not bypass those blockers.

This is an operator tool, not a public callable endpoint. It needs privileged
Application Default Credentials for the explicitly selected project and Data
Connect service. It uses service GraphQL operations without deploying a connector.
Validate queries and transaction behavior against the deployed schema in a
non-production project before first production use. Unit tests use mocked services
and do not establish compatibility with a deployed service.

## Procedure

1. Verify the request and record that no retention exception applies. Resolve the
   exact Auth UID and ensure the profile has the same email. Review alternate
   email addresses, name-only mentions, uploaded files, legacy exports/import
   ledgers, support correspondence, logs, Stripe and GOV.UK Notify independently.
   The automatic scan cannot discover those from an email alone. Remove eligible
   external data using each provider's supported process and record the outcome.
2. Preview from the repository root (replace all placeholders):

   ```sh
   node functions/scripts/erase-personal-data.mjs \
     --project PROJECT_ID --email EMAIL --uid AUTH_UID \
     --case CASE_REFERENCE --receipt /absolute/protected/path/receipt.jsonl
   ```

   The receipt contains counts and stage markers, no email or raw UID. Restrict
   access to it. Resolve every blocker; do not edit the database to conceal one.
3. Pause all account/profile, booking, notification, task and reconciliation
   writers, including background jobs and incoming callbacks. Signing out the
   member alone does not prevent service writes. Confirm the maintenance window
   is effective. Keep writers paused through verification. If a reliable pause
   cannot be established, do not apply; implement durable per-subject write
   exclusion before using this workflow online.
4. Run the same command with `--apply --no-retention --writers-paused
   --external-reviewed`. These flags attest to completed operational work; the
   tool does not pause services or erase external systems itself. It rechecks the
   identity, inventories data, disables Auth and revokes sessions, inventories
   again, deletes eligible database rows in one transaction, verifies absence,
   then deletes Auth and verifies absence there. The last stage is
   `ACTIVE_STORES_ERASED`, not a claim of complete GDPR erasure.
5. On failure, keep the receipt and inspect the state. Retry the same UID, email
   and case; an already-missing Auth account or profile is supported. Never
   re-enable an account as automatic rollback. If receipt persistence fails after
   a remote mutation, the outcome is uncertain; re-inventory before proceeding.
6. Verify external removal and remaining manual searches, then resume writers
   and check that callbacks/tasks do not recreate personal records. Record backup
   expiry dates under the configured backup retention policy. Keep erased data
   beyond use in backups; any restore must reapply the restricted erasure ledger
   before exposing restored data. Retain only the minimum restricted evidence
   needed to demonstrate the request was handled. Close the case and confirm to
   the requester only when these obligations are satisfied.

## Checks

On 9 November 2026, validation passed against a disposable local SQL database
(30 integration cases, including the existing administrator-safety races) and
against real Dev Auth/Data Connect services using verified Firebase-signed tokens.
The hosted Dev callable was also deployed and passed the same real-token checks,
including member denial, self-deletion refusal, stale-email and missing-retention
confirmation refusal. Only the new Dev function was deployed; frontend hosting
and production were not changed.
The Dev run checked administrator authorization, self-deletion refusal, read-only
preview, linked-record blockers, deletion, absence verification and replay of an
already-completed deletion. Its disposable fixtures were removed and verified
absent. Production was not modified.

Validation added regression coverage for Auth-only accounts and orphan account
metadata: these require operator recovery, and leftover metadata prevents a
success response. The operator tool recognizes completed administrator deletion
holds so an interrupted admin deletion can be finished after the maintenance
and external-review requirements are met.

The extended cloud validation runner seeds only synthetic shared announcements,
terminal notifications, historical-address receipts and a future SIMULATION task.
It checks preservation of the other recipient, task cancellation, historical
address suppression and rejection of late recipient insertion. Its long-running
delete may take several minutes.

The cloud validation runner accepts only the explicitly confirmed Dev project,
checks existing administrator safety before creating fixtures, and retires its
temporary administrator through the supported transition during cleanup. It
accepts SIMULATION or TEAM_TEST because it invokes no mailer, its notification
fixture is terminal SENT and its queued task is SIMULATION, scheduled an hour
ahead and cancelled during cleanup. It never changes delivery settings. From the repository
root, after building Functions:

```sh
RUN_ACCOUNT_DELETION_VALIDATION=1 \
ACCOUNT_DELETION_PROJECT=sodc-web ACCOUNT_DELETION_CONFIRM=sodc-web \
node --env-file=.env.development.local functions/scripts/validate-account-deletion-cloud.mjs
```

On 10 November 2026 the Dev hosting build also passed a real browser walkthrough:
sign-in, user search, preview, typed-email and retention confirmation guards,
deletion, success feedback, account absence and fixture cleanup.

By default this calls the local build with real cloud services and verified
tokens. Set `ACCOUNT_DELETION_TRANSPORT=browser` to repeat this walkthrough in
a temporary Playwright Chromium session against Dev hosting. Set `ACCOUNT_DELETION_TRANSPORT=hosted` to exercise the fixed Dev HTTPS
callable endpoint after deploying it. The runner does not deploy anything.

```sh
node --test functions/scripts/erase-personal-data.test.mjs
```

Before production, exercise a disposable non-admin fixture with a legacy link,
membership, opt-out, rate counters and ready security state in a non-production
project. Check preview is read-only, linked bookings block all writes, both stores
are empty after apply, a retry is safe, and an interrupted Auth deletion can be
finished. Confirm last-admin controls remain unchanged. Do not use a member's
account as the acceptance fixture.
