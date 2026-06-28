---
subject: "[SODC OPS] Payment dispute — ((orderId))"
templateKey: paymentDisputeOpsAlert
variables:
  - orderId
  - eventTitle
  - customerDisplay
  - disputeStripeStatus
  - disputeReason
  - disputeLocalState
  - stripeDisputeId
  - stripeEventType
  - reconciliationDashboardUrl
  - stripeEventId
---
A payment dispute event has been received.

**Order ID:** ((orderId))

**Event:** ((eventTitle))

**Customer:** ((customerDisplay))

**Dispute ID:** ((stripeDisputeId))

**Stripe status:** ((disputeStripeStatus))

**Reason:** ((disputeReason))

**Local state:** ((disputeLocalState))

**Stripe event type:** ((stripeEventType))

**Stripe event ID:** ((stripeEventId))

---

Review in the reconciliation dashboard:

((reconciliationDashboardUrl))

SODC Ops
