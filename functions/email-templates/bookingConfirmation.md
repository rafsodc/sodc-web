---
subject: "Your booking for ((eventTitle)) is confirmed"
templateKey: bookingConfirmation
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketLinesSummary
  - bookerDietaryNote
  - accommodationRequested
  - bookingTotalFormatted
  - sectionBookingsUrl
  - myPaymentsUrl
---
Hello ((firstName)),

Thank you for booking your place at ((eventTitle)). Your booking is confirmed.

---

# Event details

Date and time: ((eventDateTime))

Where: ((eventLocation))

---

# Your booking

((ticketLinesSummary))

Dietary requirements: ((bookerDietaryNote))

((accommodationRequested??Accommodation requested — see your booking for details.))

Total: ((bookingTotalFormatted))

---

View your booking:

((sectionBookingsUrl))

If you still need to make a payment, visit My Payments:

((myPaymentsUrl))

Kind regards,

SODC Admin
