# Administrator email changes

Issue: [#613](https://github.com/rafsodc/sodc-web/issues/613).

In user management, open **Edit User Profile → Change email**. Enter the new
address, confirm it belongs to the selected user, and select **Change email**.
This action is separate from saving other profile fields. It requires an enabled
administrator and an existing Firebase Auth account and Data Connect profile.

The callable updates the existing Firebase UID, preserving the password, claims,
membership and related records. A different address is marked unverified and
refresh tokens are revoked. A verification link is sent through the existing
Notify workflow. If delivery fails, the screen still confirms the completed
update and tells the user to sign in with their new address and request another
verification email. Existing account restrictions continue to apply. An admin
changing their own address is signed out after acknowledging the result.

Revocation prevents refreshing old sessions; already-issued ID tokens can remain
valid until expiry. This feature does not claim immediate invalidation of every
existing ID token. See [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions).
Profile edits cannot restore the old email: ordinary/admin saves no longer write
email, onboarding creates only new rows, and member reconciliation reads fresh
Auth state rather than trusting a token's email claim.

## Recovery and audit

Auth is authoritative. A partial failure attempts to copy the current Auth email
back to the profile and reports an incomplete operation. Retry **the same new
address**, even if Auth already changed: the operation will reconcile the profile
and retry session revocation without resetting an already verified address.
A stale form trying to replace a different, more recent address is rejected.

Administrator changes and member reconciliation share a database lease per user.
Competing operations fail before touching Auth. A process crash leaves a lease
that expires after five minutes; retry after that interval. The callable timeout
is 60 seconds. Release/write operations are bound to the lease ID, and profile
writes require an unexpired lease. A persistently unavailable service requires
operator attention; no success is returned for an incomplete account update.

Cloud Logging events `admin user-email update started`, `admin user-email update completed`,
`admin user-email update incomplete` and `admin user-email update failed` record
the actor UID, target UID and outcome with the log timestamp. The existing profile
audit metadata records `updatedBy` and `updatedAt`. Addresses, verification links
and action codes are not logged. There is no new notification to the old address.

## Deployment and verification

Deploy the schema and API connector together, then Functions, then Hosting using
the normal environment deployment workflow. The added User lease columns have
defaults for existing profiles. Generated client/Admin SDKs are included.
Do not deploy only the frontend: email editing depends on `updateUserEmail` and
the new server-only lease operations. Older clients must refresh after deployment
because `UpdateUser` no longer accepts an email variable. `UpsertUser` now updates
existing profiles only; initial registration uses `CreateUserProfile`.

Automated coverage exercises authorisation, invalid/duplicate addresses,
unchanged addresses, stale forms, competing leases, partial writes, ambiguous Auth
responses, retries, revocation failures, delivery warnings and UI confirmation.

Before production rollout, use a disposable member in Dev/Beta to verify:

1. Change their email as an administrator; check that Auth and the profile agree
   and the UID, membership, roles and bookings are unchanged.
2. Confirm sign-in accepts the new email with the existing password and rejects
   the previous email. Verify the new address using the delivered link.
3. Save an already-open profile form from the old session; it must not restore
   the previous address.
4. Try a duplicate address, an unprivileged account and two simultaneous admin
   changes. Confirm clear errors and no silently divergent records.
5. Simulate a profile-write failure and retry the same address. Confirm recovery
   and inspect the audit events. Test the delivery-warning and own-email flows.

Live sign-in, Notify delivery and deployed Data Connect concurrency checks require
the target environment; local unit tests do not replace this rollout smoke test.
