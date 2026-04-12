# Booking data model (proposed)

This document captures the **proposed** persistence for member ticket booking. It aligns with [GitHub issue #45](https://github.com/rafsodc/sodc-web/issues/45) and epic [#52](https://github.com/rafsodc/sodc-web/issues/52). Implementation may evolve; update this doc when the schema lands.

## Decisions (from issue discussion)

- **Guest cap before moderator approval**: stored **per event** on `Event` (e.g. total guest headcount allowed without extra approval — exact field name TBD in schema).
- **Ticket types**: each `TicketType` has an **audience** of **`MEMBER`** or **`GUEST`** (not “self/guest” naming). Validation in the booking rules layer must prevent booking a `GUEST` type against the member line and vice versa; pricing can differ per type.
- **Authorization** (section `ACCESS` / `MODERATOR`, `BOOKER`, booking window, `TicketType.userGroup`) remains as documented elsewhere — not all shown on this ERD.

## Entity relationship diagram

```mermaid
erDiagram
  Section ||--o{ Event : contains
  Event ||--o{ TicketType : defines
  Event ||--o{ Booking : has
  User ||--o{ Booking : books_as_booker
  Booking ||--o{ BookingLine : has
  TicketType ||--o{ BookingLine : priced_as
  UserGroup ||--o{ TicketType : eligibility
  Booking ||--o{ GuestTicketRequest : may_raise

  Section {
    uuid id PK
    string name
    enum section_type
  }

  Event {
    uuid id PK
    uuid section_id FK
    string title
    timestamp booking_start
    timestamp booking_end
    int max_guests_without_moderator_approval "NEW: cap on total guests without extra approval"
  }

  TicketType {
    uuid id PK
    uuid event_id FK
    uuid user_group_id FK
    enum audience "NEW: MEMBER | GUEST"
    string title
    float price
    int sort_order
  }

  User {
    string id PK
    enum membership_status
  }

  UserGroup {
    uuid id PK
    string name
  }

  Booking {
    uuid id PK
    uuid event_id FK
    string booker_user_id FK
    enum status "e.g. DRAFT | SUBMITTED | CONFIRMED | CANCELLED"
    timestamp created_at
    timestamp updated_at
  }

  BookingLine {
    uuid id PK
    uuid booking_id FK
    uuid ticket_type_id FK
    string guest_user_id FK "nullable: named member guest"
    string guest_display_name "nullable: non-member guest label"
    string dietary_note "nullable; see seating or dietary issue"
    int sort_order
  }

  GuestTicketRequest {
    uuid id PK
    uuid booking_id FK
    enum status "PENDING | APPROVED | REJECTED"
    int requested_guest_count "shape TBD vs line-level detail"
    string reviewed_by_user_id "nullable"
    timestamp reviewed_at
    string moderator_note "nullable"
  }
```

## Relationship notes

| Relationship | Meaning |
|--------------|--------|
| **Event → TicketType** | Event offers priced **MEMBER** and **GUEST** types; eligibility for each type is still via `TicketType.userGroup`. |
| **Event → new field** | Per-event limit on **total guest** headcount before additional moderator approval (semantics enforced in booking rules). |
| **Booking** | One **booker** (`User`) for one **event**. |
| **BookingLine** | Each row is a ticket line referencing a **`TicketType`**; the type’s **`audience`** must match use (**MEMBER** for the booker, **GUEST** for guests). Optional guest identity fields. |
| **GuestTicketRequest** | Rows for **extra** guests that need **moderator approval** beyond the standard flow; ties to [#48](https://github.com/rafsodc/sodc-web/issues/48). |

## Related issues

| Issue | Topic |
|-------|--------|
| [#45](https://github.com/rafsodc/sodc-web/issues/45) | Data model: bookings, attendees, guest requests |
| [#46](https://github.com/rafsodc/sodc-web/issues/46) | Booking rules engine |
| [#48](https://github.com/rafsodc/sodc-web/issues/48) | Moderator approval for extra guests |
| [#49](https://github.com/rafsodc/sodc-web/issues/49) | Dietary, seating, accommodation |
| [#52](https://github.com/rafsodc/sodc-web/issues/52) | Parent epic |

## Schema source of truth

When implemented, the canonical definitions live in [`dataconnect/schema/schema.gql`](../../dataconnect/schema/schema.gql). Update this document after enums and table names are finalized.
