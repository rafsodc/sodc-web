---
subject: "Changes requested for your booking — ((eventTitle))"
templateKey: bookingChangesRequested
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketLinesSummary
  - moderatorNote
  - sectionBookingsUrl
---
Hello ((firstName)),

The organiser has reviewed your booking for ((eventTitle)) and has requested changes.

Date and time: ((eventDateTime))

Where: ((eventLocation))

Booking reviewed:

((ticketLinesSummary))

Organiser note: ((moderatorNote))

Your previous approved booking remains active. View and amend the newer revision here:

((sectionBookingsUrl))

Kind regards,

SODC Admin
