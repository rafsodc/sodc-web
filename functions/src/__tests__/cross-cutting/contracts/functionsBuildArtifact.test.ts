import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import vitestConfig from "../../../../vitest.config";

const functionsDirectory = process.cwd();
const require = createRequire(import.meta.url);
const minimatch = require("minimatch") as (value: string, pattern: string) => boolean;
const buildConfig = JSON.parse(
  fs.readFileSync(path.resolve(functionsDirectory, "tsconfig.build.json"), "utf8")
) as { exclude: string[] };
const cliOnlySources = buildConfig.exclude.filter((value) => /^src\/[^*?]+\.ts$/.test(value));
const temporaryDirectories: string[] = [];
const sourceClosureCache = new Map<string, Set<string>>();
const compilerIntegrationTimeout = 30_000;

function fixture(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "functions-build-boundary-"));
  temporaryDirectories.push(directory);
  for (const name of ["tsconfig.json", "tsconfig.build.json", "tsconfig.scripts.json"]) {
    const config = JSON.parse(fs.readFileSync(path.resolve(functionsDirectory, name), "utf8"));
    if (name === "tsconfig.json") {
      config.compilerOptions.types = [];
      config.compilerOptions.skipLibCheck = true;
    }
    write(directory, name, JSON.stringify(config));
  }
  write(directory, "src/index.ts", "export { value } from \"./runtime\";");
  write(directory, "src/runtime.ts", "export const value = 1;");
  for (const source of cliOnlySources) write(directory, source, "export const cliValue = 1;");
  return directory;
}

