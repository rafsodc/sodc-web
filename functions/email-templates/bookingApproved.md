---
subject: "Your booking for ((eventTitle)) has been approved"
templateKey: bookingApproved
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketLinesSummary
  - bookingTotalFormatted
  - sectionBookingsUrl
  - myPaymentsUrl
---
Hello ((firstName)),

The organiser has approved your booking for ((eventTitle)). You can now continue to payment.

Date and time: ((eventDateTime))

Where: ((eventLocation))

Your approved booking:

((ticketLinesSummary))

Total: ((bookingTotalFormatted))

View your booking:

((sectionBookingsUrl))

Continue to payment:

((myPaymentsUrl))

Kind regards,

SODC Admin
