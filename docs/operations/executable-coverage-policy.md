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
| `check-template-sync.ts` | Template manifest, Markdown and documentation parity tests cover the checked-in source; PR/nightly drift workflows exercise the live adapter. The script contract verifies missing credentials and provider errors remain informational. | Direct unit tests would duplicate template parsing or mock the Notify client without proving the live dashboard. Run `CHECK_ENV=dev npm --prefix functions run check:template-sync` with `GOV_NOTIFY_LIVE_API_KEY` supplied through the approved secret mechanism; confirm the counts and optional Markdown output. |
| `clean-functions-build.mjs` | Every Functions CI build executes it; `functionsBuildArtifact.test.ts` verifies the clean production pipeline. | Run `npm --prefix functions run build`; confirm `functions/lib/index.js` exists and no test artifact is present. |
| `cli-dev-reset.ts` | The script contract locks in the production/unknown-project guards and explicit confirmation; shared environment configuration is under `functions/src`. | This is destructive and unsuitable for CI credentials. Run only against the `dev` alias, verify the displayed project, type the confirmation, then confirm the seeded admin and absence of pre-reset test data. Never run against Beta or Production. |
| `generate-template-manifest.ts` | Every Functions build executes it; template manifest, Markdown and documentation parity suites validate the generated consumer contract. | Run `npm --prefix functions run generate:templates`, review `functions/src/generatedEmailTemplateManifest.ts`, then run `git diff --check`. |
| `legacy-bcrypt-pilot.ts` | `legacyBcryptPilot.test.ts` covers credential generation/outcome rules; the script contract protects the production guard and cleanup. | Follow the non-production pilot command in the legacy migration runbook and confirm the disposable account is removed. Do not use `--allow-production` during routine verification. |
| `legacy-user-import.ts` | Migration, artifact and ledger unit suites cover reusable logic; `legacyUserImportCliContracts.test.ts` locks in dry-run, project binding, approval, batching and PII safety. | Follow the legacy migration runbook. Complete a non-production dry run first, review counts/checksums and only then use the separately approved apply command. |
| `legacy-user-postflight.ts` | `legacyUserPostflight.test.ts` covers report decisions; `legacyUserPostflightCliContracts.test.ts` locks in project binding, read-only snapshots and protected report output. | Run the postflight command from the migration runbook against the same source, preflight and ledger; require a `match` outcome before promotion. |
| `legacy-user-preflight-review.ts` | `legacyUserPreflightReview.test.ts` covers parsing and worksheet/approval generation; the script contract protects owner-only atomic output. | Run it against a non-PII preflight report, inspect the worksheet and confirm both output files are mode `0600`. |
| `verify-functions-build.mjs` | `functionsBuildArtifact.test.ts` executes the verifier against nested `__tests__`, `.test` and `.spec` artifacts and validates the required entry point. | Run `npm --prefix functions run build`; the command must fail if a forbidden artifact is seeded under `functions/lib`. |

## Malware-scanner inventory

| Entry point | Automated evidence | Manual verification |
| --- | --- | --- |
| `scanner.js` | `scanner.test.js` covers request validation, metadata identity, generation-bound download, size/checksum enforcement, private temporary files, ClamAV clean/infected/error mapping, cleanup and fail-closed HTTP responses. The independent coverage gate runs on every PR. | Build the reviewed image and exercise a clean file and the EICAR test file in Dev. Confirm the response reveals no internal path or scanner detail. |
| `server.js` | `entrypoints.test.js` verifies it remains a thin HTTP/listen adapter using the reviewed request handler. | Start the container locally or in Dev and confirm authenticated `/health` returns 200 while unsupported routes return 404. |
| `update-definitions.sh` | `entrypoints.test.js` executes the shell entry point with a fake `freshclam` and verifies the configured private database directory and warning flag. | Execute the definitions Cloud Run Job in Dev, require a successful completion and confirm the scheduler health check records the refresh. |
| `Dockerfile` | `entrypoints.test.js` verifies Node 24, non-root execution, copied runtime modules and the server command. | Build the image, run the Dev scanner smoke checks and inspect the deployed revision/service account before promotion. |

The full environment-specific scanner, EICAR, access-control and replacement
smoke-test checklist remains in [Section file storage](./section-file-storage.md#dev-and-beta-smoke-test-sign-off).
