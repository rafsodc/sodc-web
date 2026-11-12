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
Adding `deleteMyAccount` changes the deployed endpoint inventory. Use the
[reviewed endpoint-creation contract](./functions-runtime-config-guard.md) and
explicit runtime limits; an unreviewed creation still fails closed. In preservation
mode the new callable intentionally receives no application environment variables
or secret bindings; its Firebase project context is platform-managed. After the
guarded Functions deployment, run the read-only `--verify-creations` check and the
hosted Dev validation below before publishing the member UI. Do not bypass the
guard. A completed creation invalidates the old review and preflight baseline for
later deployments; collect a fresh proposal when starting another release.
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

The service-owner-approved retention target for a completed `AccountErasure`
record is **30 days after `completedAt`**, with a service-owner review by day 25
for held records or unresolved evidence.
The service owner approved this period on 11 November 2026 and confirmed that
Notify expires this service's data after 30 days. This is an operational policy
choice, not a statutory retention period. Disposal remains subject to the
conditions below: provider retention alone does not establish when every task,
callback or manual replay source has ended.

**Automatic disposal:** the existing five-minute security reconciliation worker
performs bounded retention work after its security repairs. It considers at most
ten identities within a 30-second tail budget. A completed standard deletion
records communication quiescence only after task cancellation, the sender drain,
database erasure and confirmed Auth absence have succeeded. At 30 days, the
worker removes all of an identity's aliases and its disposal metadata together
only when all conditions below hold. This is an evidence-checked process rather
than an unconditional TTL.

- Every marker for the UID has a completed deletion and profile-deletion timestamp;
  Auth, the profile and owned active records remain absent.
- Provider-held recipient/message data has reached its confirmed expiry date or
  was removed, and outstanding delivery callbacks are resolved. For Notify, use
  the owner-confirmed 30-day period from the last relevant provider submission;
  no further dashboard check of that setting is required.
- All affected queued tasks are confirmed cancelled or absent, or their maximum
  retention window has elapsed. Cloud Tasks can retain a task for 31 days, so
  the 30-day target alone is insufficient if task cancellation or absence is
  unconfirmed. Legacy imports, downloaded reports and other replay sources have
  also been reviewed.
- All pre-erasure automated backups, recovery logs, manual backups and exports
  capable of restoring the identity are expired or disposed of, or have been
  irreversibly sanitised and verified. An old shared backup with no expiry fails
  this condition.

The worker reads the actual Standard Cloud SQL backup inventory, including every
page and manual snapshots, and `instances.getLatestRecoveryTime`. An old
restorable or deletion-pending backup blocks disposal. The earliest recoverable
time and each restorable backup's start must be later than completed erasure,
including any work after profile deletion. Unsupported backup tiers, missing
metadata, denied access and incomplete inventories all retain suppression. A
configured seven-day retention period is insufficient evidence on its own.

A restricted `AccountErasureDisposalPolicy` records the service-wide review of
external exports and replay sources. It defaults to unreviewed. The service owner
confirmed on 12 November 2026 that there are no known external copies. Activate
the reviewed policy separately in each deployed environment using the operator
tool below; any newly discovered export or replay source must suspend the policy
or place the affected identity on hold before it is used. The application cannot
inventory files held outside its cloud project.

Pre-existing suppression records and early recovery paths default to
`HISTORICAL_EVIDENCE_REQUIRED`; completion timestamps alone do not adopt them.
Record the reviewed task and provider horizons through the operator tool. If
task cancellation or absence cannot be established, use the full 31-day Cloud
Tasks horizon, even if that extends disposal beyond the 30-day target.

Begin, completion, hold, adoption and purge share a versioned per-identity SQL
fence. The purge transaction rechecks the reviewed policy, all aliases, age and
absence of application records before removing the aliases and disposal decision.
A newly started erasure or changed hold invalidates a stale purge. Firebase Auth
absence is checked immediately before the transaction; privileged restores and
imports must still follow the isolation gate below. Late owned delivery tasks
and callbacks require a live, correctly bound subject at the database boundary,
so removal of suppression does not allow orphan records to be recreated.

Member password-reset and verification emails record a minimal, UID-bound
delivery before contacting Notify. An opaque auth-email reference lets their
callbacks resolve that same delivery even before the provider ID is saved or
after a provider-response failure. Action links and personalisation are never
stored in that delivery. Email-change receipts affect delivery state only when
the bound member's current address matches the callback recipient. Auth-only
onboarding without a member profile still permits verification email; there is
no profile delivery state to update. If the service delivery mode changes between
the ledger and mailer's separate configuration reads, an early callback with a
different mode-scoped reference remains ignored until its provider ID is saved.

