---
subject: "Your booking for ((eventTitle)) has been updated"
templateKey: bookingRevision
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketLinesSummary
  - bookerDietaryNote
  - accommodationSummary
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

Dietary requirements: ((bookerDietaryNote))

Accommodation: ((accommodationSummary))

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
