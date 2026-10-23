# Issue #670: atomic notification recovery claims

A scheduled worker can list a FAILED delivery at attempt five while another worker consumes attempt six. Previously the first worker re-read the current row and could claim attempt seven immediately, bypassing both the scheduler's six-attempt cap and its fifteen-minute retry delay.

Recovery now carries a trusted snapshot separately from the serialized recovery payload through every supported dispatcher. Its claim binds the physical row ID, channel, delivery key, notification type, status, attempt count, exact last-attempt timestamp, payload and delivery mode. Both the claim and the fallback failure mutation enforce the same snapshot and database-clock timing: FAILED must be at least fifteen minutes old; PENDING must be at least ten minutes old. The database increments the count only when it is below six. Recovery cannot insert a missing row or claim a replacement row under the same key.

The six-attempt cap applies to scheduled recovery. Intentional direct/manual sends retain their existing retry behavior. Staff recipient eligibility still receives its fresh lookup and the final provider ownership check also binds the physical row ID.

## Delivery mode and retention

Recovery uses the exact persisted physical key. It resolves the original mode from the stored ledger mode, a known transport suffix appended to the independently derived logical key, or the validated payload; conflicting evidence defers the row. A legacy row with no verifiable mode is retained unchanged, with an explicit deferred reason in the recovery log. Neither case calls the provider, consumes another retry slot, creates a replacement key or reports a terminal skip.

A known mode reduced by current configuration is terminally skipped under the original key with `DELIVERY_MODE_CHANGED`, consistent with existing staff recovery behavior. Original payload history is preserved. Legacy email-only staff identities remain terminally suppressed by the existing recipient-identity policy.

## Acceptance criteria

- A stale FAILED5 candidate cannot claim or send attempt seven after another worker reaches FAILED6.
- Refreshing the timestamp, payload, identity, mode or physical row after selection invalidates the claim.
- Due FAILED5 and expired PENDING5 can each consume attempt six once; its subsequent failure exhausts scheduled recovery.
- Concurrent workers have one winner, including a race between normal claim and fallback failure recording.
- Database time enforces cooldown even if the worker clock is ahead.
- All eleven recovery kinds and both legacy staff skip paths carry the original key and trusted claim to the final sender.
- Missing, replaced and terminal rows are not recreated or sent.
- Direct/manual retries and current staff authorization checks retain their behavior.

## Validation

The Functions suites include runtime race regressions, actual domain-to-sender forwarding tests, production SDK adapter checks, server-only authorization contracts and SQL predicate contracts. Run the disposable SQL tests with:

```sh
RUN_NOTIFICATION_RECOVERY_INTEGRATION=1 \
NOTIFICATION_RECOVERY_INTEGRATION_PROJECT=demo-sodc-notification-recovery \
npm --prefix functions run test:notification-recovery-integration
```

The runner accepts only its fixed demo project and loopback emulator, creates a fresh temporary source/database, uses two independent database clients for races, and removes its temporary data after shutdown. It imports no Auth or mailer/provider module. The suite exercises the actual generated operations, including timestamp precision, null payload/mode bindings, cap/timing rejection and concurrent claims.

## Release and remaining acceptance

This change adds a server-only connector operation and changes the existing recovery-failure operation's required variables. Pause the notification recovery Scheduler job while deploying the API connector and the matching Functions revision; resume only after both are verified. Ordinary direct/manual claim operations keep their existing contract. No database table migration is required.

These checks do not prove deployed scheduler behavior or notification delivery. After Dev deployment, repeat the approved single-recipient staff alert acceptance using the normal worker and verify provider, callback and inbox evidence before clearing the release gate.
