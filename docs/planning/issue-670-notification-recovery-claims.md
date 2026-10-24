# Issue #670: atomic notification recovery claims

A scheduled worker can list a FAILED delivery at attempt five while another worker consumes attempt six. Previously the first worker re-read the current row and could claim attempt seven immediately, bypassing both the scheduler's six-attempt cap and its fifteen-minute retry delay.

Recovery now carries a trusted snapshot separately from the serialized recovery payload through every supported dispatcher. Its claim binds the physical row ID, channel, delivery key, notification type, status, attempt count, exact last-attempt timestamp, payload, delivery mode and nullable recipient identity. Both the claim and the fallback failure mutation enforce the same snapshot and database-clock timing: FAILED must be at least fifteen minutes old; PENDING must be at least ten minutes old. The database increments the count only when it is below six. Recovery cannot insert a missing row or claim a replacement row under the same key.

The six-attempt cap applies to scheduled recovery. Intentional direct/manual sends retain their existing retry behavior. Staff recipient eligibility still receives its fresh lookup and the final provider ownership check also binds the physical row ID.

## Delivery mode and retention

Recovery uses the exact persisted physical key. It resolves the original mode from the stored ledger mode, a known transport suffix appended to the independently derived logical key, or the validated payload; conflicting evidence defers the row. A legacy row with no verifiable mode is retained with a durable deferral marker and an explicit reason. Conflicting evidence uses the same non-terminal hold. Neither case calls the provider, consumes another retry slot, creates a replacement key or reports a terminal skip. Deferral preserves status, attempts, last-attempt time, physical key, payload and mode.

A known mode reduced by current configuration is terminally skipped under the original key with `DELIVERY_MODE_CHANGED`, consistent with existing staff recovery behavior. Original payload history is preserved. Legacy email-only staff identities remain terminally suppressed by the existing recipient-identity policy.

## Deferred work and queue progress

The new automatic recovery queries exclude `recoveryDeferredAt` markers. A snapshot-bound, service-only mutation records the database timestamp and one of the two mode-deferral reasons. Guarded claims and fallback failure writes also require an absent marker, so a previously selected candidate cannot claim after deferral wins the race. The scheduled job reports `deferred` separately from `failed` and logs a safe delivery ID/reason.

Each bounded run can move deferred records out of the automatic queue. A finite backlog larger than the 25-row limit therefore cannot permanently hide newer eligible work. Both FAILED and stale PENDING scans use this filter. Merely increasing the limit or counting affected rows would not establish this progress.

The two columns are additive and nullable. The original recovery queries and legacy mutations retain their deployed behavior/signatures; the updated worker uses newly named automatic queries. Old workers ignore deferral, so the pause/drain rollout requirement still applies.

## Guarded, non-sending operator release

The reusable operator command reads one exact physical delivery key and defaults to a plan. It parses the stored recovery payload, checks its logical key/type and privileged recipient/subject identity, and requires consistent original-mode evidence. An explicitly verified mode can fill a missing ledger mode when all existing evidence agrees. It cannot override a conflict, change the payload/key/recipient, release terminal/exhausted work or silently classify an unresolved delivery as sent or skipped. Conflicting evidence remains held for a separately reviewed correction.

Use Node 24, rebuild Functions from the reviewed source, and keep the plan/receipt with the operational evidence. A plan contains a hash of the exact project, snapshot and release intent; output omits the raw key, payload and recipient. The evidence reference should point to the record establishing the original mode, rather than guessing from current configuration. This is an operator attestation: the tool checks consistency with stored evidence but cannot independently verify an external reference.

```sh
npm --prefix functions run build
npm --prefix functions run notification-recovery-admin -- \
  --project sodc-web \
  --delivery-key 'EXACT_PHYSICAL_DELIVERY_KEY' \
  --actor 'OPERATOR_ID' \
  --evidence-reference 'REVIEWED_EVIDENCE_REFERENCE' \
  --verified-mode TEAM_TEST
```

After inspecting the plan, repeat the same arguments with:

```sh
  --apply --confirm-project sodc-web --expected-plan-hash REVIEWED_PLAN_SHA256
```

Use the exact project ID (`sodc-web`, `sodc-web-beta` or `sodc-web-production`); aliases and emulator overrides are rejected. `--verified-mode` is optional when existing mode evidence is already conclusive. Apply rereads the row, requires the reviewed plan hash, conditionally releases the exact marker/snapshot and verifies the result. It clears the active timestamp, retains the deferral reason, optionally fills a previously missing mode, and preserves delivery status, retry count/timestamp, payload and key. The operator ID is recorded in the ordinary database audit metadata; the receipt records the evidence reference. This is a release of one hold, with no bulk-clear mode or automatic retry after an uncertain response.

The tool imports no mailer and calls no provider. Released work returns to the normal queue and may be sent by a later eligible scheduled recovery run; keep recovery paused if the maintenance window must remain non-sending. A concurrent worker can change the row before readback, in which case the tool reports incomplete verification rather than claiming success or retrying.

## Acceptance criteria

- A stale FAILED5 candidate cannot claim or send attempt seven after another worker reaches FAILED6.
- Refreshing the timestamp, payload, identity, mode or physical row after selection invalidates the claim.
- Due FAILED5 and expired PENDING5 can each consume attempt six once; its subsequent failure exhausts scheduled recovery.
- Concurrent workers have one winner, including a race between normal claim and fallback failure recording.
- Database time enforces the due predicate even if the worker clock is ahead. The new attempt timestamp remains worker-supplied, as in the existing delivery protocol: a worker clock behind the database can shorten the next cooldown by that skew. This change does not establish a fully database-timestamped lease protocol; production clock synchronization remains an assumption.
- All eleven recovery kinds and both legacy staff skip paths carry the original key and trusted claim to the final sender.
- Missing, replaced, deferred and terminal rows are not recreated or sent by scheduled recovery.
- More than 25 unverifiable/conflicting rows cannot permanently starve later eligible FAILED or stale PENDING work across repeated runs.
- Recipient identity and nullness are checked before claiming, in the atomic predicate, before recovery send and in the ownership callback.
- Operator release requires verified consistent mode/identity and the exact reviewed snapshot; stale plans, changed markers and concurrent claims lose without provider calls.
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

This change adds guarded server-only claim, failure, deferral and release operations, newly named automatic recovery queries, and two nullable deferral columns on the existing delivery table. The original `ClaimNotificationDeliveryById`, `RecordNotificationRecoveryFailureById` and legacy recovery list operations retain their deployed signatures and behavior. Apply the additive schema and API connector before the matching Functions revision; regenerate SDKs through the standard generator/normalizer. Existing rows need no ownership or status rewrite. New scheduled recovery code calls only the guarded operations and filtered automatic queries.

Old Functions revisions retain the pre-fix race until they finish. Pause the notification recovery Scheduler job, establish completion of old workers, deploy the API connector and matching Functions revision, then resume only after both are verified. Keep old operation compatibility through the rollout; their presence does not certify that an old worker is safe to overlap with acceptance fixtures.

These checks do not prove deployed scheduler behavior or notification delivery. After Dev deployment, repeat the approved single-recipient staff alert acceptance using the normal worker and verify provider, callback and inbox evidence before clearing the release gate.
