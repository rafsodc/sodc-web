# Functions runtime configuration guard

The supported deployment entrypoints check effective Functions configuration before
deployment. This implements the deployment-safety part of [#706](https://github.com/rafsodc/sodc-web/issues/706).
It does **not** reconcile the existing Dev configuration or establish that the
existing baseline is functionally correct.

## Supported boundary

- Node 24, Firebase CLI **15.22.3**, Functions SDK **7.2.5**, one local `default`
  codebase in `functions`, Gen 2 in `europe-west2`. CLI executable/module hashes are
  pinned. Upgrades require adapter/policy review and tests.
- Actual CLI dotenv loading, SDK manifest discovery, backend conversion and
  environment inheritance helpers are used. Full Firebase `prepare` never runs
  in the guard: it can enable APIs, write params and perform deployment work.
- Local SDK discovery receives the real read-only Firebase Admin SDK configuration,
  `GCLOUD_PROJECT` and quota project. It uses manifest-output mode, without invoking
  handlers or inheriting user dotenv, credential or token environment variables.
  Child output/errors are suppressed. Non-secret parameters (including unused or
  aliased declarations), extensions, custom hooks and unmodeled options fail closed.
- Metadata checks cover expected Functions, bounded runtime settings/identities,
  Cloud Run invoker bindings, all five Scheduler configurations, and exact secret
  project/bound/latest-version/state. Literal `latest` must be enabled and match the
  bound numeric version; an older enabled version cannot substitute for it. Secret
  payloads are never accessed. Permissions include Firebase, Resource Manager,
  Functions, Run/IAM, Scheduler and Secret Manager metadata viewers.
- The two existing task trigger definitions are pinned by source-manifest hash.
  Retry, rate or invoker changes block pending adapter/policy review. Live Cloud
  Tasks queue state/enqueuer policy is **not** inspected or predicted. The Functions'
  private Cloud Run invoker state is checked.

This is a bounded point-in-time check, not a provider transaction. Post-deployment
configuration/identity/trigger/secret/Scheduler comparisons and the usual audit
remain required. Operators must coordinate concurrent changes.

## Prepare and review

Stage the target Vite file and matching non-secret Functions project file in an
isolated reviewed checkout. Never edit/delete tracked `functions/.env` to change
resolution behavior. Install both locked dependency trees and build Functions:

```sh
npm ci
npm ci --prefix functions
npm --prefix functions run build
node scripts/functions-config-guard.mjs --env prod --propose > /private/tmp/functions-config-proposal.json
```

Normal mode resolves `.env` plus exactly one of `.env.<project-id>` or `.env.<alias>`
using the CLI. Both suffixes together are rejected. A target-specific file is
mandatory; the common placeholder alone cannot prove target configuration was
staged. File **existence**, including an empty file, selects Firebase replacement
semantics rather than inheritance.

Every endpoint's proposed application environment must equal its existing one,
distinguishing absent, empty and nonempty values. This catches partial files and
accidental broadening of endpoint-scoped settings. Normal mode also requires the
target's canonical `APP_BASE_URL` and bucket. The non-local application URL, Notify
delivery ceiling and enabled section-file settings are required. Optional template
fallbacks may be absent or intentionally empty; `GOV_NOTIFY_SERVICE_ID` is optional.
`ENV_NAME` and `PERMITTED_PROJECT_IDS` are reset-tool guardrails, not mandatory
application runtime settings. Tests do not depend on real ignored project files.

`--propose` emits **REVIEW_REQUIRED**, never a passing receipt. Inspect the exact
endpoint/key/hash deltas and replace `reviewedBy` and `reason` with the actual review.
Unedited placeholders (also with whitespace or different case) are rejected. Use
the direct `node` command when redirecting JSON to avoid npm's command banner.

An intentional environment update uses review `mode: "change-environment"`. It
authorizes only its exact before/after hashes and listed policy deviations. It
cannot authorize new Functions, runtime identities, invokers, secret versions,
custom hooks or unsupported trigger changes.

SDK reset-null options require care. Known defaults (default compute identity,
ingress, timeout, zero minimum instances and absent VPC) are compared explicitly.
`maxInstanceCount: null` has provider/quota-dependent behavior. Its exact
`providerDefaultResets` list requires review even with no environment delta. This
does **not** mean a healthy project is misconfigured or guarantee a post-deploy
value. The guard never assumes the observed value 20 is a universal default.

After review, use the same record for full genuine preflight and deployment:

```sh
export SODC_FUNCTIONS_CONFIG_REVIEW=/private/tmp/functions-config-reviewed.json
npm run deployment:preflight -- --env prod
npm run deploy:prod -- --from functions
```

That wrapper resumes Functions, Hosting, then audit. For **Functions only**, use:

```sh
npm run deploy:functions -- --env prod
# Equivalent from functions/: npm run deploy -- --env prod
```

Both require the full preflight and existing authorization-migration receipt. They
do not rerun/grant migrations. Do not substitute raw `firebase deploy --only functions`.

## Explicit preservation

When canonical local dotenv differs from deployed settings, normal mode blocks.
Do not copy local values into Dev to make it pass. To review preserving the existing
per-endpoint baseline instead:

```sh
export SODC_FUNCTIONS_CONFIG_MODE=preserve-existing
node scripts/functions-config-guard.mjs --env dev --propose > /private/tmp/dev-preservation-proposal.json
```

The CLI resolves an actually empty temporary `configDir`, with no effective
non-secret params. Its inheritance helper preserves each endpoint independently.
The proposal lists existing missing/empty policy deviations and default resets.
After review, set `SODC_FUNCTIONS_CONFIG_REVIEW` to the reviewed JSON and retain the
same mode/review for preflight and deployment. Review mode must be
`preserve-existing`, with **zero** application environment changes. This explicitly
retains an existing baseline for the release; Dev reconciliation remains separate.

## Fresh checks and handoff

The preflight guard runs after Functions build. Its ignored private receipt at
`.firebase/functions-config-guard/<env>.json` binds commit/tree, actual tracked
bytes, compiled build, SDK manifest/config context, dotenv existence/hashes,
Firebase config/aliases/policy/lockfiles, tools, review and provider baseline.
Reports contain key names, states, hashes and bounded metadata, never environment
values or credentials. Parse/child/provider failures use static sanitized codes.

The wrapper checks fresh metadata before its first remote deployment and immediately
before Functions, also on `--from dataconnect`/`--from functions`. A SHA-only old
attestation cannot bypass this. Source, ignored dotenv, build, SDK/tool or provider
changes block; a partial failed deployment can require fresh review/preflight.

The runner snapshots checked dotenv privately and copies hash-bound `.firebaserc`
so aliases still resolve. A temporary Functions-only Firebase config uses absolute
source/configDir paths. Only the canonical build hook is supported; it is suppressed
in the temporary config because preflight already built and hash-bound that artifact.
After the final local check, the runner awaits one pinned CLI command without retry
and removes temporary files in `finally`. Canonical source/config/dotenv stay intact.

Coverage applies to these npm entrypoints. Raw Firebase CLI commands are not
intercepted. No local guard atomically locks provider state or a checkout edited
after its final check; isolate the release and retain post-deploy evidence.

`npm run test:deploy-safety` uses temporary repositories and fake provider/CLI
adapters: no credentials, network, global Firebase installation or real ignored
configuration. It covers scoped/partial env, aliases, params, latest-secret drift,
review records, supported contracts, stale receipts and input changes during the
check/mutation handoff. CI warning gates and application checks are unchanged.
