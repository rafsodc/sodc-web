import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

let runner: any;
beforeAll(async () => {runner = await import(pathToFileURL(resolve("scripts/validate-account-erasure-disposal-cloud.mjs")).href);});
const optIn = (projectId = "sodc-web") => ({RUN_ACCOUNT_ERASURE_DISPOSAL_VALIDATION: "1", ACCOUNT_ERASURE_DISPOSAL_PROJECT: projectId, ACCOUNT_ERASURE_DISPOSAL_CONFIRM: projectId});
beforeEach(() => {vi.spyOn(console, "log").mockImplementation(() => undefined); vi.spyOn(console, "error").mockImplementation(() => undefined);});
afterEach(() => vi.restoreAllMocks());

function metadata(projectId: string) {
  const resources = runner.accountErasureDisposalCloudResources(projectId);
  const uri = resources.functionUrl;
  return {fn: {name: resources.functionName, state: "ACTIVE", buildConfig: {runtime: "nodejs24", entryPoint: "reconcilePendingSecurityTransitions"}, serviceConfig: {timeoutSeconds: 540, uri: "https://fixed-worker.a.run.app"}},
    job: {name: resources.jobName, state: "ENABLED", httpTarget: {httpMethod: "POST", uri, oidcToken: {audience: uri, serviceAccountEmail: "fixed-runtime@example-project.iam.gserviceaccount.com"}}}};
}
const old = "2026-01-01T00:06:00.000Z", started = "2026-01-01T00:00:30.000Z", provider = "2026-01-31T00:06:00.000Z";
function snapshot(fixture: any) {
  return {profile: null, markers: fixture.hashes.map((emailHash: string, index: number) => ({userId: fixture.uid, emailHash, startedAt: started, profileDeletedAt: old, completedAt: fixture.role === "incomplete" && index === 1 ? null : old})),
    decision: {userId: fixture.uid, generation: fixture.generation.replaceAll("-", ""), version: 1, internalQuiescedAt: old, taskSafeAt: old, providerSafeAt: provider, evidenceReference: "SYNTHETIC_HOSTED_VALIDATION", holdCode: fixture.role === "held" ? "OPERATOR_REVIEW" : null, reviewDueAt: null, nextAttemptAt: old, lastReason: null, updatedAt: old}};
}
function fakeRuntime(projectId: string) {
  const records = new Map<string, any>();
  const policy = {version: 4, externalReplayReviewed: true, reviewReference: "case/external-review"};
  const service = metadata(projectId);
  const admin = {userId: "baseline-admin", securityVersion: 9, accessReady: true, adminReady: true, desiredAdmin: true, desiredEnabled: true, verificationEmail: null, syncStatus: "READY", membershipStatus: "REGULAR", user: {membershipStatus: "REGULAR"}};
  const runtime = {
    auth: {getUser: vi.fn(async (uid: string) => {if (uid === admin.userId) return {disabled: false, emailVerified: true, customClaims: {admin: true, enabled: true, securityVersion: 9}}; throw {code: "auth/user-not-found"};})},
    security: {getAdminSafetyControl: vi.fn(async () => ({data: {adminSafetyControl: {status: "READY", readyAdminCount: 1}}})), listReadyAdministrators: vi.fn(async () => ({data: {userSecurityStates: [admin]}}))},
    dc: {executeGraphqlRead: vi.fn(async (query: string, options?: any) => {
      if (query.includes("HostedDisposalValidationPolicy")) return {data: {accountErasureDisposalPolicy: policy}};
      if (query.includes("OwnedDisposalValidationState")) return {data: records.get(options.variables.uid) ?? {profile: null, markers: [], decision: null}};
      throw new Error("Unexpected unit read");
    }), executeGraphql: vi.fn(async (query: string, options: any) => {
      if (query.includes("SeedOwnedDisposalValidation")) {
        for (const role of ["eligible", "held", "incomplete"]) {
          const variables = options.variables;
          const fixture = {role, uid: variables[`${role}Uid`], generation: variables[`${role}Generation`], hashes: [variables[`${role}First`], variables[`${role}Second`]]};
          records.set(fixture.uid, snapshot(fixture));
        }
      } else if (query.includes("CleanupOwnedDisposalValidation")) records.delete(options.variables.uid);
      else throw new Error("Unexpected unit mutation");
      return {data: {}};
    })},
    cloud: vi.fn(async (operation: string) => {
      if (operation === "function") return service.fn;
      if (operation === "job") return service.job;
      if (operation === "run") {
        for (const [uid, value] of records) {
          if (uid.endsWith("-eligible")) {
            if (projectId === "sodc-web-production") records.delete(uid);
            else Object.assign(value.decision, {version: 2, lastReason: "RESTORE_HORIZON_PENDING"});
          } else if (uid.endsWith("-incomplete")) Object.assign(value.decision, {version: 2, lastReason: "INCOMPLETE"});
        }
        return {};
      }
      throw new Error("Unexpected unit cloud operation");
    }), close: vi.fn(async () => undefined),
  };
  return {runtime, records, policy, service};
}

