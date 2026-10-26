import { defineConfig } from "vitest/config";

// Actual Data Connect transactions in a fresh local database. Never load the
// ordinary test setup's global Firebase Auth/Data Connect mocks.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: [],
    include: ["src/__tests__/users-auth/adminRoleSafety.integration.ts", "src/__tests__/users-auth/groupSubscription.integration.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
