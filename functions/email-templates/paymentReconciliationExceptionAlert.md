---
subject: "[SODC OPS] Reconciliation exception — ((orderId))"
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
A payment reconciliation exception requires your attention.

**Order ID:** ((orderId))

**Event:** ((eventTitle))

**Customer:** ((customerDisplay))

**Exception type:** ((exceptionType))

**Note:** ((exceptionNote))

**Stripe event ID:** ((stripeEventId))

---

Review in the reconciliation dashboard:

((reconciliationDashboardUrl))

SODC Ops
