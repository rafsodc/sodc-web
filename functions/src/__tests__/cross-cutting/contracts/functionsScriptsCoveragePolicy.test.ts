import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import vitestConfig from "../../../../vitest.config";

const functionsDirectory = process.cwd();
const repoRoot = path.resolve(functionsDirectory, "..");
const scriptsDirectory = path.resolve(functionsDirectory, "scripts");
const policy = fs.readFileSync(
  path.resolve(repoRoot, "docs/operations/executable-coverage-policy.md"),
  "utf8",
);

function script(name: string): string {
  return fs.readFileSync(path.resolve(scriptsDirectory, name), "utf8");
}

function inventoryRows(heading: string): Map<string, string[]> {
  const lines = policy.split("\n");
  const sectionStart = lines.indexOf(`## ${heading}`);
  expect(sectionStart, `Missing policy section: ${heading}`).toBeGreaterThanOrEqual(0);
  const nextSectionOffset = lines
    .slice(sectionStart + 1)
    .findIndex((line) => line.startsWith("## "));
  const sectionEnd = nextSectionOffset < 0
    ? lines.length
    : sectionStart + 1 + nextSectionOffset;
  const rows = new Map<string, string[]>();
  for (const line of lines.slice(sectionStart, sectionEnd)) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const entryPoint = cells[0]?.match(/^`([^`]+)`$/)?.[1];
    if (entryPoint) rows.set(entryPoint, cells);
  }
  return rows;
}

describe("Functions executable coverage policy", () => {
  it("inventories every executable Functions script", () => {
    const executableScripts = fs.readdirSync(scriptsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    const rows = inventoryRows("Functions script inventory");

    expect(executableScripts.length).toBeGreaterThan(0);
    for (const name of executableScripts) {
      const row = rows.get(name);
      expect(row, `${name} is missing from the executable coverage inventory`).toBeDefined();
      expect(row?.length, `${name} does not have exactly three inventory columns`).toBe(3);
      expect(row?.[1], `${name} has no automated evidence`).toBeTruthy();
      expect(row?.[2], `${name} has no rationale or manual verification`).toBeTruthy();
    }
  });

  it("documents the measured Functions source boundary and scanner gate", () => {
    const workflow = fs.readFileSync(
      path.resolve(repoRoot, ".github/workflows/pr-tests.yml"),
      "utf8",
    );
    const testConfig = vitestConfig.test as {
      coverage?: { include?: string[] };
    };

    expect(testConfig.coverage?.include).toEqual(["src/**/*.ts"]);
    expect(policy).toMatch(/does\s+not count `functions\/scripts`/);
    expect(workflow).toContain("Malware scanner tests and coverage");
    expect(workflow).toContain("services/section-file-malware-scanner run test:coverage");
  });

  it("keeps documented Functions test evidence paths valid", () => {
    const testReferences = [...policy.matchAll(/`([^`]+\.test\.ts)`/g)]
      .map((match) => match[1]);

    expect(testReferences.length).toBeGreaterThan(0);
    for (const reference of testReferences) {
      expect(
        reference.startsWith("functions/src/__tests__/"),
        `${reference} must use its full repository path`,
      ).toBe(true);
      expect(
        fs.existsSync(path.resolve(repoRoot, reference)),
        `${reference} does not resolve to a test file`,
      ).toBe(true);
    }
  });

  it("locks in destructive CLI safety and protected artifact contracts", () => {
    const reset = script("cli-dev-reset.ts");
    expect(reset).toContain("getProductionProjectIds");
    expect(reset).toContain("getAllowedProjectIds");
    expect(reset).toContain("await confirmBeforeProceeding(projectId)");

    const bcryptPilot = script("legacy-bcrypt-pilot.ts");
    expect(bcryptPilot).toContain("guardAgainstProduction(options)");
    expect(bcryptPilot).toContain(".deleteUser(uid)");

    const preflightReview = script("legacy-user-preflight-review.ts");
    expect(preflightReview).toContain("mode: 0o600");
    expect(preflightReview).toContain("fs.renameSync(temporaryPath, outputPath)");
  });

  it("keeps informational drift checks non-blocking and generated output identifiable", () => {
    const drift = script("check-template-sync.ts");
    expect(drift).toContain("GOV_NOTIFY_LIVE_API_KEY not set");
    expect(drift).toContain("status: \"fetch_error\"");
    expect(drift).toContain("run().catch");
    expect(drift).toContain("Always exit 0");
    expect(drift).toContain("process.exit(0)");

    const generator = script("generate-template-manifest.ts");
    expect(generator).toContain("AUTO-GENERATED — do not edit directly");
    expect(generator).toContain("functions/email-templates/*.md");
  });
});
