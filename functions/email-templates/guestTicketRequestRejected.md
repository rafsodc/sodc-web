---
subject: "Guest ticket request update — ((eventTitle))"
templateKey: guestTicketRequestRejected
variables:
  - customerFirstName
  - eventTitle
  - decisionLabel
  - guestTicketCount
  - moderatorNote
  - myBookingsUrl
---
Dear ((customerFirstName)),

Your guest ticket request for ((eventTitle)) has been ((decisionLabel)).

Guest tickets requested: ((guestTicketCount))

Note from organiser: ((moderatorNote))

If you have any questions, please contact your section organiser. You can view your booking at:

((myBookingsUrl))

SODC
