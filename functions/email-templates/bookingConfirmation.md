---
subject: "Your SODC booking — ((eventTitle))"
templateKey: bookingConfirmation
variables:
  - customerFirstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - revisionNumber
  - ticketLinesSummary
  - bookerDietaryNote
  - accommodationSummary
  - bookingTotalFormatted
  - sectionBookingsUrl
  - myPaymentsUrl
---
Dear ((customerFirstName)),

Your booking for **((eventTitle))** has been confirmed.

---

^**Event details**

**When:** ((eventDateTime))

**Where:** ((eventLocation))

---

^**Your booking (revision ((revisionNumber)))**

((ticketLinesSummary))

**Your dietary note:** ((bookerDietaryNote))

**Accommodation:** ((accommodationSummary))

**Total:** ((bookingTotalFormatted))

---

You can view your booking and payment status at any time:

((sectionBookingsUrl))

If payment is outstanding, visit My Payments:

((myPaymentsUrl))

SODC
