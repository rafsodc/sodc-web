#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeploymentEnvironment, DEPLOYMENT_ENVIRONMENTS } from "./deploy-environment-lib.mjs";
import { createHostingSnapshot } from "./hosting-cache-config.mjs";

function run(command, args, repositoryRoot) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? "unknown"}.`);
  return result.stdout ?? "";
}

export async function deployHosting(repositoryRoot, environment, execute = run) {
  const gitSha = execute("git", ["rev-parse", "HEAD"], repositoryRoot).trim();
  const snapshot = await createHostingSnapshot(repositoryRoot, { environment, gitSha });
  try {
    console.log(`Deploying Hosting with ${snapshot.assetPaths.length} build-specific immutable JS/CSS assets.`);
    execute("firebase", ["deploy", "--only", "hosting", "--project", DEPLOYMENT_ENVIRONMENTS[environment].projectId,
      "--config", snapshot.configPath, "--non-interactive"], repositoryRoot);
  } finally {
    await snapshot.remove();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  Promise.resolve().then(async () => {
    const { environment, fromStage } = parseDeploymentEnvironment(process.argv.slice(2));
    if (fromStage) throw new Error("Hosting-only deployment does not accept --from.");
    await deployHosting(root, environment);
  }).catch(error => {
    console.error(`Hosting deployment stopped: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
