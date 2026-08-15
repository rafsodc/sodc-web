import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

describe("Functions executable coverage policy", () => {
  it("inventories every executable Functions script", () => {
    const executableScripts = fs.readdirSync(scriptsDirectory)
      .filter((name) => /\.(?:ts|mjs)$/.test(name));

    expect(executableScripts.length).toBeGreaterThan(0);
    for (const name of executableScripts) {
      expect(policy, `${name} is missing from the executable coverage inventory`)
        .toContain(`\`${name}\``);
    }
  });

  it("documents the measured Functions source boundary and scanner gate", () => {
    const vitestConfig = fs.readFileSync(
      path.resolve(functionsDirectory, "vitest.config.ts"),
      "utf8",
    );
    const workflow = fs.readFileSync(
      path.resolve(repoRoot, ".github/workflows/pr-tests.yml"),
      "utf8",
    );

    expect(vitestConfig).toContain("include: ['src/**/*.ts']");
    expect(policy).toMatch(/does\s+not count `functions\/scripts`/);
    expect(workflow).toContain("Malware scanner tests and coverage");
    expect(workflow).toContain("services/section-file-malware-scanner run test:coverage");
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
