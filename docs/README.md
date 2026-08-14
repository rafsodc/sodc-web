# Documentation Index

## Member guidance

- [Section files](member-section-files.md)

## Moderator guidance

- [Managing section files](moderator-section-files.md)

This folder captures architecture, domain decisions, and contributor-facing guidance.

## Architecture

- `architecture/system-overview.md`: end-to-end request/data flow map.
- `architecture/repo-structure.md`: repository ownership boundaries and safe cleanup rules.
- `architecture/booking-data-model.md`: booking entities, relationships, and issue cross-links.
- `architecture/booking-submission-api.md`: callable contract for `submitEventBooking`.
- `architecture/security-and-permissions.md`: auth model across Data Connect and Cloud Functions.
- `architecture/error-handling.md`: shared safe error contract, provider/domain-code mapping, diagnostic reporting, and privacy rules.
- `operations/environment-and-secrets.md`: environment variables and secrets matrix.
- `operations/environments-dev-beta-prod.md`: Dev / Beta / Prod Firebase projects, schema-first deploy flow, smoke-test and rollback checkpoints, and local setup (cloud-backed dev; no emulators).
- `operations/new-production-instance.md`: first-time Firebase/GCP production provisioning, integrations, administrator bootstrap, deployment, and go-live checklist.
- `operations/transactional-email-workflows.md`: transactional email triggers by domain (payments, bookings, membership, guest tickets, ops alerts) with links to GOV.UK Notify template specs.
- `operations/govuk-notify-email-reply-to.md`: admin-managed Notify reply-to addresses, verification, deployment, and migration fallback.
- `operations/govuk-notify-template-copy.md`: Notify template index and automated-email tone guide; `functions/email-templates/`: source subject/body copy; `govuk-notify-template-registration.md`: per-environment UUID checklist.
- `operations/transactional-email-policy.md`: operational vs optional/marketing email policy (#191).
- `operations/section-announcement-audiences.md`: explicit and membership-status-derived audience, eligibility, deduplication, and opt-out rules for section announcements.
- `operations/firebase-hosting-security-headers.md`: production CSP and browser hardening policy, HSTS ownership, and post-deploy verification.
- `operations/section-file-storage.md`: private section-file bucket, lifecycle states, IAM, CORS, deployment order, and verification.
- `operations/executable-coverage-policy.md`: automated coverage boundaries, executable-entry-point inventory, deliberate exemptions, and manual verification steps for Functions scripts and the malware scanner.
- `operations/legacy-user-migration-schema.md`: approved legacy-user field mapping, secure Data Connect write boundary, staged profile completion, and deployment order.
- `operations/legacy-user-import.md`: guarded dry-run/apply/resume workflow and PII-minimised postflight reconciliation.
- `operations/legacy-user-migration-review.md`: turns a non-PII preflight report into a structured issue #420 review worksheet and approval-artifact stub.
- `operations/legacy-user-migration-runbook.md`: rehearsal and cutover runbook -- maintenance window strategy, staging rehearsal, stop conditions, recovery, go/no-go, and post-cutover reconciliation.

## User Guides

- `user-guide/member-getting-started.md`: registration, profile completion, approval, and six-month profile-review flow.
- `user-guide/booking-an-event.md`: finding events, booking tickets, guest tickets, and payments.
- `user-guide/admin-guide.md`: approving members, managing sections, events, bookings, and user groups.

## Domain Guides

- `user-groups-architecture.md`: user group and section access architecture.

## Contributor Guide

- `contributor-workflow.md`: branch/issue/PR workflow, testing expectations, and CI checks.

## Maintenance expectations

When behavior changes:

1. Update the relevant architecture/domain doc in the same PR.
2. Keep issue/epic links current in docs.
3. Ensure command snippets still match current scripts.
