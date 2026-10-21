import { defineConfig } from "vitest/config";
import { readSecurityIntegrationConfig } from "./scripts/run-security-integration.mjs";

readSecurityIntegrationConfig();

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/users-auth/accessRevocation.integration.ts"],
    setupFiles: [],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 180_000,
    hookTimeout: 90_000,
    retry: 0,
  },
});
