---
subject: "Payment unsuccessful — ((eventTitle))"
templateKey: ticketOrderFailed
variables:
  - customerFirstName
  - firstName
  - eventTitle
  - ticketTypeTitle
  - quantity
  - totalFormatted
  - currencyDisplay
  - orderStatusLabel
  - orderId
  - myPaymentsUrl
---
Dear ((customerFirstName)),

Unfortunately your payment for **((eventTitle))** was unsuccessful.

**Ticket:** ((ticketTypeTitle))

**Quantity:** ((quantity))

**Amount:** ((totalFormatted)) ((currencyDisplay))

**Status:** ((orderStatusLabel))

**Order reference:** ((orderId))

Your booking is still in place. You can return to My Payments to try again:

((myPaymentsUrl))

If you continue to have problems, please reply to this email.

SODC
