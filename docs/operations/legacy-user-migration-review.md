# Legacy user migration -- preflight review worksheet

This tool supports the human review required by issue #420 before a legacy
user import is approved. Read `legacy-user-migration-schema.md` first for the
approved field mapping and `legacy-user-import.md` for the importer runbook
this review gates.

`sodc-api`'s exporter produces a non-PII aggregate `sodc-legacy-user-preflight/v2`
report (record counts, rank/status distributions, missing-field counts -- no
names, emails, or other member-identifying data). Reviewing that raw JSON by
hand against #420's acceptance criteria is manual spreadsheet work. This CLI
turns the report into a structured Markdown worksheet with the relevant counts
already placed under each review question, plus an approval-artifact stub
ready for the importer's `--approval` flag.

The tool only reads the non-PII preflight report. It never touches the
encrypted member artifact and performs no writes to Firebase or Data Connect.

## Usage

From `functions`:

```bash
npm run legacy-user-preflight-review -- \
  --input /secure/path/legacy-user-preflight.json \
  --project sodc-web-production \
  --output /secure/path/legacy-user-preflight-worksheet.md \
  --approval-output /secure/path/legacy-user-migration-approval-stub.json
```

`--input` and `--project` are required. `--output` and `--approval-output` are
optional; omitting either prints that artifact to stdout instead of writing a
file. Both outputs are non-PII and safe to keep alongside the preflight report,
but keep them outside the repository like every other migration artifact.

`--project` is the target Firebase project ID (e.g. `sodc-web-production`) and
is copied verbatim into the approval stub's `projectId` field -- it is not
validated against `.firebaserc` by this tool, since no Firebase project is
contacted.

## What the worksheet covers

The worksheet walks through six sections matching #420's acceptance criteria,
each with the relevant counts already filled in from the report and a
checklist the reviewer ticks off:

1. **Rank mapping** -- the exporter fails closed on any rank without an
   approved target, so every rank in a real report is already approved; this
   section is for plausibility review, and flags (rather than silently
   ignoring) any rank value the tool doesn't recognise as evidence the
   reviewer and exporter have drifted onto different schema versions.
2. **Membership status** -- same fail-closed guarantee for status, with the
   same drift-detection flag.
3. **Required fields and identity conflicts** -- missing-field counts per
   field. The worksheet explicitly notes that duplicate-email/identity
   conflicts are *not* derivable from the preflight alone and must be reviewed
   separately from the importer's dry-run output.
4. **Sharing and communications defaults** -- how `isShared` and
   `hasSubscriptions` map onto `shareContactInfo` and `announcementOptOutAll`.
5. **Admin restoration allowlist** -- a reminder that admin claims cannot come
   from this pipeline (the exported schema has no `roles` field) and must be
   reviewed as a separate allowlist.
6. **Password credentials** -- blank/null hash counts and the staging-proof
   requirement before `--bcrypt-proven` is used.

An unrecognised rank or membership status value stops the review with an
explicit warning rather than rendering a worksheet that looks complete. If
that happens, confirm the CLI's `APPROVED_LEGACY_RANK_TARGETS` /
`APPROVED_LEGACY_MEMBERSHIP_STATUSES` (in
`functions/src/legacyUserPreflightReview.ts`) are still in sync with
`sodc-api`'s `LegacyUserExportSchema` before continuing.

## Approval artifact stub

The tool also emits a `sodc-legacy-user-migration-approval/v2` stub with
`approved: false`, `sourceChecksum` left as an explicit placeholder, and a
`preflightChecksum` binding the approval to the exact preflight file reviewed.
The separate `sourceChecksum` is only known once the importer's dry-run
decrypts and hashes the real encrypted artifact (see `legacy-user-import.md`).
Fill in that source checksum from the dry-run, complete every checklist item in
the worksheet, and only then flip `approved` to `true` before using it with
`legacy-user-import.ts --approval`.
