import { defineConfig } from "@playwright/test";

const baseURL = process.env.SODC_E2E_URL ?? "http://127.0.0.1:4173";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("Session acceptance tests require a local emulator-backed application.");
}
export default defineConfig({
  testDir: "./e2e",
  testMatch: "session-isolation.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chromium",
    launchOptions: {
      ignoreDefaultArgs: ["--disable-back-forward-cache"],
      args: ["--enable-features=BackForwardCache"],
    },
    trace: "off", screenshot: "off", video: "off",
  },
});
