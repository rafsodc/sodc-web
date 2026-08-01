export const DEPLOYMENT_ENVIRONMENTS = Object.freeze({
  dev: Object.freeze({ projectId: "sodc-web" }),
  beta: Object.freeze({ projectId: "sodc-web-beta" }),
  prod: Object.freeze({ projectId: "sodc-web-production" }),
});

const GENERATED_PATHS = Object.freeze([
  "src/dataconnect-generated",
  "functions/src/dataconnect-admin-generated",
]);

export function parseDeploymentEnvironment(args) {
  if (args.length !== 2 || args[0] !== "--env") {
    throw new Error("Usage: deploy-environment.mjs --env <dev|beta|prod>");
  }
  const environment = args[1];
  if (!Object.hasOwn(DEPLOYMENT_ENVIRONMENTS, environment)) {
    throw new Error(`Unknown environment "${environment}"; expected dev, beta, or prod.`);
  }
  return environment;
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

export function createDeploymentPlan(environment, gitSha) {
  if (!gitSha?.trim()) throw new Error("A Git revision is required for deployment verification.");
  return [
    {
      id: "clean-checkout",
      label: "Confirm clean reviewed checkout",
      command: "git",
      args: ["status", "--porcelain", "--untracked-files=all"],
      expectEmptyOutput: true,
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
      id: "deploy-dataconnect",
      label: "Deploy Data Connect",
      command: "firebase",
      args: ["deploy", "--only", "dataconnect", "--project", environment],
    },
    {
      id: "deploy-functions",
      label: "Build and deploy all Functions",
      command: "firebase",
      args: ["deploy", "--only", "functions", "--project", environment],
    },
    {
      id: "deploy-hosting",
      label: "Build and deploy Hosting",
      command: "npm",
      args: ["run", `deploy:hosting:${environment}`],
    },
    {
      id: "deployment-audit",
      label: "Audit the deployed environment",
      command: "npm",
      args: [
        "run",
        "deployment:check",
        "--",
        "--env",
        environment,
        "--expected-sha",
        gitSha.trim(),
      ],
    },
  ];
}

export async function runDeploymentPlan(plan, execute) {
  for (const step of plan) {
    const result = await execute(step);
    if (step.expectEmptyOutput && result?.stdout?.trim()) {
      throw new Error(`${step.label} failed: the checkout contains unreviewed changes.`);
    }
  }
}
