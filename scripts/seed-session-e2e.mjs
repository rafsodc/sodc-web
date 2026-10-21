import { createRequire } from "node:module";

// Validate every destination before loading Admin SDKs or creating any account.
const projectId = "demo-sodc-session-isolation";
if (process.env.GCLOUD_PROJECT !== projectId ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.DATA_CONNECT_EMULATOR_HOST !== "127.0.0.1:9399") {
  throw new Error("Session fixtures require the demo project and explicit loopback Auth/Data Connect emulators.");
}
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDataConnect } = require("firebase-admin/data-connect");
const app = initializeApp({ projectId });
try {
  const auth = getAuth(app);
  const dataConnect = getDataConnect({ connector: "api", serviceId: "sodc-web-service", location: "europe-west2" }, app);
  for (const [suffix, lastName] of [["a", "Alpha"], ["b", "Beta"]]) {
    const uid = `session-e2e-${suffix}`;
    const email = `${uid}@example.test`;
    const properties = { email, password: "SessionLocalOnly!123", emailVerified: true, displayName: `Session ${lastName}`, disabled: false };
    try { await auth.getUser(uid); await auth.updateUser(uid, properties); }
    catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      await auth.createUser({ uid, ...properties });
    }
    await auth.setCustomUserClaims(uid, { enabled: true, admin: false });
    const now = new Date().toISOString();
    await dataConnect.executeGraphql(`
      mutation SeedSessionFixture($id: String!, $lastName: String!, $email: String!, $service: String!, $now: Timestamp!) {
        user_upsert(data: {
          id: $id, firstName: "Session", lastName: $lastName, email: $email, serviceNumber: $service,
          mobileNumber: "+447700900123", membershipStatus: REGULAR, requestedMembershipStatus: REGULAR,
          rank: "Not specified", isRegular: true, profileReviewedAt: $now,
          createdAt: $now, updatedAt: $now, createdBy: "local-session-fixture", updatedBy: "local-session-fixture"
        })
      }
    `, { variables: { id: uid, lastName, email, service: `E2E-${suffix}`, now } });
  }
  console.log("Two disposable session-isolation fixtures are ready in the local emulators.");
} finally { await deleteApp(app); }
