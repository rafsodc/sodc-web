# Firebase Authentication email actions

The application handles Firebase Authentication email actions at `/auth/action`.
Issue #410 implements password reset; issue #411 extends the same route for email
verification. Firebase continues to generate and validate one-time action codes.

## Firebase Console configuration

Apply the following configuration separately to every Firebase project/environment:

1. In **Authentication → Settings → Authorised domains**, add the deployed application
   host for that environment. Do not add `localhost` to production projects.
2. In **Authentication → Templates → Password reset**, customise the action URL to:
   `https://<application-host>/auth/action`.
3. Review the password-reset sender name, subject, body, and reply-to address. Do not put
   passwords, action codes, or account-existence claims into custom copy.
4. Confirm Firebase Hosting continues to rewrite `/auth/action` and
   `/account/password-reset` to `index.html` so both routes support direct navigation.

`sendPasswordResetEmail` supplies an application-owned continue URL ending in `/account`.
The completion page does not redirect to the incoming `continueUrl`; after success it offers
a fixed link to the sign-in route. This prevents an attacker-controlled action URL from becoming
an open redirect.

## Runtime behaviour

1. The request page normalises and validates the submitted email locally.
2. The UI uses the same neutral confirmation for a successful request and Firebase's legacy
   `auth/user-not-found` response, avoiding an account-existence disclosure.
3. The action page accepts only `mode=resetPassword` with a non-empty `oobCode`.
4. It calls `verifyPasswordResetCode` before showing the new-password form.
5. It validates the new password using the registration/change-password policy, then calls
   `confirmPasswordReset`.
6. It does not sign the user in automatically. Firebase password resets revoke existing refresh
   tokens, so the user is directed to authenticate again with the new password.

The application must never log complete action URLs, out-of-band codes, or passwords.

## Manual end-to-end check

Run this check in a non-production environment before promoting the change:

1. Open `/account`, choose **Forgot password?**, and submit a known email/password account.
2. Confirm the UI shows a neutral response that does not reveal whether the account exists.
3. Open the email and verify its link lands on `/auth/action` in the same environment.
4. Set a password shorter than the application minimum and confirm it is rejected locally.
5. Set a valid password and confirm the page directs you back to sign in without automatically
   authenticating you.
6. Sign in with the new password and confirm the old password no longer works.
7. Reopen the used link and confirm it shows the invalid/expired recovery state.
8. Repeat with an expired or deliberately altered `oobCode`, a wrong `mode`, and an unknown email.
9. Confirm a signed-in but unverified user can still open the public action route.

References:

- [Firebase custom email action handlers](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase password reset](https://firebase.google.com/docs/auth/web/manage-users#send_a_password_reset_email)
- [Firebase session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions)
