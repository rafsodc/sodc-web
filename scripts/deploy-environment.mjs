#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyFromStage,
  assertRequiredApisEnabled,
  checkEnvironmentConfig,
  createDeploymentPlan,
  enabledApiNames,
  parseDeploymentEnvironment,
  runDeploymentPlan,
  validateFirebaseAlias,
  verifyPreflightAttestation,
  writePreflightAttestation,
} from "./deploy-environment-lib.mjs";
import { parseJsonOutput } from "./deployment-check-lib.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runCommand(command, args, captureOutput = false) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
    stdio: captureOutput ? ["inherit", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}.`);
  }
  return { stdout: result.stdout ?? "" };
}

async function main() {
  const { environment, fromStage } = parseDeploymentEnvironment(process.argv.slice(2));
  const [firebaseRc, deploymentCheckConfig] = await Promise.all([
    readFile(path.join(repositoryRoot, ".firebaserc"), "utf8").then(JSON.parse),
    readFile(path.join(repositoryRoot, "config/deployment-check.json"), "utf8").then(JSON.parse),
  ]);
  const projectId = validateFirebaseAlias(firebaseRc, environment);
  const viteMode = deploymentCheckConfig.environments?.[environment]?.viteMode;
  if (!viteMode) {
    throw new Error(`config/deployment-check.json has no viteMode configured for "${environment}".`);
  }
  const gitSha = runCommand("git", ["rev-parse", "HEAD"], true).stdout.trim();
  const plan = applyFromStage(createDeploymentPlan(environment, gitSha), fromStage);

  console.log(
    fromStage
      ? `Resuming deployment of reviewed revision ${gitSha} to ${environment} (${projectId}) from the "${fromStage}" stage.`
      : `Deploying reviewed revision ${gitSha} to ${environment} (${projectId}).`
  );
  await runDeploymentPlan(plan, async (step) => {
    console.log(`\n==> ${step.label}`);
    if (step.kind === "environment-config") {
      await checkEnvironmentConfig(repositoryRoot, viteMode);
      return { stdout: "" };
    }
    if (step.kind === "required-apis") {
      const { stdout } = runCommand(
        "gcloud",
        ["services", "list", "--enabled", "--project", projectId, "--format=json"],
        true
      );
      assertRequiredApisEnabled(deploymentCheckConfig.requiredApis, enabledApiNames(parseJsonOutput(stdout)));
      return { stdout: "" };
    }
    if (step.kind === "record-preflight-attestation") {
      const outputPath = await writePreflightAttestation(repositoryRoot, { environment, projectId, gitSha });
      console.log(`Preflight attestation recorded at ${path.relative(repositoryRoot, outputPath)}.`);
      return { stdout: "" };
    }
    if (step.kind === "verify-preflight-attestation") {
      await verifyPreflightAttestation(repositoryRoot, { environment, projectId, gitSha });
      return { stdout: "" };
    }
    return runCommand(step.command, step.args, step.expectEmptyOutput);
  });
  console.log(`\nDeployment and audit completed for ${environment} (${projectId}).`);
}

main().catch((error) => {
  console.error(`Deployment stopped: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
