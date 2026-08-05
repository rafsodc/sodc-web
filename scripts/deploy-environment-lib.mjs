import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareExpected } from "./deployment-check-lib.mjs";

export const DEPLOYMENT_ENVIRONMENTS = Object.freeze({
  dev: Object.freeze({ projectId: "sodc-web" }),
  beta: Object.freeze({ projectId: "sodc-web-beta" }),
  prod: Object.freeze({ projectId: "sodc-web-production" }),
});

const GENERATED_PATHS = Object.freeze([
  "src/dataconnect-generated",
  "functions/src/dataconnect-admin-generated",
]);

/**
 * The `VITE_FIREBASE_*` keys every environment's local config file must set
 * (see docs/operations/environment-and-secrets.md). `VITE_FIREBASE_MEASUREMENT_ID`
 * is intentionally excluded -- it is optional (Analytics only).
 */
export const REQUIRED_VITE_FIREBASE_KEYS = Object.freeze([
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
]);

/** Deployment stages in execution order; `--from` resumes at the start of one of these. */
export const DEPLOY_STAGES = Object.freeze(["preflight", "dataconnect", "functions", "hosting", "audit"]);

export function environmentConfigFileName(viteMode) {
  return `.env.${viteMode}.local`;
}

/** Minimal KEY=value parser for the gitignored .env.<mode>.local files -- no dotenv dependency needed. */
export function parseDotEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function assertRequiredEnvironmentConfig(values, fileName) {
  const missing = REQUIRED_VITE_FIREBASE_KEYS.filter((key) => !values[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`${fileName} is missing required configuration: ${missing.join(", ")}.`);
  }
}

/**
 * Confirms the target environment's local Vite config file exists and carries every
 * required VITE_FIREBASE_* value. Reads real state (unlike the rest of this module),
 * matching the existing precedent of deployment-check-lib.mjs's discoverFunctionContracts.
 */
export async function checkEnvironmentConfig(repositoryRoot, viteMode) {
  const fileName = environmentConfigFileName(viteMode);
  let content;
  try {
    content = await readFile(path.join(repositoryRoot, fileName), "utf8");
  } catch {
    throw new Error(
      `${fileName} does not exist. Copy it from .env.example and fill in this environment's Firebase web config.`
    );
  }
  assertRequiredEnvironmentConfig(parseDotEnv(content), fileName);
}

export function assertRequiredApisEnabled(requiredApis, enabledApis) {
  const missing = compareExpected(requiredApis, enabledApis);
  if (missing.length > 0) {
    throw new Error(`Required Google Cloud APIs are not enabled: ${missing.join(", ")}.`);
  }
}

/**
 * Extracts enabled API names from `gcloud services list --enabled --format=json` output,
 * matching deployment-check.mjs's own extraction so both read the same shape consistently.
 */
export function enabledApiNames(services) {
  return services.map((service) => service.config?.name ?? service.name).filter(Boolean);
}

export function parseDeploymentEnvironment(args) {
  const usage =
    "Usage: --env <dev|beta|prod> [--from <preflight|dataconnect|functions|hosting|audit>]";
  let environment;
  let fromStage;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--env") environment = args[++index];
    else if (argument === "--from") fromStage = args[++index];
    else throw new Error(usage);
  }
  if (!environment) throw new Error(usage);
  if (!Object.hasOwn(DEPLOYMENT_ENVIRONMENTS, environment)) {
    throw new Error(`Unknown environment "${environment}"; expected dev, beta, or prod.`);
  }
  if (fromStage && !DEPLOY_STAGES.includes(fromStage)) {
    throw new Error(`Unknown --from stage "${fromStage}"; expected one of ${DEPLOY_STAGES.join(", ")}.`);
  }
  return { environment, fromStage };
}

export function validateFirebaseAlias(firebaseRc, environment) {
  const expectedProjectId = DEPLOYMENT_ENVIRONMENTS[environment]?.projectId;
  if (!expectedProjectId) {
    throw new Error(`Unknown deployment environment "${environment}".`);
  }
  const actualProjectId = firebaseRc.projects?.[environment];
  if (actualProjectId !== expectedProjectId) {
    throw new Error(
      `Firebase alias "${environment}" resolves to ${actualProjectId ?? "nothing"}, ` +
        `not expected project ${expectedProjectId}.`,
    );
  }
  return expectedProjectId;
}

