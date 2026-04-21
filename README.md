# SODC Web

SODC Web is a React + Firebase application for section membership, event booking, moderation, and payments.

## Repository layout

- `src/`: frontend application code (features, shared components, hooks, utilities)
- `functions/src/`: Firebase Functions backend (callables, webhooks, server-side rules)
- `dataconnect/`: Data Connect schema and GraphQL operations
- `docs/`: architecture and operational documentation

Detailed structure conventions live in:
- `docs/architecture/repo-structure.md`

Documentation index:
- `docs/README.md`

## Generated code

These folders are generated from Data Connect operations and should not be hand-edited in normal flow:

- `src/dataconnect-generated/`
- `functions/src/dataconnect-admin-generated/`

After `.gql` changes, regenerate SDKs with:

```sh
npx firebase dataconnect:sdk:generate
```

## Local development

Frontend:

```sh
npm install
npm run dev
```

Functions:

```sh
cd functions
npm install
npm run build
```

## Test commands

Frontend tests:

```sh
npm run test
```

Functions tests:

```sh
cd functions
npm run test
```

Focused security/permission regression suites (functions):

```sh
cd functions
npm run test -- authGuards dataconnectAuthContracts functionEntryGuardContracts --run
```

## Dev-only reset helper (emulator)

When running the Firebase emulators you can wipe auth users, soft-reset DataConnect user rows, and seed a verified/enabled admin account.

- Callable: `devResetAndSeed`
- Payload: `{ email: "<desired-admin-email>" }`
- Password: `password`
- Guard:
  - `ENV_NAME` must be `dev` or `stage` (fails otherwise).
  - Active `projectId` (from `FIREBASE_CONFIG`/`GCLOUD_PROJECT`) must be in `PERMITTED_PROJECT_IDS` (comma-separated). If not, it fails and instructs you to add it.

Example (with emulators running):
```sh
firebase functions:shell
firebase > devResetAndSeed({ email: "admin@example.com" })
```
