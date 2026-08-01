# Dev, Beta, and Prod environments

Tracked in [GitHub issue #193](https://github.com/rafsodc/sodc-web/issues/193).

This document describes how we run **three isolated Firebase-backed environments** without relying on local emulators for day-to-day development. Each environment is a **separate Firebase (Google Cloud) project** so Auth, Data Connect, Cloud Functions, and Hosting stay segregated.

For the first deployment into a newly created production project, complete the
[new production instance provisioning runbook](./new-production-instance.md)
before using the promotion process below.

## Goals

| Environment | Purpose |
|-------------|---------|
| **Dev** | Daily development from your laptop against shared cloud backends (safe to break). |
| **Beta** | Wider testing, deployment rehearsal, stakeholders—production-like but non-production data. |
| **Prod** | Live users only; changes arrive via promotion from Beta (or reviewed release process). |

## Principles

1. **One Firebase project per environment** — Data Connect and Functions are **project-scoped**. Hosting preview channels do **not** duplicate backends; they only swap static frontend bundles within a single project.
2. **Frontend config is baked at build time** — Vite reads `VITE_*` variables when you run `npm run build`. There is no runtime injection from Hosting for Firebase web SDK config. Each deploy pipeline must build with the correct `.env` for that target project.
3. **Secrets and Stripe differ per project** — Use separate webhook endpoints, Stripe secrets, and Firebase secrets per environment (see [environment-and-secrets.md](./environment-and-secrets.md)).
4. **Backend dependencies deploy schema-first** — For a full-stack release, verify generated Data Connect SDKs locally, deploy and validate Data Connect and Storage rules, deploy and validate Functions, then deploy Hosting. Do not use one unscoped `firebase deploy` command for a release that changes these dependencies.

Firebase Authentication password policy is also project-specific. Follow
[firebase-password-policy.md](./firebase-password-policy.md) in every
environment; Dev configuration is not inherited by Beta or Prod.

## Firebase CLI aliases

Aliases live in `.firebaserc` at the repo root. Typical mapping:

| Alias | Intended project | Audience |
|-------|------------------|----------|
| `dev` | Shared development project | Engineers |
| `beta` | Staging / pre-production | Team + beta testers |
| `prod` | Production project | End users |

Switch the active project before deploys:

```sh
firebase use dev    # or beta / prod
firebase projects:list
```

Inspect a project without switching the default alias:

```sh
firebase dataconnect:services:list --project beta
```

The repo expects a **beta** Firebase project whose ID matches the `beta` entry in `.firebaserc` (currently `sodc-web-beta`). If that project does not exist yet, create it in the [Firebase Console](https://console.firebase.google.com/) with that ID **or** pick another ID and update `.firebaserc` accordingly. Until the project exists, `firebase use beta` will fail until the alias points at a real project.

## Local development (laptop → cloud Dev)

1. **Clone** the repo and install dependencies (`npm install`, `cd functions && npm install`).
2. **Configure web app env** — Copy or merge from your team’s secure storage (do not commit secrets):
   - Use a **Dev-only** Firebase web app config in `.env` or `.env.local` (see variable list in [environment-and-secrets.md](./environment-and-secrets.md)).
   - Ensure every `VITE_FIREBASE_*` value matches the **dev** Firebase project that backends should use.
3. **Run the app**:

   ```sh
   npm run dev
   ```

4. **Functions / Data Connect changes** — Deploy to **dev** when you need others (or your deployed web build) to hit updated server behavior. Follow the full-stack rollout below; Data Connect must be deployed and checked before dependent Functions.

## Building and deploying the SPA (Hosting-only changes)

For a Hosting-only change, always build with the environment variables for **the project you are about to deploy to**. If the release also changes Data Connect or Functions, use the full-stack rollout sequence instead and do not deploy Hosting until its backend checkpoints pass.

```sh
# Build with .env.staging.local, then deploy to the beta alias.
npm run deploy:hosting:beta
```

Common mistakes:

- Building with **prod** `.env` and deploying to **dev** (wrong Auth project, confusing failures).
- Deploying **without** rebuilding after changing `.env` (stale API keys in `dist/`).

The repository's fixed commands pair each Firebase alias with its Vite mode and
ignored environment file:

| Target | Vite mode / local file | Build | Build and deploy Hosting |
|---|---|---|---|
| Dev | `development` / `.env.development.local` | `npm run build:dev` | `npm run deploy:hosting:dev` |
| Beta | `staging` / `.env.staging.local` | `npm run build:beta` | `npm run deploy:hosting:beta` |
| Prod | `production` / `.env.production.local` | `npm run build:prod` | `npm run deploy:hosting:prod` |

Use the combined deploy command for Hosting releases. It always rebuilds before
calling Firebase and cannot reuse a stale `dist` directory. `--project` selects
the remote Hosting project; it does not replace the Firebase configuration that
Vite already embedded in the bundle.

## One-command application deployment

For an ordinary reviewed application release, use the command pinned to the
target environment:

```sh
npm run deploy:dev
npm run deploy:beta
npm run deploy:prod
```

Run only the command for the environment being promoted. Each command requires
a clean checkout, verifies its Firebase alias, generates the Data Connect SDKs
and rejects generated drift, then deploys Data Connect, all Functions, and a
freshly rebuilt Hosting bundle in that order. It stops on the first failure and
finishes by checking the live deployment manifest against the deployed Git
revision.

These commands deliberately do not deploy Storage rules. Initial bucket setup
remains an operator procedure, and rules changes must be reviewed and deployed
explicitly before Functions:

```sh
firebase deploy --only storage --project dev
# Substitute beta or prod for the relevant promotion stage.
```

Use the detailed sequence below for first-time environment setup,
Storage-changing releases, manual checkpoints, or troubleshooting. Do not use
an unscoped `firebase deploy`: it can reuse a stale `dist` directory and does
not enforce the repository's dependency-safe stage ordering.

## Full-stack rollout sequence

Run this sequence independently for **Dev**, then **Beta**, then **Prod**. Complete the smoke-test checkpoint for one environment before promoting the same reviewed commit to the next. Replace `dev` below with `beta` or `prod` as appropriate.

### 1. Pin the target and release revision

```sh
export FIREBASE_PROJECT=dev
git status --short
git rev-parse HEAD
firebase dataconnect:services:list --project "$FIREBASE_PROJECT"
```

Start from a clean checkout of the reviewed release commit. Record the commit SHA and confirm that the Firebase alias resolves to the intended project. Beta and Prod must use the same commit that passed the preceding environment unless a new fix has been reviewed and the sequence restarts from Dev.

### 2. Verify generated SDK compatibility

Generate both the frontend and Admin SDKs from the checked-in schema and connector operations, then prove that the generated output is already committed and that both consumers compile:

```sh
npx firebase dataconnect:sdk:generate
git diff --exit-code -- src/dataconnect-generated functions/src/dataconnect-admin-generated
git status --short -- src/dataconnect-generated functions/src/dataconnect-admin-generated
npm run build
npm --prefix functions run build
```

The diff and status commands must both produce no output; the status check also catches new untracked generated files. If generation changes anything, stop and commit/review the generated files. If either build fails, stop before changing the remote environment. Do not deploy Functions compiled against stale generated operations.

### 3. Deploy and validate Data Connect

```sh
firebase deploy --only dataconnect --project "$FIREBASE_PROJECT"
firebase dataconnect:services:list --project "$FIREBASE_PROJECT"
```

Review migration and connector compatibility messages; do not add `--force` merely to bypass a warning or breaking-change assessment. Before continuing:

1. confirm the `sodc-web-service` schema and `api` connector deployment completed;
2. use the currently deployed client or Data Connect console to run a harmless existing read;
3. exercise a new or changed read-only operation when the release adds one; and
4. confirm existing Hosting and Functions traffic still works against the expanded schema.

Schema changes that remove or rename fields require an expand/migrate/contract rollout across separate releases. Do not approve destructive migration steps during an ordinary application deploy.

### 4. Deploy and validate Storage rules

When the release uses section files, first confirm Cloud Storage for Firebase
has been initialized in the target project's Firebase console and the exact
bucket name matches `VITE_FIREBASE_STORAGE_BUCKET` and
`SECTION_FILES_BUCKET`. Follow
[section-file-storage.md](./section-file-storage.md) for the initial bucket,
IAM, lifecycle, and CORS setup.

Deploy the repository's deny-all client rules:

```sh
firebase deploy --only storage --project "$FIREBASE_PROJECT"
```

Confirm the CLI targeted the intended project's bucket. Use the Firebase Rules
Playground or an unauthenticated Firebase Storage SDK request to verify direct
client reads and writes are denied. Stop before Functions if Storage is absent,
mis-targeted, or permissive.

### 5. Deploy and validate Functions

Only after the Data Connect and Storage checkpoints pass:

```sh
firebase deploy --only functions --project "$FIREBASE_PROJECT"
```

Smoke-test the changed callable, HTTP, or scheduled Function through a non-destructive path. Check Functions logs for startup, Data Connect operation, authorization, and secret/configuration errors. Also repeat one established callable flow to catch connector compatibility regressions.

### 6. Build and deploy Hosting

Use the fixed command for the current rollout target. It selects the matching
Vite mode, rebuilds, and deploys Hosting last:

```sh
npm run deploy:hosting:dev
# Use deploy:hosting:beta or deploy:hosting:prod at those promotion stages.
```

Smoke-test sign-in, one Data Connect read, one callable action, a deep link, and the release's changed browser flow. For CSP/header changes, also follow [firebase-hosting-security-headers.md](./firebase-hosting-security-headers.md).

Then run the read-only deployment audit and require the live manifest to match
the reviewed commit:

```sh
npm run deployment:check -- \
  --env "$FIREBASE_PROJECT" \
  --expected-sha "$(git rev-parse HEAD)"
```

See [deployment configuration and health checks](./deployment-checks.md) for
permissions, JSON output, authenticated smoke checks, and manual checkpoints.

## Partial failure and rollback checkpoints

| Failure point | Safe response |
|---|---|
| SDK generation or either build fails | Stop. No remote state has changed; regenerate, fix, review, and restart. |
| Data Connect migration or connector deployment fails | Do not deploy Functions or Hosting. Preserve CLI output, inspect the service state, and prefer a forward-compatible fix. A schema migration may already have run even if a later connector step failed. |
| Data Connect smoke test fails | Stop before Functions. Restore the previous connector/schema from the last known-good commit only when that rollback is non-destructive; otherwise ship a reviewed forward fix. |
| Storage is not initialized, targets the wrong bucket, or rules verification fails | Do not deploy file Functions or Hosting. Correct the target/configuration and redeploy deny-all rules. Do not make the bucket public as a workaround. |
| Functions deploy or smoke test fails | Do not deploy Hosting. Keep the backward-compatible expanded schema in place and redeploy Functions from the last known-good release commit, then repeat the Function checkpoint. |
| Hosting build, deploy, or smoke test fails | Backend checkpoints remain valid. Rebuild/redeploy Hosting from the last known-good release commit with the correct environment variables. |

Checking out and redeploying a previous Data Connect definition cannot restore data removed by a destructive migration. Take a database backup and use a separately reviewed migration/rollback plan for destructive changes. Record the failed stage, target project, commit SHA, and corrective action before resuming promotion.

## Promotion flow (recommended)

A practical sequence:

1. Implement and integrate on **Dev**, completing all six rollout checkpoints.
2. Deploy the same reviewed commit to **Beta** and repeat SDK verification, Data Connect, Storage, Functions, Hosting, and smoke tests.
3. After Beta sign-off, repeat the complete sequence for **Prod** using production secrets and Stripe configuration.

Branch ↔ environment mapping is a **team convention** (e.g. feature branches → dev only; `main` → beta then prod). Document any automation (GitHub Actions) in the workflow repo settings.

## Stripe and external callbacks

Beta and Prod must use **different** Stripe webhook URLs and dashboard endpoints unless you intentionally share a test mode—typically Beta uses Stripe **test** keys and Prod uses **live** keys. Document webhook URLs per environment in [stripe-webhook-endpoints.md](./stripe-webhook-endpoints.md) and keep them updated.

## Hosting preview channels (optional)

Preview channels are **optional** and apply **only within one Firebase project**. Useful for:

- PR previews against **dev** or **beta** without overwriting the default site.

They do **not** replace the Beta project for full-stack staging.

## Related documentation

- [environment-and-secrets.md](./environment-and-secrets.md) — Variable and secret matrix.
- [contributor-workflow.md](../contributor-workflow.md) — Branches, PRs, tests.
- [stripe-webhook-endpoints.md](./stripe-webhook-endpoints.md) — Webhook URLs per deployment.
- [deployment-checks.md](./deployment-checks.md) — Read-only configuration audit and runtime checks.
