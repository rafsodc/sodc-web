# GOV.UK Notify: draft template copy

Ready-to-paste **subject** and **body** text for all transactional email templates. Register each template in the [GOV.UK Notify dashboard](https://www.notifications.service.gov.uk/) per Firebase environment (Dev, Beta, Prod).

**Before publishing**

1. Follow [how to create an email template](https://www.notifications.service.gov.uk/using-notify/how-to-create-email-template) and [personalisation](https://www.notifications.service.gov.uk/using-notify/personalisation).
2. Placeholder names must match this document **exactly** (`((firstName))`, not `((first_name))` or `((firstname))`).
3. Copy the template UUID into the matching `GOV_NOTIFY_TEMPLATE_*` env var — see [govuk-notify-template-registration.md](./govuk-notify-template-registration.md).
4. Send a test email using sample values from [govuk-notify-sample-personalisation.json](./govuk-notify-sample-personalisation.json).

Placeholder specs (keys only): `govuk-notify-*.md`. Workflow index: [transactional-email-workflows.md](./transactional-email-workflows.md).

## Voice and structure (user-facing templates)

Weave **RAF SODC** / **RAF SODC website** into the opening lines — do not rely on a separate footer. Follow the pattern from the legacy activation email:

1. Greeting with `((firstName))` (or the template’s name key).
2. What happened, in the context of the **RAF SODC website** or account.
3. Action links (`((appUrl))`, `((myPaymentsUrl))`, etc.).
4. Why they received the email; what to do if it is wrong — use static contacts only:
   - **Account / access:** `admin@sodc.net`
   - **Payments:** `secretary@sodc.net`
5. Sign-off: **Kind regards,** then **SODC Admin** (account/access) or **SODC Secretary** (payments). Bookings that cover both may mention both contacts in step 4 and sign off as **SODC Admin**.

Internal ops templates use operational copy only (no member sign-off).

---

## Ticket order lifecycle

### `ticketOrderPaid` — Payment confirmed

**Env var:** `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_PAID`

**Subject:** Payment confirmed for ((eventTitle))

**Body:**

```
Hello ((firstName)),

Your payment on the RAF SODC website for ((eventTitle)) is confirmed.

Ticket: ((ticketTypeTitle))
Quantity: ((quantity))
Total: ((totalFormatted))
Status: ((orderStatusLabel))
Order reference: ((orderId))

View your payments: ((myPaymentsUrl))

You are receiving this email because a payment was recorded on your RAF SODC account. If you did not make this payment, contact secretary@sodc.net.

Kind regards,
SODC Secretary
```

**Placeholders used:** `firstName`, `eventTitle`, `ticketTypeTitle`, `quantity`, `totalFormatted`, `currencyDisplay` (optional in body), `orderStatusLabel`, `orderId`, `myPaymentsUrl`

---

### `ticketOrderFailed` — Payment failed

**Env var:** `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_FAILED`

**Subject:** Payment could not be completed for ((eventTitle))

**Body:**

```
Hello ((firstName)),

We could not complete your payment on the RAF SODC website for ((eventTitle)).

Ticket: ((ticketTypeTitle))
Quantity: ((quantity))
Amount: ((totalFormatted))
Status: ((orderStatusLabel))
Order reference: ((orderId))

You can try again from your payments page: ((myPaymentsUrl))

You are receiving this email because a payment attempt was recorded on your RAF SODC account. For payment questions, contact secretary@sodc.net.

Kind regards,
SODC Secretary
```

**Placeholders used:** same as `ticketOrderPaid` (status label is sent as `Payment failed`)

---

### `ticketOrderRefunded` — Refund processed

**Env var:** `GOV_NOTIFY_TEMPLATE_TICKET_ORDER_REFUNDED`

**Subject:** Refund processed for ((eventTitle))

**Body:**

```
Hello ((firstName)),

A refund has been processed on the RAF SODC website for your order for ((eventTitle)).

Ticket: ((ticketTypeTitle))
Quantity: ((quantity))
Original total: ((totalFormatted))
Refund amount: ((refundFormatted))
Status: ((orderStatusLabel))
Order reference: ((orderId))

View your payments: ((myPaymentsUrl))

You are receiving this email because a refund was recorded on your RAF SODC account. For payment questions, contact secretary@sodc.net.

Kind regards,
SODC Secretary
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

**Subject:** Your RAF SODC account is now active

**Body:**

```
Hello ((firstName)),

Your account on the RAF SODC website has been activated. Your membership status is now ((membershipStatusLabel)).

To sign in, visit ((appUrl)). You can view your profile at ((profileUrl)).

You are receiving this email because your RAF SODC account status was updated. If you believe this is in error, contact admin@sodc.net.

Kind regards,
SODC Admin
```

**Placeholders used:** `firstName`, `membershipStatusLabel`, `appUrl`, `profileUrl`

---

### `membershipAccessRestricted`

**Env var:** `GOV_NOTIFY_TEMPLATE_MEMBERSHIP_ACCESS_RESTRICTED`

**Subject:** Your RAF SODC account access has changed

**Body:**

```
Hello ((firstName)),

Your access to the RAF SODC website has changed. Your membership status is now ((membershipStatusLabel)) (previously ((previousStatusLabel))).

To sign in, visit ((appUrl)).

You are receiving this email because your RAF SODC account status was updated. If you believe this is in error, contact admin@sodc.net.

Kind regards,
SODC Admin
```

**Placeholders used:** `firstName`, `membershipStatusLabel`, `previousStatusLabel`, `appUrl`

---

## Guest ticket requests

### `guestTicketRequestSubmittedModerator`

**Env var:** `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_SUBMITTED_MODERATOR`

**Subject:** Guest ticket request — ((eventTitle))

**Body:**

```
A guest ticket request on the RAF SODC website needs review.

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

Your guest ticket request on the RAF SODC website for ((eventTitle)) has been ((decisionLabel)).

Guest: ((guestDisplayName))
Guests requested: ((requestedGuestCount))
Moderator note: ((moderatorNote))

View your booking: ((myBookingsUrl))

You are receiving this email because a guest ticket request on your RAF SODC account was reviewed. For account questions, contact admin@sodc.net.

Kind regards,
SODC Admin
```

**Placeholders used:** `customerFirstName`, `eventTitle`, `guestDisplayName`, `requestedGuestCount`, `decisionLabel`, `moderatorNote`, `myBookingsUrl`

---

### `guestTicketRequestRejected`

**Env var:** `GOV_NOTIFY_TEMPLATE_GUEST_TICKET_REQUEST_REJECTED`

**Subject:** Guest ticket request not approved — ((eventTitle))

**Body:**

```
Hello ((customerFirstName)),

Your guest ticket request on the RAF SODC website for ((eventTitle)) has been ((decisionLabel)).

Guest: ((guestDisplayName))
Guests requested: ((requestedGuestCount))
Moderator note: ((moderatorNote))

View your booking: ((myBookingsUrl))

You are receiving this email because a guest ticket request on your RAF SODC account was reviewed. For account questions, contact admin@sodc.net.

Kind regards,
SODC Admin
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

Your booking on the RAF SODC website for ((eventTitle)) has been submitted.

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

You are receiving this email because a booking was submitted on your RAF SODC account. For account questions, contact admin@sodc.net. For payment questions, contact secretary@sodc.net.

Kind regards,
SODC Admin
```

**Placeholders used:** `customerFirstName`, `eventTitle`, `eventDateTime`, `eventLocation`, `revisionNumber`, `ticketLinesSummary`, `bookerDietaryNote`, `accommodationSummary`, `bookingTotalFormatted`, `sectionBookingsUrl`, `myPaymentsUrl`

---

### `bookingRevision`

**Env var:** `GOV_NOTIFY_TEMPLATE_BOOKING_REVISION`

**Subject:** Booking updated — ((eventTitle))

**Body:**

```
Hello ((customerFirstName)),

Your booking on the RAF SODC website for ((eventTitle)) has been updated (revision ((revisedRevisionNumber)), previously revision ((previousRevisionNumber))).

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

You are receiving this email because a booking on your RAF SODC account was updated. For account questions, contact admin@sodc.net. For payment questions, contact secretary@sodc.net.

Kind regards,
SODC Admin
```

**Placeholders used:** all confirmation keys plus `previousRevisionNumber`, `revisedRevisionNumber`, `paymentAdjustmentStatus`, `previousTotalFormatted`, `revisedTotalFormatted`, `deltaAmountFormatted`
