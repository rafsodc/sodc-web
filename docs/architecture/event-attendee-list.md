# Names-only event attendees (#616)

The event details page shows attendees to signed-in, enabled users who can view
the event through its section. Explicit access groups, membership-based access,
section moderators and administrators follow the existing section access rules.
Having a booking is not required. Anonymous visitors and guest payment links
do not grant access.

`getEventAttendees` checks access before running the server-only names query.
Its response is `{ attendees: [...] }`. Each entry contains only `firstName` and
`lastName`, or `displayName` for an unlinked guest whose legacy record stores a
single name. No IDs, dietary requirements, contact information, ticket details,
approval status or payment information reach the browser in this response.

Attendance follows the existing organiser ticket list: submitted and confirmed
bookings with approved or unnecessary approval, including unpaid bookings.
Draft, cancelled, rejected, pending and superseded revisions are excluded.
Where a pending revision leaves an earlier approved revision active, that earlier
revision remains visible. Only the latest eligible revision per revision group
is used. Distinct ticket places with identical names remain separate entries.

Members and linked guests use their structured profile names and sort by surname,
then first name. Legacy guest names are preserved intact and sorted by their full
entered name; missing names are omitted rather than guessed. The interface pages
the sorted names in groups of 50, with loading, empty and retry states. Lists are
cached separately per viewer and discarded when unmounted; completing a booking
invalidates the event's list.

Organiser-managed guests (#615) are not yet implemented. Their names should join
this response when that booking model is added. Full organiser attendee views
are unchanged.
