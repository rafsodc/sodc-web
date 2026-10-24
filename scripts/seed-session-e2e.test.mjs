import { describe, expect, it } from "vitest";
import { readSessionFixtureConfig } from "./seed-session-e2e.mjs";
const environment = {GCLOUD_PROJECT: "demo-sodc-session-isolation", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399"};
describe("local session fixture targeting before SDK/credential imports", () => {
  it("accepts only the explicit demo and loopback emulators", () => expect(readSessionFixtureConfig(environment)).toEqual({projectId: environment.GCLOUD_PROJECT}));
  it.each([{}, {GCLOUD_PROJECT: "sodc-web"}, {GOOGLE_CLOUD_PROJECT: "sodc-web"}, {FIREBASE_AUTH_EMULATOR_HOST: "remote:9099"}, {DATA_CONNECT_EMULATOR_HOST: "remote:9399"}, {FIREBASE_CONFIG: "{"}, {FIREBASE_CONFIG: JSON.stringify({projectId: "sodc-web"})}])("refuses ambiguous/cloud targeting: %s", overrides => {
    expect(() => readSessionFixtureConfig(overrides.GCLOUD_PROJECT === undefined && Object.keys(overrides).length === 0 ? {} : {...environment, ...overrides})).toThrow();
  });
});
