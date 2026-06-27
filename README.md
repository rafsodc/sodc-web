# SODC Web

The SODC members' site — section membership, event booking, guest ticket management, and payments.

**Beta site:** [https://sodc-web.web.app/](https://sodc-web.web.app/)

---

## For members

- [Getting started](docs/user-guide/member-getting-started.md) — registering, completing your profile, and getting approved
- [Booking an event](docs/user-guide/booking-an-event.md) — finding events, booking tickets, and guest ticket requests

## For administrators

- [Admin guide](docs/user-guide/admin-guide.md) — approving members, managing sections, events, and bookings

---

## Technical documentation

Full documentation index: [docs/README.md](docs/README.md)

---

## Repository layout

| Path | Contents |
|------|----------|
| `src/` | Frontend application (React, features, shared components, hooks, utilities) |
| `functions/src/` | Firebase Functions backend (callables, webhooks, server-side validation) |
| `dataconnect/` | Data Connect schema and GraphQL operations |
| `docs/` | Architecture, operations, and user documentation |
| `src/dataconnect-generated/` | Generated — do not hand-edit |
| `functions/src/dataconnect-admin-generated/` | Generated — do not hand-edit |

After changing `.gql` files, regenerate SDKs with:

```sh
npx firebase dataconnect:sdk:generate
```

---

## Local development

**Frontend:**

```sh
npm install
npm run dev
```

**Functions:**

```sh
cd functions
npm install
npm run build
```

See [docs/operations/environments-dev-beta-prod.md](docs/operations/environments-dev-beta-prod.md) for environment setup (cloud-backed dev; no emulators required).

---

## Tests

**Frontend:**

```sh
npm run test
```

**Functions:**

```sh
cd functions
npm run test
```

**Security/permission regression suites:**

```sh
cd functions
npm run test -- authGuards dataconnectAuthContracts functionEntryGuardContracts --run
```

---

## Dev-only reset helper

When running against the `dev` Firebase project you can wipe auth users, reset Data Connect user rows, and seed a verified admin account via the `devResetAndSeed` callable:

```sh
firebase functions:shell
firebase > devResetAndSeed({ email: "admin@example.com" })
# password: password
```

Guards: `ENV_NAME` must be `dev` or `stage`; the active project must be in `PERMITTED_PROJECT_IDS`.
