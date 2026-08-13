import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const functionsDirectory = process.cwd();

describe("Functions production build artifact", () => {
  it("uses a clean, test-excluding, verified build pipeline", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(functionsDirectory, "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    const build = packageJson.scripts?.build ?? "";

    expect(build).toContain("clean-functions-build.mjs");
    expect(build).toContain("tsc -p tsconfig.build.json");
    expect(build).toContain("verify-functions-build.mjs");

    const buildConfig = JSON.parse(
      fs.readFileSync(path.resolve(functionsDirectory, "tsconfig.build.json"), "utf8")
    ) as { exclude?: string[] };
    expect(buildConfig.exclude).toEqual(expect.arrayContaining([
      "src/__tests__/**",
      "src/**/*.test.ts",
    ]));

    expect(packageJson.scripts?.["dev-reset"]).toBe(
      "ts-node --project tsconfig.scripts.json scripts/cli-dev-reset.ts"
    );
  });

  it("keeps test sources and compiled tests out of Firebase uploads", () => {
    const firebaseConfig = JSON.parse(
      fs.readFileSync(path.resolve(functionsDirectory, "..", "firebase.json"), "utf8")
    ) as { functions?: Array<{ ignore?: string[] }> };
    const ignore = firebaseConfig.functions?.[0]?.ignore ?? [];

    expect(ignore).toEqual(expect.arrayContaining([
      "src/__tests__/**",
      "src/**/*.test.ts",
      "lib/__tests__/**",
      "lib/**/*.test.js",
      "lib/**/*.test.js.map",
    ]));
  });
});
