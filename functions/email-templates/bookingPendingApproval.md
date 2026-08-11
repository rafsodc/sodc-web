---
subject: "Your booking for ((eventTitle)) is awaiting approval"
templateKey: bookingPendingApproval
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketLinesSummary
  - sectionBookingsUrl
---
Hello ((firstName)),

We have received your complete booking for ((eventTitle)). It is now with the organiser for approval.

Date and time: ((eventDateTime))

Where: ((eventLocation))

Your booking:

((ticketLinesSummary))

You cannot pay for this revision until it is approved. We will email you when the organiser has reviewed it.

View your booking:

((sectionBookingsUrl))

Kind regards,

SODC Admin
