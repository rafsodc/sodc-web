import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

let validateAdminSafetyIntegrationEnvironment: (env: Record<string, string | undefined>, args?: string[]) => { checkOnly: boolean; emulatorHost: string };
beforeAll(async () => {
  ({ validateAdminSafetyIntegrationEnvironment } = await import(pathToFileURL(resolve("scripts/run-admin-safety-integration.mjs")).href));
});
const safe = { RUN_ADMIN_SAFETY_INTEGRATION: "1", ADMIN_SAFETY_INTEGRATION_PROJECT: "demo-sodc-admin-safety" };
describe("disposable admin safety SQL runner", () => {
  it("requires explicit opt-in before any SDK or network access", () => {
    expect(() => validateAdminSafetyIntegrationEnvironment({})).toThrow("RUN_ADMIN_SAFETY_INTEGRATION");
    expect(validateAdminSafetyIntegrationEnvironment(safe, ["--check"])).toMatchObject({ checkOnly: true, emulatorHost: "127.0.0.1:9399" });
  });
  it.each(["sodc-web", "sodc-web-beta", "sodc-web-production", "demo-other"])("rejects external project %s", project => {
    expect(() => validateAdminSafetyIntegrationEnvironment({ ...safe, ADMIN_SAFETY_INTEGRATION_PROJECT: project })).toThrow("fixed demo project");
  });
  it.each([
    { GCLOUD_PROJECT: "sodc-web" }, { GOOGLE_CLOUD_PROJECT: "sodc-web-production" },
    { FIREBASE_CONFIG: "{}" }, { ADMIN_SAFETY_FIXTURE_DIR: "/tmp/unowned" }, { ADMIN_SAFETY_INTEGRATION_RUN_ID: "unowned" },
    { DATA_CONNECT_EMULATOR_HOST: "remote.example:9399" }, { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" },
    { FIREBASE_DATA_CONNECT_EMULATOR_HOST: "https://remote.example:9399" }, { FIREBASE_DATACONNECT_EMULATOR_HOST: "remote.example:9399" },
  ])("refuses ambiguous or externally supplied context %j", overrides => {
    expect(() => validateAdminSafetyIntegrationEnvironment({ ...safe, ...overrides })).toThrow();
  });
  it("does not accept an arbitrary config, command or existing data directory", () => {
    for (const args of [["--project", "sodc-web"], ["--config", "/tmp/other"], ["--check", "extra"]]) {
      expect(() => validateAdminSafetyIntegrationEnvironment(safe, args)).toThrow("Only --check");
    }
  });
  it("keeps integration files outside the ordinary mocked suite and production build", () => {
    const config = readFileSync(resolve("vitest.admin-safety-integration.config.ts"), "utf8");
    expect(config).toContain("setupFiles: []");
    expect(config).toContain("adminRoleSafety.integration.ts");
    expect(readFileSync(resolve("vitest.config.ts"), "utf8")).not.toContain("integration.ts");
    expect(readFileSync(resolve("tsconfig.build.json"), "utf8")).toContain("src/**/__tests__/**");
  });
});
