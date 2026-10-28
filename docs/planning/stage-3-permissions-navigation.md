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

The shared builders/closed task validators live in `src/shared/navigation/sectionRoutes.ts`.
Names, section type and moderation permission are loaded by ID through the current
server access decision. Navigation state is only accepted to redirect old links;
it does not grant access or supply resource metadata.

| Task | Canonical destination |
| --- | --- |
| Section/member overview | `/sections/:sectionId` (`?view=past` for past events) |
| Member event/booking view | `/sections/:sectionId/events/:eventId` (`?tab=book` or `?tab=attendees`; About is the default) |
| Section management overview | `/sections/:sectionId/manage` |
| Section files / announcements | `/sections/:sectionId/manage/files`, `/sections/:sectionId/manage/announcements` |
| Section events list | `/sections/:sectionId/manage/events` |
| Event management | `/sections/:sectionId/manage/events/:eventId` |
| Selected existing event task | `?task=details`, `tickets`, `approvals`, `attendees`, `guests`, `activity`, `payments`, or `announcement` (details is the default) |
| Booking approval filter | `?task=approvals&approval=PENDING`, `ALL`, `APPROVED`, or `REJECTED` |
| New event / edit event form | Section events list with `?edit=new-event`; event workspace with `?edit=event` |
| New/edit ticket-type form | Event workspace with `?task=tickets&ticket=new` or `&ticket=:ticketTypeId` |
| Announcement audience filters | Event announcement task with known `audience.*` filter query parameters |
| Global section configuration | Admin-only `/admin/sections?section=:sectionId`; new section `/admin/sections?create=section` |

Legacy `/admin/section/:sectionId` redirects to the management hub. Legacy
`/admin/sections` navigation state specifying a section/event redirects to the
section event workspace; member section state specifying an event redirects to
its member URL. Existing `/sections/:sectionId/files/:fileId` and bearer-capability
`/guest-ticket#token` links remain unchanged. Welcome cards, My Bookings, section
menus, event cards, admin links and booking emails use the same resource builders
and corresponding server-side email destinations. Section configuration stays
in the global Admin menu; it is not an extra section-moderator action.

Event ownership is checked against the authoritative section list before enabling
private management queries, and against returned event metadata before rendering.
A resource change resets the component's selection; late responses cannot assign
an old resource's permission or private UI to its replacement. Auth initialization,
validated sign-in return URLs, query/hash and history remain covered.

Unsaved event/ticket/editor and booking/announcement drafts are retained in bounded
in-memory storage for the active private session and resource. Save/Cancel discard
the relevant draft; retirement/account replacement clears the store and rejects
late setters. Nothing is stored in local/session storage. A dirty mounted form
warns before leaving/reloading the document. This establishes addressable existing
tasks; the full #301 Manage Event visual redesign remains separate.

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
