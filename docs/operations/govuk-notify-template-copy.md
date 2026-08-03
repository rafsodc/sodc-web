# GOV.UK Notify template copy index

The reviewed GOV.UK Notify subjects, bodies and placeholder lists live in
[`functions/email-templates/`](../../functions/email-templates/). Those Markdown
files are the single source of truth used to generate the Function manifest and
the **Admin → Email Templates** drift report. Do not maintain a second copy of
their contents in this document.

## Automated email tone

- Use clear, concise British English with a warm club tone.
- Use `Hello ((firstName)),` when a member name is safely available, otherwise
  use plain `Hello,`.
- Use member-facing terms such as member, booking, place, guest and payment.
- Do not use customer, purchase or order in member-facing copy.
- Automated emails must not ask recipients to reply.
- End every automated email with these lines:

```text
Kind regards,

SODC Admin
```

## Member-facing templates

### `bookingConfirmation`

Source: [`bookingConfirmation.md`](../../functions/email-templates/bookingConfirmation.md)

### `bookingRevision`

Source: [`bookingRevision.md`](../../functions/email-templates/bookingRevision.md)

### `emailChangeVerification`

Source: [`email-change-verification.md`](../../functions/email-templates/email-change-verification.md)

### `emailVerification`

Source: [`email-verification.md`](../../functions/email-templates/email-verification.md)

### `guestTicketRequestApproved`

Source: [`guestTicketRequestApproved.md`](../../functions/email-templates/guestTicketRequestApproved.md)

### `guestTicketRequestRejected`

Source: [`guestTicketRequestRejected.md`](../../functions/email-templates/guestTicketRequestRejected.md)

### `membershipAccessRestricted`

Source: [`membershipAccessRestricted.md`](../../functions/email-templates/membershipAccessRestricted.md)

### `membershipActivated`

Source: [`membershipActivated.md`](../../functions/email-templates/membershipActivated.md)

### `passwordReset`

Source: [`password-reset.md`](../../functions/email-templates/password-reset.md)

### `ticketOrderFailed`

Source: [`ticketOrderFailed.md`](../../functions/email-templates/ticketOrderFailed.md)

### `ticketOrderPaid`

Source: [`ticketOrderPaid.md`](../../functions/email-templates/ticketOrderPaid.md)

### `ticketOrderRefunded`

Source: [`ticketOrderRefunded.md`](../../functions/email-templates/ticketOrderRefunded.md)

## Moderator and operations templates

### `guestTicketRequestSubmittedModerator`

Source: [`guestTicketRequestSubmittedModerator.md`](../../functions/email-templates/guestTicketRequestSubmittedModerator.md)

### `newUserPendingApprovalAlert`

Source: [`newUserPendingApprovalAlert.md`](../../functions/email-templates/newUserPendingApprovalAlert.md)

### `paymentDisputeOpsAlert`

Source: [`paymentDisputeOpsAlert.md`](../../functions/email-templates/paymentDisputeOpsAlert.md)

### `paymentReconciliationExceptionAlert`

Source: [`paymentReconciliationExceptionAlert.md`](../../functions/email-templates/paymentReconciliationExceptionAlert.md)

## Publishing and testing

Use [the template registration runbook](./govuk-notify-template-registration.md)
and [sample personalisation](./govuk-notify-sample-personalisation.json). After
updating a source file, regenerate the manifest with
`npm --prefix functions run generate:templates`, deploy Functions, and use the
Admin drift report to apply and verify the corresponding Notify dashboard change.
