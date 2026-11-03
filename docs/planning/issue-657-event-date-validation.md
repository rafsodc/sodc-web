# Event date validation — issue #657

CreateEvent and UpdateEvent keep all four existing `Timestamp!` inputs required.
GraphQL scalar coercion rejects omitted, null, blank, malformed and invalid-calendar
timestamps before mutation execution. Their input/output types and optional event
text fields do not change.

The two independent range rules allow equal instants:

- Event end must be at or after event start. A reversed range returns
  `EVENT_END_BEFORE_START` for the event end field.
- Booking closing must be at or after booking opening. A reversed range returns
  `BOOKING_END_BEFORE_START` for the booking closing field.

Equality preserves existing same-instant defaults and zero-duration booking
windows; the existing inclusive eligibility at that exact instant is unchanged.
There is no new rule relating booking dates to event dates, or restricting
dates to the future. Timestamps are compared as instants, including explicit UTC
offsets, rather than as strings or local clock readings.

Both checks run on the initial redacted query step, after its existing current
authorization and section-management checks and before any write. Existing
transactional canonical save responses, stable IDs, authority checks and audit
fields remain intact. An invalid update cannot change another event field or its
audit timestamps. Scalar-coercion failures retain the service's native input error;
the application-specific codes above describe reversed, otherwise valid ranges.

## Local form input

The event editor requires all four local date-and-time inputs before starting a
write receipt or mutation. Both modal and embedded editors retain invalid input,
show field-specific feedback and focus the first invalid field. Correction permits
the normal explicit save. The manager repeats validation at its mutation boundary.

Local calendar rollover and nonexistent local times during a spring DST gap are
rejected instead of silently normalized. Ambiguous times during the autumn clock
change retain JavaScript Date's existing earlier-occurrence interpretation; this
change does not introduce an offset/occurrence selector. The parser supports seconds
and fractional seconds. Its general date-only helper can represent midnight, while
the event form requires a date and time. Pair comparisons use the converted instants
and retain the same equality and independent-booking-window policy as the server.

## Server verification

The local section-permissions integration suite exercises the actual compiled
connector and a disposable Data Connect/PostgreSQL instance. Direct named mutation
calls bypass the form and cover both create/update, global admins, explicit and
status-derived moderators, equality, offset comparisons across spring/autumn clock
changes, an independent booking window after the event, malformed/missing values,
and denied/stale callers. Rejected writes compare all event scalar and audit fields
before/after. The normal authorization matrix and canonical-save tests remain in
the same suite.

Run the existing guarded local runner with Node 24 and the pinned Firebase CLI:

```sh
RUN_SECTION_PERMISSIONS_INTEGRATION=1 \
SECTION_PERMISSIONS_INTEGRATION_PROJECT=demo-sodc-section-permissions \
npm --prefix functions run test:section-permissions-integration
```

The runner accepts only its fixed demo project and owned loopback emulator. It
creates/removes its own temporary database; it does not use live Dev/Production,
Auth identities, provider messages or payments.

The implemented server changes passed all 307 disposable SQL scenarios, including
58 new date/authority cases, and 56 focused authorization/schema/runner tests.
Official SDK generation followed by normalization produced no generated diff.
In a separate disposable copy using the original connector, all 24 new reversed-
range tests fail because the old mutations accept those inputs. The supported
Functions build, focused lint and 261-operation authorization inventory pass.

The server tests prove timestamp ordering after explicit offset conversion. They do not
claim that a server receiving an RFC3339 instant knows the user's intended local
time zone or can diagnose an ambiguous/nonexistent local clock input. Form-level
calendar/DST feedback remains the frontend responsibility.

References: [issue #657](https://github.com/rafsodc/sodc-web/issues/657),
[Firebase Timestamp scalar](https://firebase.google.com/docs/reference/sql-connect/gql/scalar#timestamp),
and [transaction and check semantics](https://firebase.google.com/docs/sql-connect/mutations-guide#the_transaction_directive).
