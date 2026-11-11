import {beforeAll, describe, expect, it, vi} from "vitest";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

let gate: (env: Record<string, string | undefined>, args?: string[]) => {projectId: string; region: string; checkOnly: boolean};
let run: (env: Record<string, string | undefined>, args?: string[]) => Promise<void>;
let callableUrl: (name: string) => string;
let notStarted: (response: unknown, status: string, code?: string) => void;
let taskIdentity: (metadata: unknown) => string;
let failureCategory: (error: unknown) => string;
beforeAll(async () => {
  const runner = await import(pathToFileURL(resolve("scripts/validate-self-account-deletion-cloud.mjs")).href);
  gate = runner.validateSelfAccountDeletionEnvironment;
  run = runner.runSelfAccountDeletionValidation;
  callableUrl = runner.selfDeletionCallableUrl;
  notStarted = runner.requireNotStartedRefusal;
  taskIdentity = runner.validateSelfDeletionTaskWorker;
  failureCategory = runner.selfDeletionValidationErrorCategory;
});
const safe = {RUN_SELF_ACCOUNT_DELETION_VALIDATION: "1", SELF_ACCOUNT_DELETION_PROJECT: "sodc-web", SELF_ACCOUNT_DELETION_CONFIRM: "sodc-web"};

describe("hosted self-deletion validation boundary", () => {
  it("requires all explicit fixed-Dev opt-ins before SDK or network access", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    try {
      for (const env of [{}, {...safe, RUN_SELF_ACCOUNT_DELETION_VALIDATION: ""}, {...safe, SELF_ACCOUNT_DELETION_CONFIRM: ""}]) {
        expect(() => gate(env, ["--check"])).toThrow("fixed Dev");
        await expect(run(env, ["--check"])).rejects.toThrow("fixed Dev");
      }
      expect(network).not.toHaveBeenCalled();
    } finally {network.mockRestore();}
  });
  it("checks targeting without needing SDK, ADC, an API key or network", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(gate(safe, ["--check"])).toEqual({projectId: "sodc-web", region: "europe-west2", checkOnly: true});
      await expect(run(safe, ["--check"])).resolves.toBeUndefined();
      expect(network).not.toHaveBeenCalled();
    } finally {network.mockRestore(); log.mockRestore();}
  });
  it.each(["sodc-web-production", "sodc-web-beta", "demo-sodc-admin-safety", "other"])("rejects non-Dev project %s", project => {
    expect(() => gate({...safe, SELF_ACCOUNT_DELETION_PROJECT: project}, ["--check"])).toThrow();
    expect(() => gate({...safe, SELF_ACCOUNT_DELETION_CONFIRM: project}, ["--check"])).toThrow();
  });
  it.each([
    {GCLOUD_PROJECT: "sodc-web-production"}, {GOOGLE_CLOUD_PROJECT: "sodc-web-beta"}, {VITE_FIREBASE_PROJECT_ID: "other"}, {FIREBASE_PROJECT_ID: "other"},
    {FIREBASE_CONFIG: "{}"}, {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}, {DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399"}, {FIREBASE_EMULATORS_HUB: "127.0.0.1:4400"},
    {SELF_ACCOUNT_DELETION_ENDPOINT: "https://production.example"}, {SELF_ACCOUNT_DELETION_TRANSPORT: "local"}, {SELF_ACCOUNT_DELETION_FIXTURE_PREFIX: "existing-member"},
  ])("refuses ambiguous, emulator or externally supplied execution context %j", overrides => {
    expect(() => gate({...safe, ...overrides}, ["--check"])).toThrow();
  });
  it("does not accept arbitrary targets, commands, fixture identifiers or endpoint arguments", () => {
    for (const args of [["--project", "sodc-web"], ["--uid", "existing-member"], ["--endpoint", "https://other"], ["--check", "extra"]]) {
      expect(() => gate(safe, args)).toThrow("Only --check");
    }
    expect(() => gate(safe)).toThrow("API key");
    expect(gate({...safe, VITE_FIREBASE_API_KEY: "synthetic-test-key"})).toMatchObject({checkOnly: false});
  });
  it("allows only the two fixed Dev hosted callables", () => {
    expect(callableUrl("deleteMyAccount")).toBe("https://europe-west2-sodc-web.cloudfunctions.net/deleteMyAccount");
    expect(callableUrl("deleteAccount")).toBe("https://europe-west2-sodc-web.cloudfunctions.net/deleteAccount");
    for (const name of ["https://other.example", "deleteMyAccount?project=prod", "../deleteAccount", "other"]) expect(() => callableUrl(name)).toThrow();
  });
  it("accepts only a proven hosted not-started refusal preserving the domain code", () => {
    notStarted({error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_CHANGED"}}}, "FAILED_PRECONDITION", "ACCOUNT_CHANGED");
    for (const response of [
      {error: {status: "FAILED_PRECONDITION", details: {code: "ACCOUNT_CHANGED"}}},
      {error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "OTHER"}}},
      {error: {status: "PERMISSION_DENIED", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_CHANGED"}}},
      {error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_DELETION_INCOMPLETE"}}},
      {result: {deleted: true}, error: {status: "FAILED_PRECONDITION", details: {deletionStatus: "NOT_STARTED", code: "ACCOUNT_CHANGED"}}},
    ]) expect(() => notStarted(response, "FAILED_PRECONDITION", "ACCOUNT_CHANGED")).toThrow();
  });
});


describe("hosted validation task identity", () => {
  const worker = {name: "projects/sodc-web/locations/europe-west2/functions/processAnnouncementEmail", state: "ACTIVE",
    serviceConfig: {serviceAccountEmail: "931675247602-compute@developer.gserviceaccount.com"}};
  it("accepts only the active fixed Dev worker's exact runtime identity", () => {
    expect(taskIdentity(worker)).toBe("931675247602-compute@developer.gserviceaccount.com");
  });
  it.each([
    undefined, {}, {...worker, name: "projects/sodc-web-production/locations/europe-west2/functions/processAnnouncementEmail"},
    {...worker, name: "projects/sodc-web/locations/us-central1/functions/processAnnouncementEmail"},
    {...worker, name: "projects/sodc-web/locations/europe-west2/functions/deleteMyAccount"},
    {...worker, state: "DEPLOYING"}, {...worker, serviceConfig: {}},
    {...worker, serviceConfig: {serviceAccountEmail: "123456789-compute@developer.gserviceaccount.com"}},
    {...worker, serviceConfig: {serviceAccountEmail: "other@sodc-web.iam.gserviceaccount.com"}},
    {...worker, serviceConfig: {serviceAccountEmail: "931675247602-compute@developer.gserviceaccount.com.attacker.example"}},
  ])("rejects missing, unrelated or changed task metadata %j", metadata => {
    expect(() => taskIdentity(metadata)).toThrow("Fixed Dev task worker");
  });
  it("reports only bounded static failure categories", () => {
    expect(failureCategory({code: "functions/invalid-argument", message: "private provider detail"})).toBe("task-invalid-argument");
    expect(failureCategory({code: "functions/permission-denied"})).toBe("task-permission-denied");
    expect(failureCategory({code: "functions/unknown-error", message: "credential details"})).toBe("task-unknown-error");
    expect(failureCategory({code: "ERR_ASSERTION", actual: "private data"})).toBe("assertion");
    for (const error of [new Error("private credential detail"), {code: "credential-secret-value"}, {code: "__proto__"}, null]) expect(failureCategory(error)).toBe("unclassified");
  });
});
