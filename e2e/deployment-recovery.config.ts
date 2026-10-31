import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "deployment-recovery.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  reporter: "list",
  use: {
    browserName: "chromium",
    channel: "chromium",
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: { ignoreDefaultArgs: ["--disable-back-forward-cache"] },
  },
});
