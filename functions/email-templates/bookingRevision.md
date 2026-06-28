---
subject: "Your SODC booking has been updated — ((eventTitle))"
templateKey: bookingRevision
variables:
  - customerFirstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - revisionNumber
  - ticketLinesSummary
  - bookerDietaryNote
  - accommodationSummary
  - bookingTotalFormatted
  - sectionBookingsUrl
  - myPaymentsUrl
  - previousRevisionNumber
  - revisedRevisionNumber
  - paymentAdjustmentStatus
  - previousTotalFormatted
  - revisedTotalFormatted
  - deltaAmountFormatted
---
Dear ((customerFirstName)),

Your booking for **((eventTitle))** has been updated (revision ((previousRevisionNumber)) → ((revisedRevisionNumber))).

---

^**Event details**

**When:** ((eventDateTime))

**Where:** ((eventLocation))

---

^**Updated booking (revision ((revisedRevisionNumber)))**

((ticketLinesSummary))

**Your dietary note:** ((bookerDietaryNote))

**Accommodation:** ((accommodationSummary))

**Previous total:** ((previousTotalFormatted))

**Revised total:** ((revisedTotalFormatted))

**Difference:** ((deltaAmountFormatted))

**Payment status:** ((paymentAdjustmentStatus))

---

View your booking:

((sectionBookingsUrl))

Manage payments:

((myPaymentsUrl))

SODC
