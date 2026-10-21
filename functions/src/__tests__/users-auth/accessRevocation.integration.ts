/**
 * Opt-in deployed-endpoint gate. Never loaded by the ordinary mocked unit config.
 * Credentials, passwords and retained signed tokens stay in memory.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { applicationDefault, deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";
import { createUser, MembershipStatus } from "@dataconnect/admin-generated";
import { initializeUserSecurityState } from "../../currentAuthorizationTransitions";

const runnerUrl = pathToFileURL(resolve(__dirname, "../../../scripts/run-security-integration.mjs")).href;
let config: { projectId: string; apiKey: string; appCheckToken?: string };
const runId = randomUUID().replace(/-/g, "");
const prefix = `security-it-${runId}`;
type Fixture = { uid: string; email: string; password: string };
type WireBody = {
  data?: Record<string, any>;
  result?: Record<string, any>;
  error?: { status?: string; message?: string; details?: unknown };
  errors?: unknown[];
  idToken?: string;
};
type WireResponse = { status: number; body: WireBody };
type SecuritySnapshot = { securityVersion: number; operationId: string };
let app: App;
let auth: Auth;
let dc: DataConnect;
let actor: Fixture;
let target: Fixture;
let actorToken: string;
const fixtures: Fixture[] = [];
const sectionNames = new Set<string>();

/** Do not put fetch errors/response objects in failed assertions: they can contain credentials. */
async function quiet<T>(label: string, operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch { throw new Error(`${label} failed; inspect non-secret service diagnostics separately.`); }
}

async function post(url: URL, body: unknown, headers: Record<string, string> = {}): Promise<WireResponse> {
  return quiet("CLIENT_REQUEST", async () => {
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body), signal: AbortSignal.timeout(25_000),
    });
    return { status: response.status, body: await response.json() as WireBody };
  });
}

function success(response: WireResponse): boolean {
  return response.status >= 200 && response.status < 300 && !response.body.error && !response.body.errors?.length;
}

function expectSuccess(response: WireResponse, label: string) {
  expect(success(response), `${label} must succeed against the deployed implementation`).toBe(true);
}

function expectDenied(response: WireResponse, label: string) {
  const errorText = JSON.stringify(response.body.error ?? response.body.errors ?? "");
  const recognized = /ACCESS_REVOKED|SESSION_VERSION_STALE|PERMISSION_DENIED|UNAUTHENTICATED|permission.denied|unauthenticated/i.test(errorText);
  expect(!success(response) && recognized, `${label} must fail authorization, not schema/input validation`).toBe(true);
  const disclosed = Object.values(response.body.data ?? {}).some((value) => value !== null && value !== undefined);
  expect(disclosed, `${label} must not return partial protected data`).toBe(false);
  expect(response.body.result == null, `${label} must not return a callable result`).toBe(true);
}

const appCheckHeaders = (): Record<string, string> => config.appCheckToken ? { "X-Firebase-AppCheck": config.appCheckToken } : {};

async function clientOperation(kind: "Query" | "Mutation", operationName: string, token: string, variables: Record<string, unknown> = {}) {
  const name = `projects/${config.projectId}/locations/europe-west2/services/sodc-web-service/connectors/api`;
  const url = new URL(`https://firebasedataconnect.googleapis.com/v1/${name}:execute${kind}`);
  url.searchParams.set("key", config.apiKey);
  return post(url, { name, operationName, variables }, { "X-Firebase-Auth-Token": token, ...appCheckHeaders() });
}

async function callable(name: string, token: string, data: Record<string, unknown> = {}) {
  return post(new URL(`https://europe-west2-${config.projectId}.cloudfunctions.net/${name}`), { data }, {
    Authorization: `Bearer ${token}`, ...appCheckHeaders(),
  });
}

