# Member visibility and Potential lost review (#618)

## Directory

The section member callable verifies each candidate against Firebase Auth using
batches of at most 100 UIDs. Missing or unverified accounts are omitted. An Auth
lookup failure fails the request instead of exposing unverified members.

Verified members remain listed, but email and mobile are null unless contact
sharing is allowed and `profileReviewedAt` is valid and no older than two calendar
years. Missing review dates lock immediately. Explicit opt-out takes precedence;
expiry never overwrites the sharing preference. This applies to explicit group
members and status-inherited members. The six-month profile prompt is unchanged.
A successful profile confirmation refreshes the mounted directory. Verification
completes before the ordinary directory is mounted through the existing verified
account gate; reopening/refreshing the directory always rechecks Auth.

The existing directory queries explicitly support up to 5,000 users per source.
At that bound, the server rejects the result rather than silently presenting a
truncated member list. Larger directories will need paginated source queries.

## Admin workflow

**Manage users → Potential lost** reads current evidence on opening and Refresh,
with search and UI pagination. Server queries page through all profiles and Auth
users, so candidates do not depend on returning to the website or a scheduled job.
Each person appears once with every applicable reason:

- Last sign-in is more than three calendar years old.
- At least three distinct permanent email failures since the latest delivered
  message. Duplicate/replayed receipts do not increment this count.

For never-signed-in accounts, the Auth creation date starts the inactivity clock.
Imported accounts therefore accrue only observable time since creation on this
system; historical inactivity is not invented. Missing/invalid dates do not prove
inactivity. Profiles without an Auth account are omitted from this review flow.
Already-LOST members are excluded. Protected administrator accounts are shown
with the existing status-transition restriction and a disabled confirmation action.

A new login or delivery clears the relevant reason on the next refresh. There is
no persistent dismiss/defer action in this first version: administrators can leave
candidates pending. Flagging never changes access or membership, and receipts
(including recovery/replay) no longer change either automatically.

**Mark as Lost → Confirm Lost** re-reads Auth and profile evidence and rejects
changed evidence. The existing fail-closed membership helper revokes access before
an atomic conditional profile update plus `PotentialLostReview` audit insert.
The transaction compares membership status, update timestamp and delivery version.
The audit records reviewer, timestamp, previous status and reviewed evidence.
A failed conditional write reconciles claims with the actual stored status;
retrying a completed transition repairs claims without another audit entry.
The existing membership notification path runs for a successful new transition.
The application's existing `LOST` status represents the requested `ROLE_LOST`.

Calendar thresholds use UTC anniversaries with leap-day clamping. The exact
anniversary remains within the window; immediately afterwards it is overdue.
Auth and Data Connect are separate services: re-reading login evidence immediately
before confirmation minimises, but cannot make atomic, a simultaneous sign-in.

## Deployment and validation

Deploy the additive `PotentialLostReview` schema first. Replace the callback and
receipt-recovery functions before removing the obsolete automatic-lost connector
operation, then deploy the updated connector and remaining functions before the
frontend. Keep the old connector available while old callback instances drain;
do not remove its mutation while old instances can still call it.
No records are automatically reclassified or restored during deployment.

Automated tests cover directory redaction and Auth checks, calendar boundaries,
admin-only review, paged evidence, stale/conflicting confirmations, callback retries
and recovery, and the UI confirmation/error states. Manually verify the admin tab,
verified/unverified directory visibility and profile-review refresh on Dev before
production rollout.
