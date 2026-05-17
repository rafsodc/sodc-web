# GOV.UK Notify: draft template copy

Ready-to-paste **subject** and **body** text for all transactional email templates. Register each template in the [GOV.UK Notify dashboard](https://www.notifications.service.gov.uk/) per Firebase environment (Dev, Beta, Prod).

**Before publishing**

1. Follow [how to create an email template](https://www.notifications.service.gov.uk/using-notify/how-to-create-email-template) and [personalisation](https://www.notifications.service.gov.uk/using-notify/personalisation).
2. Placeholder names must match this document **exactly** (`((customerFirstName))`, not `((first_name))`).
3. Copy the template UUID into the matching `GOV_NOTIFY_TEMPLATE_*` env var — see [govuk-notify-template-registration.md](./govuk-notify-template-registration.md).
4. Send a test email using sample values from [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json).

Placeholder specs (keys only): `govuk-notify-*.md`. Workflow index: [transactional-email-workflows.md](./transactional-email-workflows.md).

---

## Ticket order lifecycle

### `ticketOrderPaid` — Payment confirmed

**Env var:** `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_PAID`

**Subject:** Payment confirmed for ((eventTitle))

**Body:**

```
Hello ((firstName)),

Your payment for ((eventTitle)) is confirmed.

Ticket: ((ticketTypeTitle))
Quantity: ((quantity))
Total: ((totalFormatted))
Status: ((orderStatusLabel))
Order reference: ((orderId))

View your payments: ((myPaymentsUrl))

If you did not make this payment, please contact the [SODC Secretary](mailto:secretary@sodc.net).
```

**Placeholders used:** `firstName`, `eventTitle`, `ticketTypeTitle`, `quantity`, `totalFormatted`, `currencyDisplay` (optional in body), `orderStatusLabel`, `orderId`, `myPaymentsUrl`

---

### `ticketOrderFailed` — Payment failed

**Env var:** `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_FAILED`

**Subject:** Payment could not be completed for ((eventTitle))

**Body:**

```
Hello ((firstName)),

We could not complete your payment for ((eventTitle)).

Ticket: ((ticketTypeTitle))
Quantity: ((quantity))
Amount: ((totalFormatted))
Status: ((orderStatusLabel))
Order reference: ((orderId))

You can try again from your payments page: ((myPaymentsUrl))
```

**Placeholders used:** same as `ticketOrderPaid` (status label is sent as `Payment failed`)

---

### `ticketOrderRefunded` — Refund processed

**Env var:** `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_REFUNDED`

**Subject:** Refund processed for ((eventTitle))

**Body:**

```
Hello ((firstName)),

A refund has been processed for your order for ((eventTitle)).

Ticket: ((ticketTypeTitle))
Quantity: ((quantity))
Original total: ((totalFormatted))
Refund amount: ((refundFormatted))
Status: ((orderStatusLabel))
Order reference: ((orderId))

View your payments: ((myPaymentsUrl))
```

**Placeholders used:** all paid/failed keys plus `refundFormatted`

---

## Internal payment ops

Set `PAYMENT_OPS_ALERT_EMAILS` before these templates will send.

### `paymentReconciliationExceptionAlert`

**Env var:** `GOV_NOTIFY_TEMPLATE_PAYMENT_RECONCILIATION_EXCEPTION_ALERT`

**Subject:** [Payments] Reconciliation exception — ((exceptionType))

**Body:**

```
A payment reconciliation exception is open.

Order: ((orderId))
Event: ((eventTitle))
User: ((userDisplay))
Exception type: ((exceptionType))
Note: ((exceptionNote))
Stripe event: ((stripeEventId))

Open reconciliation dashboard:
((reconciliationDashboardUrl))
```

**Placeholders used:** `orderId`, `eventTitle`, `userDisplay`, `exceptionType`, `exceptionNote`, `reconciliationDashboardUrl`, `stripeEventId`

---

### `paymentDisputeOpsAlert`

**Env var:** `GOV_NOTIFY_TEMPLATE_PAYMENT_DISPUTE_OPS_ALERT`

**Subject:** [Payments] Stripe dispute update — ((eventTitle))

**Body:**

```
Stripe dispute side-state received.

Order: ((orderId))
Event: ((eventTitle))
User: ((userDisplay))
Local state: ((disputeLocalState))
Stripe dispute status: ((disputeStripeStatus))
Reason: ((disputeReason))
Dispute ID: ((stripeDisputeId))
Stripe event type: ((stripeEventType))
Stripe event ID: ((stripeEventId))

Open reconciliation dashboard:
((reconciliationDashboardUrl))
```

**Placeholders used:** `orderId`, `eventTitle`, `userDisplay`, `disputeStripeStatus`, `disputeReason`, `disputeLocalState`, `stripeDisputeId`, `stripeEventType`, `reconciliationDashboardUrl`, `stripeEventId`

---

## Membership status

### `membershipActivated`

**Env var:** `GOV_NOTIFY_TEMPLATE_MEMBERSHIP_ACTIVATED`

**Subject:** Your account is now active

**Body:**

```
Hello ((firstName)),

Your membership status is now ((membershipStatusLabel)). You can sign in and use the application.

Open the app: ((appUrl))
Your profile: ((profileUrl))

If you have questions, contact your section administrator.
```

**Placeholders used:** `firstName`, `membershipStatusLabel`, `appUrl`, `profileUrl`

---

### `membershipAccessRestricted`

**Env var:** `GOV_NOTIFY_TEMPLATE_MEMBERSHIP_ACCESS_RESTRICTED`

**Subject:** Your account access has changed

**Body:**

```
Hello ((firstName)),

Your membership status has changed from ((previousStatusLabel)) to ((membershipStatusLabel)). You may no longer have full access to the application.

If you believe this is a mistake, contact your section administrator.

Application: ((appUrl))
```

**Placeholders used:** `firstName`, `membershipStatusLabel`, `previousStatusLabel`, `appUrl`

---

## Guest ticket requests

### `guestTicketRequestSubmittedModerator`

**Env var:** `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_SUBMITTED_MODERATOR`

**Subject:** Guest ticket request — ((eventTitle))

**Body:**

```
A booker has submitted a guest ticket request that needs review.

Section: ((sectionName))
Event: ((eventTitle))
Booker: ((bookerDisplay))
Guest name: ((guestDisplayName))
Ticket type: ((guestTicketTypeTitle))
Guests requested: ((requestedGuestCount))
Dietary note: ((dietaryNote))

Review requests (Manage Sections): ((moderationUrl))
```

**Placeholders used:** `eventTitle`, `sectionName`, `bookerDisplay`, `guestDisplayName`, `requestedGuestCount`, `guestTicketTypeTitle`, `dietaryNote`, `moderationUrl`

---

### `guestTicketRequestApproved`

**Env var:** `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_APPROVED`

**Subject:** Guest ticket request approved — ((eventTitle))

**Body:**

```
Hello ((customerFirstName)),

Your guest ticket request for ((eventTitle)) has been ((decisionLabel)).

Guest: ((guestDisplayName))
Guests requested: ((requestedGuestCount))
Moderator note: ((moderatorNote))

View your booking: ((myBookingsUrl))
```

**Placeholders used:** `customerFirstName`, `eventTitle`, `guestDisplayName`, `requestedGuestCount`, `decisionLabel`, `moderatorNote`, `myBookingsUrl`

---

### `guestTicketRequestRejected`

**Env var:** `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_REJECTED`

**Subject:** Guest ticket request not approved — ((eventTitle))

**Body:**

```
Hello ((customerFirstName)),

Your guest ticket request for ((eventTitle)) has been ((decisionLabel)).

Guest: ((guestDisplayName))
Guests requested: ((requestedGuestCount))
Moderator note: ((moderatorNote))

View your booking: ((myBookingsUrl))
```

**Placeholders used:** same as approved (`decisionLabel` is sent as `Rejected`)

---

## Bookings

### `bookingConfirmation`

**Env var:** `GOV_NOTIFY_TEMPLATE_BOOKING_CONFIRMATION`

**Subject:** Booking confirmed — ((eventTitle))

**Body:**

```
Hello ((customerFirstName)),

Your booking for ((eventTitle)) has been submitted.

When: ((eventDateTime))
Where: ((eventLocation))
Revision: ((revisionNumber))

Tickets:
((ticketLinesSummary))

Dietary requirements: ((bookerDietaryNote))
Accommodation: ((accommodationSummary))
Booking total: ((bookingTotalFormatted))

View section bookings: ((sectionBookingsUrl))
Payments: ((myPaymentsUrl))
```

**Placeholders used:** `customerFirstName`, `eventTitle`, `eventDateTime`, `eventLocation`, `revisionNumber`, `ticketLinesSummary`, `bookerDietaryNote`, `accommodationSummary`, `bookingTotalFormatted`, `sectionBookingsUrl`, `myPaymentsUrl`

---

### `bookingRevision`

**Env var:** `GOV_NOTIFY_TEMPLATE_BOOKING_REVISION`

**Subject:** Booking updated — ((eventTitle))

**Body:**

```
Hello ((customerFirstName)),

Your booking for ((eventTitle)) has been updated (revision ((revisedRevisionNumber)), previously revision ((previousRevisionNumber))).

When: ((eventDateTime))
Where: ((eventLocation))

Tickets:
((ticketLinesSummary))

Dietary requirements: ((bookerDietaryNote))
Accommodation: ((accommodationSummary))

Payment adjustment: ((paymentAdjustmentStatus))
Previous total: ((previousTotalFormatted))
Revised total: ((revisedTotalFormatted))
Change: ((deltaAmountFormatted))

View section bookings: ((sectionBookingsUrl))
Payments: ((myPaymentsUrl))
```

**Placeholders used:** all confirmation keys plus `previousRevisionNumber`, `revisedRevisionNumber`, `paymentAdjustmentStatus`, `previousTotalFormatted`, `revisedTotalFormatted`, `deltaAmountFormatted`
