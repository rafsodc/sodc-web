import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

let gate: (env: Record<string, string>, args?: string[]) => { projectId: string; emulatorHost: string; checkOnly: boolean };
const project = "demo-sodc-section-permissions";
const accepted = { RUN_SECTION_PERMISSIONS_INTEGRATION: "1", SECTION_PERMISSIONS_INTEGRATION_PROJECT: project };

beforeAll(async () => {
  const runner = await import(pathToFileURL(path.resolve(__dirname, "../../../scripts/run-section-permissions-integration.mjs")).href);
  gate = runner.validateSectionPermissionsIntegrationEnvironment;
});

describe("local section permissions SQL runner targeting gate", () => {
  it("accepts only the explicit fixed demo and owned loopback target", () => {
    expect(gate(accepted)).toEqual({ projectId: project, emulatorHost: "127.0.0.1:9396", checkOnly: false });
    expect(gate(accepted, ["--check"]).checkOnly).toBe(true);
  });
  it.each([{}, { ...accepted, RUN_SECTION_PERMISSIONS_INTEGRATION: "0" },
    { ...accepted, SECTION_PERMISSIONS_INTEGRATION_PROJECT: "sodc-web" },
    { ...accepted, SECTION_PERMISSIONS_INTEGRATION_PROJECT: "sodc-web-beta" },
    { ...accepted, SECTION_PERMISSIONS_INTEGRATION_PROJECT: "demo-other" }])("rejects missing opt-in or non-owned project %j", env => {
    expect(() => gate(env as Record<string, string>)).toThrow();
  });
  it.each(["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "FIREBASE_CONFIG", "SECTION_PERMISSIONS_FIXTURE_DIR", "SECTION_PERMISSIONS_INTEGRATION_RUN_ID"])("rejects externally supplied %s context", key => {
    expect(() => gate({ ...accepted, [key]: "sodc-web" })).toThrow();
  });
  it.each(["DATA_CONNECT_EMULATOR_HOST", "FIREBASE_DATA_CONNECT_EMULATOR_HOST", "FIREBASE_DATACONNECT_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"])("rejects conflicting %s transport", key => {
    expect(() => gate({ ...accepted, [key]: "example.com:9396" })).toThrow();
  });
  it.each([["--project", "sodc-web"], ["--fixture-dir=/tmp/other"], ["--check", "--check"]])("rejects target overrides and unsupported arguments %j", (...args) => {
    expect(() => gate(accepted, args)).toThrow();
  });
});