/**
 * The non-mutating checks that must pass before any remote deployment step runs: a clean,
 * reviewed checkout; no generated-SDK drift; the target environment's local config present;
 * and frontend/Functions lint, tests, and builds all green. Shared by createDeploymentPlan
 * (prefixed onto the real deploy) and the standalone `deployment:preflight` command, so the
 * two can never drift apart into checking different things.
 */
export function createPreflightSteps(environment) {
  return [
    {
      id: "clean-checkout",
      label: "Confirm clean reviewed checkout",
      command: "git",
      args: ["status", "--porcelain", "--untracked-files=all"],
      expectEmptyOutput: true,
    },
    {
      id: "required-apis-check",
      label: "Confirm required Google Cloud APIs are enabled",
      kind: "required-apis",
    },
    {
      id: "generate-dataconnect-sdk",
      label: "Generate Data Connect SDKs",
      command: "firebase",
      args: ["dataconnect:sdk:generate", "--project", environment],
    },
    {
      id: "generated-drift-check",
      label: "Confirm generated SDKs match the reviewed commit",
      command: "git",
      args: ["status", "--porcelain", "--untracked-files=all", "--", ...GENERATED_PATHS],
      expectEmptyOutput: true,
    },
    {
      id: "environment-config-check",
      label: "Confirm the target environment's local Firebase web config is present",
      kind: "environment-config",
    },
    {
      id: "frontend-lint",
      label: "Run frontend lint",
      command: "npm",
      args: ["run", "lint"],
    },
    {
      id: "frontend-test",
      label: "Run frontend test suite",
      command: "npm",
      args: ["run", "test:run"],
    },
    {
      id: "frontend-build",
      label: "Run frontend build",
      command: "npm",
      args: ["run", "build"],
    },
    {
      id: "functions-lint",
      label: "Run Functions lint",
      command: "npm",
      args: ["--prefix", "functions", "run", "lint"],
    },
    {
      id: "functions-test",
      label: "Run Functions test suite",
      command: "npm",
      args: ["--prefix", "functions", "run", "test"],
    },
    {
      id: "functions-build",
      label: "Run Functions build",
      command: "npm",
      args: ["--prefix", "functions", "run", "build"],
    },
  ];
}

export function createDeploymentPlan(environment, gitSha) {
  if (!gitSha?.trim()) throw new Error("A Git revision is required for deployment verification.");
  const preflight = createPreflightSteps(environment).map((step) => ({ ...step, stage: "preflight" }));
  const deploySteps = [
    {
      id: "deploy-dataconnect",
      stage: "dataconnect",
      label: "Deploy Data Connect",
      command: "firebase",
      args: ["deploy", "--only", "dataconnect", "--project", environment],
    },
    {
      id: "deploy-functions",
      stage: "functions",
      label: "Build and deploy all Functions",
      command: "firebase",
      args: ["deploy", "--only", "functions", "--project", environment],
    },
    {
      id: "deploy-hosting",
      stage: "hosting",
      label: "Build and deploy Hosting",
      command: "npm",
      args: ["run", `deploy:hosting:${environment}`],
    },
    {
      id: "deployment-audit",
      stage: "audit",
      label: "Audit the deployed environment",
      command: "npm",
      args: ["run", "deployment:check", "--", "--env", environment, "--expected-sha", gitSha.trim()],
    },
  ];
  return [...preflight, ...deploySteps];
}

/** Slices a plan built by createDeploymentPlan to resume at the start of the given stage. */
export function applyFromStage(plan, fromStage) {
  if (!fromStage) return plan;
  const startIndex = plan.findIndex((step) => step.stage === fromStage);
  return startIndex === -1 ? plan : plan.slice(startIndex);
}

export async function runDeploymentPlan(plan, execute) {
  for (const step of plan) {
    const result = await execute(step);
    if (step.expectEmptyOutput && result?.stdout?.trim()) {
      throw new Error(`${step.label} failed: the checkout contains unreviewed changes.`);
    }
  }
}
