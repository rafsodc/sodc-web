import { describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyCreationsBeforeHosting } from "./functions-deploy.mjs";
import {
  applyFromStage,
  assertRequiredApisEnabled,
  assertRequiredEnvironmentConfig,
  checkEnvironmentConfig,
  createDeploymentPlan,
  createPreflightSteps,
  DEPLOY_STAGES,
  enabledApiNames,
  environmentConfigFileName,
  parseDeploymentEnvironment,
  parseDotEnv,
  preflightAttestationPath,
  REQUIRED_VITE_FIREBASE_KEYS,
  runDeploymentPlan,
  validateFirebaseAlias,
  verifyPreflightAttestation,
  writePreflightAttestation,
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
      "required-apis-check",
      "generate-dataconnect-sdk",
      "normalize-generated-sdk",
      "generated-drift-check",
      "environment-config-check",
      "frontend-lint",
      "frontend-test",
      "frontend-build",
      "functions-lint",
      "functions-test",
      "functions-build",
      "functions-config-preflight",
      "record-preflight-attestation",
      "functions-config-before-first-deploy",
      "deploy-dataconnect",
      "deploy-functions",
      "functions-creation-before-hosting",
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
    expect(firebaseDeploys).toHaveLength(1);
    expect(plan.find(({ id }) => id === "deploy-functions").kind).toBe("guarded-functions-deploy");
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
  it("retains the clean-checkout and attestation gates before the requested stage", () => {
    const plan = createDeploymentPlan("beta", "abc123");
    const resumed = applyFromStage(plan, "hosting");
    expect(resumed.map(({ id }) => id)).toEqual([
      "clean-checkout",
      "verify-preflight-attestation",
      "functions-creation-before-hosting",
      "deploy-hosting",
      "deployment-audit",
    ]);
  });

  it("returns the full plan unchanged when no stage is given", () => {
    const plan = createDeploymentPlan("beta", "abc123");
    expect(applyFromStage(plan, undefined)).toEqual(plan);
  });
});

describe("deployment preflight attestation", () => {
  it("binds a resume to the exact environment, project, and Git revision", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "deploy-attestation-"));
    try {
      const expected = { environment: "beta", projectId: "sodc-web-beta", gitSha: "abc123" };
      const guardPath = path.join(directory, ".firebase/functions-config-guard/beta.json");
      await mkdir(path.dirname(guardPath), { recursive: true });
      const guard = { schemaVersion: "sodc-functions-config-guard/v1", status: "PASS", binding: expected };
      await writeFile(guardPath, JSON.stringify(guard));
      await writePreflightAttestation(directory, expected);
      await expect(verifyPreflightAttestation(directory, expected)).resolves.toMatchObject(expected);
      expect(preflightAttestationPath(directory, "beta")).toContain("deployment-preflight/beta.json");

      await expect(
        verifyPreflightAttestation(directory, { ...expected, gitSha: "different" }),
      ).rejects.toThrow(/does not match/);
      await expect(
        verifyPreflightAttestation(directory, { environment: "prod", projectId: "sodc-web-production", gitSha: "abc123" }),
      ).rejects.toThrow(/No valid preflight attestation/);
      await writeFile(guardPath, JSON.stringify({ ...guard, binding: { ...expected, inputs: "changed" } }));
      await expect(verifyPreflightAttestation(directory, expected)).rejects.toThrow(/changed after full preflight/);
    } finally {
      await rm(directory, { recursive: true, force: true });
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
    expect(visited.at(-1)).toBe("deploy-functions");
    expect(visited).not.toContain("deploy-hosting");
    expect(visited).not.toContain("deployment-audit");
  });

  it.each([
    ["clean-checkout", 1],
    ["generated-drift-check", 5],
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

describe("required Google Cloud APIs check", () => {
  it("extracts enabled API names from gcloud's config.name or top-level name", () => {
    expect(
      enabledApiNames([
        { config: { name: "run.googleapis.com" } },
        { name: "storage.googleapis.com" },
        { config: {} },
      ]),
    ).toEqual(["run.googleapis.com", "storage.googleapis.com"]);
  });

  it("passes when every required API is enabled and fails listing what's missing", () => {
    expect(() =>
      assertRequiredApisEnabled(
        ["run.googleapis.com", "storage.googleapis.com"],
        ["run.googleapis.com", "storage.googleapis.com", "extra.googleapis.com"],
      ),
    ).not.toThrow();

    expect(() =>
      assertRequiredApisEnabled(
        ["run.googleapis.com", "storage.googleapis.com"],
        ["run.googleapis.com"],
      ),
    ).toThrow(/storage\.googleapis\.com/);
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


describe("reviewed Function creation before Hosting", () => {
  it.each(["dev", "prod"])("blocks %s Hosting resume if the reviewed callable is absent or its live contract is wrong", async environment => {
    const directory = await mkdtemp(path.join(tmpdir(), "hosting-creation-gate-"));
    const receipt = {schemaVersion: "sodc-functions-config-guard/v1", status: "PASS", binding: {environment}, outcome: {endpointCreations: [{name: "deleteMyAccount"}]}};
    try {
      await mkdir(path.join(directory, ".firebase/functions-config-guard"), {recursive: true});
      await writeFile(path.join(directory, `.firebase/functions-config-guard/${environment}.json`), JSON.stringify(receipt));
      const verifyCreations = vi.fn(async () => {throw new Error("reviewed endpoint missing or changed");});
      const visited = [];
      const resumed = applyFromStage(createDeploymentPlan(environment, "reviewed-sha"), "hosting");
      await expect(runDeploymentPlan(resumed, async step => {
        visited.push(step.id);
        if (step.kind === "functions-creation-verify") await verifyCreationsBeforeHosting(directory, environment, {verifyCreations});
        return {stdout: ""};
      })).rejects.toThrow("reviewed endpoint missing or changed");
      expect(verifyCreations).toHaveBeenCalledWith(directory, environment, receipt);
      expect(visited).not.toContain("deploy-hosting");
      expect(visited).not.toContain("deployment-audit");
    } finally {await rm(directory, {recursive: true, force: true});}
  });

  it("requires a fresh PASS proof for creations and skips the creation-only verifier for ordinary releases", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "hosting-creation-proof-"));
    const receipt = {schemaVersion: "sodc-functions-config-guard/v1", status: "PASS", binding: {environment: "dev"}, outcome: {endpointCreations: [{name: "deleteMyAccount"}]}};
    const receiptFile = path.join(directory, ".firebase/functions-config-guard/dev.json");
    try {
      await mkdir(path.dirname(receiptFile), {recursive: true});
      await writeFile(receiptFile, JSON.stringify(receipt));
      const verifyCreations = vi.fn().mockResolvedValueOnce({status: "FAIL"}).mockResolvedValueOnce({status: "PASS"});
      await expect(verifyCreationsBeforeHosting(directory, "dev", {verifyCreations})).rejects.toThrow("created-endpoint-verification-failed");
      await expect(verifyCreationsBeforeHosting(directory, "dev", {verifyCreations})).resolves.toEqual({status: "PASS"});
      await writeFile(receiptFile, JSON.stringify({...receipt, outcome: {endpointCreations: []}}));
      await expect(verifyCreationsBeforeHosting(directory, "dev", {verifyCreations})).resolves.toEqual({status: "NOT_REQUIRED"});
      expect(verifyCreations).toHaveBeenCalledTimes(2);
      await expect(verifyCreationsBeforeHosting(directory, "prod", {verifyCreations})).rejects.toThrow("missing-functions-guard-before-hosting");
    } finally {await rm(directory, {recursive: true, force: true});}
  });
});
