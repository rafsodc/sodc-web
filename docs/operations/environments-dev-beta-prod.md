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

Override without switching default:

```sh
firebase deploy --project beta
```

The repo expects a **beta** Firebase project whose ID matches the `beta` entry in `.firebaserc` (currently `sodc-web-beta`). If that project does not exist yet, create it in the [Firebase Console](https://console.firebase.google.com/) with that ID **or** pick another ID and update `.firebaserc` accordingly. Until the project exists, `firebase use beta` will fail until the alias points at a real project.

## Local development (laptop → cloud Dev)

1. **Clone** the repo and install dependencies (`npm install`, `cd functions && npm install`).
2. **Configure web app env** — Start from the committed template (no secrets in git):

   ```sh
   cp .env.development.example .env.development.local
   ```

   Edit `.env.development.local` with the **dev** Firebase web app values from the console (Project settings → Your apps). Variable meanings are listed in [environment-and-secrets.md](./environment-and-secrets.md). Ensure every `VITE_FIREBASE_*` value matches the **dev** project (`firebase use dev`).
3. **Run the app**:

   ```sh
   npm run dev
   ```

4. **Functions / Data Connect changes** — Deploy to **dev** when you need others (or your deployed web build) to hit updated server behavior:

   ```sh
   firebase use dev
   firebase deploy --only functions
   firebase deploy --only dataconnect
   ```

   Coordinate schema changes: Data Connect updates must be applied to each environment in order (typically dev → beta → prod) after review.

## Building and deploying the SPA

Always build with the environment variables for **the project you are about to deploy to**.

**Beta (staging mode)** — copy the template once, then fill with the **beta** Firebase web app:

```sh
cp .env.staging.example .env.staging.local
# edit .env.staging.local …
npm run build -- --mode staging
firebase deploy --only hosting --project beta
```

**Production** — use `.env.production.local` (gitignored) with the **prod** web app config, then `npm run build` (default mode is `production`), or set `VITE_*` in CI for the prod project.

Common mistakes:

- Building with **prod** vars and deploying to **beta** (or vice versa): wrong Auth project and confusing failures.
- Deploying **without** rebuilding after changing env files (stale API keys in `dist/`).

Recommendation: keep **only** `*.local` files on disk for secrets; use the committed `*.example` files as the checklist of keys, or export `VITE_*` in CI per environment.

## Promotion flow (recommended)

A practical sequence:

1. Implement and integrate on **dev** (`firebase use dev`).
2. When ready for wider validation, deploy the same revision (after review) to **beta** (`firebase use beta` or `--project beta`).
3. After beta sign-off, deploy to **prod** (`firebase use prod` or `--project prod`) using prod secrets and Stripe configuration.

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
