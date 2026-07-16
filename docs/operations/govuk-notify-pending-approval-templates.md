# GOV.UK Notify: pending-approval admin alert

This template sends an **internal** email to all admins when a new user enters the **Approve Users** queue. Implementation: [`functions/src/pendingApprovalAdminAlert.ts`](../../functions/src/pendingApprovalAdminAlert.ts), wired from [`functions/src/users.ts`](../../functions/src/users.ts) (`syncPendingUserClaims`).

Recipients are **all current Firebase Auth admins** (`getAdminUsers()`, same pattern as guest-ticket moderator alerts) — no separate ops env var, unlike payment ops alerts.

**Source of truth:** Personalisation **keys** in this document must match the object sent to Notify.

**Draft copy:** [govuk-notify-template-copy.md](./govuk-notify-template-copy.md). **Registration:** [govuk-notify-template-registration.md](./govuk-notify-template-registration.md).

## Configuration

| Logical key (code) | Firebase / runtime env var for template UUID |
|---------------------|-----------------------------------------------|
| `newUserPendingApprovalAlert` | `GOV_NOTIFY_TEMPLATE_NEW_USER_PENDING_APPROVAL_ALERT` |

Env var name follows [`govNotifyTemplateEnvVarName`](../../functions/src/mailer.ts).

Also required for sends: `GOV_NOTIFY_API_KEY` (secret), optional `GOV_NOTIFY_EMAIL_REPLY_TO_ID`, and **`APP_BASE_URL`** for the Approve Users deep link (see [environment-and-secrets.md](./environment-and-secrets.md)).

## Trigger

`syncPendingUserClaims` runs both at registration and again after profile submission (so the `enabled` claim is never left unset). On each call it checks `isUserPendingApproval` (verified email + `enabled` claim not true + membership status awaiting approval, from [`pendingUserApproval.ts`](../../functions/src/pendingUserApproval.ts)) — the alert only fires once that's actually true, i.e. in practice after profile submission (email verification is already required to reach profile completion).

**No send:** user has no Data Connect profile yet (pre-profile-submission registration call); email not verified; membership status not awaiting approval (e.g. already enabled, or an admin-created account); no admin recipients.

## Notify `reference` field

`PENDING_APPROVAL:<userId>`.

## Delivery key

`pending-approval:<userId>:<adminEmail>` — deduped per admin, so adding a new admin later or `syncPendingUserClaims` firing again for the same still-pending user only emails admins who haven't already been notified about this user.

## Template: `newUserPendingApprovalAlert`

| Key | Semantics |
|-----|-----------|
| `firstName` | User's first name |
| `lastName` | User's last name |
| `email` | User's email |
| `serviceNumber` | User's service number |
| `serviceBackgroundSummary` | Comma-joined service background flags, e.g. `Regular, Reserve`, or `Not specified` |
| `requestedMembershipStatus` | Requested membership status, falling back to current status or `—` |
| `approveUsersUrl` | `APP_BASE_URL` (normalised) + `/admin/users/approvals` |

## Related docs

- [transactional-email-policy.md](./transactional-email-policy.md)
- [govuk-notify-membership-templates.md](./govuk-notify-membership-templates.md) — membership status change emails to the member
