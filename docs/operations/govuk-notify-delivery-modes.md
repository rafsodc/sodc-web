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

Run commands from the repository root of a clean, reviewed release checkout using
Node 24, Firebase CLI **15.22.3** and both installed lockfiles (`npm ci` and
`npm --prefix functions ci`). Choose the Firebase alias `dev`, `beta` or `prod`
and verify its `.firebaserc` project mapping; `PROJECT_ID` below means that alias's
literal project ID.

For initial provisioning or an explicitly approved rotation, set the three secrets
independently. Do not create new versions as a routine release step:

```sh
firebase functions:secrets:set GOV_NOTIFY_LIVE_API_KEY --project PROJECT_ID
firebase functions:secrets:set GOV_NOTIFY_TEST_API_KEY --project PROJECT_ID
firebase functions:secrets:set GOV_NOTIFY_TEAM_API_KEY --project PROJECT_ID
```

The ordinary deployment guard requires deployed bindings to match the literal
enabled latest versions. A new/mismatched version needs its separately reviewed
provisioning/rotation workflow; do not bypass that block with a raw Functions
deployment.

Set the deployment ceiling in the ignored project-specific Functions environment
file, for example `functions/.env.PROJECT_ID`:

```dotenv
GOV_NOTIFY_DELIVERY_MODE=SIMULATION
```

Use `SIMULATION` initially in a new environment. If administrators must later
select team-test or live mode without a deployment, set the ceiling to `LIVE`
only after the environment has passed its delivery checks. The runtime setting
will remain in `SIMULATION`.

For an existing environment with the authorization migration and secret bindings
complete, follow the [Functions configuration review](./functions-runtime-config-guard.md#prepare-and-review).
A deployment-ceiling change is an intentional environment delta: review the exact
proposal and retain its `SODC_FUNCTIONS_CONFIG_REVIEW` for the full preflight and
deployment. Stage the matching Vite file too; the full preflight remains required
for a Functions-only release.

```sh
export FIREBASE_ENV=dev # Use beta or prod only for that approved target.
npm run deployment:preflight -- --env "$FIREBASE_ENV"
```

If installing changed runtime-setting/audit schema or connector operations, deploy
and validate Data Connect before Functions. A ceiling-only change to an already
compatible backend does not require a Data Connect deployment:

```sh
npm run deployment:functions-config -- --env "$FIREBASE_ENV" --verify
firebase deploy --only dataconnect --project "$FIREBASE_ENV"
```

Then deploy Functions through the guarded path, which rechecks fresh metadata:

```sh
npm run deploy:functions -- --env "$FIREBASE_ENV"
# Deploy Hosting only if this release also changes the frontend; choose its target.
npm run "deploy:hosting:$FIREBASE_ENV"
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
