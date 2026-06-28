---
subject: "Payment confirmed — ((eventTitle))"
templateKey: ticketOrderPaid
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

Your payment for ((eventTitle)) has been confirmed.

Ticket: ((ticketTypeTitle))

Quantity: ((quantity))

Total paid: ((totalFormatted)) ((currencyDisplay))

Status: ((orderStatusLabel))

Order reference: ((orderId))

You can view your payment history at any time:

((myPaymentsUrl))

SODC
