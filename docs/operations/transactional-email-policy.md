# Transactional email policy

Defines which emails the application sends today, how they are classified, and what is deferred. Part of epic **#183**; closes **#191**.

**Related:** [transactional-email-workflows.md](./transactional-email-workflows.md) (triggers and templates), [govuk-notify-template-copy.md](./govuk-notify-template-copy.md) (Notify dashboard copy).

## Provider and boundaries

| Channel | Provider | Used for |
|---------|----------|----------|
| Account verification | **Firebase Auth** | Email verification links only |
| App-owned transactional | **GOV.UK Notify** | Payments, bookings, membership access, guest moderation, internal payment ops |

We do **not** replace Firebase Auth verification emails. Stripe may send its own receipts when enabled in the Stripe dashboard; app-owned payment emails add application context and deep links.

## Email categories

### Operational (required, no marketing opt-out)

Sent because of a **user action or system state change** the user or operator must know about. These are implemented on epic **#183** and do not use a marketing preferences store.

| Category | Examples | Opt-out |
|----------|----------|---------|
| Payment lifecycle | Order paid, failed, refunded | No — tied to purchase |
| Booking | Confirmation, revision | No — tied to submit |
| Membership access | Account activated, access restricted | No — tied to status change |
| Guest ticket moderation | Moderator alert, approve/reject to booker | No — tied to request workflow |
| Internal payment ops | Reconciliation exception, dispute alert | N/A (internal recipients only) |

**Rules**

- Idempotent delivery via `NotificationDelivery` (no duplicate sends on webhook/callable retries).
- Recipients and placeholders are defined in code and `govuk-notify-*.md` specs.
- Internal ops emails use `PAYMENT_OPS_ALERT_EMAILS`; if unset, those alerts are not sent.

### Optional / future (preferences required before implementation)

Lower priority or bulk-style messages. **Do not implement** without explicit product decision, storage for preferences, and unsubscribe behaviour per **#191** follow-ups.

| Category | Examples | Notes |
|----------|----------|--------|
| Section / event announcements | New event, event updated | Candidate: #198 (section group `ACCESS` audiences) |
| Reminders | Booking window opening/closing, event reminder | Schedule-driven; needs opt-out |
| Subscription confirmations | Section subscribe/unsubscribe | User-initiated but not strictly operational |
| Marketing / newsletters | General club news | Out of scope for current app architecture |

**Rules for future work**

- Classify each new template as operational vs optional before coding.
- Optional emails require: preference model, UI to manage preferences, and Notify/list-unsubscribe or equivalent compliant mechanism.
- Operational emails must not be gated behind marketing opt-out.

## What we send today (Notify template keys)

| Domain | Template keys |
|--------|----------------|
| Ticket orders | `ticketOrderPaid`, `ticketOrderFailed`, `ticketOrderRefunded` |
| Payment ops | `paymentReconciliationExceptionAlert`, `paymentDisputeOpsAlert` |
| Membership | `membershipActivated`, `membershipAccessRestricted` |
| Guest tickets | `guestTicketRequestSubmittedModerator`, `guestTicketRequestApproved`, `guestTicketRequestRejected` |
| Bookings | `bookingConfirmation`, `bookingRevision` |

Configuration: [environment-and-secrets.md](./environment-and-secrets.md). Registration: [govuk-notify-template-registration.md](./govuk-notify-template-registration.md).

## User-facing copy expectations

- Operational emails: plain language, what happened, what to do next, link placeholders only (no hardcoded environment URLs in Notify).
- Do not include admin-only notes in customer personalisation payloads.
- Profile completion UI may state that users **will be notified by email** when an administrator activates their account (`membershipActivated`).

## Governance

- New operational templates: update dispatcher, `govuk-notify-*.md`, `govuk-notify-template-copy.md`, and register in Notify per environment.
- New optional templates: new issue; reference this policy; do not merge without preferences design.

## Related issues

- Epic: #183
- Preferences / future bulk email: #198 and follow-ups from #191
- Notify setup and UAT: see ops/UAT issue linked from epic #183
