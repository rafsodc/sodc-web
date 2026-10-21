# Current authorization and issued-token revocation (#653)

`UserSecurityState` is the server-owned authority for member/admin admission. Auth custom claims are a versioned mirror used as additional restrictive checks. A signed token cannot grant access by itself. Missing state denies member/admin access; request guards never bootstrap it.

## Enforcement and transition contract

Every protected client operation checks the caller's own state with `auth.uid`, redacts the lookup, requires `READY`, ready access, the same current profile status, an allowed membership status and an exact integer `securityVersion`. Admin operations additionally require `adminReady`. Mutations check before their writes within `@transaction`. Existing ownership and relationship checks remain. `docs/security/authorization-operations.json` inventories every operation; run `node scripts/check-authorization-inventory.mjs` to detect omissions.

Functions await `requireEnabled`/`requireAdmin` before protected work. Their fresh DB checks are cached only within that one request. Downstream role bypasses use the resulting effective permissions. Backend consumers use explicit `Service*` NO_ACCESS reads or existing service operations rather than relying on an absent `auth.uid` in the Admin SDK. The authorization connector uses a separate named Firebase App because installed Admin SDK 13.10 caches Data Connect instances without the connector ID. This prevents accidentally selecting the client API connector for security operations.

Staff-recipient selection and claimed sends also read fresh current security state, require ready matching profile/version eligibility and use `adminReady` for the admin bypass. A pending/revoked DB record cannot remain eligible from a still-true Auth mirror; the delivery ledger persists the definitive skip through #651.

The shared API is `functions/src/currentAuthorizationTransitions.ts`:

- `initializeUserSecurityState({userId, actorId, reason, allowAdminBootstrap?})` is an explicit migration/bootstrap operation. Only a separately authorised bootstrap imports an existing Auth admin role. Ordinary guards cannot call it. Initial unverified identities receive a durable exact-address verification hold.
- `transitionUserSecurity({userId, actorId, reason, operationId?, membershipStatus?, admin?, authDisabled?, verificationEmail?, releaseEmailVerification?})` commits denied ready flags, the incremented version, target profile status and a durable `SecurityTransition` in one CAS transaction. An operation ID is bound to the complete normalized intent hash, not just an actor/reason. Reusing it for another action fails.
- `synchronizeUserSecurity(operationId)` resumes the stored intent. It mirrors claims/explicit account disable intent, verifies fresh Auth state, then conditionally makes that exact current version ready. A failed grant remains denied; an old worker cannot complete a newer state. A pending restriction remains effective even if Auth synchronization fails. Superseded pending operations are retired.

Both restrictions and restoration increment the version. Ready flags are false during **every** transition, including an allowed-to-allowed membership edit and administrator email reverification. These are readiness reductions for #654's serialized last-usable-admin guard. #654 must place its singleton guard/counter update in the same begin/complete transaction, covering initial grants, role/status changes, email holds, explicit account disable, reconciliation, bootstrap and repair. Retain the existing policy prohibiting administrators from restricted status changes and resignation. This PR does not replace the remaining last-admin count race; #654 owns that work.

Email changes first bind a persistent hold to the intended new address and revoke current access; only then can Auth email be changed/unverified. A concurrent reconciliation of the still-verified old email cannot release it. Self reconciliation releases only an explicit hold after fresh Auth verification of the exact intended address, rechecking current profile/disabled state. It cannot generically enable a denied account. Initial/imported unverified accounts have the same supported verification recovery. Unheld restrictions require an authorised status/account transition.

The five-minute reconciliation scheduler retries pending intents and sweeps paginated existing states for READY Auth-mirror drift. A late old Auth write cannot change DB authority; the sweep or own-session check repairs its mirror using current authority. A known external disable/delete/unverified identity creates a new DB-first denial instead of undoing that restriction. External unverified identity denials bind the observed current email; other out-of-band restrictions require operator recovery. No Firebase Auth `onUpdate` mirror is assumed.

## Boundaries and recovery

The intentionally authentication-only callables are onboarding/display-name setup, pending-claim setup, email verification/reconciliation and `getMyAuthorizationStatus`. The latter accepts no target identity or permission flags and returns only `{status, isAdmin, securityVersion, tokenVersionCurrent, verificationRequired}` for the caller. `status` is `enabled`, `restricted`, `pending` or `missing`. It freshly reads own Auth/DB state; it may repair a READY claim mirror, but cannot bootstrap, start a grant, release a hold or return member data. It is rate limited to 30 requests per five minutes.

