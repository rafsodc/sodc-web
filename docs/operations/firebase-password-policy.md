# Firebase Authentication password policy

The application treats each environment's Firebase Authentication password
policy as authoritative. The browser calls Firebase `validatePassword()` for
new passwords during registration, password reset, and password change; it does
not reproduce complexity rules in application code. Sign-in credentials go
directly to Firebase Authentication, which applies the configured enforcement
state and force-upgrade setting. Passwords are never sent to Functions or Data
Connect.

## Required environment setup

Repeat these steps independently in **Dev**, **Beta**, and **Prod**. Configuring
one Firebase project does not configure the others.

1. Open Firebase Console → Authentication → Settings → Password policy for the
   exact target project.
2. Set a minimum length of **12 characters**. Do not add composition rules
   unless they have been separately approved and tested with the member UX.
3. During rollout, use the policy's notification/monitoring mode and exercise
   registration, reset, change-password, and representative migrated-password
   sign-ins.
4. After the environment passes those checks, enable enforcement and
   **force upgrade on sign-in**. When Firebase rejects an otherwise valid
   credential because its password is no longer compliant, the site directs
   the member to the GOV.UK Notify-backed reset journey.
5. Record the target project, operator, date, policy requirements, enforcement
   state, and test evidence in the release record.

The new-password check improves the member-facing explanation. For sign-in,
Firebase's policy error triggers the reset explanation; the application does
not pre-check the submitted credential because doing so would bypass monitoring
mode and could misreport an ordinary typo as a policy failure. Firebase
enforcement is the security boundary. Do not enable forced upgrade in Prod
until Beta proves compatible imported passwords continue to sign in and
non-compliant passwords reach the reset journey.

## Verification

For each environment, confirm:

- a compliant migrated credential signs in without an unnecessary reset;
- a non-compliant credential is directed to reset before normal site access;
- a passwordless migrated identity can set a compliant password from the
  in-app reset email;
- registration, reset, and Account settings display requirements returned by
  Firebase and reject a non-compliant password; and
- email verification still precedes the six-month details review.

Never place real passwords, reset links, action codes, or member email
addresses in screenshots, logs, issues, or CI artifacts.
