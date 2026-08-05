import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  applyFromStage,
  assertRequiredEnvironmentConfig,
  checkEnvironmentConfig,
  createDeploymentPlan,
  createPreflightSteps,
  DEPLOY_STAGES,
  environmentConfigFileName,
  parseDeploymentEnvironment,
  parseDotEnv,
  REQUIRED_VITE_FIREBASE_KEYS,
  runDeploymentPlan,
  validateFirebaseAlias,
} from "./deploy-environment-lib.mjs";

const firebaseRc = {
  projects: {
    dev: "sodc-web",
    beta: "sodc-web-beta",
    prod: "sodc-web-production",
  },
};

describe("environment deployment configuration", () => {
  it.each([
    ["dev", "sodc-web"],
    ["beta", "sodc-web-beta"],
    ["prod", "sodc-web-production"],
  ])("pins %s to the reviewed Firebase project", (environment, projectId) => {
    expect(parseDeploymentEnvironment(["--env", environment])).toEqual({ environment, fromStage: undefined });
    expect(validateFirebaseAlias(firebaseRc, environment)).toBe(projectId);
  });

  it("rejects unknown environments and changed Firebase aliases", () => {
    expect(() => parseDeploymentEnvironment(["--env", "production"])).toThrow(
      /expected dev, beta, or prod/,
    );
    expect(() =>
      validateFirebaseAlias({ projects: { prod: "wrong-project" } }, "prod"),
    ).toThrow(/not expected project sodc-web-production/);
  });

  it("parses an optional --from resume stage", () => {
    expect(parseDeploymentEnvironment(["--env", "prod", "--from", "hosting"])).toEqual({
      environment: "prod",
      fromStage: "hosting",
    });
    expect(() => parseDeploymentEnvironment(["--env", "prod", "--from", "not-a-stage"])).toThrow(
      /Unknown --from stage/,
    );
  });

  it("orders preflight checks, then schema, Functions, Hosting, and the live audit", () => {
    const plan = createDeploymentPlan("prod", "abc123");
    expect(plan.map(({ id }) => id)).toEqual([
      "clean-checkout",
      "generate-dataconnect-sdk",
      "generated-drift-check",
      "environment-config-check",
      "frontend-lint",
      "frontend-test",
      "frontend-build",
      "functions-lint",
      "functions-test",
      "functions-build",
      "deploy-dataconnect",
      "deploy-functions",
      "deploy-hosting",
      "deployment-audit",
    ]);
    expect(plan.find(({ id }) => id === "deploy-hosting")?.args).toEqual([
      "run",
      "deploy:hosting:prod",
    ]);
    expect(plan.at(-1)?.args).toContain("abc123");
    const firebaseDeploys = plan.filter(({ command, args }) =>
      command === "firebase" && args[0] === "deploy",
    );
    expect(firebaseDeploys).toHaveLength(2);
    for (const step of firebaseDeploys) {
      expect(step.args.slice(-2)).toEqual(["--project", "prod"]);
      expect(step.args).not.toContain("storage");
    }
  });

  it("tags every step with its stage for --from resumption", () => {
    const plan = createDeploymentPlan("dev", "abc123");
    const stagesInOrder = [...new Set(plan.map(({ stage }) => stage))];
    expect(stagesInOrder).toEqual(DEPLOY_STAGES);
  });

  it("createPreflightSteps never includes a mutating deploy command", () => {
    const steps = createPreflightSteps("prod");
    expect(steps.map(({ id }) => id)).not.toContain("deploy-dataconnect");
    for (const step of steps) {
      if (!step.command) continue; // the inline environment-config-check has no shell command
      expect(step.args?.join(" ")).not.toMatch(/\bdeploy\b/);
    }
  });
});

