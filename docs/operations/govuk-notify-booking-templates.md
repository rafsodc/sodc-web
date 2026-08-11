# GOV.UK Notify: booking confirmation and revision templates

User-facing email after a successful **`submitEventBooking`** callable. Implementation: [`functions/src/bookingEmailDispatcher.ts`](../../functions/src/bookingEmailDispatcher.ts), wired from [`functions/src/bookings.ts`](../../functions/src/bookings.ts).

**No email** when the callable returns **`idempotentReplay: true`**.

**Source copy:** [`functions/email-templates/`](../../functions/email-templates/) (see the [template index](./govuk-notify-template-copy.md)).

## Configuration

| Logical key (code) | Firebase / runtime env var for template UUID |
|---------------------|-----------------------------------------------|
| `bookingConfirmation` | `GOV_NOTIFY_TEMPLATE_BOOKING_CONFIRMATION` |
| `bookingRevision` | `GOV_NOTIFY_TEMPLATE_BOOKING_REVISION` |

Also required: `GOV_NOTIFY_LIVE_API_KEY` (secret), optional `GOV_NOTIFY_EMAIL_REPLY_TO_ID`, and **`APP_BASE_URL`**.

## Triggers

| Template | When |
|----------|------|
| `bookingConfirmation` | First successful submit (no superseded booking) |
| `bookingRevision` | Submit supersedes a previous booking and creates a payment adjustment row |

## Template 1: booking confirmation — `bookingConfirmation`

| Key | Semantics |
|-----|-----------|
| `firstName` | Booker first name, or `Member` if unexpectedly blank |
| `eventTitle` | Event title |
| `eventDateTime` | Formatted start/end (en-GB) |
| `eventLocation` | Location or `To be confirmed` |
| `ticketLinesSummary` | Multiline bullet list of lines |
| `bookerDietaryNote` | Member ticket line dietary note or `None provided` (legacy variable name retained for template compatibility) |
| `accommodationSummary` | `Not requested` or `Requested — {note}` |
| `bookingTotalFormatted` | Sum of line prices, e.g. `£35.00` |
| `sectionBookingsUrl` | `APP_BASE_URL/sections/{sectionId}` |
| `myPaymentsUrl` | `APP_BASE_URL/payments` |

## Template 2: booking revision — `bookingRevision`

All keys from **bookingConfirmation**, plus:

| Key | Semantics |
|-----|-----------|
| `paymentAdjustmentStatus` | e.g. `Additional payment due`, `Refund due`, `No payment change required` |
| `previousTotalFormatted` | Prior revision total |
| `revisedTotalFormatted` | New revision total |
| `deltaAmountFormatted` | Signed delta, e.g. `+£15.00` |

## Related docs

- [environment-and-secrets.md](./environment-and-secrets.md)
- [payment-state-machine.md](../architecture/payment-state-machine.md) (ticket checkout vs booking adjustments)
