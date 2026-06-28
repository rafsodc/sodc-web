---
subject: "Guest ticket request approved — ((eventTitle))"
templateKey: guestTicketRequestApproved
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

Your guest ticket request for **((eventTitle))** has been **((decisionLabel))**.

**Guest:** ((guestDisplayName))

**Guest tickets:** ((requestedGuestCount))

**Note from organiser:** ((moderatorNote))

You can now complete payment for your guest tickets. Visit your booking to continue:

((myBookingsUrl))

SODC