async function signedToken(fixture: Fixture): Promise<string> {
  const url = new URL("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword");
  url.searchParams.set("key", config.apiKey);
  const response = await post(url, { email: fixture.email, password: fixture.password, returnSecureToken: true }, appCheckHeaders());
  expectSuccess(response, "Firebase password sign-in");
  if (typeof response.body.idToken !== "string") throw new Error("Firebase sign-in returned no signed ID token.");
  const token = response.body.idToken;
  const decoded = await quiet("SIGNED_TOKEN_VERIFICATION", () => auth.verifyIdToken(token));
  expect(decoded.uid === fixture.uid && decoded.aud === config.projectId, "Real signed token must belong to the disposable fixture/project").toBe(true);
  expect(Number.isInteger(decoded.securityVersion) && decoded.securityVersion > 0, "Deployed claims must carry the current security version").toBe(true);
  return token;
}

async function createFixture(role: string): Promise<Fixture> {
  const fixture = { uid: `${prefix}-${role}`, email: `${prefix}-${role}@example.invalid`, password: randomBytes(32).toString("base64url") };
  fixtures.push(fixture); // Register before creation so partial setup is still cleaned up.
  await quiet("CREATE_DISPOSABLE_AUTH", () => auth.createUser({ ...fixture, emailVerified: true, displayName: "Security integration fixture" }));
  await quiet("CREATE_DISPOSABLE_PROFILE", () => createUser({
    userId: fixture.uid, firstName: "Security", lastName: "Fixture", email: fixture.email,
    serviceNumber: runId, membershipStatus: MembershipStatus.REGULAR, now: new Date().toISOString(),
  }));
  await quiet("BOOTSTRAP_DISPOSABLE_CLAIMS", () => auth.setCustomUserClaims(fixture.uid, { enabled: true, admin: true }));
  await quiet("INITIALIZE_DISPOSABLE_SECURITY", () => initializeUserSecurityState({
    userId: fixture.uid, actorId: "security-integration-fixture", reason: "Disposable non-production test bootstrap", allowAdminBootstrap: true,
  }));
  return fixture;
}

async function readSnapshot(): Promise<SecuritySnapshot> {
  const result = await dc.executeGraphql<{ userSecurityState: SecuritySnapshot | null }, { userId: string }>(
    "query FixtureSecurity($userId: String!) { userSecurityState(key: {userId: $userId}) { securityVersion operationId } }",
    { variables: { userId: target.uid } },
  );
  if (!result.data.userSecurityState) throw new Error("Disposable security state is missing.");
  return result.data.userSecurityState;
}

async function profileFirstName(): Promise<string> {
  const result = await dc.executeGraphql<{ user: { firstName: string } | null }, { userId: string }>(
    "query FixtureProfile($userId: String!) { user(id: $userId) { firstName } }", { variables: { userId: target.uid } },
  );
  if (!result.data.user) throw new Error("Disposable profile is missing.");
  return result.data.user.firstName;
}

const upsertVariables = (firstName: string) => ({ firstName, lastName: "Fixture", serviceNumber: runId });

async function deniedReadsAndWrites(token: string, sectionId: string, label: string) {
  const beforeName = await profileFirstName();
  const beforeDisplayName = (await auth.getUser(target.uid)).displayName;
  expectDenied(await clientOperation("Query", "GetCurrentUser", token), `${label}: client member read`);
  expectDenied(await clientOperation("Query", "ListSections", token), `${label}: client admin read`);
  expectDenied(await clientOperation("Mutation", "UpsertUser", token, upsertVariables("Forbidden")), `${label}: client member write`);
  const sectionName = `${prefix}-denied-${sectionNames.size}`;
  sectionNames.add(sectionName);
  expectDenied(await clientOperation("Mutation", "CreateSection", token, { name: sectionName, type: "MEMBERS" }), `${label}: client admin write`);
  expectDenied(await callable("getSectionForUser", token, { sectionId }), `${label}: callable member read`);
  expectDenied(await callable("getNewMemberReportOptions", token), `${label}: callable admin read`);
  expectDenied(await callable("updateUserDisplayName", token, { userId: target.uid, displayName: "Forbidden" }), `${label}: callable admin write`);
  expectDenied(await callable("updateMembershipStatus", token, { userId: target.uid, newStatus: "RESERVE" }), `${label}: callable member write`);
  expect(await profileFirstName() === beforeName, `${label}: denied profile write has no side effect`).toBe(true);
  expect((await auth.getUser(target.uid)).displayName === beforeDisplayName, `${label}: denied Auth write has no side effect`).toBe(true);
  const created = await dc.executeGraphql<{ sections: unknown[] }, { name: string }>(
    "query DeniedSection($name: String!) { sections(where: {name: {eq: $name}}) {id} }", { variables: { name: sectionName } },
  );
  expect(created.data.sections.length, `${label}: denied section insertion has no side effect`).toBe(0);
}

