# Submit event booking (callable API)

Server-side enforcement for issues **#46** and **#544**. Member UI submits the complete member-and-guest booking through this callable instead of writing bookings directly or following with a second guest-request call.

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
| `lines` | array | yes | Complete list of 1–100 attendee line items (see below); exactly one member line and every guest line must be present |
| `baseBookingId` | string (UUID) | no | Required for mutable-booking revision updates once a terminal revision exists |
| `baseRevisionNumber` | integer | no | Required with `baseBookingId`; optimistic concurrency guard |

### Idempotency semantics

- The database enforces **uniqueness of `(event, booker, clientSubmissionKey)`** on `Booking` (see `dataconnect/schema/schema.gql`). The callable maps `idempotencyKey` → `clientSubmissionKey`.
- **Replay (success, no duplicate writes):** If a **SUBMITTED** or **CONFIRMED** booking already exists for this event and booker with the same `idempotencyKey`, the callable returns **`idempotentReplay: true`** and the existing outcome.
- **Revision lineage:** Bookings now carry `revisionGroupId`, `revisionNumber`, and optional `supersedesBookingId`.
- **Optimistic concurrency:** When terminal revisions already exist, caller must provide `baseBookingId` + `baseRevisionNumber` for the latest terminal revision. The database also enforces uniqueness of `(revisionGroupId, revisionNumber)`, so two concurrent amendments from one base cannot both commit.
- **No partial draft:** The booking, new stable places, and all lines commit in one Data Connect transaction directly to `SUBMITTED`. A failed transaction leaves none of those rows behind.
- **Legacy draft conflict:** Pre-redesign DRAFT rows fail with `IDEMPOTENCY_DRAFT_CONFLICT` until final migration/cleanup in #548.

### Line object

| Field | Type | Required | Description |
|--------|------|------------|-------------|
| `ticketTypeId` | string (UUID) | yes | Must belong to the event |
| `sortOrder` | integer | yes | Sort key; the member line must sort before guest lines |
| `guestUserId` | string \| null | no | Linked guest user (Firebase UID), for guest-priced lines |
| `guestDisplayName` | string \| null | no | Free-text guest label when not linking a user |
| `dietaryNote` | string \| null | no | Optional attendee dietary requirements, stored on this exact ticket line |

## Success response

```json
{
  "bookingId": "<uuid>",
  "status": "SUBMITTED",
  "approvalStatus": "NOT_REQUIRED",
  "outcome": "READY_FOR_PAYMENT",
  "paymentReady": true,
  "idempotentReplay": false
}
```

When the booking was already completed with the same idempotency key:

```json
{
  "bookingId": "<uuid>",
  "status": "SUBMITTED",
  "approvalStatus": "PENDING",
  "outcome": "PENDING_APPROVAL",
  "paymentReady": false,
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
| `SELF_TICKET_REQUIRED` | `failed-precondition` | The request does not contain exactly one member-priced line for the booker |
| `GUEST_BEFORE_SELF` | `failed-precondition` | Guest line ordered before member line |
| `INVALID_GUEST_FIELDS` | `failed-precondition` | Inconsistent guest naming vs ticket audience |
| `BOOKING_REVISION_BASE_REQUIRED` | `failed-precondition` | Amendment omitted its exact base booking/revision |
| `BOOKING_REVISION_BASE_NOT_FOUND` | `failed-precondition` | Amendment base is no longer present |
| `BOOKING_REVISION_CONFLICT` | `aborted` | Another revision committed first; refetch before retrying |
| `PAID_BOOKING_PLACE_REMOVAL_REQUIRES_REFUND` | `failed-precondition` | Amendment removes/transfers a paid stable place; refund workflow is not implemented yet |

Other `invalid-argument` / `not-found` errors apply to bad input or missing event/section.

## Post-submit email

After a successful approval-eligible submit (`idempotentReplay: false`), Functions send a GOV.UK Notify email to the booker:

- **`bookingConfirmation`** — first booking for this submit (no superseded booking).
- **`bookingRevision`** — submit supersedes a prior booking and records a payment adjustment.

**No email** when the callable returns **`idempotentReplay: true`**, or while a new/revised booking is `PENDING` whole-booking approval. Pending/approval/rejection notifications are added by #547.

See [`docs/operations/transactional-email-workflows.md`](../operations/transactional-email-workflows.md) and [`govuk-notify-booking-templates.md`](../operations/govuk-notify-booking-templates.md).

## Implementation

- Rules: `functions/src/bookingRules.ts`
- Callable: `functions/src/bookings.ts` (`submitEventBooking`)
- Stable-place planning and typed persistence contract: `functions/src/bookingSubmissionPersistence.ts`
- Atomic Data Connect operations: `dataconnect/booking-service/booking-submission.gql`
- Email: `functions/src/bookingEmailDispatcher.ts`

The server-only `booking-service` connector exists because Firebase Data Connect supports `_Data` batch variables in deployed operations but its JavaScript SDK generator does not currently generate wrappers for them. Functions invokes the named, schema-validated operations using explicit TypeScript variable interfaces. It does not use Admin SDK generic `insertMany`, including for the temporary legacy guest-request compatibility path.
