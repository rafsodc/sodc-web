---
subject: "[SODC] Payment dispute — ((orderId))"
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
A Stripe payment dispute needs review.

Ticket order ID: ((orderId))

Event: ((eventTitle))

Member: ((customerDisplay))

Stripe dispute ID: ((stripeDisputeId))

Stripe dispute status: ((disputeStripeStatus))

Stripe dispute reason: ((disputeReason))

SODC dispute state: ((disputeLocalState))

Stripe event type: ((stripeEventType))

Stripe event ID: ((stripeEventId))

---

Review the dispute in the reconciliation dashboard:

((reconciliationDashboardUrl))

Kind regards,

SODC Admin
