#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { verifyAuthorizationMigration } from "./check-authorization-migration.mjs";
import { parseDeploymentEnvironment, verifyPreflightAttestation } from "./deploy-environment-lib.mjs";
import { loadPinnedCli, runFunctionsConfigGuard } from "./functions-config-guard.mjs";
import { GuardError, bytesDigest, requireGuard } from "./functions-config-guard-lib.mjs";

/** The only supported direct Functions mutation path. A freshly checked receipt, pinned
 * executable and private snapshot of dotenv inputs are used by the same awaited command. */
export async function deployGuardedFunctions(root, environment, { guard = runFunctionsConfigGuard,
  cliLoader = loadPinnedCli, verifyPreflight = verifyPreflightAttestation, verifyMigration = verifyAuthorizationMigration,
  execute = (executable, args) => spawnSync(process.execPath, [executable, ...args], {
    cwd: root, stdio: "inherit", env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
  }) } = {}) {
  const receipt = await guard(root, environment, { verify: true });
  await verifyPreflight(root, { environment, projectId: receipt.binding.projectId, gitSha: receipt.binding.gitSha });
  await verifyMigration(root, { projectId: receipt.binding.projectId, gitSha: receipt.binding.gitSha });
  const directory = await mkdtemp(path.join(tmpdir(), "sodc-guarded-functions-"));
  try {
    await mkdir(path.join(directory, "env"), { mode: 0o700 });
    const configuration = JSON.parse(await readFile(path.join(root, "firebase.json"), "utf8"));
    requireGuard(bytesDigest(await readFile(path.join(root, "firebase.json"))) === receipt.binding.inputs["firebase.json"],
      "config-changed-before-functions-command");
    if (receipt.binding.mode === "dotenv") {
      for (const [file, hash] of Object.entries(receipt.binding.inputs)) {
        if (!file.startsWith("functions/.env") || hash === null) continue;
        const bytes = await readFile(path.join(root, file));
        requireGuard(bytesDigest(bytes) === hash, "dotenv-changed-before-functions-command");
        await copyFile(path.join(root, file), path.join(directory, "env", path.basename(file)));
        requireGuard(bytesDigest(await readFile(path.join(directory, "env", path.basename(file)))) === hash,
          "dotenv-snapshot-does-not-match");
      }
    }
    // No tracked placeholder is removed or rewritten. configDir is a supported pinned-CLI
    // setting; it freezes the checked inputs, or remains empty for reviewed preservation.
    const functions = configuration.functions.map((entry) => {
      const copy = { ...entry, source: path.join(root, entry.source), configDir: path.join(directory, "env") };
      // The full preflight already built and hash-bound this artifact. Rebuilding after
      // the final guard would reopen the discovery/packaging race this runner closes.
      delete copy.predeploy;
      return copy;
    });
    const file = path.join(directory, "firebase.json");
    await writeFile(file, `${JSON.stringify({ functions })}\n`, { mode: 0o600 });
    const firebaseRc = await readFile(path.join(root, ".firebaserc"));
    requireGuard(bytesDigest(firebaseRc) === receipt.binding.inputs[".firebaserc"], "alias-changed-before-functions-command");
    await writeFile(path.join(directory, ".firebaserc"), firebaseRc, { mode: 0o600 });
    const policy = JSON.parse(await readFile(path.join(root, "config/functions-config-guard.json"), "utf8"));
    const cli = cliLoader(policy);
    requireGuard(JSON.stringify(cli.identity) === JSON.stringify(receipt.binding.cli), "cli-changed-before-functions-command");
    requireGuard(typeof receipt.assertUnchanged === "function", "missing-final-input-check");
    await receipt.assertUnchanged();
    const result = await execute(cli.executable, ["deploy", "--only", "functions", "--project", environment,
      "--config", file, "--non-interactive"]);
    requireGuard(!result.error && result.status === 0, "functions-command-failed");
    return result;
  } catch (error) {
    if (error instanceof GuardError) throw error;
    throw new GuardError("guarded-functions-command-failed");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const { environment, fromStage } = parseDeploymentEnvironment(process.argv.slice(2));
    requireGuard(!fromStage, "direct-functions-command-does-not-accept-resume");
    await deployGuardedFunctions(root, environment);
  })().catch((error) => {
    console.error(error instanceof GuardError ? error.message : "Functions deployment blocked: invalid-input.");
    process.exitCode = 1;
  });
}
