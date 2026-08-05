# GOV.UK Notify: template registration runbook

Use this checklist when creating templates in Notify for **Dev**, **Beta**, and **Prod**.

**Source templates to paste:** [`functions/email-templates/`](../../functions/email-templates/)

**Template index and tone guide:** [govuk-notify-template-copy.md](./govuk-notify-template-copy.md)

**Test payloads:** [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json)

**Env matrix:** [environment-and-secrets.md](./environment-and-secrets.md)

Which live Notify template UUID each transactional key uses is managed from
the **Email Templates** admin page ([#487](https://github.com/rafsodc/sodc-web/issues/487)),
not environment configuration. `GOV_NOTIFY_TEMPLATE_*` env vars are no longer
where you configure a template, and `functions/email-templates/template-registry.json`
is retired; the env var mechanism remains only as an automatic fallback used
if the Data Connect binding is ever unreachable, so a missing or unreachable
binding never blocks a critical email — but every template still needs to
exist in Notify and be bound from the admin page to actually be used.

## Per-environment steps

1. Sign in to [GOV.UK Notify](https://www.notifications.service.gov.uk/) for the service linked to that Firebase project.
2. For each template below:
   - Create an **email** template ([guidance](https://www.notifications.service.gov.uk/using-notify/how-to-create-email-template)), and **name it exactly the logical key** (for example `bookingConfirmation`, case-sensitive, no extra text) — the admin page only offers exact name matches, so a template named anything else will not appear as a bindable option.
   - Paste **subject** and **body** from the matching file in [`functions/email-templates/`](../../functions/email-templates/).
   - Add every `((placeholder))` listed for that template (Notify validates on send).
   - Send a **test email** using values from [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json) for that logical key.
3. In the site's admin area, open **Email Templates**, click **Refresh**, and for each key select the matching template from its dropdown, confirm the version, and **Save**. This records who bound it and when.
4. Configure Firebase Functions for that project:
   - Secret: `GOV_NOTIFY_LIVE_API_KEY`
   - `GOV_NOTIFY_SERVICE_ID`: the Notify service ID, used only to build the admin page's "Edit in GOV Notify" deep link
   - Optional migration fallback: `GOV_NOTIFY_EMAIL_REPLY_TO_ID` (see the [reply-to runbook](./govuk-notify-email-reply-to.md)); also configure `APP_BASE_URL`
   - Internal ops only: `PAYMENT_OPS_ALERT_EMAILS` (comma-separated)
5. Redeploy Functions after env changes.
6. Run one **end-to-end** trigger per domain in that environment (see [transactional-email-workflows.md](./transactional-email-workflows.md#manual-qa-beta)).

## Template list

| Logical key |
|-------------|
| `ticketOrderPaid` |
| `ticketOrderFailed` |
| `ticketOrderRefunded` |
| `paymentReconciliationExceptionAlert` |
| `paymentDisputeOpsAlert` |
| `membershipActivated` |
| `membershipAccessRestricted` |
| `guestTicketRequestSubmittedModerator` |
| `guestTicketRequestApproved` |
| `guestTicketRequestRejected` |
| `bookingConfirmation` |
| `bookingRevision` |
| `newUserPendingApprovalAlert` |
| `passwordReset` |
| `emailVerification` |
| `emailChangeVerification` |

## Suggested order

1. Dev — all 16 templates, bind each from the admin page, then E2E smoke tests
2. Beta — clone copy, new templates, repeat binding and smoke tests
3. Prod — final copy review, bind, enable sends

## Reviewing a version

GOV.UK Notify always sends whatever is the current live version of a bound
template — there is no way to pin an older version for sending. The version
recorded on the admin page is a **last-reviewed marker**: if a template is
edited in Notify after being bound, the page shows its live version has moved
past the reviewed one. Re-review the content and either re-save that row or
use **Move all to latest version** to bulk-acknowledge every drifted binding
at once.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Template doesn't appear in the admin page's dropdown | Its Notify name doesn't exactly match the logical key (case-sensitive) |
| "Not bound" status | No binding saved for this key yet — select and save one |
| Missing placeholder error | Dashboard placeholder name does not match code (see `govuk-notify-*.md`) |
| No email sent | Binding is missing for the effective delivery mode's key, or the ops recipient list is empty (`PAYMENT_OPS_ALERT_EMAILS`) |
| Duplicate emails | Expected on webhook retry only if delivery ledger failed; check `NotificationDelivery` |

## Related issues

- Epic: #183, #480, #293
- Implementation: #186–#190, #216, #487
- This work: #218
