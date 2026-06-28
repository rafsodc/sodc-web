---
subject: "Refund processed — ((eventTitle))"
templateKey: ticketOrderRefunded
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
  - refundFormatted
---
Dear ((customerFirstName)),

A refund of **((refundFormatted))** has been processed for your payment on **((eventTitle))**.

**Ticket:** ((ticketTypeTitle))

**Quantity:** ((quantity))

**Original total:** ((totalFormatted)) ((currencyDisplay))

**Status:** ((orderStatusLabel))

**Order reference:** ((orderId))

Refunds typically appear in your account within 5–10 working days depending on your bank.

You can view your payment history at:

((myPaymentsUrl))

SODC
