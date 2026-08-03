---
subject: "[SODC] Guest ticket request — ((eventTitle))"
templateKey: guestTicketRequestSubmittedModerator
variables:
  - eventTitle
  - sectionName
  - bookerDisplay
  - guestDisplayName
  - requestedGuestCount
  - guestTicketTypeTitle
  - dietaryNote
  - moderationUrl
---
A guest ticket request is ready for review.

Event: ((eventTitle))

Section: ((sectionName))

Requested by: ((bookerDisplay))

Guest: ((guestDisplayName))

Places requested: ((requestedGuestCount))

Ticket type: ((guestTicketTypeTitle))

Dietary requirements: ((dietaryNote))

---

Review the request in SODC:

((moderationUrl))

Kind regards,

SODC Admin
