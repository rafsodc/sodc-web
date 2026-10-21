# Local session-isolation browser acceptance

This runner is opt-in and uses disposable emulator identities. It refuses non-loopback application targets and blocks remote HTTP/WebSocket requests before submitting credentials. Normal development remains cloud-backed; the emulator adapter runs only when Vite's `DEV` flag and `VITE_USE_FIREBASE_EMULATORS=true` are both set. Production builds cannot enable it.

## Prepare the local stack

Install the frontend and Functions dependencies, and install the Playwright Chromium browser. These commands do not start or seed accounts:

```sh
npm ci
npm --prefix functions ci
npx playwright install chromium
cp .env.session-e2e.example .env.session-e2e
```

Build Functions, then start Auth on port 9099, Functions on 5001, and Data Connect on 9399, using the demo project. Start these only against local disposable data:

```sh
npm --prefix functions run build
firebase emulators:start --only auth,functions,dataconnect --project demo-sodc-session-isolation
```

The repository's Data Connect schema/connectors must be loaded by the emulator. In another terminal, create two verified local users and their reviewed REGULAR profiles. The seed script validates the demo project and both exact loopback endpoints before loading Admin SDKs. It only upserts the two fixed fixture UIDs; it does not wipe any database:

```sh
GCLOUD_PROJECT=demo-sodc-session-isolation \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 \
node scripts/seed-session-e2e.mjs
npm run dev:session-e2e
```

## Run acceptance

Use a fresh terminal while the emulators and development server remain running:

```sh
SODC_SESSION_E2E=1 \
SODC_E2E_URL=http://127.0.0.1:4173 \
SODC_E2E_A_EMAIL=session-e2e-a@example.test \
SODC_E2E_A_PASSWORD='SessionLocalOnly!123' \
SODC_E2E_A_MARKER='Session Alpha' \
SODC_E2E_B_EMAIL=session-e2e-b@example.test \
SODC_E2E_B_PASSWORD='SessionLocalOnly!123' \
SODC_E2E_B_MARKER='Session Beta' \
npm run test:browser:session
```

The three scenarios cover shared-device/cross-tab isolation, blocked-storage first login, and Back/Forward after another tab signs out. Browser BFCache eligibility varies; inspect the browser history result in addition to the deterministic persisted-pageshow regression in `App.sessionIsolation.test.tsx`. Trace, screenshots and video are disabled. Do not substitute member credentials or point this runner at Dev/Beta/Prod.

Without `SODC_SESSION_E2E=1`, the command deliberately reports three skipped tests. `--list` only checks test discovery. Neither result is browser acceptance evidence.

## Release evidence still required

Record the emulator/Chromium versions, command, result and BFCache behavior before production promotion. The implementation session ran frontend/SDK unit integration checks and browser discovery/skip checks; it did not start emulators, create accounts, or run the browser scenarios. An already accepted server mutation can still complete after logout; these checks establish that its old callback cannot populate or act in a later session.