function write(directory: string, name: string, contents: string): void {
  const target = path.resolve(directory, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function compile(directory: string, config = "tsconfig.build.json") {
  return spawnSync(process.execPath, [
    path.resolve(functionsDirectory, "node_modules/typescript/lib/tsc.js"), "-p", config,
  ], { cwd: directory, encoding: "utf8" });
}

function verifyBuild(directory: string) {
  const verifier = pathToFileURL(path.resolve(functionsDirectory, "scripts/verify-functions-build.mjs")).href;
  return spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { verifyFunctionsBuild } from ${JSON.stringify(verifier)}; await verifyFunctionsBuild(process.argv[1]);`,
    directory,
  ], { cwd: functionsDirectory, encoding: "utf8" });
}

function expectCompile(directory: string, config?: string): void {
  const result = compile(directory, config);
  expect(result.status, result.stdout + result.stderr).toBe(0);
}

function sourceClosure(roots: string[]): Set<string> {
  const key = JSON.stringify([...roots].sort());
  const cached = sourceClosureCache.get(key);
  if (cached) return cached;
  const configPath = path.resolve(functionsDirectory, "tsconfig.build.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, functionsDirectory);
  const program = ts.createProgram(roots.map((name) => path.resolve(functionsDirectory, name)), {
    ...parsed.options, noEmit: true,
  });
  const closure = new Set(program.getSourceFiles().map((file) =>
    path.relative(functionsDirectory, file.fileName).split(path.sep).join("/")
  ));
  sourceClosureCache.set(key, closure);
  return closure;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("Functions production build artifact", () => {
  it("uses a clean, test-excluding, verified build pipeline and preserves CLI tools", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(functionsDirectory, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    const build = packageJson.scripts.build;
    expect(build.indexOf("clean-functions-build.mjs")).toBeLessThan(build.indexOf("tsc -p tsconfig.build.json"));
    expect(build.indexOf("tsc -p tsconfig.build.json")).toBeLessThan(build.indexOf("verify-functions-build.mjs"));
    expect(buildConfig.exclude).toEqual(expect.arrayContaining([
      "src/**/__tests__/**", "src/**/*.test.ts", "src/**/*.spec.ts",
    ]));
    for (const name of ["dev-reset", "legacy-user-import", "legacy-user-postflight", "legacy-user-preflight-review", "legacy-bcrypt-pilot"]) {
      expect(packageJson.scripts[name]).toMatch(/^ts-node --project tsconfig\.scripts\.json scripts\//);
    }
    const testConfig = vitestConfig.test as { include?: string[]; coverage?: { exclude?: string[] } };
    expect(testConfig.include).toEqual(expect.arrayContaining(["src/**/*.test.ts", "src/**/*.spec.ts"]));
    expect(testConfig.coverage?.exclude).toEqual(expect.arrayContaining([
      "src/**/*.test.ts", "src/**/*.spec.ts", "src/**/__tests__/**",
    ]));
  });

  it("excludes only helper roots outside the Function graph and reachable by the historical CLIs", () => {
    const runtime = sourceClosure(["src/index.ts"]);
    const cli = sourceClosure([
      "scripts/legacy-user-import.ts", "scripts/legacy-user-postflight.ts",
      "scripts/legacy-user-preflight-review.ts", "scripts/legacy-bcrypt-pilot.ts",
    ]);
    expect(cliOnlySources).toHaveLength(6);
    for (const source of cliOnlySources) {
      expect(runtime.has(source), source).toBe(false);
      expect(cli.has(source), source).toBe(true);
    }
    expect(runtime.has("src/privilegedNotificationLegacy.ts")).toBe(true);
    expect(runtime.has("src/validation.ts")).toBe(true);
  }, compilerIntegrationTimeout);

  it("omits CLI-only helpers while retaining runtime dependencies in a real compiler build", () => {
    const directory = fixture();
    expectCompile(directory);
    expect(fs.existsSync(path.resolve(directory, "lib/runtime.js"))).toBe(true);
    for (const source of cliOnlySources) {
      expect(fs.existsSync(path.resolve(directory, source.replace(/^src\//, "lib/").replace(/\.ts$/, ".js")))).toBe(false);
    }
    const result = verifyBuild(directory);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, compilerIntegrationTimeout);

  it("fails closed when a runtime import pulls an excluded CLI helper into emitted output", () => {
    const directory = fixture();
    write(directory, "src/index.ts", "export { cliValue } from \"./legacyUserMigration\";");
    expectCompile(directory);
    expect(fs.existsSync(path.resolve(directory, "lib/legacyUserMigration.js"))).toBe(true);
    const result = verifyBuild(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("legacyUserMigration.js");
  }, compilerIntegrationTimeout);

  it("keeps excluded helpers compilable through the unchanged CLI project", () => {
    const directory = fixture();
    write(directory, "scripts/legacy-import.ts", cliOnlySources.map((source, index) =>
      `import { cliValue as value${index} } from "../${source.replace(/\.ts$/, "")}"; console.log(value${index});`
    ).join("\n"));
    expectCompile(directory, "tsconfig.scripts.json");
    for (const source of cliOnlySources) {
      expect(fs.existsSync(path.resolve(directory, "lib-scripts", source.replace(/\.ts$/, ".js")))).toBe(true);
    }
  }, compilerIntegrationTimeout);

  it.each([
    "nested/__tests__/example.js", "nested/example.test.js", "nested/example.test.js.map",
    "nested/example.spec.js", "nested/example.spec.js.map",
    ...cliOnlySources.flatMap((source) => [".js", ".js.map"].map((extension) =>
      source.replace(/^src\//, "").replace(/\.ts$/, extension)
    )),
    "src/legacyUserMigration.js",
  ])("rejects stale excluded artifact %s", (relativePath) => {
    const directory = fixture();
    write(directory, "lib/index.js", "// compiled entry point");
    write(directory, "lib/" + relativePath, "// stale artifact");
    const result = verifyBuild(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(relativePath);
  });

  it("excludes CLI sources and entrypoints from uploads, retaining the runtime graph and remote build inputs", () => {
    const firebaseConfig = JSON.parse(
      fs.readFileSync(path.resolve(functionsDirectory, "..", "firebase.json"), "utf8")
    ) as { functions: Array<{ ignore: string[] }> };
    const ignore = firebaseConfig.functions[0].ignore;
    const ignored = (name: string) => ignore.some((pattern) => minimatch(name, pattern));
    const cliEntrypoints = [
      "scripts/legacy-bcrypt-pilot.ts", "scripts/legacy-user-import.ts",
      "scripts/legacy-user-postflight.ts", "scripts/legacy-user-preflight-review.ts",
    ];
    for (const name of [...cliOnlySources, ...cliEntrypoints,
      "src/nested/example.test.ts", "src/nested/example.spec.ts", "src/nested/__tests__/fixture.ts",
      "lib/nested/example.test.js", "lib/nested/example.test.js.map", "lib/nested/example.spec.js",
      "lib/nested/example.spec.js.map", "lib/nested/__tests__/fixture.js",
    ]) expect(ignored(name), name).toBe(true);
    for (const name of sourceClosure(["src/index.ts"])) {
      if (name.startsWith("src/") && !name.includes("node_modules/")) expect(ignored(name), name).toBe(false);
    }
    for (const name of [
      "package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json", "tsconfig.scripts.json",
      "scripts/generate-template-manifest.ts", "scripts/clean-functions-build.mjs", "scripts/verify-functions-build.mjs",
      "src/privilegedNotificationLegacy.ts", "lib/index.js",
    ]) expect(ignored(name), name).toBe(false);

    // Reproduce remote compilation after the ignored CLI sources are removed.
    const directory = fixture();
    for (const source of cliOnlySources) fs.rmSync(path.resolve(directory, source));
    expectCompile(directory);
    expect(verifyBuild(directory).status).toBe(0);
  }, compilerIntegrationTimeout);
});
