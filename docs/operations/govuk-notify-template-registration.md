# GOV.UK Notify: template registration runbook

Use this checklist when creating templates in Notify for **Dev**, **Beta**, and **Prod**. Do **not** commit API keys or template UUIDs to the repository.

**Draft copy to paste:** [govuk-notify-template-copy.md](./govuk-notify-template-copy.md)  
**Test payloads:** [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json)  
**Env matrix:** [environment-and-secrets.md](./environment-and-secrets.md)

## Per-environment steps

1. Sign in to [GOV.UK Notify](https://www.notifications.service.gov.uk/) for the service linked to that Firebase project.
2. For each template below:
   - Create an **email** template ([guidance](https://www.notifications.service.gov.uk/using-notify/how-to-create-email-template)).
   - Paste **subject** and **body** from [govuk-notify-template-copy.md](./govuk-notify-template-copy.md).
   - Add every `((placeholder))` listed for that template (Notify validates on send).
   - Send a **test email** using values from [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json) for that logical key.
   - Copy the template **UUID** into your secure ops record (table below).
3. Configure Firebase Functions for that project:
   - Secret: `GOV_NOTIFY_API_KEY`
   - Env vars: `GOV_NOTIFY_TEMPLATE_*` (one per row below)
   - Optional: `GOV_NOTIFY_EMAIL_REPLY_TO_ID`, `APP_BASE_URL`
   - Internal ops only: `PAYMENT_OPS_ALERT_EMAILS` (comma-separated)
4. Redeploy Functions after env changes.
5. Run one **end-to-end** trigger per domain in that environment (see [transactional-email-workflows.md](./transactional-email-workflows.md#manual-qa-beta)).

## Template registry (record UUIDs outside repo)

| Logical key | Env var | Dev UUID | Beta UUID | Prod UUID | Registered |
|-------------|---------|----------|-----------|-----------|------------|
| `ticketOrderPaid` | `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_PAID` | | | | [ ] |
| `ticketOrderFailed` | `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_FAILED` | | | | [ ] |
| `ticketOrderRefunded` | `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_REFUNDED` | | | | [ ] |
| `paymentReconciliationExceptionAlert` | `GOV_NOTIFY_TEMPLATE_PAYMENT_RECONCILIATION_EXCEPTION_ALERT` | | | | [ ] |
| `paymentDisputeOpsAlert` | `GOV_NOTIFY_TEMPLATE_PAYMENT_DISPUTE_OPS_ALERT` | | | | [ ] |
| `membershipActivated` | `GOV_NOTIFY_TEMPLATE_MEMBERSHIP_ACTIVATED` | | | | [ ] |
| `membershipAccessRestricted` | `GOV_NOTIFY_TEMPLATE_MEMBERSHIP_ACCESS_RESTRICTED` | | | | [ ] |
| `guestTicketRequestSubmittedModerator` | `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_SUBMITTED_MODERATOR` | | | | [ ] |
| `guestTicketRequestApproved` | `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_APPROVED` | | | | [ ] |
| `guestTicketRequestRejected` | `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_REJECTED` | | | | [ ] |
| `bookingConfirmation` | `GOV_NOTIFY_TEMPLATE_BOOKING_CONFIRMATION` | | | | [ ] |
| `bookingRevision` | `GOV_NOTIFY_TEMPLATE_BOOKING_REVISION` | | | | [ ] |

## Suggested order

1. Dev — all 12 templates, then E2E smoke tests  
2. Beta — clone copy, new UUIDs, repeat smoke tests  
3. Prod — final copy review, register UUIDs, enable sends  

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Notify API `template` error | Wrong UUID in `GOV_NOTIFY_TEMPLATE_*` for this environment |
| Missing placeholder error | Dashboard placeholder name does not match code (see `govuk-notify-*.md`) |
| No email sent | `GOV_NOTIFY_API_KEY` missing, template ID env unset, or ops recipient list empty (`PAYMENT_OPS_ALERT_EMAILS`) |
| Duplicate emails | Expected on webhook retry only if delivery ledger failed; check `NotificationDelivery` |

## Related issues

- Epic: #183  
- Implementation: #186–#190, #216  
- This work: #218
