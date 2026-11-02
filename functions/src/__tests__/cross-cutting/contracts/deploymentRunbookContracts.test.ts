import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function section(markdown: string, heading: string, nextHeading: string): string {
  const start = markdown.indexOf(heading);
  const end = markdown.indexOf(nextHeading, start + heading.length);
  expect(start, `missing ${heading}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing ${nextHeading}`).toBeGreaterThan(start);
  return markdown.slice(start, end);
}

describe("deployment runbook contracts", () => {
  it("orders full-stack releases schema-first in every environment", () => {
    const runbook = readRepoFile("docs/operations/environments-dev-beta-prod.md");
    const rollout = section(
      runbook,
      "## Full-stack rollout sequence",
      "## Partial failure and rollback checkpoints"
    );

    const commands = [...rollout.matchAll(/```sh\n([\s\S]*?)```/g)]
      .map(([, script]) => script).join("\n");
    const generate = commands.indexOf("dataconnect:sdk:generate");
    const generatedDiff = commands.indexOf("git diff --exit-code");
    const generatedStatus = commands.indexOf("git status --short --");
    const preflight = commands.indexOf("npm run deployment:preflight -- --env \"$FIREBASE_PROJECT\"");
    const guard = commands.indexOf("npm run deployment:functions-config -- --env \"$FIREBASE_PROJECT\" --verify");
    const dataConnect = commands.indexOf("firebase deploy --only dataconnect");
    const functions = commands.indexOf("npm run deploy:functions -- --env \"$FIREBASE_PROJECT\"");
    const hosting = commands.indexOf("npm run deploy:hosting:dev");

    expect(generate).toBeGreaterThanOrEqual(0);
    expect(generatedDiff).toBeGreaterThan(generate);
    expect(generatedStatus).toBeGreaterThan(generatedDiff);
    expect(preflight).toBeGreaterThan(generatedStatus);
    expect(guard).toBeGreaterThan(preflight);
    expect(dataConnect).toBeGreaterThan(guard);
    expect(functions).toBeGreaterThan(dataConnect);
    expect(hosting).toBeGreaterThan(functions);
    expect(rollout).toContain("**Dev**, then **Prod**");
    expect(rollout).not.toContain("firebase deploy --project");
    expect(rollout).not.toContain("firebase deploy --only functions");
  });

  it("documents smoke and rollback stops between remote deployment stages", () => {
    const runbook = readRepoFile("docs/operations/environments-dev-beta-prod.md");
    const rollback = section(
      runbook,
      "## Partial failure and rollback checkpoints",
      "## Promotion flow"
    );
    const functions = section(
      runbook,
      "### 5. Deploy and validate Functions",
      "### 6. Build and deploy Hosting"
    );

    expect(runbook).toContain("Before continuing:");
    expect(functions).toContain("full preflight");
    expect(functions).toContain("Data Connect/Storage checkpoints");
    expect(functions).toContain("checks fresh target metadata");
    expect(rollback).toContain("Do not deploy Functions or Hosting");
    expect(rollback).toContain("Do not deploy Hosting");
    expect(rollback).toContain("destructive migration");
  });

  it("keeps the Data Connect guide generate-before-deploy", () => {
    const guide = readRepoFile("dataconnect/README.md");
    const generate = guide.indexOf("dataconnect:sdk:generate");
    const deploy = guide.indexOf("firebase deploy --only dataconnect");

    expect(generate).toBeGreaterThanOrEqual(0);
    expect(deploy).toBeGreaterThan(generate);
    expect(guide).not.toContain("firebase deploy --only dataconnect:schema");
    expect(guide).not.toContain("firebase deploy --only dataconnect:api");
  });
});
