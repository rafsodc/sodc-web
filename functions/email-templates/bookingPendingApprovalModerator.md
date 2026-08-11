---
subject: "[SODC] Booking awaiting approval — ((eventTitle))"
templateKey: bookingPendingApprovalModerator
variables:
  - eventTitle
  - sectionName
  - bookerDisplay
  - guestCount
  - ticketLinesSummary
  - moderationUrl
---
A complete booking is ready for review.

Event: ((eventTitle))

Section: ((sectionName))

Member: ((bookerDisplay))

Guests: ((guestCount))

Booking:

((ticketLinesSummary))

Review the exact booking revision in SODC:

((moderationUrl))

Kind regards,

SODC Admin
