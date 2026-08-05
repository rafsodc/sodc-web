---
subject: "[SODC] New member awaiting approval"
templateKey: newUserPendingApprovalAlert
variables:
  - firstName
  - lastName
  - email
  - serviceNumber
  - serviceBackgroundSummary
  - requestedMembershipStatus
  - approveUsersUrl
---
A new member has completed their profile and is ready for review.

Name: ((firstName)) ((lastName))

Email: ((email))

Service number: ((serviceNumber))

Service background: ((serviceBackgroundSummary))

Requested status: ((requestedMembershipStatus))

---

Review the member in Approve Users:

((approveUsersUrl))

Kind regards,

SODC Admin