The frontend seam is `src/shared/auth/authorizationFailure.ts` plus the raw own-status wrapper `src/shared/auth/authorizationStatus.ts`. It recognizes the stable `SESSION_VERSION_STALE` and `ACCESS_REVOKED` markers through actual Error and Data Connect wrappers. #602 integration must mask private views immediately, capture/check its session generation around the status call, permit at most one forced refresh for a stale version and never replay a failed mutation automatically. `ACCESS_REVOKED` can also mean a pending synchronization or role-only admin denial. Do not blindly sign out an enabled member: pending remains masked with bounded retry; confirmed restriction/missing authority uses #602 sign-out cleanup; role-only loss refreshes claims and performs a controlled document reset to clear the installed SDK's private cache, returning to a safe member route.

Public account recovery, signed guest capabilities and verified webhooks remain separate explicit boundaries. Section/file capabilities are issued only after current member and resource checks. An already-issued signed Storage URL remains usable until its expiry; version changes cannot recall it. Already-admitted work can complete after a subsequent restriction. The proposed release target is denial of newly started protected checks within **five seconds of the successful DB restriction commit**, measured with a retained signed token in non-production. This is a candidate release criterion, not an agreed operational SLA and not a promise for in-flight work or Console-only Auth changes.

Console-only Auth disable/delete and unsupported raw DB/Auth writes do not share this transaction. Use the supported service/operator path for immediate DB-first restrictions. Reconciliation detects known drift later, subject to scheduling, data volume, service availability and alert response; it is not an immediate external-change guarantee. Monitor failed/pending synchronization and READY mirror recovery warnings.

## One-time migration in each project

**Do not use the normal one-shot deploy before this migration.** The default checked-in connector is strict and denies old tokens/missing rows immediately. Old Functions also need the additive `Service*` reads before replacement. Rehearse each step in Dev, then Beta before Production. No migration/deployment was performed as part of implementation.

1. Review the exact commit and backups, select the explicit project ID, schedule a membership/role/email/operator-write freeze, and wait for old in-flight writers to drain. Keep the freeze through new Functions validation. Confirm that no scheduler or migration job still uses an Auth-only grant or legacy status writer.
2. Deploy only the additive schema and authorization-service connector, keeping the existing API connector in place:

   ```sh
   firebase deploy --only dataconnect:sodc-web-service:schema,dataconnect:sodc-web-service:authorization-service --project sodc-web-beta
   ```

3. Prepare a new **local temporary source artifact**, explicitly project bound with expiry no more than 48 hours away:

   ```sh
   node scripts/prepare-authorization-rollout.mjs --project sodc-web-beta --output /tmp/sodc-authorization-beta-reviewed --expires <ISO-expiry-within-48h>
   ```

   Review `AUTHORIZATION-ROLLOUT.json`, the source diff and the expiry before using it. This command never deploys or changes default sources. Only this artifact omits the new current-state lookups; it retains all previous token/ownership checks, adds NO_ACCESS service operations, and removes SDK generation paths. It provides **legacy security only**, so the revocation target does not apply during this short frozen phase. From that temporary directory, deploy **only** `dataconnect:sodc-web-service:api` to the same explicit project. Never deploy the temporary artifact after strict cutover or after expiry. Expiry is operator enforced metadata, not an automatic cloud rollback timer.
4. Audit/backfill existing Auth identities with membership profiles through the explicit CLI. Audit is read-only by default; output contains UID/classification only. Auth identities without profiles are skipped by bootstrap; onboarding remains available. Review orphaned profiles without an Auth identity separately and leave them denied until a supported identity repair. Do not infer a grant from the absence of an Auth account.

   ```sh
   npm --prefix functions run security-state-admin -- --project sodc-web-beta --all
   npm --prefix functions run security-state-admin -- --project sodc-web-beta --all --mode bootstrap --import-admins --apply --confirm-project sodc-web-beta --actor <operator-id> --reason <approved-migration-reference>
   npm --prefix functions run security-state-admin -- --project sodc-web-beta --all
   ```

   `--import-admins` is an explicit approval to adopt legacy roles, not a routine runtime repair. Review active profile eligibility, ready states, intended holds, pending/error records, mirrored versions and at least one verified non-disabled ready administrator. The scheduler can resume pending intents; rerun audit after it finishes. Never reset versions or overwrite authority from stale claims. This step invalidates old tokens; #602 recovery or explicit sign-out/sign-in is required.
