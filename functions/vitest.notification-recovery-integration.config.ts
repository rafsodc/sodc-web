import { defineConfig } from "vitest/config";

// Actual SQL requests to a fresh, runner-owned loopback database. Do not load
// the ordinary test setup's Firebase Auth or Data Connect mocks.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: [],
    include: ["src/__tests__/notifications/notificationRecoveryClaims.integration.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
