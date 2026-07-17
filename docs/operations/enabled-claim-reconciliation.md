# Enabled-claim reconciliation

Firebase Auth's `enabled` custom claim is the application access boundary used by
Functions and Data Connect. The user's Data Connect `membershipStatus` is the source
of truth for that claim:

| Membership status | `enabled` |
|---|---:|
| `REGULAR`, `RETIRED`, `RESERVE`, `INDUSTRY`, `CIVIL_SERVICE` | `true` |
| `PENDING`, `RESIGNED`, `LOST`, `DECEASED` | `false` |

The rule applies to administrators too. The `admin` claim is preserved when access is
revoked, but it never forces `enabled: true`; `requireAdmin` requires both claims.

## Write ordering

Membership changes span Data Connect and Firebase Auth, which cannot share a single
transaction. `updateMembershipStatus` therefore uses fail-closed ordering:

- Restricting access writes `enabled: false` before storing the restricted status.
- Granting access stores the non-restricted status before writing `enabled: true`.
- Auth claim errors are logged and returned as callable failures; they are not ignored.

This ensures a partial failure cannot leave a restricted status with newly granted
access. A failed restriction may temporarily leave an old active status with access
already revoked, while a failed activation may leave an active status disabled. Both
cases are repaired through the same idempotent reconciliation path below.

## Automatic reconciliation paths

- Admin and self-service status changes reconcile the claim in
  `functions/src/membershipStatus.ts`.
- A Notify permanent-failure threshold that marks a member `LOST` reconciles the claim
  before its delivery receipt is marked processed.
- If that Notify claim write fails, the receipt is marked `FAILED`. Reclaiming the same
  receipt retries reconciliation even though the Data Connect status is already `LOST`.

## Detecting drift

Investigate Functions logs for either of these messages:

- `Could not reconcile enabled claim with membership status`
- `Membership access was revoked but the status write failed`

Compare the user's Data Connect `membershipStatus` with their Firebase Auth custom
claims using the mapping above. Do not remove unrelated claims while repairing access.

## Repair procedure

1. Confirm the intended membership status with an authorised administrator.
2. Open the user's profile in the admin membership workflow and save it with the
   intended status selected. Admin saves invoke `updateMembershipStatus` even when the
   status is unchanged; the callable treats that as a claim-reconciliation request and
   preserves all other custom claims.
3. Confirm the callable succeeds and the Auth `enabled` claim matches the table above.
4. Ask the affected user to sign out and back in, or otherwise refresh their Firebase ID
   token, before testing access.
5. For a Notify-derived `LOST` transition, also confirm the originating
   `NotifyDeliveryReceipt` is `PROCESSED`. A `FAILED` row remains eligible for replay
   with its original receipt ID.

If a restriction revoked access but its Data Connect status write failed, either submit
the intended restricted status to complete the change or re-submit the stored active
status to restore access. Record which action was authorised.
