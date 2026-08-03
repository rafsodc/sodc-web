---
subject: "Payment unsuccessful — ((eventTitle))"
templateKey: ticketOrderFailed
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

We could not complete your payment for ((eventTitle)).

Date and time: ((eventDateTime))

Location: ((eventLocation))

Ticket: ((ticketTypeTitle))

Quantity: ((quantity))

Amount: ((totalFormatted))

Your booking is still in place. You can return to My Payments to try again:

((myPaymentsUrl))

Kind regards,

SODC Admin