async function revokeAndProbe(previousVersion: number, token: string, change: () => Promise<WireResponse>) {
  // Start probing the committed DB revision while Auth mirroring may still be in flight.
  // Attach a rejection handler immediately: setup/poll failure must not leave an unhandled request.
  const changing = change().then((response) => ({ response }), () => ({ failed: true as const }));
  let state: SecuritySnapshot | undefined;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const current = await readSnapshot();
    if (current.securityVersion > previousVersion) { state = current; break; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  expect(Boolean(state), "Supported transition must commit a newer security revision").toBe(true);
  if (!state) throw new Error("No committed security transition observed.");
  const stamp = await dc.executeGraphql<{ securityTransition: { createdAt: string } | null }, { id: string }>(
    "query FixtureCommit($id: String!) { securityTransition(key: {operationId: $id}) {createdAt} }", { variables: { id: state.operationId } },
  );
  const commitAt = Date.parse(stamp.data.securityTransition?.createdAt ?? "");
  expectDenied(await clientOperation("Query", "GetCurrentUser", token), "First post-commit retained-token probe");
  const denialMs = Date.now() - commitAt;
  expect(Number.isFinite(denialMs) && denialMs >= -1000 && denialMs <= 5000, "New-request denial must meet the proposed five-second target; test host clock must be synchronized").toBe(true);
  console.info(`[security integration] first retained-token denial after commit: ${Math.max(0, denialMs)}ms`);
  const finished = await changing;
  if (!("response" in finished)) throw new Error("Transition callable transport failed.");
  expectSuccess(finished.response, "Supported transition callable");
}

async function cleanupFixtures() {
  if (!dc || !auth || fixtures.length === 0) return;
  // Every predicate is bound to fresh in-memory run IDs; no broad project cleanup.
  const ids = fixtures.map((fixture) => fixture.uid);
  if (!ids.every((id) => id.startsWith(`${prefix}-`))) throw new Error("Refusing cleanup outside this disposable run.");
  const cleanup = `mutation CleanupSecurityFixtures($ids: [String!]!, $names: [String!]!) @transaction {
    section_deleteMany(where: {name: {in: $names}})
    notificationDelivery_deleteMany(where: {userId: {in: $ids}})
    callableRateLimitBucket_deleteMany(where: {userId: {in: $ids}})
    callableInvocation_deleteMany(where: {userId: {in: $ids}})
    securityTransition_deleteMany(where: {userId: {in: $ids}})
    userSecurityState_deleteMany(where: {userId: {in: $ids}})
    user_deleteMany(where: {id: {in: $ids}})
  }`;
  let databaseFailed = false;
  try { await dc.executeGraphql(cleanup, { variables: { ids, names: [...sectionNames] } }); } catch { databaseFailed = true; }
  let authFailed = false;
  for (const fixture of fixtures) {
    try { await auth.deleteUser(fixture.uid); } catch (error) {
      if ((error as { code?: string })?.code !== "auth/user-not-found") authFailed = true;
    }
  }
  if (databaseFailed || authFailed) throw new Error(`Disposable fixture cleanup incomplete for run ${prefix}; use the scoped operator cleanup procedure.`);
}

describe("issued-token revocation through deployed client endpoints", () => {
  beforeAll(async () => {
    const { readSecurityIntegrationConfig } = await import(runnerUrl);
    config = readSecurityIntegrationConfig();
    app = initializeApp({ projectId: config.projectId, credential: applicationDefault() });
    auth = getAuth(app);
    dc = getDataConnect({ serviceId: "sodc-web-service", location: "europe-west2" }, app);
    const mode = await quiet("READ_EMAIL_MODE", () => dc.executeGraphql<{ govNotifyDeliveryConfiguration: { mode: string } | null }, Record<string, never>>(
      "query IntegrationEmailMode { govNotifyDeliveryConfiguration(key: {id: \"site-wide\"}) { mode } }",
    ));
    expect(mode.data.govNotifyDeliveryConfiguration?.mode === "SIMULATION", "Explicit SIMULATION email configuration is required before membership test transitions").toBe(true);
    actor = await createFixture("actor");
    target = await createFixture("target");
    actorToken = await signedToken(actor);
  });

  afterAll(async () => {
    try { await cleanupFixtures(); } finally { if (app) await deleteApp(app); }
  });

  it("denies retained JWTs on reads/writes and never resurrects them after restore or regrant", async () => {
    const originalAdminToken = await signedToken(target);
    const originalVersion = (await readSnapshot()).securityVersion;
    expectSuccess(await clientOperation("Query", "GetCurrentUser", originalAdminToken), "Initial member read");
    expectSuccess(await clientOperation("Query", "ListSections", originalAdminToken), "Initial admin read");
    expectSuccess(await clientOperation("Mutation", "UpsertUser", originalAdminToken, upsertVariables("Before")), "Initial member write");
    const name = `${prefix}-baseline`;
    sectionNames.add(name);
    const created = await clientOperation("Mutation", "CreateSection", originalAdminToken, { name, type: "MEMBERS" });
    expectSuccess(created, "Initial admin write");
    const sectionId = created.body.data?.section_insert?.id;
    if (typeof sectionId !== "string") throw new Error("Fixture section was not returned.");
    expectSuccess(await callable("getSectionForUser", originalAdminToken, { sectionId }), "Initial protected callable read");
    expectSuccess(await callable("updateUserDisplayName", originalAdminToken, { userId: target.uid, displayName: "Before" }), "Initial protected callable write");

    await revokeAndProbe(originalVersion, originalAdminToken, () => callable("revokeAdmin", actorToken, { uid: target.uid }));
    await deniedReadsAndWrites(originalAdminToken, sectionId, "Admin revoked");
    const currentMemberToken = await signedToken(target);
    expectSuccess(await clientOperation("Query", "GetCurrentUser", currentMemberToken), "Refreshed member keeps member read");
    expectSuccess(await clientOperation("Mutation", "UpsertUser", currentMemberToken, upsertVariables("Current")), "Refreshed member keeps member write");
    expectDenied(await clientOperation("Query", "ListSections", currentMemberToken), "Refreshed member lacks admin access");

    const memberVersion = (await readSnapshot()).securityVersion;
    await revokeAndProbe(memberVersion, currentMemberToken, () => callable("updateMembershipStatus", actorToken, { userId: target.uid, newStatus: "LOST" }));
    await deniedReadsAndWrites(currentMemberToken, sectionId, "Member restricted");
    expectSuccess(await callable("updateMembershipStatus", actorToken, { userId: target.uid, newStatus: "REGULAR" }), "Restore membership");
    await deniedReadsAndWrites(currentMemberToken, sectionId, "Membership restored, previous token stays invalid");
    expectSuccess(await callable("grantAdmin", actorToken, { uid: target.uid }), "Regrant admin role");
    await deniedReadsAndWrites(originalAdminToken, sectionId, "Admin regranted, original token stays invalid");
    const currentAdminToken = await signedToken(target);
    expectSuccess(await clientOperation("Query", "ListSections", currentAdminToken), "New version restores intended admin read");
    expectSuccess(await callable("getNewMemberReportOptions", currentAdminToken), "New version restores intended callable admin read");
  });
});
