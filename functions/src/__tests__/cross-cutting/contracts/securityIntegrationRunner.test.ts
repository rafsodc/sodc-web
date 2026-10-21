import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const runnerUrl = pathToFileURL(resolve(__dirname, "../../../../scripts/run-security-integration.mjs")).href;
let readSecurityIntegrationConfig: (environment: Record<string, string | undefined>) => { projectId: string };
beforeAll(async () => { ({ readSecurityIntegrationConfig } = await import(runnerUrl)); });
const valid = {
  RUN_SECURITY_INTEGRATION: "1",
  SECURITY_INTEGRATION_PROJECT: "sodc-web-beta",
  SECURITY_INTEGRATION_CONFIRM: "sodc-web-beta",
  SECURITY_INTEGRATION_API_KEY: "non-secret-test-key",
};

describe("real-token integration targeting", () => {
  it("accepts only explicit Dev/Beta opt-ins", () => {
    expect(readSecurityIntegrationConfig(valid).projectId).toBe("sodc-web-beta");
    expect(readSecurityIntegrationConfig({ ...valid, SECURITY_INTEGRATION_PROJECT: "sodc-web", SECURITY_INTEGRATION_CONFIRM: "sodc-web" }).projectId).toBe("sodc-web");
  });
  it("rejects default execution, missing confirmation and missing client key", () => {
    expect(() => readSecurityIntegrationConfig({})).toThrow(/opt in/);
    expect(() => readSecurityIntegrationConfig({ ...valid, SECURITY_INTEGRATION_CONFIRM: undefined })).toThrow(/CONFIRM/);
    expect(() => readSecurityIntegrationConfig({ ...valid, SECURITY_INTEGRATION_API_KEY: " " })).toThrow(/API_KEY/);
  });
  it("rejects production and lookalike project names", () => {
    for (const project of ["sodc-web-production", "prod", "sodc-web-beta.example.com", "sodc-web/../sodc-web-production"]) {
      expect(() => readSecurityIntegrationConfig({ ...valid, SECURITY_INTEGRATION_PROJECT: project, SECURITY_INTEGRATION_CONFIRM: project })).toThrow(/allowlisted/);
    }
  });
  it("rejects conflicting ADC project context and ambiguous Firebase configuration", () => {
    for (const key of ["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"]) {
      expect(() => readSecurityIntegrationConfig({ ...valid, [key]: "sodc-web-production" })).toThrow(/Conflicting/);
    }
    expect(() => readSecurityIntegrationConfig({ ...valid, FIREBASE_CONFIG: "config-file.json" })).toThrow(/ambiguous/);
    expect(() => readSecurityIntegrationConfig({ ...valid, FIREBASE_CONFIG: "null" })).toThrow(/ambiguous/);
    expect(() => readSecurityIntegrationConfig({ ...valid, FIREBASE_CONFIG: "[]" })).toThrow(/ambiguous/);
    expect(() => readSecurityIntegrationConfig({ ...valid, FIREBASE_CONFIG: JSON.stringify({ projectId: "sodc-web-production" }) })).toThrow(/Conflicting/);
    expect(readSecurityIntegrationConfig({ ...valid, FIREBASE_CONFIG: JSON.stringify({ projectId: "sodc-web-beta" }) }).projectId).toBe("sodc-web-beta");
  });
  it("rejects emulator transport overrides", () => {
    for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "DATA_CONNECT_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST"]) {
      expect(() => readSecurityIntegrationConfig({ ...valid, [key]: "127.0.0.1:9099" })).toThrow(/emulator/);
    }
  });
  it("keeps transport credentials out of validation failures", () => {
    const secret = "do-not-print-this-value";
    try {
      readSecurityIntegrationConfig({ ...valid, SECURITY_INTEGRATION_PROJECT: secret, SECURITY_INTEGRATION_API_KEY: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
