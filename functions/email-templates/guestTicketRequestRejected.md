---
subject: "Update on your guest request for ((eventTitle))"
templateKey: guestTicketRequestRejected
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - guestTicketCount
  - moderatorNote
  - myBookingsUrl
---
Hello ((firstName)),

Unfortunately, your request for guest places at ((eventTitle)) was not approved.

Date and time: ((eventDateTime))

Location: ((eventLocation))

Guest tickets requested: ((guestTicketCount))

Note from organiser: ((moderatorNote))

View your booking:

((myBookingsUrl))

Kind regards,

SODC Admin