Other non-announcement callbacks require a recorded provider-ID binding. Unknown
or untracked callbacks, including a missing binding after an uncertain provider
response, are acknowledged without recording a receipt or changing a profile.
Do not recover that association by looking up the current owner of an email
address; the address may belong to a new identity after erasure.

Worker logs contain counts and fixed reason codes, without UIDs, email hashes or
case payloads. Unheld records with unavailable evidence are deferred and retried.
Held records are excluded from the automatic queue: `reviewDueAt` is an operator
review date, not an automatic release or an alert. The service owner must review
the restricted hold/deferral register at least weekly and review unresolved
evidence by day 25 after completion. A later hold needs prompt review; subsequent
reviews must finish by the recorded due date. Record the
owner, evidence and next review in the restricted case system. A missed review
never permits disposal; retain the hold until its evidence is explicitly adopted
or its reason has been resolved through the operator tool.

If a condition is unresolved at day 30, retain only the minimal marker and
restricted disposal decision under a named, documented exception. Record the reason, owner and next review
within 30 days; repeat reviews until disposal is possible. Do not treat an open
exception as approval for indefinite retention. Apply the same disposal decision
to independent case/ledger copies of the UID and email hashes. Incomplete
deletions are recovery work, not candidates for retention purging. Do not use the
ledger for marketing, profiling or preventing a legitimate new registration under
a different UID.

### Disposal operator tool

Use `functions/scripts/account-erasure-disposal-admin.mjs` from a built checkout.
It accepts only the fixed Dev, Beta and Production projects. Preview is read-only;
mutations require explicit apply flags and the exact reviewed policy or decision
version. Subject operations read a private case file rather than putting an
identity on the command line. Keep that file outside Git, mode `0600`, and remove
it with the other restricted case copies when disposal is complete.

The tool supports policy review, explicit holds and historical evidence adoption.
It does not provide a blind purge command. The scheduled worker always repeats
Auth, database, time and backup checks before disposal. Use `--help` for the exact
flags and case-file shape. In a restore or newly discovered export incident,
suspend the service-wide reviewed policy before reopening writers.

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

### Production retention settings and evidence

Read-only metadata checks against `sodc-web-production` on 10 November 2026 found
the settings below. Notify's service-specific retention period was confirmed by
the service owner on 11 November 2026.

| Store | Observed setting | Closure requirement |
| --- | --- | --- |
| Cloud SQL automated backups | Standard backups, enabled, seven retained **successful backups**, midnight UTC window | Confirm that each pre-erasure backup has disappeared after seven newer successful backups; this is count-based, not a guaranteed seven-day expiry. |
| Cloud SQL point-in-time recovery | Enabled; seven days of transaction logs in Cloud Storage | Confirm the earliest recoverable time has advanced beyond erasure. A configured window alone is not proof of physical deletion at an exact instant. |
| Cloud SQL manual backups | The two on-demand snapshots dated 12 August and 25 October 2026 were deleted on 10 November 2026 following explicit owner instruction | Post-deletion inventory confirmed no manual backups remained and all seven original successful automated backups were preserved. Review any new manual backup separately. |
| Instance-deletion backup settings | Retain-on-delete false; final backup disabled | These settings do not expire the manual backups of a running instance. |
| Announcement task queue | Running; four attempts, 30–120 second backoff | Verify selected tasks absent. Attempts/backoff do not bound future scheduled task lifetime; Cloud Tasks has a 31-day retention limit. |
| Cloud Logging | Global `_Default` bucket 30 days; `_Required` bucket 400 days | Separate operational/security-log retention. Contents were not inspected; do not describe these as account data erased by the callable. |
| GOV.UK Notify | Service owner confirmed on 11 November 2026 that this service expires data after 30 days | Record expiry from the last relevant provider submission and allow the 30-day period to elapse; no further dashboard check of the setting is required. Resolve any outstanding callbacks or separately retained exports before suppression disposal. |

For an erasure on 10 November 2026, the daily-backup rollover is expected around
17 November **only if seven subsequent backups succeed**. Recovery-log expiry
must be checked separately after its seven-day window. The manual snapshots no
longer prevent rollover, but final backup erasure is still **not confirmed** until
the remaining pre-erasure automated backups and recovery window are verified gone.
Keep restore exclusion in force until then. Do not restore a shared backup merely
to inspect this member's data.

