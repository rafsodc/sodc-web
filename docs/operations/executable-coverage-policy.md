# Executable script and service coverage policy

Tracked by [#581](https://github.com/rafsodc/sodc-web/issues/581) under the
codebase-hygiene epic [#575](https://github.com/rafsodc/sodc-web/issues/575).

## Policy

The Functions Vitest coverage gate measures `functions/src/**/*.ts`. It does
not count `functions/scripts` because those files are operational entry points
that bind filesystem, terminal, Firebase Admin, Data Connect, GOV.UK Notify or
process-exit behaviour. Reusable parsing, reconciliation and decision logic
belongs under `functions/src`, where it is included in the ratcheted Functions
coverage gate. CLI adapters are protected by focused source-contract tests,
safe dry runs or build execution, and the manual checks below.

Historical member-import helpers remain under `functions/src` for CLI use and
unit coverage. The production build and Firebase upload exclude those helpers
and their import/pilot entry points. The artifact verifier rejects their
compiled output, including stale files from an earlier build. Keep the CLI
TypeScript configuration separate from the production build boundary.

The malware-scanner service has an independent Node test and coverage gate.
PR CI measures `scanner.js` against these minimums:

| Metric | Minimum |
| --- | ---: |
| Lines | 90% |
| Functions | 85% |
| Branches | 80% |

`server.js`, the container definition and the definitions-update shell
entry point are tested as executable contracts rather than being included in
the JavaScript percentage.

Adding an executable under either area requires updating this inventory and
providing an automated check or an explicit rationale and manual verification
step. Do not lower a coverage threshold merely to accommodate new code.

## Functions script inventory

| Entry point | Automated evidence | Deliberate boundary and manual verification |
| --- | --- | --- |
| `admin-safety-integration-fixture.mjs` | The separate actual SQL integration suite validates the runner-owned demo project, exact loopback transports and temporary source/database metadata before loading any database SDK in each process. | Use only through `run-admin-safety-integration.mjs`; do not supply an existing database directory. No cloud project is accepted. |
| `admin-safety-integration-worker.mjs` | `adminRoleSafety.integration.ts` launches independent OS processes, waits at an IPC barrier and races actual conditional Data Connect mutations. It checks count/roster/intent rollback, duplicate completion and stale actor/target revisions. | Run the opt-in local race command after schema changes. This proves SQL transaction behavior; no Firebase Auth identity or retained signed JWT is supplied by this worker. |
| `run-admin-safety-integration.mjs` | `functions/src/__tests__/cross-cutting/contracts/adminSafetyIntegrationRunner.test.ts` rejects missing opt-in, cloud projects, conflicting context, unknown transports and external commands/configuration without SDK/network access. The local suite covers administrator races and applicant email holds plus `groupSubscription.integration.ts`: real service-account explicit-UID subscription/registration, duplicate joins, NO_ACCESS client impersonation refusal, transactional group/current-authority denials and caller-bound audit expressions. The subscription callable unit suite separately rejects forged body identities and disabled/stale requests. These local checks do not establish live signed-token acceptance. | `RUN_ADMIN_SAFETY_INTEGRATION=1 ADMIN_SAFETY_INTEGRATION_PROJECT=demo-sodc-admin-safety npm --prefix functions run test:admin-safety-integration`; append `-- --check` for no-network targeting validation. The runner removes only its own temporary directory after emulator shutdown; it does not reuse the checkout's persisted emulator data or reset a shared administrator counter. |
| `check-template-sync.ts` | Template manifest, Markdown and documentation parity tests cover the checked-in source; PR/nightly drift workflows exercise the live adapter. The script contract verifies missing credentials and provider errors remain informational. | Direct unit tests would duplicate template parsing or mock the Notify client without proving the live dashboard. Run `CHECK_ENV=dev npm --prefix functions run check:template-sync` with `GOV_NOTIFY_LIVE_API_KEY` supplied through the approved secret mechanism; confirm the counts and optional Markdown output. |
| `clean-functions-build.mjs` | Every Functions CI build executes it; `functions/src/__tests__/cross-cutting/contracts/functionsBuildArtifact.test.ts` verifies the clean production pipeline. | Run `npm --prefix functions run build`; confirm `functions/lib/index.js` exists and no test artifact is present. |
| `cli-dev-reset.ts` | `functions/src/__tests__/cross-cutting/contracts/adminSafetyContracts.test.ts` checks fail-closed control/state fencing before the first destructive deletion; script TypeScript/build validation. | Online reset refuses after current-security/control bootstrap. Only an explicitly reviewed offline fresh development project may use this destructive seed path; no reset was run. |
| `generate-template-manifest.ts` | Every Functions build executes it; template manifest, Markdown and documentation parity suites validate the generated consumer contract. | Run `npm --prefix functions run generate:templates`, review `functions/src/generatedEmailTemplateManifest.ts`, then run `git diff --check`. |
| `legacy-bcrypt-pilot.ts` | `functions/src/__tests__/legacy-user-migration/legacyBcryptPilot.test.ts` covers credential generation/outcome rules; the script contract protects the production guard and cleanup. | Follow the non-production pilot command in the legacy migration runbook and confirm the disposable account is removed. Do not use `--allow-production` during routine verification. |
| `legacy-user-import.ts` | Migration, artifact and ledger unit suites cover reusable logic; `functions/src/__tests__/legacy-user-migration/legacyUserImportCliContracts.test.ts` locks in dry-run, project binding, approval, batching and PII safety. | Follow the legacy migration runbook. Complete a non-production dry run first, review counts/checksums and only then use the separately approved apply command. |
| `legacy-user-postflight.ts` | `functions/src/__tests__/legacy-user-migration/legacyUserPostflight.test.ts` covers report decisions; `functions/src/__tests__/legacy-user-migration/legacyUserPostflightCliContracts.test.ts` locks in project binding, read-only snapshots and protected report output. | Run the postflight command from the migration runbook against the same source, preflight and ledger; require a `match` outcome before promotion. |
| `legacy-user-preflight-review.ts` | `functions/src/__tests__/legacy-user-migration/legacyUserPreflightReview.test.ts` covers parsing and worksheet/approval generation; the script contract protects owner-only atomic output. | Run it against a non-PII preflight report, inspect the worksheet and confirm both output files are mode `0600`. |
| `run-security-integration.mjs` | `functions/src/__tests__/cross-cutting/contracts/securityIntegrationRunner.test.ts` checks opt-in, known non-production target, explicit confirmation and emulator exclusions without network calls. | Run the opt-in signed-token suite only against the dedicated Dev/Beta target using the current-authorization runbook. The live gate is required before promotion and never runs in normal unit tests. |
| `security-state-admin.ts` | `functions/src/__tests__/users-auth/securityStateAdmin.test.ts` checks explicit project, identity scope, default audit and mutation confirmation; transition tests cover versioned writes and Auth failure. | Follow the current-authorization runbook. Audit first, review the UID-only report, then apply only the selected bootstrap/disable/enable/repair intent. |
| `notification-recovery-admin.mjs` | `functions/src/__tests__/notifications/notificationRecoveryAdmin.test.ts` covers project/transport rejection before SDK loading, reviewed snapshot hashes, canonical compact/hyphenated UUID and ID/key selection, all three write outcomes, preserved stdout failure receipts, cleanup failures, history readback, the real release planner and explicit generated-connector wiring. Reusable parsing/planning/orchestration lives under `functions/src` in the coverage gate. | Build Functions, read and review a single-row release plan, then use the same intent with exact project confirmation and plan hash only for an approved release. Imports no mailer and calls no provider; released work can be sent by a later normal scheduled recovery run. No live release was run during implementation. |
| `run-notification-recovery-integration.mjs` | `functions/src/__tests__/notifications/notificationRecoveryIntegrationGate.test.ts` validates the fixed demo/loopback/runner-owned temporary context before SDK imports. The separate actual SQL suite exercises recovery claim and failure races, cap, cooldown and full snapshot ownership, plus real operator inspection/planning/release with database-returned UUIDs and equivalent selector hashes, without any provider. | `RUN_NOTIFICATION_RECOVERY_INTEGRATION=1 NOTIFICATION_RECOVERY_INTEGRATION_PROJECT=demo-sodc-notification-recovery npm --prefix functions run test:notification-recovery-integration`; append `-- --check` for pure targeting validation. Owns a fresh local PostgreSQL/Data Connect instance and removes only its temporary directory after shutdown. No cloud, Auth or mailer target is accepted. |
| `run-notification-integration.mjs` | `functions/src/__tests__/notifications/notificationIntegrationGate.test.ts` verifies explicit Dev/Beta confirmation, project conflict, config and emulator rejection before credentials/network imports; in-process staff delivery/recovery suites cover orchestration with fake services. | After schema/operations release, opt in with matching `RUN_SECURITY_INTEGRATION=1`, `SECURITY_INTEGRATION_PROJECT`, and `SECURITY_INTEGRATION_CONFIRM`, then run `npm --prefix functions run test:notification-integration`. It creates only random synthetic profiles/ledger rows, checks actual SKIPPED CAS, terminal retry exclusions and legacy modes, then removes its fixtures. No mailer/provider is imported. Never run against Production. |
| `verify-functions-build.mjs` | `functions/src/__tests__/cross-cutting/contracts/functionsBuildArtifact.test.ts` executes the verifier against nested test artifacts and historical member-import helper output, validates the required entry point, and checks the production/upload boundary. | Run `npm --prefix functions run build`; the command must fail if a forbidden artifact is seeded under `functions/lib`. |

## Malware-scanner inventory

| Entry point | Automated evidence | Manual verification |
| --- | --- | --- |
| `scanner.js` | `scanner.test.js` covers request validation, metadata identity, generation-bound download, size/checksum enforcement, private temporary files, ClamAV clean/infected/error mapping, cleanup and fail-closed HTTP responses. The independent coverage gate runs on every PR. | Build the reviewed image and exercise a clean file and the EICAR test file in Dev. Confirm the response reveals no internal path or scanner detail. |
| `server.js` | `entrypoints.test.js` verifies it remains a thin HTTP/listen adapter using the reviewed request handler. | Start the container locally or in Dev and confirm authenticated `/health` returns 200 while unsupported routes return 404. |
| `update-definitions.sh` | `entrypoints.test.js` executes the shell entry point with a fake `freshclam` and verifies the configured private database directory and warning flag. | Execute the definitions Cloud Run Job in Dev, require a successful completion and confirm the scheduler health check records the refresh. |
| `Dockerfile` | `entrypoints.test.js` verifies Node 24, non-root execution, copied runtime modules and the server command. | Build the image, run the Dev scanner smoke checks and inspect the deployed revision/service account before promotion. |

The full environment-specific scanner, EICAR, access-control and replacement
smoke-test checklist remains in [Section file storage](./section-file-storage.md#dev-and-beta-smoke-test-sign-off).
