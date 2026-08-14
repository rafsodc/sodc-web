import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vitestConfig from "../../vitest.config";

const functionsDirectory = process.cwd();
const outputDirectory = path.resolve(functionsDirectory, "lib");
const seededPaths: string[] = [];

function seedArtifact(relativePath: string): void {
  const target = path.resolve(outputDirectory, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "test artifact");
  seededPaths.push(target);
}

function ensureBuildEntryPoint(): void {
  const entryPoint = path.resolve(outputDirectory, "index.js");
  if (fs.existsSync(entryPoint)) return;

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(entryPoint, "// Test build entry point\n");
  seededPaths.push(entryPoint);
}

function verifyBuild() {
  return spawnSync(process.execPath, ["scripts/verify-functions-build.mjs"], {
    cwd: functionsDirectory,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const target of seededPaths.splice(0)) fs.rmSync(target, { force: true });
});

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
      "src/**/__tests__/**",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
    ]));

    expect(packageJson.scripts?.["dev-reset"]).toBe(
      "ts-node --project tsconfig.scripts.json scripts/cli-dev-reset.ts"
    );

    const testConfig = vitestConfig.test as {
      include?: string[];
      coverage?: { exclude?: string[] };
    };
    expect(testConfig.include).toEqual(expect.arrayContaining([
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
    ]));
    expect(testConfig.coverage?.exclude).toEqual(expect.arrayContaining([
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "src/**/__tests__/**",
    ]));
  });

  it("keeps test sources and compiled tests out of Firebase uploads", () => {
    const firebaseConfig = JSON.parse(
      fs.readFileSync(path.resolve(functionsDirectory, "..", "firebase.json"), "utf8")
    ) as { functions?: Array<{ ignore?: string[] }> };
    const ignore = firebaseConfig.functions?.[0]?.ignore ?? [];

    expect(ignore).toEqual(expect.arrayContaining([
      "src/**/__tests__/**",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "lib/**/__tests__/**",
      "lib/**/*.test.js",
      "lib/**/*.test.js.map",
      "lib/**/*.spec.js",
      "lib/**/*.spec.js.map",
    ]));
  });

  it.each([
    "nested/__tests__/example.js",
    "nested/example.test.js",
    "nested/example.test.js.map",
    "nested/example.spec.js",
    "nested/example.spec.js.map",
  ])("rejects forbidden compiled artifact %s", (relativePath) => {
    ensureBuildEntryPoint();
    seedArtifact(relativePath);

    const result = verifyBuild();

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(relativePath);
  });
});
