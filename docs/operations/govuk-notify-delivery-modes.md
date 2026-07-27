# GOV.UK Notify delivery modes

All application-owned GOV.UK Notify email is controlled by two site-wide
settings:

- `GOV_NOTIFY_DELIVERY_MODE` is a deployment ceiling. It is mandatory; missing
  or unrecognised values fail closed.
- **Admin → Email Delivery** is the day-to-day runtime mode. Its persisted
  default is `SIMULATION`.

| Mode | Secret | Delivery behaviour |
|---|---|---|
| `SIMULATION` | `GOV_NOTIFY_TEST_API_KEY` | Calls Notify once per intended recipient but delivers no email. |
| `TEAM_TEST` | `GOV_NOTIFY_TEAM_API_KEY` | Delivers only to recipients on the Notify team or guest list. |
| `LIVE` | `GOV_NOTIFY_LIVE_API_KEY` | Permits unrestricted live delivery. |

The modes form a ceiling: `SIMULATION < TEAM_TEST < LIVE`. The effective site
mode is the more restrictive of the deployment ceiling and admin-selected
runtime mode. Transactional workflows request `LIVE`. A moderator can request
any mode for an announcement, but the backend always applies the most
restrictive of all three values. There is no secret fallback.

## Configure an environment

Set the three secrets independently:

```sh
firebase functions:secrets:set GOV_NOTIFY_LIVE_API_KEY --project PROJECT_ID
firebase functions:secrets:set GOV_NOTIFY_TEST_API_KEY --project PROJECT_ID
firebase functions:secrets:set GOV_NOTIFY_TEAM_API_KEY --project PROJECT_ID
```

Set the deployment ceiling in the ignored project-specific Functions environment
file, for example `functions/.env.PROJECT_ID`:

```dotenv
GOV_NOTIFY_DELIVERY_MODE=SIMULATION
```

Use `SIMULATION` initially in a new environment. If administrators must later
select team-test or live mode without a deployment, set the ceiling to `LIVE`
only after the environment has passed its delivery checks. The runtime setting
will remain in `SIMULATION`.

Deploy Data Connect before Functions because the runtime setting and audit
tables are schema changes:

```sh
npx firebase deploy --only dataconnect --project PROJECT_ID
npx firebase deploy --only functions --project PROJECT_ID
npx firebase deploy --only hosting --project PROJECT_ID
```

## Change the runtime mode

Sign in as an enabled global administrator and open **Admin → Email Delivery**.
Choose the new mode and enter a reason. Moving to a more permissive mode
requires an extra confirmation. The backend prevents a selection above the
deployment ceiling and uses optimistic locking so one administrator cannot
silently overwrite another's change.

Every change records the actor UID, reason, old and new modes, ceiling, and
timestamp. The page shows the 25 most recent changes. Changing the runtime mode
does not require a Functions deployment.

Change `GOV_NOTIFY_DELIVERY_MODE` only when altering the maximum mode permitted
in that environment. Changing the environment file does not affect running
Functions until they are redeployed.

After configuration:

1. Open **Admin → Email Delivery** and confirm both the runtime mode and
   deployment ceiling.
2. Open the announcement screen and confirm the prominent effective site-mode
   banner.
3. In `SIMULATION`, send to a representative large section and confirm one
   acceptance/error result per intended recipient with no delivered mail.
4. In `TEAM_TEST`, confirm team recipients receive mail and external recipients
   are reported as restricted failures; never retry them using the live key.
5. Before `LIVE`, verify templates, reply-to settings, callback processing,
   unsubscribe links, recipient selection, and environment identity.

Announcement history records requested, site-wide, and effective modes.
Per-recipient rows and the generic transactional delivery ledger record the
effective mode. Notify references include the mode so simulation or team-test
acceptance cannot suppress a later live request.

## Interpretation and incident response

Notify accepting a simulation request means the request was valid; it is not
evidence of delivery. Keep simulated, team-test, and live totals separate in
support reports and diagnostics.

For an email incident, an administrator can immediately lower the runtime mode
to `SIMULATION`. Lower the deployment ceiling and redeploy as a second,
defence-in-depth step when appropriate. If the ceiling or matching secret is
missing, leave the system failed closed, correct the configuration, and
redeploy. Do not temporarily substitute another mode's key. Rotate only the
affected secret if a key is exposed, and do not log or paste key material.
