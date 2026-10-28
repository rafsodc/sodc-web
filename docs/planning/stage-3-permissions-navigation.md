# Stage 3: permissions and navigation

Parent: #645. Integration branch: `codex/permissions-navigation`.
Baseline: Production/Dev-accepted main `b8cceb884bded9d85b67f25a419d5de3e472e27c`.

The user authorised implementation of #646, #603 and the remaining #647 scope.
Changes are prepared in separate child PRs against this integration branch.
Deployment and the full Manage Event visual redesign (#301) are separate release work.

## Effective permission matrix — #646

Every allow below requires a current enabled, eligible identity, matching security
version and ready server-owned authority. Auth claims and hidden controls alone
cannot grant permission. A section moderator is matched by explicit membership
or the group's current membership-status relationship, scoped to that section.

| Capability | Ordinary eligible member | Moderator of this section | Enabled global administrator |
| --- | --- | --- | --- |
| Read section metadata and directory | Current ACCESS/MODERATOR relationship | Yes | Yes, without a section relationship |
| Appear in a directory / expose contacts | Existing MEMBER roster and contact/privacy rules | Same roster/privacy rules | Same roster/privacy rules |
| Manage section files and announcements | No | Yes | Yes |
| Manage that section's events, ticket types, attendees, organiser guests and booking approvals | No | Yes | Yes |
| Inspect that section's booking/payment administration | No | Yes | Yes |
| Create/configure/delete sections; assign groups; manage users/global groups; global payment reconciliation | No | No | Yes, through global Admin navigation |
| Make/pay for own booking | Normal ACCESS, BOOKER, ticket and policy rules | Same rules with existing booking-window exception | Same normal eligibility plus the #603 booking-window exception |

Global administration remains distinct from section work. Common section menus
and actions match for both forms of moderator and an administrator. Cross-section
moderators, ordinary members, restricted/disabled identities, stale/revoked sessions
and anonymous requests must be rejected by server checks on management paths.
Directory access must not add administrators/moderators to the MEMBER roster or
relax contact redaction, profile eligibility or Auth verification filtering.

## Booking-window scope — #603

Allow otherwise eligible administrators to create/amend their own bookings and
complete eligible checkout before opening, consistently in preview and server
checks. Keep section ACCESS, BOOKER, ticket, guest, approval, payment and invalid
window rules intact. Preserve existing moderator before-open/after-close behaviour
and existing checkout-after-close policy. Use verified current administrator
authority after awaited guards, never a request-supplied role or JWT claim alone.

## Canonical route map — #647

Use ordinary links for navigation, with resource IDs in the URL and authoritative
metadata/permissions loaded by ID. URL spelling may be refined during implementation;
keep a single shared route builder/validator and record the final mapping here.

| Task | Proposed canonical destination |
| --- | --- |
| Section/member overview | `/sections/:sectionId` |
| Member event/booking view | `/sections/:sectionId/events/:eventId` |
| Section management overview | `/sections/:sectionId/manage` |
| Section files / announcements | `/sections/:sectionId/manage/files`, `/sections/:sectionId/manage/announcements` |
| Section events list | `/sections/:sectionId/manage/events` |
| Event management and selected task | `/sections/:sectionId/manage/events/:eventId`, with a validated task/subview encoded in the URL |
| Global section configuration | Existing admin-only `/admin/sections`, with relevant configuration selection encoded in the URL |

Legacy section-admin links, file links, guest links, event cards, My Bookings,
welcome-page links and old navigation-state entry points remain compatible or
redirect to the canonical destination. Fresh tabs, reload, sign-in return and
back/forward preserve resource/task selection without trusting `location.state`.
Missing, inaccessible or mismatched resources have useful local states. Clear
obsolete event/task state when navigating to a different resource; preserve or
warn before discarding unsaved forms/drafts. The earlier #667 Auth-initialisation
fix remains covered; broad canonical routing is still needed.

## Validation and release

- Behaviour tests for both moderator membership sources, administrator-without-
  relationship, cross-section/ordinary/stale/revoked/disabled/anonymous refusals,
  authoritative directory roster/privacy and global-admin boundaries.
- Actual isolated Data Connect/database scenarios for changed authorization,
  generated SDK drift checks and the strict authorization inventory.
- Booking preview, submit/amend and checkout regressions, preserving other gates.
- Router/component integration tests for cold/direct URLs, task selection,
  metadata hydration, sign-in return, history, missing/denied/mismatched IDs,
  legacy links, normal link semantics and stale session/resource responses.
- Full frontend/Functions tests, coverage, lint/build/type checks and relevant
  deployment-safety checks after integration. Live/browser release acceptance
  remains a later Dev checkpoint. No live writes, emails, payments or deployments
  form part of this implementation task.
