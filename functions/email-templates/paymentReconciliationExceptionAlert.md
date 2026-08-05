---
subject: "[SODC] Payment reconciliation exception — ((orderId))"
templateKey: paymentReconciliationExceptionAlert
variables:
  - orderId
  - eventTitle
  - customerDisplay
  - exceptionType
  - exceptionNote
  - reconciliationDashboardUrl
  - stripeEventId
---
A payment reconciliation exception needs review.

Ticket order ID: ((orderId))

Event: ((eventTitle))

Member: ((customerDisplay))

Exception type: ((exceptionType))

Recorded note: ((exceptionNote))

Stripe event ID: ((stripeEventId))

---

Review the exception in the reconciliation dashboard:

((reconciliationDashboardUrl))

Kind regards,

SODC Admin
