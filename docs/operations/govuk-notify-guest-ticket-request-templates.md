# GOV.UK Notify: guest ticket request workflow templates

Emails for **additional guest ticket** moderation: notify moderators/admins when a request is submitted, and notify the **booker** when it is approved or rejected. Implementation: [`functions/src/guestTicketRequestEmails.ts`](../../functions/src/guestTicketRequestEmails.ts), callables in [`functions/src/guestTicketRequests.ts`](../../functions/src/guestTicketRequests.ts).

**Source of truth:** Personalisation **keys** must match Notify template placeholders.

**Draft copy:** [govuk-notify-template-copy.md](./govuk-notify-template-copy.md) (guest ticket section).

## Configuration

| Logical key (code) | Firebase / runtime env var for template UUID |
|---------------------|-----------------------------------------------|
| `guestTicketRequestSubmittedModerator` | `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_SUBMITTED_MODERATOR` |
| `guestTicketRequestApproved` | `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_APPROVED` |
| `guestTicketRequestRejected` | `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_REJECTED` |

Also required: `GOV_NOTIFY_API_KEY` (secret), optional `GOV_NOTIFY_EMAIL_REPLY_TO_ID`, and **`APP_BASE_URL`**.

## How moderator recipients are resolved

When a booker submits a request, Functions loads the booking’s **event → section** and builds a **deduped** email list (lowercase):

1. **Global admins** — Firebase Auth users with custom claim `admin: true` (uses Auth email).
2. **Section moderators** — user groups linked to that section with **`MODERATOR`** in `SectionUserGroupPurposeLink.purposes`:
   - Explicit members via `UserUserGroup`
   - Users whose `membershipStatus` is listed on the group’s `membershipStatuses` (admin `listUsers`, same merge idea as `getSectionMembersMerged`)

The **submitting booker** is excluded from moderator fan-out.

Implementation: [`functions/src/guestTicketRequestModerators.ts`](../../functions/src/guestTicketRequestModerators.ts).

## Triggers

| Template | When |
|----------|------|
| `guestTicketRequestSubmittedModerator` | After successful `submitGuestTicketRequest` callable (one email per recipient) |
| `guestTicketRequestApproved` | After `reviewGuestTicketRequest` with `APPROVED` |
| `guestTicketRequestRejected` | After `reviewGuestTicketRequest` with `REJECTED` |

Client UI uses these callables instead of direct Data Connect mutations for submit/review so email stays server-side.

## Template 1: moderator alert — `guestTicketRequestSubmittedModerator`

| Key | Semantics |
|-----|-----------|
| `eventTitle` | Event title |
| `sectionName` | Section name |
| `bookerDisplay` | e.g. `Name <email>` |
| `guestDisplayName` | Requested guest name |
| `requestedGuestCount` | Number (JSON number) |
| `guestTicketTypeTitle` | Ticket type title |
| `dietaryNote` | Dietary note or `—` |
| `moderationUrl` | `APP_BASE_URL` + `/admin/sections` (open Manage Sections, select event) |

## Templates 2 & 3: booker — `guestTicketRequestApproved` / `guestTicketRequestRejected`

| Key | Semantics |
|-----|-----------|
| `customerFirstName` | Booker first name or `there` |
| `eventTitle` | Event title |
| `guestDisplayName` | Guest name on request |
| `requestedGuestCount` | Number |
| `decisionLabel` | `Approved` or `Rejected` |
| `moderatorNote` | Note from reviewer, or `—` |
| `myBookingsUrl` | `APP_BASE_URL` + `/sections/{sectionId}` |

## Related docs

- [environment-and-secrets.md](./environment-and-secrets.md)
- [govuk-notify-membership-templates.md](./govuk-notify-membership-templates.md)
