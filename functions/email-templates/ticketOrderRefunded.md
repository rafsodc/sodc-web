---
subject: "Refund processed — ((eventTitle))"
templateKey: ticketOrderRefunded
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketTypeTitle
  - quantity
  - totalFormatted
  - myPaymentsUrl
  - refundFormatted
---
Hello ((firstName)),

We have processed a refund of ((refundFormatted)) for your payment for ((eventTitle)).

Date and time: ((eventDateTime))

Location: ((eventLocation))

Ticket: ((ticketTypeTitle))

Quantity: ((quantity))

Original payment: ((totalFormatted))

Refunds typically appear in your account within 5 to 10 working days depending on your bank.

You can view your payment history at:

((myPaymentsUrl))

Kind regards,

SODC Admin
