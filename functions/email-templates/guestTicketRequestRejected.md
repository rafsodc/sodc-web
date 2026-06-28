---
subject: "Guest ticket request update — ((eventTitle))"
templateKey: guestTicketRequestRejected
variables:
  - customerFirstName
  - eventTitle
  - guestDisplayName
  - requestedGuestCount
  - decisionLabel
  - moderatorNote
  - myBookingsUrl
---
Dear ((customerFirstName)),

Your guest ticket request for ((eventTitle)) has been ((decisionLabel)).

Guest: ((guestDisplayName))

Guest tickets requested: ((requestedGuestCount))

Note from organiser: ((moderatorNote))

If you have any questions, please contact your section organiser. You can view your booking at:

((myBookingsUrl))

SODC
