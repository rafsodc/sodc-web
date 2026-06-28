---
subject: "Guest ticket request — ((eventTitle))"
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
A guest ticket request has been submitted for your review.

**Event:** ((eventTitle))

**Section:** ((sectionName))

**Requested by:** ((bookerDisplay))

**Guest name:** ((guestDisplayName))

**Guest count:** ((requestedGuestCount))

**Ticket type:** ((guestTicketTypeTitle))

**Dietary note:** ((dietaryNote))

---

Review and approve or decline this request in the admin panel:

((moderationUrl))

SODC
