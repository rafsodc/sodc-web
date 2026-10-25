import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

let gate: (env: Record<string, string>, args?: string[]) => { projectId: string; emulatorHost: string; checkOnly: boolean };
const project = "demo-sodc-notification-recovery";
const accepted = { RUN_NOTIFICATION_RECOVERY_INTEGRATION: "1", NOTIFICATION_RECOVERY_INTEGRATION_PROJECT: project };

beforeAll(async () => {
  const runner = await import(pathToFileURL(path.resolve(__dirname, "../../../scripts/run-notification-recovery-integration.mjs")).href);
  gate = runner.validateNotificationRecoveryIntegrationEnvironment;
});

describe("local notification recovery SQL runner targeting gate", () => {
  it("accepts only the explicit fixed demo and owned loopback target", () => {
    expect(gate(accepted)).toEqual({ projectId: project, emulatorHost: "127.0.0.1:9398", checkOnly: false });
    expect(gate(accepted, ["--check"]).checkOnly).toBe(true);
  });
  it.each([{}, { ...accepted, RUN_NOTIFICATION_RECOVERY_INTEGRATION: "0" },
    { ...accepted, NOTIFICATION_RECOVERY_INTEGRATION_PROJECT: "sodc-web" },
    { ...accepted, NOTIFICATION_RECOVERY_INTEGRATION_PROJECT: "sodc-web-beta" },
    { ...accepted, NOTIFICATION_RECOVERY_INTEGRATION_PROJECT: "demo-other" }])("rejects missing opt-in or non-owned project %j", env => {
    expect(() => gate(env as Record<string, string>)).toThrow();
  });
  it.each(["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "FIREBASE_CONFIG", "NOTIFICATION_RECOVERY_FIXTURE_DIR", "NOTIFICATION_RECOVERY_INTEGRATION_RUN_ID"])("rejects externally supplied %s context", key => {
    expect(() => gate({ ...accepted, [key]: "sodc-web" })).toThrow();
  });
  it.each(["DATA_CONNECT_EMULATOR_HOST", "FIREBASE_DATA_CONNECT_EMULATOR_HOST", "FIREBASE_DATACONNECT_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"])("rejects conflicting %s transport", key => {
    expect(() => gate({ ...accepted, [key]: "example.com:9398" })).toThrow();
  });
  it.each([["--project", "sodc-web"], ["--fixture-dir=/tmp/other"], ["--check", "--check"]])("rejects target overrides and unsupported arguments %j", (...args) => {
    expect(() => gate(accepted, args)).toThrow();
  });
});
