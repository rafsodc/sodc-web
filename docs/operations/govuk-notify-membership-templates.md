# GOV.UK Notify: membership status templates

User-facing email when **membership status** changes in ways that affect app access. Implementation: [`functions/src/membershipStatusEmailDispatcher.ts`](../../functions/src/membershipStatusEmailDispatcher.ts), triggered from [`functions/src/membershipStatus.ts`](../../functions/src/membershipStatus.ts) after a successful `updateMembershipStatus` callable.

**Source of truth:** Personalisation **keys** must match the Notify template placeholders.

## Configuration

| Logical key (code) | Firebase / runtime env var for template UUID |
|---------------------|-----------------------------------------------|
| `membershipActivated` | `GOV_NOTIFY_TEMPLATE_MEMBERSHIP_ACTIVATED` |
| `membershipAccessRestricted` | `GOV_NOTIFY_TEMPLATE_MEMBERSHIP_ACCESS_RESTRICTED` |

Also required: `GOV_NOTIFY_API_KEY` (secret), optional `GOV_NOTIFY_EMAIL_REPLY_TO_ID`, and **`APP_BASE_URL`** for links (see [environment-and-secrets.md](./environment-and-secrets.md)).

## Triggers

| Template | When |
|----------|------|
| `membershipActivated` | Previous status was **restricted** (`PENDING`, `RESIGNED`, `LOST`, `DECEASED`) or unknown (`null`), and new status is **non-restricted** (`REGULAR`, `RESERVE`, etc.) — typical admin approval from **Approve Users**. |
| `membershipAccessRestricted` | Previous status was **non-restricted** and new status is **restricted** (access removed / account disabled via `enabled` claim). |

No email for restricted→restricted or non-restricted→non-restricted transitions.

## Notify `reference` field

`MEMBERSHIP_ACTIVATION:{userId}:{from}:{to}` or `MEMBERSHIP_RESTRICTED:…` (see `membershipStatusNotifyReference` in code).

## Template 1: account activated — `membershipActivated`

| Key | Semantics |
|-----|-----------|
| `customerFirstName` | User first name, or `there` |
| `membershipStatusLabel` | Friendly label for new status, e.g. `Regular` |
| `appUrl` | `APP_BASE_URL` (no trailing slash) |
| `profileUrl` | `appUrl` + `/profile` |

## Template 2: access restricted — `membershipAccessRestricted`

| Key | Semantics |
|-----|-----------|
| `customerFirstName` | User first name, or `there` |
| `membershipStatusLabel` | Friendly label for new restricted status |
| `previousStatusLabel` | Friendly label for previous status |
| `appUrl` | `APP_BASE_URL` |

Use static template copy for “contact your administrator” — do not include admin-only notes in personalisation.

## Related docs

- [govuk-notify-ticket-order-templates.md](./govuk-notify-ticket-order-templates.md)
- [environment-and-secrets.md](./environment-and-secrets.md)
