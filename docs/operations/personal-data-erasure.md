# Personal data erasure

## Member account settings

Enabled members can choose **Delete account** in Account Settings. The screen
warns that deletion ends membership, permanently removes sign-in access and
cannot be undone. A read-only eligibility check precedes typed-email confirmation,
explicit acknowledgement that membership ends and recent authentication.

The `deleteMyAccount` callable derives the target from the authenticated member;
callers cannot select another account or certify that retention obligations do
not apply. Financial, shared-content and administrator-audit blockers are checked
on the server. Ineligible members are directed to contact an administrator;
checking eligibility or cancelling the dialog does not end membership.
Administrator accounts require another administrator's help and cannot use
self-service deletion.

Eligible deletion uses the same communication suppression, task cancellation,
sender drain, shared-snapshot redaction and database fences as administrator
erasure. Membership is ended and sign-in is disabled before the final erasure.
Completion signs out the member and clears the private session. A confirmed
refusal before suppression begins leaves the dialog cancellable and restores
private reads; existing access-revocation or stale-session recovery still applies.
An unconfirmed write or interrupted operation requires administrator review; do
not promise deletion is complete after an unconfirmed response. After the deletion
hold is established, leave the account disabled and suppressed and finish through
Manage Users. Provider-held data and recoverable copies remain subject to the
retention and restore procedures below.

Suppression is established before access is disabled. If task cancellation or the
identity re-check fails at that point, the account may remain enabled and still
a member while its messages are suppressed. Keep the marker and have
an operator inspect the current identity and security state. Resume Manage Users
deletion for an eligible non-admin account; a concurrently promoted administrator
needs operator review. Do not remove suppression or change privileges as an
automatic rollback.

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


Roll out the schema and guarded connector operations (including the narrowly
scoped self-deletion security transition) first, then all announcement,
notification, callback and security writers, then the new deletion callable and
frontend. Do not enable deletion before those workers are updated.
Adding `deleteMyAccount` changes the deployed endpoint inventory. The current
Functions configuration guard rejects new endpoints; its endpoint-creation
contract requires a separate review before rollout. Do not bypass that guard or
publish the member UI before the callable and connector changes are deployed.
The deletion runtime identity must have `cloudtasks.tasks.delete` for the announcement queue; verify
that permission before release. Cancellation failure stops the erasure. After the first
erasure, old snapshot writers without the complete recipient-ID list fail closed.
Do not roll back suppression guards or restore a deleted UID without operator
review. A database restore must reapply the restricted ledger before enabling
writers or exposing restored personal data.

Use a restricted operator session and a case reference that contains no personal
data. Record the request, identity verification, scope and retention decision in
the restricted case system. Do not put the subject's details in Git or tickets.

## Retention and erasure closure

### Suppression record policy

The operational target is to retain a completed `AccountErasure` record for
**100 days after `completedAt`**, with a service-owner review by day 90. This is
an operational policy choice, not a statutory retention period. It covers the
31-day Cloud Tasks lifetime and Notify's configurable message-retention window
of up to 90 days, with a margin for delayed processing. Message retention alone
does not establish when every callback or manual replay source has ended.

**Current implementation:** records have no TTL or automatic purge job. This
policy requires manual disposition; writing it does not make records expire.
Do not introduce a blind 100-day TTL while recoverable copies or replay sources
remain. The service owner must record review and disposal in the restricted case
record and arrange a separately reviewed purge when all conditions below hold:

- Every marker for the UID has a completed deletion and profile-deletion timestamp;
  Auth, the profile and owned active records remain absent.
- Provider-held recipient/message data and outstanding delivery callbacks are
  confirmed expired or removed. A published default is not service-specific proof.
- Queued tasks are absent, their retention window has elapsed, and legacy imports,
  downloaded reports and other replay sources have been reviewed.
- All pre-erasure automated backups, recovery logs, manual backups and exports
  capable of restoring the identity are expired or disposed of, or have been
  irreversibly sanitised and verified. An old shared backup with no expiry fails
  this condition.

