#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDeploymentPlan,
  parseDeploymentEnvironment,
  runDeploymentPlan,
  validateFirebaseAlias,
} from "./deploy-environment-lib.mjs";

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
  const environment = parseDeploymentEnvironment(process.argv.slice(2));
  const firebaseRc = JSON.parse(await readFile(path.join(repositoryRoot, ".firebaserc"), "utf8"));
  const projectId = validateFirebaseAlias(firebaseRc, environment);
  const gitSha = runCommand("git", ["rev-parse", "HEAD"], true).stdout.trim();
  const plan = createDeploymentPlan(environment, gitSha);

  console.log(`Deploying reviewed revision ${gitSha} to ${environment} (${projectId}).`);
  await runDeploymentPlan(plan, (step) => {
    console.log(`\n==> ${step.label}`);
    return runCommand(step.command, step.args, step.expectEmptyOutput);
  });
  console.log(`\nDeployment and audit completed for ${environment} (${projectId}).`);
}

main().catch((error) => {
  console.error(`Deployment stopped: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
