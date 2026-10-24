import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Pure guard: no SDK, credential discovery or network before exact demo/loopback targeting. */
export function readSessionFixtureConfig(environment = process.env) {
  const projectId = "demo-sodc-session-isolation";
  if (environment.GCLOUD_PROJECT !== projectId ||
      (environment.GOOGLE_CLOUD_PROJECT && environment.GOOGLE_CLOUD_PROJECT !== projectId) ||
      environment.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
      environment.DATA_CONNECT_EMULATOR_HOST !== "127.0.0.1:9399") {
    throw new Error("Session fixtures require the demo project and explicit loopback Auth/Data Connect emulators.");
  }
  if (environment.FIREBASE_CONFIG) {
    let config;
    try {config = JSON.parse(environment.FIREBASE_CONFIG);} catch {throw new Error("Invalid session fixture Firebase config.");}
    if (!config || config.projectId !== projectId) throw new Error("Conflicting session fixture Firebase project.");
  }
  return {projectId};
}

export async function seedSessionFixtures() {
  const {projectId} = readSessionFixtureConfig();
  const require = createRequire(new URL("../functions/package.json", import.meta.url));
  const { initializeApp, deleteApp, getApps } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getDataConnect } = require("firebase-admin/data-connect");
  const { initializeUserSecurityState, transitionUserSecurity, synchronizeUserSecurity,
    bootstrapAdminSafetyControl, activateAdminSafetyControl } = require("../functions/lib/currentAuthorizationTransitions.js");
  const { getUserSecurityState, getAdminSafetyControl } = require("../functions/lib/securityRepository.js");
  // Emulator-only owner credential never consults ADC or a cloud metadata endpoint.
  const app = initializeApp({projectId, credential: {getAccessToken: async () => ({access_token: "owner", expires_in: 3600})}});
  const run = randomUUID();
  const actor = {actorId: "local-session-fixture", actorKind: "OPERATOR"};
  try {
    const auth = getAuth(app);
    const dataConnect = getDataConnect({connector: "api", serviceId: "sodc-web-service", location: "europe-west2"}, app);
    if (!(await getAdminSafetyControl()).data.adminSafetyControl) {
      await bootstrapAdminSafetyControl({...actor, operationId: `session-control:${run}`, reason: "Explicit local fixture control creation", recoverObservedDrift: true});
    }
    // The anchor makes READY control possible without turning member fixtures into admins.
    for (const [suffix, lastName] of [["admin", "Anchor"], ["a", "Alpha"], ["b", "Beta"]]) {
      const uid = `session-e2e-${suffix}`, email = `${uid}@example.test`;
      let state = (await getUserSecurityState({userId: uid})).data.userSecurityState;
      let identity;
      try {identity = await auth.getUser(uid);} catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
        // Record the observed deletion before recreating the owned identity so
        // retained tokens cannot inherit the former security revision.
        if (state) await synchronizeUserSecurity(state.operationId);
        identity = await auth.createUser({uid, email, password: "SessionLocalOnly!123", emailVerified: true, displayName: `Session ${lastName}`});
      }
      if (identity.email !== email) throw new Error("Unexpected local fixture identity; use a fresh owned emulator data directory.");
      await auth.updateUser(uid, {password: "SessionLocalOnly!123", displayName: `Session ${lastName}`});
      const profile = await dataConnect.executeGraphql("query FixtureProfile($id: String!) {user(id: $id) {id}}", {variables: {id: uid}});
      const now = new Date().toISOString();
      const fields = `firstName: "Session", lastName: $lastName, email: $email, serviceNumber: $service,
        mobileNumber: "+447700900123", requestedMembershipStatus: REGULAR, rank: "Not specified", isRegular: true,
        profileReviewedAt: $now, updatedAt: $now, updatedBy: "local-session-fixture"`;
      // Membership status of an existing profile is changed only by the coordinator.
      const mutation = profile.data.user
        ? `user_update(key: {id: $id}, data: {${fields}})`
        : `user_insert(data: {id: $id, membershipStatus: REGULAR, ${fields}, createdAt: $now, createdBy: "local-session-fixture"})`;
      await dataConnect.executeGraphql(`mutation SeedSessionFixture($id: String!, $lastName: String!, $email: String!, $service: String!, $now: Timestamp!) {${mutation}}`,
        {variables: {id: uid, lastName, email, service: `E2E-${suffix}`, now}});
      if (state) await synchronizeUserSecurity(state.operationId);
      if (!identity.emailVerified) {
        if (state) await transitionUserSecurity({...actor, userId: uid, reason: "LOCAL_FIXTURE_VERIFICATION_HOLD", verificationEmail: email, operationId: `session-hold:${run}:${suffix}`});
        await auth.updateUser(uid, {emailVerified: true}); // Existing authority is already held/denied.
      }
      if (!state && suffix === "admin") {
        const current = await auth.getUser(uid);
        await auth.setCustomUserClaims(uid, {...current.customClaims, admin: true}); // No authority exists until verified completion.
      }
      await initializeUserSecurityState({...actor, userId: uid, reason: "LOCAL_FIXTURE_BOOTSTRAP", allowAdminBootstrap: suffix === "admin", operationId: `session-init:${run}:${suffix}`});
      state = (await getUserSecurityState({userId: uid})).data.userSecurityState;
      await transitionUserSecurity({...actor, userId: uid, reason: "LOCAL_FIXTURE_READY", admin: suffix === "admin", authDisabled: false,
        ...(suffix !== "admin" || !state?.adminReady ? {membershipStatus: "REGULAR"} : {}),
        ...(state?.verificationEmail ? {releaseEmailVerification: true} : {}), operationId: `session-ready:${run}:${suffix}`});
    }
    await activateAdminSafetyControl({...actor, operationId: `session-activate:${run}`, reason: "Verified local anchor and member fixtures"});
    console.log("Two disposable member fixtures and a separate ready admin anchor are prepared in local emulators.");
  } finally {
    await Promise.all(getApps().filter(candidate => candidate.options.projectId === projectId).map(candidate => deleteApp(candidate)));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await seedSessionFixtures();
