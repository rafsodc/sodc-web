# Submit event booking (callable API)

Server-side enforcement for issue **#46**. Member UI (**#47**) should call this instead of writing bookings directly via Data Connect.

For payment lifecycle transitions and webhook semantics, see
`docs/architecture/payment-state-machine.md`.

## Callable

| Field | Value |
|--------|--------|
| **Name** | `submitEventBooking` |
| **Region** | `europe-west2` (see `functions/src/constants.ts`) |
| **Auth** | Firebase Auth required; custom claim **`enabled: true`** (same bar as Data Connect user operations) |

## Request (`data`)

| Field | Type | Required | Description |
|--------|------|------------|-------------|
| `idempotencyKey` | string (UUID) | yes | **Per submit attempt** — generate a new UUID (v4) when the user commits; **reuse the same value** on retries after network errors so the server returns the same booking instead of creating another |
| `eventId` | string (UUID) | yes | Event being booked |
| `lines` | array | yes | Non-empty list of line items (see below) |
| `baseBookingId` | string (UUID) | no | Required for mutable-booking revision updates once a terminal revision exists |
| `baseRevisionNumber` | integer | no | Required with `baseBookingId`; optimistic concurrency guard |

### Idempotency semantics

- The database enforces **uniqueness of `(event, booker, clientSubmissionKey)`** on `Booking` (see `dataconnect/schema/schema.gql`). The callable maps `idempotencyKey` → `clientSubmissionKey`.
- **Replay (success, no duplicate writes):** If a **SUBMITTED** or **CONFIRMED** booking already exists for this event and booker with the same `idempotencyKey`, the callable returns **`idempotentReplay: true`** and the existing `bookingId` / `status`.
- **Revision lineage:** Bookings now carry `revisionGroupId`, `revisionNumber`, and optional `supersedesBookingId`.
- **Optimistic concurrency:** When terminal revisions already exist, caller must provide `baseBookingId` + `baseRevisionNumber` for the latest terminal revision. Stale base inputs fail with conflict semantics.
- **Draft conflict:** If a **DRAFT** exists for this event with a **different** `clientSubmissionKey` (including legacy drafts with a null key), the call fails with `IDEMPOTENCY_DRAFT_CONFLICT` until that draft is cleared or the client retries with the matching key.
- **Concurrent creates:** If two requests race with the same key, one insert wins; the other may hit a unique violation, refetch, and continue using the winner’s draft (or replay if already completed).

### Line object

| Field | Type | Required | Description |
|--------|------|------------|-------------|
| `ticketTypeId` | string (UUID) | yes | Must belong to the event |
| `sortOrder` | integer | yes | Sort key; member lines should sort before guest lines |
| `guestUserId` | string \| null | no | Linked guest user (Firebase UID), for guest-priced lines |
| `guestDisplayName` | string \| null | no | Free-text guest label when not linking a user |
| `dietaryNote` | string \| null | no | Optional note (validation expanded in #49) |

## Success response

```json
{
  "bookingId": "<uuid>",
  "status": "SUBMITTED",
  "idempotentReplay": false
}
```

When the booking was already completed with the same idempotency key:

```json
{
  "bookingId": "<uuid>",
  "status": "SUBMITTED",
  "idempotentReplay": true
}
```

## Errors

Uses HTTPS callable errors. Prefer inspecting **`error.details.code`** (string) for stable handling.

| `details.code` | Typical HTTP mapping | Meaning |
|----------------|----------------------|---------|
| `NO_SECTION_ACCESS` | `permission-denied` | User cannot access the section (ACCESS/MODERATOR path) |
| `NOT_AUTHORIZED_BOOKER` | `permission-denied` | User is not in a BOOKER-purpose group for the section |
| `NO_BOOKER_PURPOSE` | `failed-precondition` | Section has no BOOKER purpose rows |
| `OUTSIDE_BOOKING_WINDOW` | `failed-precondition` | Outside `bookingStartDateTime`–`bookingEndDateTime` |
| `BOOKING_ALREADY_SUBMITTED` | `failed-precondition` | A SUBMITTED/CONFIRMED booking already exists for this user and event (and this call is not a replay of the same idempotency key) |
| `IDEMPOTENCY_DRAFT_CONFLICT` | `failed-precondition` | Another DRAFT exists for this event (different or missing idempotency key) |
| `TICKET_TYPE_NOT_FOUND` | `failed-precondition` | Unknown ticket type or not on this event |
| `INELIGIBLE_TICKET_TYPE` | `failed-precondition` | User does not match the ticket type’s `userGroup` |
| `SELF_TICKET_REQUIRED` | `failed-precondition` | No member-priced line for the booker |
| `GUEST_BEFORE_SELF` | `failed-precondition` | Guest line ordered before member line |
| `TOO_MANY_GUEST_LINES` | `failed-precondition` | More than one guest-priced line without moderation path |
| `INVALID_GUEST_FIELDS` | `failed-precondition` | Inconsistent guest naming vs ticket audience |

Other `invalid-argument` / `not-found` errors apply to bad input or missing event/section.

## Implementation

- Rules: `functions/src/bookingRules.ts`
- Callable: `functions/src/bookings.ts` (`submitEventBooking`)
- Draft creation for the callable: `CreateBookingDraftForUser` in `dataconnect/api/admin-mutations.gql` (explicit `bookerId`, **not** `auth.uid` from the Data Connect service account)
