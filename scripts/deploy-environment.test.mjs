import { describe, expect, it, vi } from "vitest";
import {
  createDeploymentPlan,
  parseDeploymentEnvironment,
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
    expect(parseDeploymentEnvironment(["--env", environment])).toBe(environment);
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

  it("orders schema, Functions, Hosting, and the live audit", () => {
    const plan = createDeploymentPlan("prod", "abc123");
    expect(plan.map(({ id }) => id)).toEqual([
      "clean-checkout",
      "generate-dataconnect-sdk",
      "generated-drift-check",
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
    expect(visited).toEqual([
      "clean-checkout",
      "generate-dataconnect-sdk",
      "generated-drift-check",
      "deploy-dataconnect",
      "deploy-functions",
    ]);
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
