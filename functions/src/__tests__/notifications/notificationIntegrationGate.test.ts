import { describe, expect, it } from "vitest";
// The gate is pure and runs before the integration runner loads any Firebase module.
import { readNotificationIntegrationConfig } from "../../../scripts/run-notification-integration.mjs";
const enabled = { RUN_SECURITY_INTEGRATION: "1", SECURITY_INTEGRATION_PROJECT: "sodc-web-beta", SECURITY_INTEGRATION_CONFIRM: "sodc-web-beta" };
describe("non-production connector check opt-in gate", () => {
  it("refuses an ordinary test run and never needs credentials to reject it", () => {
    expect(() => readNotificationIntegrationConfig({})).toThrow(/opt in/);
  });
  it.each(["sodc-web-production", "production", "", "other-project"])("rejects project %s", (project) => {
    expect(() => readNotificationIntegrationConfig({ ...enabled, SECURITY_INTEGRATION_PROJECT: project, SECURITY_INTEGRATION_CONFIRM: project })).toThrow(/Dev\/Beta/);
  });
  it("requires matching explicit project confirmation", () => {
    expect(() => readNotificationIntegrationConfig({ ...enabled, SECURITY_INTEGRATION_CONFIRM: "sodc-web" })).toThrow(/must match/);
  });
  it.each(["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"])("rejects conflicting %s", (name) => {
    expect(() => readNotificationIntegrationConfig({ ...enabled, [name]: "sodc-web-production" })).toThrow(/Conflicting/);
  });
  it.each(["FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_DATA_CONNECT_EMULATOR_HOST", "CUSTOM_EMULATOR_HOST"])("rejects %s override", (name) => {
    expect(() => readNotificationIntegrationConfig({ ...enabled, [name]: "localhost:9999" })).toThrow(/Emulator/);
  });
  it("rejects conflicting, malformed and indirect Firebase config", () => {
    for (const FIREBASE_CONFIG of ["/tmp/config.json", "{", JSON.stringify({ projectId: "sodc-web-production" })]) {
      expect(() => readNotificationIntegrationConfig({ ...enabled, FIREBASE_CONFIG })).toThrow();
    }
  });
  it.each(["sodc-web", "sodc-web-beta"])("accepts only the confirmed %s project", (projectId) => {
    expect(readNotificationIntegrationConfig({ ...enabled, SECURITY_INTEGRATION_PROJECT: projectId, SECURITY_INTEGRATION_CONFIRM: projectId,
      FIREBASE_CONFIG: JSON.stringify({ projectId }) })).toEqual({ projectId });
  });
});
