# Section announcement audiences

Section announcement recipients are resolved by
[`functions/src/announcements.ts`](../../functions/src/announcements.ts) before one GOV.UK Notify
task is queued per deliverable user.

## Audience sources

Only groups linked to the selected section with an `ACCESS` or `MODERATOR` purpose contribute
recipients. The audience is the union of:

1. users explicitly related to those groups through `UserUserGroup`; and
2. users whose `membershipStatus` appears in those groups' `membershipStatuses` configuration.

The two sources are merged by user ID, so an explicit user who also matches an inherited status
receives one announcement. `MEMBER`, `BOOKER`, and other purpose links do not independently add
announcement recipients.

## Eligibility and opt-outs

Only non-restricted membership statuses (`REGULAR`, `RETIRED`, `RESERVE`, `INDUSTRY`, and
`CIVIL_SERVICE`) are eligible. Restricted users (`PENDING`, `RESIGNED`, `LOST`, and `DECEASED`)
are excluded even if a stale explicit group relation remains or a group is misconfigured to list a
restricted status.

After explicit and status-derived users are merged, the section's `SectionAnnouncementOptOut`
records are applied once to the combined audience. This ensures both recipient sources have the
same opt-out behaviour. An empty audience is valid and records a send with zero queued recipients.

## Operational checks

Before sending a production announcement:

- confirm the section's `ACCESS` and `MODERATOR` purpose links target the intended groups;
- review each group's explicit users and inherited `membershipStatuses`; and
- remember that adding a status to either eligible purpose group includes every non-restricted user
  with that status unless they have opted out of that section's announcements.
