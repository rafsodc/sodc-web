# Event attendee tab (#616, #620)

The event details page has a separate Attendees tab showing attendees to signed-in, enabled users who can view
the event through its section. Explicit access groups, membership-based access,
section moderators and administrators follow the existing section access rules.
Having a booking is not required. Anonymous visitors and guest payment links
do not grant access.

`getEventAttendees` checks access before running the server-only attendee query.
Its response is `{ attendees: [...] }`. Each entry contains `firstName` and
`lastName`, or `displayName` for an unlinked guest whose legacy record stores a
single name, plus `audience` (MEMBER/GUEST), `includesSymposium` and `includesDinner`. These two booleans
come directly from the current booking line's ticket type; no ticket title or
price is returned. This is the explicitly authorised expansion of #616's original
names-only response. No IDs, dietary requirements, contact information, approval
status or payment information reach the browser in this response.

Attendance follows the existing organiser ticket list: submitted and confirmed
bookings with approved or unnecessary approval, including unpaid bookings.
Draft, cancelled, rejected, pending and superseded revisions are excluded.
Where a pending revision leaves an earlier approved revision active, that earlier
revision remains visible. Only the latest eligible revision per revision group
is used. Distinct ticket places with identical names remain separate entries.
The query filters out inactive bookings in the database and reads all matching
bookings in explicit pages of 500, ordered by booking ID. Revision selection runs
across all pages, avoiding Data Connect's implicit 100-row query limit.

Bookings sort by the booking member's surname, then first name, ignoring case.
Each booking member is followed immediately by their own guests, sorted by surname
and first name within that booking. Legacy guest names are preserved intact and
sorted by their full entered name; missing names are omitted rather than guessed.
Identically named bookers remain separate groups using internal booking identity;
no booking IDs or additional personal fields are returned. The interface pages
the sorted attendees in groups of 50, with loading, empty and retry states.
The responsive table always shows Name and Type (Member/Guest). Audience describes
the ticket place, not the account's membership status: linked guests remain Guest.
Symposium and Dinner columns appear only when at least one of the event's ticket
types offers that option, independent of current bookings or the displayed page.
These columns use explicit Yes/No labels with row/column headers. About retains its booking button without an attendee
list above it. Attendee data is fetched only when its tab is selected. Lists are
cached separately per viewer and discarded when unmounted; completing a booking
invalidates the event's list.

Organiser-managed guests (#615) are not yet implemented. Their names should join
this response when that booking model is added. Full organiser attendee views
are unchanged.

Deploy the updated connector and attendee callable before the frontend so the
two attendance flags are available when the new tab is released.
