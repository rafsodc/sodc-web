# GOV.UK Notify: template registration runbook

Use this checklist when creating templates in Notify for **Dev**, **Beta**, and **Prod**.

**Source templates to paste:** [`functions/email-templates/`](../../functions/email-templates/)

**Template index and tone guide:** [govuk-notify-template-copy.md](./govuk-notify-template-copy.md)

**Test payloads:** [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json)

**Env matrix:** [environment-and-secrets.md](./environment-and-secrets.md)

Manage each transactional key's live Notify template UUID from the
**Email Templates** admin page ([#487](https://github.com/rafsodc/sodc-web/issues/487)).
The old `functions/email-templates/template-registry.json` is retired as runtime
configuration. It remains only for the legacy informational drift checker; that
checker's successful or skipped result does not verify live bindings or readiness.

The runtime uses the saved Data Connect binding first. If no binding is returned,
including after a binding lookup failure, it tries that key's
`GOV_NOTIFY_TEMPLATE_*` environment fallback on the Function executing the send.
That fallback works only when it is actually configured there; configuring it on
an unrelated Function does not help. A saved ID takes precedence, so a malformed
or deleted bound template does not cause a second attempt with the fallback.

If neither source supplies a template ID, the mailer raises
`MailerConfigurationError` before contacting Notify. A booking can already have
been saved while its separate notification is recorded as `FAILED`; a successful
booking response is not evidence that email was delivered. Bind every active key
and review fallback requirements rather than relying on an unconditional fallback
guarantee.

## Per-environment steps

1. Sign in to [GOV.UK Notify](https://www.notifications.service.gov.uk/) for the service linked to that Firebase project.
2. For each template below:
   - Review the service's existing **email** templates first and reuse the template whose name exactly matches the logical key. If none exists, create one ([guidance](https://www.notifications.service.gov.uk/using-notify/how-to-create-email-template)) and **name it exactly the logical key** (for example `bookingConfirmation`, case-sensitive, no extra text). The admin page only offers exact name matches. Do not create a duplicate just to clear a binding warning.
   - Compare the existing **subject** and **body** with the matching file in [`functions/email-templates/`](../../functions/email-templates/). Reconcile any mismatch through the reviewed copy-change process; for a new template, paste those fields from the file.
   - Add every `((placeholder))` listed for that template (Notify validates on send).
   - When a test recipient and message are approved, send a **test email** using values from [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json) for that logical key. Do not trigger real member workflows merely to test configuration.
3. In the site's admin area, open **Email Templates** and click **Refresh**. For each key, review the exact template ID, name, subject, body, placeholders and live version; then select that template and **Save** its row. The server re-fetches and checks the selected name, content and version before writing, and audits who changed it and when. Stop and refresh if the provider changed during review. If the save response fails, read back the binding and audit state before retrying: the write can have committed before the status response failed.
4. Configure Firebase Functions for that project:
   - Secret: `GOV_NOTIFY_LIVE_API_KEY`
   - `GOV_NOTIFY_SERVICE_ID`: the Notify service ID, used only to build the admin page's "Edit in GOV Notify" deep link
   - Optional migration fallback: `GOV_NOTIFY_EMAIL_REPLY_TO_ID` (see the [reply-to runbook](./govuk-notify-email-reply-to.md)); also configure `APP_BASE_URL`
   - Internal ops only: `PAYMENT_OPS_ALERT_EMAILS` (comma-separated)
5. Redeploy Functions through the [guarded deployment workflow](./functions-runtime-config-guard.md) after environment changes. Binding-only changes take effect immediately and need no deployment. Before saving a binding, inspect recovery-eligible notification counts: correcting configuration can enable queued notifications to send. Review their relevance and recipients before allowing a stale backlog to recover.
6. Refresh status and read back the exact bindings, reviewed versions and audit actions. These are configuration checks, not proof of provider delivery. Run an approved **end-to-end** trigger per domain in that environment when appropriate (see [transactional-email-workflows.md](./transactional-email-workflows.md#manual-qa-beta)).

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
| `bookingConfirmation` |
| `bookingRevision` |
| `bookingPendingApproval` |
| `bookingPendingApprovalModerator` |
| `bookingApproved` |
| `bookingChangesRequested` |
| `newUserPendingApprovalAlert` |
| `passwordReset` |
| `emailVerification` |
| `emailChangeVerification` |

## Suggested order

1. Dev — every active template key listed above, bind each from the admin page, then approved E2E smoke tests
2. Beta — clone copy, new templates, repeat binding and smoke tests
3. Prod — final copy review, bind, enable sends

## Reviewing a version

GOV.UK Notify always sends whatever is the current live version of a bound
template — there is no way to pin an older version for sending. The version
recorded on the admin page is a **last-reviewed marker**: if a template is
edited in Notify after being bound, the page shows its live version has moved
past the reviewed one. This reminder is independent of subject/body drift and
does not itself block sending. A **Content matches** row can therefore still need a
version review.

Re-review the content and save the same template ID at the reviewed current
version for that row. Do not use **Move all to latest version** to clear warnings
without reviewing each affected template. The bulk action only updates existing
bindings; it cannot create a missing one. Do not add a version-drift send gate as
a substitute for reviewing configuration: that would change the critical-email
delivery policy.

## Retiring stale failed notifications

Configuration repair is separate from deciding whether old notifications are
still relevant. Do not reset or replay old failures automatically. A
`NotificationDelivery` row marked `SKIPPED` is terminal for that exact delivery
key and is excluded from scheduled recovery. Legacy moderator rows also preserve
protection against recreating the old staff alert under a newer key.

When an operator decides that an old notification must not be sent, use an
explicitly reviewed, snapshot-bound cancellation that records `SKIPPED`, a skip
reason and audit metadata. Preserve delivery keys, booking links and historical
mode evidence; do not claim or retry the notification just to cancel it. Deleting
the ledger record can remove duplicate protection. New notifications caused by
genuinely new domain activity still follow their normal delivery rules.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Template doesn't appear in the admin page's dropdown | Its Notify name doesn't exactly match the logical key (case-sensitive) |
| "No saved binding" status | No Data Connect binding exists for this key. This page does not assess the sender's environment fallback; review the exact template and save its binding, then run the operational readiness check |
| Missing placeholder error | Dashboard placeholder name does not match code (see `govuk-notify-*.md`) |
| No email sent | Check the delivery ledger and effective delivery mode. A missing binding plus an absent sender fallback fails before Notify; provider errors, recipient rules, simulation mode or an empty ops recipient list (`PAYMENT_OPS_ALERT_EMAILS`) are different causes |
| Duplicate emails | Expected on webhook retry only if delivery ledger failed; check `NotificationDelivery` |

## Related issues

- Epic: #183, #480, #293
- Implementation: #186–#190, #216, #487
- This work: #218
- Configuration readiness and stale-notification cancellation: #741