If a condition is unresolved at day 100, retain only the existing minimal marker
under a named, documented exception. Record the reason, owner and next review
within 30 days; repeat reviews until disposal is possible. Do not treat an open
exception as approval for indefinite retention. Incomplete deletions are recovery
work, not candidates for retention purging. Do not use the ledger for marketing,
profiling or preventing a legitimate new registration under a different UID.

A restore must remain isolated, with writers and callbacks disabled, until the
current erasure ledger has been reapplied and erased identities removed from the
restored data. A pre-erasure backup may not contain the ledger at all. The current
application stores the ledger in Data Connect; it does not automatically maintain
an independent disaster-recovery copy. Operators must have a current restricted
case/ledger copy independent of the restored database. If that evidence is
unavailable, do not open the restored service. This is a required operational
restore gate, not an automated restore guarantee.

The UID and unsalted email hash remain restricted pseudonymous personal data;
hashing does not exempt them from retention review. The ICO requires retention to
be justified and reviewed, and backup data awaiting replacement to be kept beyond
use. See [storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
and [erasure and backups](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/).

### Production retention settings checked on 10 November 2026

Read-only metadata checks against `sodc-web-production` found:

| Store | Observed setting | Closure requirement |
| --- | --- | --- |
| Cloud SQL automated backups | Standard backups, enabled, seven retained **successful backups**, midnight UTC window | Confirm that each pre-erasure backup has disappeared after seven newer successful backups; this is count-based, not a guaranteed seven-day expiry. |
| Cloud SQL point-in-time recovery | Enabled; seven days of transaction logs in Cloud Storage | Confirm the earliest recoverable time has advanced beyond erasure. A configured window alone is not proof of physical deletion at an exact instant. |
| Cloud SQL manual backups | The two on-demand snapshots dated 12 August and 25 October 2026 were deleted on 10 November 2026 following explicit owner instruction | Post-deletion inventory confirmed no manual backups remained and all seven original successful automated backups were preserved. Review any new manual backup separately. |
| Instance-deletion backup settings | Retain-on-delete false; final backup disabled | These settings do not expire the manual backups of a running instance. |
| Announcement task queue | Running; four attempts, 30–120 second backoff | Verify selected tasks absent. Attempts/backoff do not bound future scheduled task lifetime; Cloud Tasks has a 31-day retention limit. |
| Cloud Logging | Global `_Default` bucket 30 days; `_Required` bucket 400 days | Separate operational/security-log retention. Contents were not inspected; do not describe these as account data erased by the callable. |
| GOV.UK Notify | Service-specific setting and remaining recipient records require an authenticated dashboard check | Published default is seven days, configurable from three to 90 days. Do not substitute that default for the actual setting. |

For an erasure on 10 November 2026, the daily-backup rollover is expected around
17 November **only if seven subsequent backups succeed**. Recovery-log expiry
must be checked separately after its seven-day window. The manual snapshots no
longer prevent rollover, but final backup erasure is still **not confirmed** until
the remaining pre-erasure automated backups and recovery window are verified gone.
Keep restore exclusion in force until then. Do not restore a shared backup merely
to inspect this member's data.

The bucket-name inventory did not establish that no database exports exist.
Review export destinations, provider CSV downloads, operator copies and any
separately retained Auth exports in the restricted case process. No member names,
addresses, UID values or email hashes belong in this document or a public PR.

Sources: [Cloud SQL backup retention](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backups),
[Cloud Tasks retention](https://docs.cloud.google.com/tasks/docs/comp-pub-sub),
[Notify retention](https://www.notifications.service.gov.uk/using-notify/data-retention-period).


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

On 11 November 2026, member self-service deletion passed local UI tests for
membership warnings, confirmations, sign-in checks and session replacement, plus
backend tests for own-account authorization, retention blockers and interrupted
recovery. All 71 disposable local SQL integration cases passed, including the
narrow SELF deletion transition, final purge, shared-recipient preservation and
rejection of superseded deletion authority. These checks used synthetic fixtures;
the new member callable and UI have not been deployed or validated in a hosted
environment.

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