describe("resuming a deployment with --from", () => {
  it("skips to the requested stage, leaving earlier stages out entirely", () => {
    const plan = createDeploymentPlan("beta", "abc123");
    const resumed = applyFromStage(plan, "hosting");
    expect(resumed.map(({ id }) => id)).toEqual(["deploy-hosting", "deployment-audit"]);
  });

  it("returns the full plan unchanged when no stage is given", () => {
    const plan = createDeploymentPlan("beta", "abc123");
    expect(applyFromStage(plan, undefined)).toEqual(plan);
  });
});

describe("environment deployment execution", () => {
  it("stops before later stages when a deployment fails", async () => {
    const visited = [];
    const execute = vi.fn(async (step) => {
      visited.push(step.id);
      if (step.id === "deploy-functions") throw new Error("Functions failed");
      return { stdout: "" };
    });

    await expect(
      runDeploymentPlan(createDeploymentPlan("dev", "abc123"), execute),
    ).rejects.toThrow("Functions failed");
    expect(visited.at(-1)).toBe("deploy-functions");
    expect(visited).not.toContain("deploy-hosting");
    expect(visited).not.toContain("deployment-audit");
  });

  it.each([
    ["clean-checkout", 1],
    ["generated-drift-check", 3],
  ])("blocks deployment when %s reports files", async (blockedStep, expectedCalls) => {
    const execute = vi.fn(async (step) => ({
      stdout: step.id === blockedStep ? " M generated/index.d.ts" : "",
    }));

    await expect(
      runDeploymentPlan(createDeploymentPlan("beta", "abc123"), execute),
    ).rejects.toThrow(/unreviewed changes/);
    expect(execute).toHaveBeenCalledTimes(expectedCalls);
  });
});

describe("environment config check", () => {
  it("names the expected file per Vite mode", () => {
    expect(environmentConfigFileName("development")).toBe(".env.development.local");
    expect(environmentConfigFileName("staging")).toBe(".env.staging.local");
    expect(environmentConfigFileName("production")).toBe(".env.production.local");
  });

  it("parses KEY=value lines, ignoring blanks, comments, and quoting", () => {
    expect(
      parseDotEnv(
        [
          "# comment",
          "",
          'VITE_FIREBASE_API_KEY="abc123"',
          "VITE_FIREBASE_AUTH_DOMAIN=example.firebaseapp.com",
          "  VITE_FIREBASE_PROJECT_ID = example  ",
        ].join("\n"),
      ),
    ).toEqual({
      VITE_FIREBASE_API_KEY: "abc123",
      VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "example",
    });
  });

  it("requires every VITE_FIREBASE_* key to be present and non-empty", () => {
    const complete = Object.fromEntries(REQUIRED_VITE_FIREBASE_KEYS.map((key) => [key, "value"]));
    expect(() => assertRequiredEnvironmentConfig(complete, ".env.development.local")).not.toThrow();

    const missingOne = { ...complete, VITE_FIREBASE_APP_ID: "" };
    expect(() => assertRequiredEnvironmentConfig(missingOne, ".env.development.local")).toThrow(
      /VITE_FIREBASE_APP_ID/,
    );
  });

  it("checkEnvironmentConfig passes for a complete file and fails for a missing or incomplete one", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "deploy-preflight-"));
    try {
      await expect(checkEnvironmentConfig(directory, "development")).rejects.toThrow(
        /\.env\.development\.local does not exist/,
      );

      const complete = REQUIRED_VITE_FIREBASE_KEYS.map((key) => `${key}=value`).join("\n");
      await writeFile(path.join(directory, ".env.development.local"), complete);
      await expect(checkEnvironmentConfig(directory, "development")).resolves.toBeUndefined();

      const incomplete = REQUIRED_VITE_FIREBASE_KEYS.slice(1)
        .map((key) => `${key}=value`)
        .join("\n");
      await writeFile(path.join(directory, ".env.staging.local"), incomplete);
      await expect(checkEnvironmentConfig(directory, "staging")).rejects.toThrow(
        REQUIRED_VITE_FIREBASE_KEYS[0],
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
