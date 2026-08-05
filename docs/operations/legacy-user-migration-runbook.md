# Legacy user migration production runbook

This is the rehearsal and cutover runbook for issue [#417](https://github.com/rafsodc/sodc-web/issues/417),
part of the legacy-user-migration epic
[#415](https://github.com/rafsodc/sodc-web/issues/415). Read
[`legacy-user-migration-schema.md`](legacy-user-migration-schema.md) for the
approved field mapping,
[`legacy-user-migration-review.md`](legacy-user-migration-review.md) for the
preflight review worksheet tooling, and
[`legacy-user-import.md`](legacy-user-import.md) for the importer itself
before using this runbook -- it sequences those tools rather than replacing
them.

Migration mapping and exceptions were approved in issue
[#420](https://github.com/rafsodc/sodc-web/issues/420) (closed). Profile
review for migrated users ([#416](https://github.com/rafsodc/sodc-web/issues/416))
and email verification ([#411](https://github.com/rafsodc/sodc-web/issues/411))
are both built and shipped.

## Fresh-instance precondition

**This runbook's recovery strategy assumes `sodc-web-production` has no real
member accounts on it yet.** As of this writing it is a genuinely unprovisioned
project -- never deployed to, missing required Google Cloud APIs. Because of
that, a failed or partial production import can be recovered by wiping the
project's migration-created Auth users and Data Connect data and re-running
with a new batch ID, rather than needing per-record surgical rollback tooling.

**If production ever gains real, independently-registered accounts before
this migration runs, stop and re-plan.** The wipe-and-restart recovery
strategy in this document would delete those accounts too. At that point,
follow the general (non-destructive) recovery rules in
[`legacy-user-import.md`](legacy-user-import.md)'s "Recovery rules" section
instead, and this runbook's recovery section needs rewriting before the next
production attempt.

## 1. Maintenance window and delta strategy

Two approaches, pick one per run rather than prescribing it here:

- **(a) Frozen window** -- put the legacy site into maintenance/read-only mode,
  export once, migrate, cut over.
- **(b) Initial load + final delta** -- export and migrate now against the
  system as it is (an export already exists: 918 records, generated
  2026-07-26T15:27:09Z), then take a small final delta export immediately
  before cutover to capture anything that changed in between.

**Recommended: (b).** The fresh-instance precondition above makes retries
cheap -- there is no reason to freeze the legacy system for an extended
window. Record the chosen approach, the maintenance window (if any), and the
final export timestamp here before proceeding:

- [ ] Approach chosen: ******\_\_\_******
- [ ] Window / final export timestamp: ******\_\_\_******

## 2. Roles and approvals

- [ ] Named operator: ******\_\_\_******
- [ ] Second reviewer (verifies UIDs, checksums, and go/no-go independently):
      ******\_\_\_******
- [ ] Escalation contact: ******\_\_\_******
- [ ] Both operator and reviewer sign off go/no-go in section 8 before
      production apply.

## 3. Pre-flight checklist

Run in order, against the target project:

- [ ] `npm run deployment:preflight -- --env <dev|beta|prod>` passes cleanly
      (required Google Cloud APIs, generated-SDK drift, environment config,
      lint/test/build). See [`environments-dev-beta-prod.md`](environments-dev-beta-prod.md).
- [ ] Data Connect deployed to the target project:
      `npx firebase dataconnect:sdk:generate --project <target>` then
      `npx firebase deploy --only dataconnect --project <target>`.
- [ ] `npm run legacy-user-preflight-review` worksheet reviewed and signed off
      for the export being used (already done for the 918-record, 26 July
      export -- see #420's closure comment; re-run if a new export is taken).
- [ ] `npm run legacy-bcrypt-pilot -- --project <target> --api-key <key>`
      passes for the target project specifically. Proven for `sodc-web`
      (dev); Beta and Prod each need their own run before their own apply --
      see [`legacy-user-import.md`](legacy-user-import.md#3-non-production-apply).

## 4. Staging rehearsal

Rehearse the complete cycle against a non-production project (dev or beta),
using the real artifact -- dry-run performs no writes, so there is no reason
to synthesize test data:

- [ ] Dry-run (`npm run legacy-user-import -- --input ... --preflight ...
      --project <target>`, optionally `--interactive-remediation`) reports
      zero unresolved `quarantineReasons` and a `sourceChecksum` matching the
      approved artifact.
- [ ] Apply (`--apply --batch-id ... --state ... --confirm-project
      <target>`, with `--bcrypt-proven` once step 3's pilot has passed for
      this project) completes with reconciled counts and no unresolved
      critical failures.
- [ ] `npm run legacy-user-postflight` against the same state/artifact
      reports `outcome: "match"`.
- [ ] At least one sampled sign-in/reset/verify/profile-review walkthrough
      per credential and membership-status combination, using issue
      [#504](https://github.com/rafsodc/sodc-web/issues/504)'s checklist as
      the acceptance test for this step (not duplicated here).

## 5. Stop conditions

Halt and do not proceed to production apply if any of the following are true:

- Any `warningReasons` or `quarantineReasons` in the dry-run output that
  weren't already reviewed as part of the #420 approval.
- `sourceChecksum` from a fresh dry-run doesn't match the approved artifact.
- `legacy-user-postflight` reports anything other than `outcome: "match"`.
- `deployment:preflight`'s required-Google-Cloud-APIs check fails for the
  target project.
- The bcrypt pilot (step 3) fails for the target project.
- Either operator or reviewer (section 2) has an unresolved concern.

## 6. Recovery strategy

Per the fresh-instance precondition above, recovery from a failed or partial
import in a **non-live** target project is wipe-and-restart, not per-record
rollback:

1. Delete migration-created Firebase Auth users. Since the target has no
   pre-existing accounts to protect, it's acceptable to delete *all* Auth
   users on that project outright (`firebase auth:export` first if you want a
   record, then bulk-delete via the Admin SDK or Firebase console) rather
   than filtering by batch.
2. Clear the Data Connect `User` and `LegacyUserIdentity` tables. There is no
   bulk-delete mutation for this -- truncate the tables directly via the
   underlying Cloud SQL instance (Cloud SQL Studio or `psql`, per
   [`new-production-instance.md`](new-production-instance.md#6-provision-data-connect-and-cloud-sql)'s
   provisioning notes). This is a manual step, not a script, by design -- see
   the fresh-instance precondition above for why per-record rollback tooling
   wasn't built.
3. Delete the interrupted run's `--state` ledger file and start a new
   `--batch-id`.

**This is a destructive, irreversible action against whichever project it's
run on.** Confirm the target project is not live before running it. Once
production has real self-registered accounts, this section no longer applies
-- use the general rules in
[`legacy-user-import.md`](legacy-user-import.md)'s "Recovery rules" section
instead, which never delete or modify a pre-existing account.

## 7. Go/no-go

Before production apply, both the operator and reviewer (section 2)
independently confirm:

- [ ] Section 4's staging rehearsal is complete with no unresolved failures.
- [ ] The approval artifact (`sodc-legacy-user-migration-approval/v1`) has
      `approved: true`, and its `sourceChecksum` has been reconfirmed against
      a fresh dry-run targeting `sodc-web-production` itself (the checksum in
      the #420 approval was generated from a dev dry-run; per
      [`legacy-user-import.md`](legacy-user-import.md#3-non-production-apply),
      it must be reconfirmed for production specifically).
- [ ] The bcrypt pilot (step 3) has passed for `sodc-web-production`
      specifically.
- [ ] Both signatures recorded: operator ******\_\_\_******, reviewer
      ******\_\_\_******, date ******\_\_\_******.

## 8. Production cutover

Follow [`legacy-user-import.md`](legacy-user-import.md#5-production-approval-and-apply)
section 5 exactly -- nothing new to add here beyond the sequencing above.

### Monitoring during the cutover window

Watch, through the apply and the immediate post-cutover window:

- [ ] The import's own aggregate output (create/link/failure counts) as it
      runs.
- [ ] Functions error rate/logs (`npm --prefix functions run logs` or the
      Firebase console) for elevated errors coincident with the import.
- [ ] Cloud SQL load/error metrics for the Data Connect instance.
- [ ] The existing Functions/webhook error alerts, SQL alerts, and incident
      contacts already verified in
      [`new-production-instance.md`](new-production-instance.md)'s go-live
      checklist -- confirm they're live for this project before starting.
- [ ] Support inbox/contact for members reporting sign-in issues once
      communications (section 10) go out.

## 9. Post-cutover reconciliation

- [ ] `npm run legacy-user-postflight` (with `--production`, following
      [`legacy-user-import.md`](legacy-user-import.md#6-postflight-reconciliation)'s
      full command) reports `outcome: "match"` against the production apply.
- [ ] Issue [#504](https://github.com/rafsodc/sodc-web/issues/504)'s
      post-migration login journey checklist passes for a sample of real
      migrated accounts before migrated members are told to sign in.

## 10. Communications

Member-facing communications (who gets told to reset vs. just verify, and the
actual email content) are handled as a separate task, not by this runbook or
its tooling. What that separate work needs from this migration:

- The count and identification of accounts requiring a password reset
  (`credentialResetRequired` from the dry-run/apply output) vs. those with a
  compatible imported credential.
- Confirmation of which accounts were migrated as restricted/disabled
  (`DECEASED`, `LOST`) and should not receive a "sign in now" message.

## 11. Artifact retention and disposal

Retain the encrypted source artifact, preflight report, approval artifact,
and import ledger according to the agreed migration retention policy (see
[`legacy-user-import.md`](legacy-user-import.md#5-production-approval-and-apply)).
Once that period elapses:

- [ ] Delete the encrypted `.jsonl.gpg` artifact and its manifest.
- [ ] Delete the preflight report, review worksheet, and approval artifact.
- [ ] Delete the import ledger (`--state` file).
- [ ] Record disposal date and operator here: ******\_\_\_******.
