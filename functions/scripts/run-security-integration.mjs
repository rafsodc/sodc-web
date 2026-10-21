import process from "node:process";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projects = new Set(["sodc-web", "sodc-web-beta"]);

/** Pure validation also runs inside Vitest, so bypassing this wrapper cannot bypass targeting. */
export function readSecurityIntegrationConfig(environment = process.env) {
  if (environment.RUN_SECURITY_INTEGRATION !== "1") {
    throw new Error("Set RUN_SECURITY_INTEGRATION=1 to opt in to disposable non-production mutations.");
  }
  const projectId = environment.SECURITY_INTEGRATION_PROJECT;
  if (!projects.has(projectId)) throw new Error("Security integration requires an explicitly allowlisted Dev/Beta project.");
  if (environment.SECURITY_INTEGRATION_CONFIRM !== projectId) {
    throw new Error("SECURITY_INTEGRATION_CONFIRM must exactly match the selected non-production project.");
  }
  for (const key of ["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"]) {
    if (environment[key] && environment[key] !== projectId) throw new Error("Conflicting Firebase project configuration.");
  }
  if (Object.entries(environment).some(([key, value]) => key.endsWith("_EMULATOR_HOST") && value)) {
    throw new Error("This gate requires real Firebase-signed tokens and deployed endpoints; emulator overrides are forbidden.");
  }
  if (environment.FIREBASE_CONFIG) {
    let firebaseConfig;
    try { firebaseConfig = JSON.parse(environment.FIREBASE_CONFIG); } catch {
      throw new Error("Remove ambiguous FIREBASE_CONFIG before running this gate.");
    }
    if (!firebaseConfig || typeof firebaseConfig !== "object" || Array.isArray(firebaseConfig)) {
      throw new Error("Remove ambiguous FIREBASE_CONFIG before running this gate.");
    }
    if (firebaseConfig.projectId !== projectId) throw new Error("Conflicting Firebase project configuration.");
  }
  const apiKey = environment.SECURITY_INTEGRATION_API_KEY?.trim();
  if (!apiKey) throw new Error("SECURITY_INTEGRATION_API_KEY is required for actual client requests.");
  return { projectId, apiKey, appCheckToken: environment.SECURITY_INTEGRATION_APPCHECK_TOKEN?.trim() };
}

export function runSecurityIntegration(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    throw new Error("Only --check is supported; the test configuration cannot be overridden.");
  }
  const config = readSecurityIntegrationConfig();
  if (args[0] === "--check") {
    process.stdout.write(`Security integration targeting validated for ${config.projectId}; no network calls made.\n`);
    return 0;
  }
  const functionsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = spawnSync(process.execPath, [
    resolve(functionsDirectory, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.security-integration.config.ts",
  ], { cwd: functionsDirectory, stdio: "inherit", env: process.env });
  if (result.error) throw new Error("Could not start the security integration runner.");
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = runSecurityIntegration(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Security integration configuration rejected."}\n`);
    process.exitCode = 1;
  }
}
