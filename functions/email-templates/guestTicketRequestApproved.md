---
subject: "Guest ticket request approved — ((eventTitle))"
templateKey: guestTicketRequestApproved
variables:
  - customerFirstName
  - eventTitle
  - decisionLabel
  - guestTicketCount
  - totalAmountLine
  - moderatorNote
  - myBookingsUrl
---
Dear ((customerFirstName)),

Your guest ticket request for ((eventTitle)) has been ((decisionLabel)).

Guest tickets: ((guestTicketCount))

((totalAmountLine))

Note from organiser: ((moderatorNote))

You can now complete payment for your guest tickets. Visit your booking to continue:

((myBookingsUrl))

SODC
