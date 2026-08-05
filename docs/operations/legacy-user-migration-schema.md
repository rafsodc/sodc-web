# Legacy-user migration target schema

Issue #418 prepares Data Connect for the canonical
`sodc-legacy-user/v1` records exported by `rafsodc/sodc-api`.

The encrypted JSONL artifact is the only boundary between the systems. Plaintext
records, password hashes, decryption keys, and PII reports must remain outside
Git, GitHub, chat, normal logs, and CI artifacts.

## Canonical mapping

| Export field | Destination | Rule |
|---|---|---|
| `legacyUserId` | `LegacyUserIdentity.legacyUserId` | Required UUID; immutable provenance key |
| `oldUid` | `LegacyUserIdentity.oldUid` | Nullable legacy numeric identifier retained as provenance only; never used as an identity key |
| `email` | Firebase Auth and `User.email` | Trim, lowercase, validate, and reconcile collisions before writes. An explicitly approved invalid-email exception may be imported only as a disabled email-less Auth identity with `User.email=""` and `membershipStatus=LOST`. |
| `firstName`, `lastName` | `User.firstName`, `User.lastName` | Trim; blank values fail closed |
| `serviceNumber` | `User.serviceNumber` | Trim; blank or missing values become `N/A` |
| `mobileNumber` | `User.mobileNumber` | Normalise valid values to E.164; blank values remain null for first-login review |
| `postNominals` | `User.postNominals` | Trim; blank values become null |
| `rank` | `User.rank` | Preserve canonical values; null becomes `Not specified` |
| `membershipStatus` | `User.membershipStatus` | Direct mapping to the existing enum |
| `isShared` | `User.shareContactInfo` | Direct mapping; controls server-side disclosure of email and mobile number |
| `hasSubscriptions` | `User.announcementOptOutAll` | Invert: `announcementOptOutAll = !hasSubscriptions` |
| `passwordHash` | Firebase Authentication plus `User.legacyPasswordMigrated` evidence | The hash is never stored in Data Connect. The nullable marker is true only when a migration-created Auth account received the proven-compatible legacy bcrypt hash; false means that account required password reset; null means the migration did not create that Auth account. |

## Migration write boundary

The admin connector exposes two server-only operations:

- `CreateMigratedUserProfileAndIdentity` uses `user_insert` and
  `legacyUserIdentity_insert` in one Data Connect transaction. It deliberately
  fails if the canonical profile or mapping already exists.
- `LinkLegacyIdentityToExistingUser` inserts provenance only. The importer may
  call it after independently proving that an existing Firebase/Data Connect
  user is the correct canonical identity.

Neither operation accepts `passwordHash`. Both accept nullable `oldUid` as
provenance only. The mapping records the source system, legacy UUID, old numeric
UID, canonical user, batch UUID, record-schema version, source checksum, and
import timestamp.

`legacyPasswordMigrated` is historical migration evidence, not a live activity
flag. For migration-created accounts it records whether the legacy credential
was imported successfully. It remains unchanged after a password reset or
sign-in. To determine whether a member has subsequently used the new site,
combine this marker with Firebase Auth's `lastSignInTime`; do not treat the
marker alone as proof of current inactivity.

## Staged profile completion

`mobileNumber` is nullable in Data Connect because the current preflight has
316 blank values. New registrations require a valid mobile number. Migrated
members with no number are expected to provide one during the profile-review
flow in #416.

The application normalises common UK input such as `07700 900123` to
`+447700900123`. International input must include its country code. The
importer in #419 must apply equivalent E.164 validation and quarantine
non-empty values that cannot be interpreted safely.

`profileReviewedAt` remains null for migrated users until they complete the
profile-review dialog. The dialog appears after email verification and enabled
account gates, persists profile corrections and the server review timestamp in
one Data Connect write, and requires missing mobile/rank details to be resolved.

The executable dry-run, apply, resume, and production approval procedure is in
[`legacy-user-import.md`](legacy-user-import.md). The preflight report this
schema describes can be turned into a structured review worksheet with the
tooling in
[`legacy-user-migration-review.md`](legacy-user-migration-review.md). The
sequenced rehearsal-to-cutover procedure is in
[`legacy-user-migration-runbook.md`](legacy-user-migration-runbook.md).

## Announcement preferences

`announcementOptOutAll` is the master preference for optional section
announcements:

- it takes precedence over every per-section preference;
- it automatically covers sections added in the future;
- per-section preferences remain stored and resume if the master opt-out is
  disabled; and
- it does not suppress password, verification, account-security, booking,
  payment, or other required transactional messages.

The migration maps the 55 preflight records with `hasSubscriptions=false` to
`announcementOptOutAll=true`.

## Deployment order

Deploy the Data Connect schema and connector before deploying Functions or
Hosting. Generated client and admin SDKs reference the new fields and
operations.
