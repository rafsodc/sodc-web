# Documentation Index

This folder captures architecture, domain decisions, and contributor-facing guidance.

## Architecture

- `architecture/system-overview.md`: end-to-end request/data flow map.
- `architecture/repo-structure.md`: repository ownership boundaries and safe cleanup rules.
- `architecture/booking-data-model.md`: booking entities, relationships, and issue cross-links.
- `architecture/booking-submission-api.md`: callable contract for `submitEventBooking`.
- `architecture/security-and-permissions.md`: auth model across Data Connect and Cloud Functions.
- `operations/environment-and-secrets.md`: environment variables and secrets matrix.
- `operations/environments-dev-beta-prod.md`: Dev / Beta / Prod Firebase projects, deploy flow, and local setup (cloud-backed dev; no emulators).
- `operations/transactional-email-workflows.md`: transactional email triggers by domain (payments, bookings, membership, guest tickets, ops alerts) with links to GOV.UK Notify template specs.
- `operations/govuk-notify-template-copy.md`: draft subject/body for all Notify templates; `govuk-notify-template-registration.md`: per-environment UUID checklist.
- `operations/transactional-email-policy.md`: operational vs optional/marketing email policy (#191).
- `operations/section-announcement-audiences.md`: explicit and membership-status-derived audience, eligibility, deduplication, and opt-out rules for section announcements.
- `operations/firebase-hosting-security-headers.md`: production CSP and browser hardening policy, HSTS ownership, and post-deploy verification.

## User Guides

- `user-guide/member-getting-started.md`: registration, profile completion, and approval flow.
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
