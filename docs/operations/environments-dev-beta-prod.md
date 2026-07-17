# Dev, Beta, and Prod environments

Tracked in [GitHub issue #193](https://github.com/rafsodc/sodc-web/issues/193).

This document describes how we run **three isolated Firebase-backed environments** without relying on local emulators for day-to-day development. Each environment is a **separate Firebase (Google Cloud) project** so Auth, Data Connect, Cloud Functions, and Hosting stay segregated.

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
4. **Backend dependencies deploy schema-first** — For a full-stack release, verify generated Data Connect SDKs locally, deploy and validate Data Connect, deploy and validate Functions, then deploy Hosting. Do not use one unscoped `firebase deploy` command for a release that changes these dependencies.

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
# Example: deploy Hosting to beta — ensure VITE_* point at the beta Firebase web app
npm run build
firebase deploy --only hosting --project beta
```

Common mistakes:

- Building with **prod** `.env` and deploying to **dev** (wrong Auth project, confusing failures).
- Deploying **without** rebuilding after changing `.env` (stale API keys in `dist/`).

Recommendation: maintain **separate env files** that are **not committed**, e.g. `.env.dev.local`, `.env.beta.local`, `.env.prod.local`, and copy or symlink the right one before `npm run build`, or use your shell/CI to export variables.

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

### 4. Deploy and validate Functions

Only after the Data Connect checkpoint passes:

```sh
firebase deploy --only functions --project "$FIREBASE_PROJECT"
```

Smoke-test the changed callable, HTTP, or scheduled Function through a non-destructive path. Check Functions logs for startup, Data Connect operation, authorization, and secret/configuration errors. Also repeat one established callable flow to catch connector compatibility regressions.

### 5. Build and deploy Hosting

Confirm the active `.env` contains the target project's `VITE_*` values, rebuild, and deploy Hosting last:

```sh
npm run build
firebase deploy --only hosting --project "$FIREBASE_PROJECT"
```

Smoke-test sign-in, one Data Connect read, one callable action, a deep link, and the release's changed browser flow. For CSP/header changes, also follow [firebase-hosting-security-headers.md](./firebase-hosting-security-headers.md).

## Partial failure and rollback checkpoints

| Failure point | Safe response |
|---|---|
| SDK generation or either build fails | Stop. No remote state has changed; regenerate, fix, review, and restart. |
| Data Connect migration or connector deployment fails | Do not deploy Functions or Hosting. Preserve CLI output, inspect the service state, and prefer a forward-compatible fix. A schema migration may already have run even if a later connector step failed. |
| Data Connect smoke test fails | Stop before Functions. Restore the previous connector/schema from the last known-good commit only when that rollback is non-destructive; otherwise ship a reviewed forward fix. |
| Functions deploy or smoke test fails | Do not deploy Hosting. Keep the backward-compatible expanded schema in place and redeploy Functions from the last known-good release commit, then repeat the Function checkpoint. |
| Hosting build, deploy, or smoke test fails | Backend checkpoints remain valid. Rebuild/redeploy Hosting from the last known-good release commit with the correct environment variables. |

Checking out and redeploying a previous Data Connect definition cannot restore data removed by a destructive migration. Take a database backup and use a separately reviewed migration/rollback plan for destructive changes. Record the failed stage, target project, commit SHA, and corrective action before resuming promotion.

## Promotion flow (recommended)

A practical sequence:

1. Implement and integrate on **Dev**, completing all five rollout checkpoints.
2. Deploy the same reviewed commit to **Beta** and repeat SDK verification, Data Connect, Functions, Hosting, and smoke tests.
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
