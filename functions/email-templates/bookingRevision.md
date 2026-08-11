---
subject: "Your booking for ((eventTitle)) has been updated"
templateKey: bookingRevision
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketLinesSummary
  - accommodationRequested
  - bookingTotalFormatted
  - sectionBookingsUrl
  - myPaymentsUrl
  - paymentAdjustmentStatus
  - previousTotalFormatted
  - revisedTotalFormatted
  - deltaAmountFormatted
---
Hello ((firstName)),

Your booking for ((eventTitle)) has been updated.

---

# Event details

Date and time: ((eventDateTime))

Where: ((eventLocation))

---

# Your updated booking

((ticketLinesSummary))

((accommodationRequested??Accommodation requested — see your booking for details.))

Previous total: ((previousTotalFormatted))

Revised total: ((revisedTotalFormatted))

Payment difference: ((deltaAmountFormatted))

Payment status: ((paymentAdjustmentStatus))

---

View your booking:

((sectionBookingsUrl))

View your payments:

((myPaymentsUrl))

Kind regards,

SODC Admin
