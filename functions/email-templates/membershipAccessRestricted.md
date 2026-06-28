---
subject: "Your SODC membership status has changed"
templateKey: membershipAccessRestricted
variables:
  - customerFirstName
  - membershipStatusLabel
  - previousStatusLabel
  - appUrl
---
Dear ((customerFirstName)),

Your SODC membership status has changed from ((previousStatusLabel)) to ((membershipStatusLabel)).

Your access to the member area has been restricted. If you think this is an error, or would like to discuss your membership, please reply to this email.

((appUrl))

SODC
