---
subject: "Payment confirmed — ((eventTitle))"
templateKey: ticketOrderPaid
variables:
  - firstName
  - eventTitle
  - eventDateTime
  - eventLocation
  - ticketTypeTitle
  - quantity
  - totalFormatted
  - myPaymentsUrl
---
Hello ((firstName)),

Thank you. We have received your payment for ((eventTitle)).

Date and time: ((eventDateTime))

Location: ((eventLocation))

Ticket: ((ticketTypeTitle))

Quantity: ((quantity))

Total paid: ((totalFormatted))

You can view your payment history at any time:

((myPaymentsUrl))

Kind regards,

SODC Admin