describe("hosted suppression disposal validation gate", () => {
  it.each(["sodc-web", "sodc-web-production"])("supports exact explicit target %s without loading runtime or credentials in check mode", async projectId => {
    const createRuntime = vi.fn(); const network = vi.spyOn(globalThis, "fetch");
    expect(runner.validateAccountErasureDisposalEnvironment(optIn(projectId), ["--check"])).toEqual({projectId, region: "europe-west2", checkOnly: true});
    await runner.runAccountErasureDisposalValidation(optIn(projectId), ["--check"], {createRuntime});
    expect(createRuntime).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
  });
  it.each([{}, {...optIn(), RUN_ACCOUNT_ERASURE_DISPOSAL_VALIDATION: ""}, {...optIn(), ACCOUNT_ERASURE_DISPOSAL_CONFIRM: ""}, {...optIn(), ACCOUNT_ERASURE_DISPOSAL_CONFIRM: "sodc-web-production"}])("refuses absent or mismatched opt-ins before runtime access", async env => {
    const createRuntime = vi.fn();
    await expect(runner.runAccountErasureDisposalValidation(env, [], {createRuntime})).rejects.toThrow("Explicit opt-in");
    expect(createRuntime).not.toHaveBeenCalled();
  });
  it.each(["sodc-web-beta", "demo-disposal", "other", "sodc-web-production.evil"])("rejects unsupported target %s", projectId => {
    expect(() => runner.validateAccountErasureDisposalEnvironment(optIn(projectId), ["--check"])).toThrow();
    expect(() => runner.accountErasureDisposalCloudResources(projectId)).toThrow();
  });
  it.each([
    {FIREBASE_CONFIG: "{}"}, {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}, {DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399"}, {FIREBASE_EMULATORS_HUB: "127.0.0.1:4400"},
    {GCLOUD_PROJECT: "sodc-web-production"}, {GOOGLE_CLOUD_PROJECT: "other"}, {VITE_FIREBASE_PROJECT_ID: "other"}, {FIREBASE_PROJECT_ID: "other"}, {CLOUDSDK_CORE_PROJECT: "other"},
    {ACCOUNT_ERASURE_DISPOSAL_ENDPOINT: "https://other.invalid"}, {ACCOUNT_ERASURE_DISPOSAL_SOURCE: "/tmp/other"}, {ACCOUNT_ERASURE_DISPOSAL_SOURCE_ROOT: "/tmp/other"}, {ACCOUNT_ERASURE_DISPOSAL_FIXTURE_PREFIX: "member"}, {ACCOUNT_ERASURE_DISPOSAL_UID: "member"},
    {FIREBASE_AUTH_EMULATOR_PORT: "9099"}, {CUSTOM_EMULATOR_HOST: "localhost"}, {GCE_METADATA_HOST: "other.invalid"}, {GCE_METADATA_IP: "127.0.0.1"}, {GCE_METADATA_ROOT: "http://other.invalid"}, {GOOGLE_GCE_METADATA_IP: "127.0.0.1"},
    {CLOUDSDK_API_ENDPOINT_OVERRIDES_CLOUDSCHEDULER: "https://other.invalid"}, {GOOGLE_API_ENDPOINT: "other.invalid"}, {AUTH_ENDPOINTS_OVERRIDE: "other.invalid"},
  ])("rejects emulator, conflicting project and external source/fixture context before loading SDK: %j", async overrides => {
    const createRuntime = vi.fn();
    await expect(runner.runAccountErasureDisposalValidation({...optIn(), ...overrides}, ["--check"], {createRuntime})).rejects.toThrow();
    expect(createRuntime).not.toHaveBeenCalled();
  });
  it.each([["--project", "sodc-web-production"], ["--source", "/tmp/other"], ["--check", "extra"], ["--uid", "member"]])("refuses arbitrary command arguments: %j", args => {
    expect(() => runner.validateAccountErasureDisposalEnvironment(optIn(), args)).toThrow("Only --check");
  });
});

describe("fixed Scheduler proof and owned metadata contracts", () => {
  it.each(["sodc-web", "sodc-web-production"])("accepts only the fixed existing hosted worker/job for %s", projectId => {
    const {fn, job} = metadata(projectId);
    expect(() => runner.validateAccountErasureDisposalScheduler(projectId, fn, job)).not.toThrow();
    for (const changed of [{...job, name: job.name + "-other"}, {...job, state: "PAUSED"}, {...job, httpTarget: {...job.httpTarget, uri: "https://other.invalid"}}, {...job, httpTarget: {...job.httpTarget, oidcToken: {audience: "https://other.invalid", serviceAccountEmail: "fixed@example.iam.gserviceaccount.com"}}}]) expect(() => runner.validateAccountErasureDisposalScheduler(projectId, fn, changed)).toThrow();
    expect(() => runner.validateAccountErasureDisposalScheduler(projectId, {...fn, state: "DEPLOYING"}, job)).toThrow();
    expect(() => runner.validateAccountErasureDisposalScheduler(projectId, {...fn, buildConfig: {...fn.buildConfig, entryPoint: "other"}}, job)).toThrow();
  });
  it("normalizes only the harmless root slash of the metadata-bound Cloud Run target", () => {
    const {fn, job} = metadata("sodc-web");
    job.httpTarget.uri = fn.serviceConfig.uri + "/";
    job.httpTarget.oidcToken.audience = job.httpTarget.uri;
    expect(() => runner.validateAccountErasureDisposalScheduler("sodc-web", fn, job)).not.toThrow();
    for (const suffix of ["/other", "/?extra=1", "/#fragment"]) {
      job.httpTarget.uri = fn.serviceConfig.uri + suffix; job.httpTarget.oidcToken.audience = job.httpTarget.uri;
      expect(() => runner.validateAccountErasureDisposalScheduler("sodc-web", fn, job)).toThrow();
    }
  });
  it("creates only three random metadata fixtures and scopes a single atomic seed to their exact UIDs/hashes", () => {
    const set = runner.createAccountErasureDisposalFixtures(), second = runner.createAccountErasureDisposalFixtures();
    expect(set.prefix === second.prefix).toBe(false);
    const seed = runner.accountErasureDisposalSeed(set);
    expect(Object.keys(seed.variables)).toHaveLength(12);
    expect(seed.query.match(/accountErasure_insertMany/g)).toHaveLength(1);
    expect(seed.query.match(/accountErasureDisposal_insertMany/g)).toHaveLength(1);
    expect(seed.query).toContain("@transaction");
    expect(seed.query).not.toMatch(/user_insert|user_update|user_delete|Policy_(?:update|insert|delete)/);
  });
  it("refuses a substituted fixture, changed namespace, extra alias and different lifecycle generation in cleanup", () => {
    const set = runner.createAccountErasureDisposalFixtures(), fixture = set.fixtures[0], state = snapshot(fixture);
    expect(() => runner.accountErasureDisposalCleanup(set, {...fixture}, state)).toThrow();
    expect(() => runner.accountErasureDisposalCleanup({...set, prefix: "member"}, fixture, state)).toThrow();
    expect(() => runner.accountErasureDisposalCleanup(set, fixture, {...state, markers: [...state.markers, {...state.markers[0], emailHash: "f".repeat(64)}]})).toThrow();
    expect(() => runner.accountErasureDisposalCleanup(set, fixture, {...state, decision: {...state.decision, generation: "f".repeat(32)}})).toThrow();
  });
  it("fences cleanup against concurrent runtime disposal using exact selected generation/version/count", () => {
    const set = runner.createAccountErasureDisposalFixtures(), fixture = set.fixtures[0], state = snapshot(fixture);
    const cleanup = runner.accountErasureDisposalCleanup(set, fixture, state);
    expect(cleanup.variables).toEqual({uid: fixture.uid, hashes: fixture.hashes, count: 2, generation: fixture.generation, version: 1});
    expect(cleanup.query).toContain("DISPOSAL_VALIDATION_CLEANUP_CONFLICT");
    expect(cleanup.query).not.toContain("user_delete");
  });
  it("requires processed-version/reason evidence and preserves every held/incomplete alias", () => {
    const set = runner.createAccountErasureDisposalFixtures();
    const states = Object.fromEntries(set.fixtures.map((fixture: any) => [fixture.role, snapshot(fixture)]));
    expect(runner.accountErasureDisposalHostedOutcome("sodc-web", set, states)).toBe(false);
    Object.assign(states.eligible.decision, {version: 2, lastReason: "RESTORE_HORIZON_PENDING"});
    Object.assign(states.incomplete.decision, {version: 2, lastReason: "INCOMPLETE"});
    expect(runner.accountErasureDisposalHostedOutcome("sodc-web", set, states)).toBe(true);
    expect(runner.accountErasureDisposalHostedOutcome("sodc-web-production", set, states)).toBe(false);
    states.eligible = {profile: null, markers: [], decision: null};
    expect(runner.accountErasureDisposalHostedOutcome("sodc-web-production", set, states)).toBe(true);
    states.held.markers.pop();
    expect(() => runner.accountErasureDisposalHostedOutcome("sodc-web-production", set, states)).toThrow();
  });
});

describe("runner orchestration with fake I/O (no hosted execution)", () => {
  it.each(["sodc-web", "sodc-web-production"])("uses existing Scheduler execution and removes only owned metadata for %s", async projectId => {
    const {runtime, records} = fakeRuntime(projectId);
    await runner.runAccountErasureDisposalValidation(optIn(projectId), [], {createRuntime: async () => runtime});
    expect(runtime.cloud.mock.calls.map(call => call[0])).toEqual(["function", "job", "run"]);
    expect(runtime.dc.executeGraphql).toHaveBeenCalledTimes(projectId === "sodc-web-production" ? 3 : 4);
    expect(records.size).toBe(0); expect(runtime.close).toHaveBeenCalledOnce();
    const output = [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.error).mock.calls].flat().join(" ");
    expect(output).not.toMatch(/baseline-admin|@example|[a-f0-9]{64}|disposal-validation-/);
  });
  it("aborts without seeding or triggering the scheduler when global external policy is unreviewed", async () => {
    const {runtime, policy} = fakeRuntime("sodc-web"); policy.externalReplayReviewed = false;
    await expect(runner.runAccountErasureDisposalValidation(optIn(), [], {createRuntime: async () => runtime})).rejects.toMatchObject({code: "VALIDATION_FAILED"});
    expect(runtime.dc.executeGraphql).not.toHaveBeenCalled(); expect(runtime.cloud.mock.calls.some(call => call[0] === "run")).toBe(false);
    expect(runtime.close).toHaveBeenCalledOnce();
  });
  it("cleans all three fixtures after an uncertain Scheduler failure without printing raw errors", async () => {
    const {runtime, records} = fakeRuntime("sodc-web");
    runtime.cloud.mockImplementation(async (operation: string) => {if (operation === "run") throw new Error("NEVER_PRINT_PASSWORD_OR_MEMBER"); return operation === "function" ? metadata("sodc-web").fn : metadata("sodc-web").job;});
    await expect(runner.runAccountErasureDisposalValidation(optIn(), [], {createRuntime: async () => runtime})).rejects.toMatchObject({code: "VALIDATION_FAILED"});
    expect(records.size).toBe(0); expect(runtime.dc.executeGraphql).toHaveBeenCalledTimes(4);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("NEVER_PRINT");
  });
  it("never reports cleanup confirmed after a rejected seed even if current reads are empty", async () => {
    const {runtime} = fakeRuntime("sodc-web");
    runtime.dc.executeGraphql.mockRejectedValueOnce(new Error("unconfirmed request"));
    await expect(runner.runAccountErasureDisposalValidation(optIn(), [], {createRuntime: async () => runtime})).rejects.toMatchObject({code: "VALIDATION_FAILED"});
    expect(runtime.cloud.mock.calls.some(call => call[0] === "run")).toBe(false);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).toContain("SEED_OUTCOME_UNCERTAIN CLEANUP_UNCONFIRMED");
    expect(vi.mocked(console.log).mock.calls.flat().join(" ")).not.toContain("PASS OWNED_METADATA_REMOVED");
    expect(runtime.close).toHaveBeenCalledOnce();
  });
  it("continues cleaning other owned fixtures when one unexpectedly changes generation", async () => {
    const {runtime, records} = fakeRuntime("sodc-web");
    const original = runtime.cloud.getMockImplementation()!;
    runtime.cloud.mockImplementation(async (operation: string) => {const result = await original(operation); if (operation === "run") for (const [uid, state] of records) if (uid.endsWith("-eligible")) state.decision.generation = "f".repeat(32); return result;});
    await expect(runner.runAccountErasureDisposalValidation(optIn(), [], {createRuntime: async () => runtime})).rejects.toMatchObject({code: "VALIDATION_FAILED"});
    expect(records.size).toBe(1); expect([...records.keys()].every(uid => uid.endsWith("-eligible"))).toBe(true);
    expect(runtime.close).toHaveBeenCalledOnce();
  });
});
