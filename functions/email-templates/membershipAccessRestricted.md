---
subject: "Your SODC membership status has changed"
templateKey: membershipAccessRestricted
variables:
  - firstName
  - membershipStatusLabel
  - previousStatusLabel
  - appUrl
---
Hello ((firstName)),

Your SODC membership status has changed from ((previousStatusLabel)) to ((membershipStatusLabel)).

Your access to the member area has therefore changed.

View SODC online:

((appUrl))

Kind regards,

SODC Admin
