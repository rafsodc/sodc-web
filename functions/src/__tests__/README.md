# Functions test layout

Functions tests are grouped by the domain whose behaviour they protect. Keep
shared Vitest setup in `setup.ts`; new test files belong in one of these domain
folders:

| Folder | Ownership |
| --- | --- |
| `announcements/` | Announcement composition, recipients and delivery orchestration |
| `bookings/` | Booking rules, revisions, approvals, persistence and booking-owned email behaviour |
| `email-templates/` | Template manifests, copy contracts, binding configuration and reply-to configuration |
| `guest-tickets/` | Reserved for standalone guest-ticket workflows; guest behaviour owned by booking submission remains in `bookings/` |
| `legacy-user-migration/` | One-time legacy-user migration, review and CLI contracts |
| `notifications/` | Shared mailer, GOV.UK Notify, callback, receipt and recovery infrastructure |
| `payments/` | Checkout, ticket orders, Stripe webhooks, reconciliation and payment-owned email behaviour |
| `sections/` | Section access, section files and malware-scanning integration |
| `users-auth/` | Authentication, membership status, user approval and user search |
| `cross-cutting/` | Shared helpers, validation and rate limiting |
| `cross-cutting/contracts/` | Repository, build, schema, deployment and security boundary contracts |

Prefer the owning feature domain when a test crosses infrastructure boundaries.
For example, booking confirmation email orchestration belongs in `bookings/`,
while the reusable notification delivery mechanism belongs in `notifications/`.

The test-layout contract prevents test files from returning to the root or being
placed in an undocumented domain. Vitest discovers tests recursively, and the
production build continues to exclude every `__tests__` directory and
`*.test.ts`/`*.spec.ts` file.
