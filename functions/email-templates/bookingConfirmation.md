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
  - accommodationRequested
  - bookingTotalFormatted
  - sectionBookingsUrl
  - myPaymentsUrl
---
Dear ((customerFirstName)),

Your booking for ((eventTitle)) has been confirmed.

---

# Event details

When: ((eventDateTime))

Where: ((eventLocation))

---

# Your booking (revision ((revisionNumber)))

((ticketLinesSummary))

Your dietary note: ((bookerDietaryNote))

((accommodationRequested??Accommodation requested — see your booking for details.))

Total: ((bookingTotalFormatted))

---

You can view your booking and payment status at any time:

((sectionBookingsUrl))

If payment is outstanding, visit My Payments:

((myPaymentsUrl))

SODC