The bucket-name inventory did not establish that no database exports exist.
The owner confirmed no known external copies on 12 November 2026; record any
new export destinations, provider CSV downloads, operator copies or separately
retained Auth exports in the restricted case process and place a disposal hold
before using them. No member names,
addresses, UID values or email hashes belong in this document or a public PR.

Sources: [Cloud SQL backup retention](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backups),
[Cloud Tasks retention](https://docs.cloud.google.com/tasks/docs/comp-pub-sub),
[Cloud SQL recovery horizon](https://docs.cloud.google.com/sql/docs/postgres/admin-api/rest/v1/projects.instances/getLatestRecoveryTime),
[Notify retention](https://www.notifications.service.gov.uk/using-notify/data-retention-period).


## Hosted suppression-disposal validation

Build the committed Functions source and deploy the schema, connector and all
workers through the guarded release path. Review and activate the service-wide
external-replay policy separately. The fixed-project runner uses read-only Auth,
three random synthetic metadata identities and the existing security scheduler;
it does not create/delete Auth accounts, change the policy or send provider mail.

```sh
RUN_ACCOUNT_ERASURE_DISPOSAL_VALIDATION=1 \
ACCOUNT_ERASURE_DISPOSAL_PROJECT=sodc-web \
ACCOUNT_ERASURE_DISPOSAL_CONFIRM=sodc-web \
node functions/scripts/validate-account-erasure-disposal-cloud.mjs
```

Use `sodc-web-production` for both project and confirmation to run the explicitly
authorized Production smoke test. `--check` verifies targeting without SDK,
credential, fixture or network access. Beta and caller-supplied resources are
not supported by this runner.

The Production test requires the actual scheduled runtime to remove both aliases
and the temporary decision of an eligible synthetic identity using its real SQL
backup/recovery-horizon reads. Held and incomplete fixtures must remain. Dev's
disposable SQL configuration is expected to defer removal; the test requires a
worker version/reason update proving that it processed and retained the fixture.
Every fixture is ownership-checked and removed afterward, and the original
administrator roster and policy are verified unchanged. A rejected seed response
has an uncertain outcome and cannot be reported as confirmed cleanup merely
because an immediate read is empty. Retain bounded PASS/cleanup output privately.

## Hosted Dev self-deletion validation

Deploy the authorization connector first, then the new callable through the
guarded Functions path. Use a clean, reviewed Node 24 checkout, its matching Dev
web configuration and the existing project authorization-migration receipt. The
runner accepts only the fixed `sodc-web` Dev project, explicit opt-ins and hosted
callable URLs; production, emulator and caller-supplied endpoint overrides fail
before SDK or credential access.

```sh
RUN_SELF_ACCOUNT_DELETION_VALIDATION=1 \
SELF_ACCOUNT_DELETION_PROJECT=sodc-web SELF_ACCOUNT_DELETION_CONFIRM=sodc-web \
node --env-file=.env.development.local functions/scripts/validate-self-account-deletion-cloud.mjs
```

Add `--check` for a local targeting-only check with no SDK, credential, network or
fixture access. Build Functions before a real run. Existing baseline administrator
health and a non-live Dev email mode are checked before fixture creation. The
runner uses random synthetic identities, real password sign-ins and verified
Firebase ID tokens; it never prints passwords, tokens or baseline identities.
Task fixtures use a separate task-only app bound to the active, fixed Dev worker's
verified service account; the operator's credential permissions remain unchanged.
Long callable requests use an explicit 540-second HTTPS/socket deadline so a
shorter default fetch header timeout cannot cut off the required sender drain.

The hosted checks cover NOT_STARTED refusal details, authorization changes,
retention review, rate limiting and an actually aged sign-in refreshed without
resetting its authentication time. Successful deletion preserves another synthetic
recipient and proves runtime task-delete permission by independently reading that
a known queued SIMULATION task has disappeared. A second request encounters an
owned active delivery lease after the 330-second drain, leaving a genuine disabled
SELF hold. The runner settles only that synthetic lease and completes deletion
through the hosted administrator callable.

The active notification fixture has no recovery payload and cannot send mail.
Both long requests settle before cleanup; an uncertain transport outcome waits
out the server budget before owned state is changed. All temporary roles, records,
markers and tasks are removed and the baseline administrator count is verified.
Retain the bounded PASS/stage/cleanup output as private release evidence. Any
cleanup failure requires review of only the printed synthetic run prefix. Do not
promote to production until the hosted run, creation-contract verification and
ordinary deployment audit pass.

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