5. Deploy new Functions against the additive API. Their awaited current guards are now strict. Verify service reads, onboarding/approval, role/status transitions, exact-address verification, operator recovery, existing public/guest/webhook boundaries and current-recipient eligibility. Keep old writers frozen until all Functions instances/jobs use the new boundary. `ConfirmPotentialLost` retains its old signature for already-deployed Functions; new code uses only `ConfirmPotentialLostWithSecurityState`.
6. Deploy the strict API from the reviewed default checkout, then run the real signed-token gate and #602 recovery acceptance checks before Hosting promotion. Recheck that every eligible existing user has a versioned state and a refresh path. Delete the temporary compatibility directory. Remove the unused legacy Potential Lost operation in a later reviewed cleanup after every environment has replaced old Functions; never use it as a repair path.
7. Record the one-time receipt at gitignored `.firebase/authorization-migration/<project-id>.json`:

   ```json
   {
     "schemaVersion": "sodc-authorization-migration/v1",
     "migrationId": "current-authorization/v1",
     "projectId": "sodc-web-beta",
     "gitSha": "<full-reviewed-migration-commit-sha>",
     "backfillComplete": true,
     "strictApiReady": true,
     "reviewedBy": "<operator-id>",
     "evidence": "<audit, strict API and non-production gate references>"
   }
   ```

   The normal deployment/preflight entry points require this project/epoch receipt and verify its recorded SHA is an ancestor of the requested revision before any remote step. It is a durable operator assertion with evidence, not an automated substitute for the audit. Descendant releases reuse it; the existing deployment preflight separately binds each exact release SHA. A fresh project, unrelated history or future migration epoch requires a new receipt. Keep receipt evidence in the approved operational record so another deploy host can verify/recreate it.

Rollback must preserve the schema/version rows and current authority. Prefer rolling back Hosting or fixing Functions while leaving strict API checks in place. Do not restore claim-only connectors, reset versions or restore an old Auth claim snapshot after cutover: that would re-enable retained tokens. An unavailable synchronization can be retried from the durable operation; an authorised compensating restoration is a new versioned transition.

## Operator restrictions and retries

Use `security-state-admin` with an explicit single `--user` for `--mode disable` / `--mode enable`, plus `--apply --confirm-project --actor --reason`. Restriction commits denied state before Auth disable. Enabling checks the current profile, verified email and any hold before granting readiness. `--mode repair` resumes the current durable operation (or repairs its READY mirror), rather than inventing a grant from Auth flags. `--mode bootstrap` is reserved for migration/new explicit bootstrap; existing state is not reimported from Auth. Audit first and retain the UID-only result with the approval reference. Pending operations are also retried automatically.

## Validation and release evidence

Normal suites use deterministic unit/domain mocks and are not proof that Firebase accepted a retained signed JWT. The separate `functions/src/__tests__/users-auth/accessRevocation.integration.ts` uses the exact pre-change JWT bytes against deployed direct connector read/write operations and real callables. Raw Admin access is limited to unique `security-it-*` fixture setup, authoritative state observations, assertions and cleanup; it is not used as the proof of client authorization. It tests restriction/role revocation, no-write side effects, restoration/regrant and the proposed five-second denial criterion. Auth synchronization failures and stale-worker races are covered by unit/transaction tests, not by fault injection into live Auth.

The live suite requires an explicitly confirmed Dev/Beta project and site-wide Notify `SIMULATION` before fixture mutations. It never runs against Production or an emulator. Supply the target web API key through the approved environment mechanism:

```sh
RUN_SECURITY_INTEGRATION=1 SECURITY_INTEGRATION_PROJECT=sodc-web-beta SECURITY_INTEGRATION_CONFIRM=sodc-web-beta SECURITY_INTEGRATION_API_KEY=<target-web-api-key> npm --prefix functions run test:security-integration
```

If App Check is enforced on Auth/Data Connect, supply a valid target-project `SECURITY_INTEGRATION_APPCHECK_TOKEN` through the approved test attestation flow as well; do not weaken project enforcement to make the gate pass. The raw fixture Admin client explicitly selects the API connector so its cache cannot poison generated API operations.

The same command with `-- --check` checks targeting without network or account changes. Running without opt-in fails before network. This live gate has **not been executed** in this PR; it remains mandatory after a non-production deployment. Local Data Connect emulator smoke separately verified CEL/current reads and writes, denied-write rollback, restriction/restoration, stale-version/admin rejection and multi-connector service compatibility. Emulator impersonation does not replace the signed-token gate.

Firebase references: [database authorization lookups](https://firebase.google.com/docs/sql-connect/authorization-and-security), [transaction/check/redaction semantics](https://firebase.google.com/docs/sql-connect/mutations-guide), [granular schema/connector deployment](https://firebase.google.com/docs/sql-connect/cli-reference), [schema/connector management](https://firebase.google.com/docs/sql-connect/manage-schemas-and-connectors).
