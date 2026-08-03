---
subject: "Guest ticket request approved — ((eventTitle))"
templateKey: guestTicketRequestApproved
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - guestDisplayName
  - requestedGuestCount
  - moderatorNote
  - myBookingsUrl
---
Hello ((firstName)),

Your request for guest places at ((eventTitle)) has been approved.

Date and time: ((eventDateTime))

Location: ((eventLocation))

Guest: ((guestDisplayName))

Guest places: ((requestedGuestCount))

Note from organiser: ((moderatorNote))

You can now arrange payment for the guest places. View your booking to continue:

((myBookingsUrl))

Kind regards,

SODC Admin
