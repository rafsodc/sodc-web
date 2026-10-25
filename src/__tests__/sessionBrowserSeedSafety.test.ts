/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "scripts/seed-session-e2e.mjs");
describe("local browser fixture destination guards", () => {
  it.each([
    { GCLOUD_PROJECT: "sodc-web-production", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399" },
    { GCLOUD_PROJECT: "demo-sodc-session-isolation", FIREBASE_AUTH_EMULATOR_HOST: "remote.example:9099", DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399" },
    { GCLOUD_PROJECT: "demo-sodc-session-isolation", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", DATA_CONNECT_EMULATOR_HOST: "remote.example:9399" },
  ])("rejects unsafe fixture destinations before loading Admin SDKs", (env) => {
    expect(() => execFileSync(process.execPath, [script], { env, stdio: "pipe" })).toThrow(/Session fixtures require the demo project/);
  });
});
