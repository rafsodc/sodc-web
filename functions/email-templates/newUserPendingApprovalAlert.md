---
subject: "[SODC] New member awaiting approval — ((firstName)) ((lastName))"
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
A new member has completed their profile and is awaiting approval.

Name: ((firstName)) ((lastName))
Email: ((email))
Service number: ((serviceNumber))
Service background: ((serviceBackgroundSummary))
Requested status: ((requestedMembershipStatus))

Review in Approve Users:
((approveUsersUrl))
