#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADMIN_SAFETY_DEMO_PROJECT = "demo-sodc-admin-safety";
export const ADMIN_SAFETY_EMULATOR = "127.0.0.1:9399";
export const ADMIN_SAFETY_EMULATOR_ENV = {
  DATA_CONNECT_EMULATOR_HOST: ADMIN_SAFETY_EMULATOR,
  FIREBASE_DATA_CONNECT_EMULATOR_HOST: `http://${ADMIN_SAFETY_EMULATOR}`,
  FIREBASE_DATACONNECT_EMULATOR_HOST: ADMIN_SAFETY_EMULATOR,
};

/** Validate before any SDK, CLI, account, database or network access. */
export function validateAdminSafetyIntegrationEnvironment(env, args = []) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) throw new Error("Only --check is supported; the runner owns its emulator and source directory.");
  if (env.RUN_ADMIN_SAFETY_INTEGRATION !== "1") throw new Error("Set RUN_ADMIN_SAFETY_INTEGRATION=1 for disposable local SQL race tests.");
  if (env.ADMIN_SAFETY_INTEGRATION_PROJECT !== ADMIN_SAFETY_DEMO_PROJECT) throw new Error("The admin safety runner accepts only its fixed demo project; no cloud target is supported.");
  for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (env[key] && env[key] !== ADMIN_SAFETY_DEMO_PROJECT) throw new Error(`Conflicting ${key}; refusing integration run.`);
  }
  if (env.FIREBASE_CONFIG || env.ADMIN_SAFETY_FIXTURE_DIR || env.ADMIN_SAFETY_INTEGRATION_RUN_ID) throw new Error("Externally supplied Firebase/fixture context is not accepted.");
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_EMULATOR_HOST") && value && ADMIN_SAFETY_EMULATOR_ENV[key] !== value) {
      throw new Error("Unexpected emulator override; the runner starts its own loopback Data Connect emulator.");
    }
  }
  return { projectId: ADMIN_SAFETY_DEMO_PROJECT, emulatorHost: ADMIN_SAFETY_EMULATOR, checkOnly: args[0] === "--check" };
}

// Firebase's emulators:exec receives a shell command. Quote paths, never JSON-encode them as shell source.
const shellQuote = value => `'${value.replace(/'/g, "'\\''")}'`;

export async function runAdminSafetyIntegration(env = process.env, args = process.argv.slice(2)) {
  const options = validateAdminSafetyIntegrationEnvironment(env, args);
  if (options.checkOnly) {
    console.log("Admin safety targeting check passed: fixed demo project and disposable loopback SQL only. No emulator, SDK or network operation ran.");
    return 0;
  }
  const repositoryRoot = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "sodc-admin-safety-"));
  const runId = randomUUID();
  let emulator;
  let onInterrupt;
  let onTerminate;
  try {
    await cp(path.join(repositoryRoot, "dataconnect"), path.join(fixtureRoot, "dataconnect"), {
      recursive: true, filter: source => !source.split(path.sep).includes(".dataconnect"),
    });
    for (const connector of ["api", "booking-service", "authorization-service"]) {
      await writeFile(path.join(fixtureRoot, "dataconnect", connector, "connector.yaml"), `connectorId: ${connector}\n`);
    }
    // Fresh database, source and metadata belong to this invocation. Neither an
    // existing emulator nor the checkout's persisted database is reused or reset.
    await mkdir(path.join(fixtureRoot, "data"));
    await writeFile(path.join(fixtureRoot, "firebase.json"), JSON.stringify({
      dataconnect: { source: "dataconnect" },
      emulators: { dataconnect: { host: "127.0.0.1", port: 9399, dataDir: "data" } },
    }, null, 2));
    await writeFile(path.join(fixtureRoot, "ADMIN-SAFETY-FIXTURE.json"), JSON.stringify({
      schemaVersion: "sodc-admin-safety-local/v1", projectId: options.projectId, repositoryRoot, runId,
    }, null, 2));
    const functionsRoot = path.join(repositoryRoot, "functions");
    const command = [process.execPath, path.join(functionsRoot, "node_modules/vitest/vitest.mjs"), "run",
      "--root", functionsRoot, "--config", path.join(functionsRoot, "vitest.admin-safety-integration.config.ts")].map(shellQuote).join(" ");
    emulator = spawn("firebase", ["emulators:exec", "--only", "dataconnect", "--project", options.projectId,
      "--config", path.join(fixtureRoot, "firebase.json"), command], {
      cwd: fixtureRoot, stdio: "inherit", env: { ...env,
        GCLOUD_PROJECT: options.projectId, GOOGLE_CLOUD_PROJECT: options.projectId,
        DATA_CONNECT_EMULATOR_HOST: options.emulatorHost,
        ADMIN_SAFETY_FIXTURE_DIR: fixtureRoot, ADMIN_SAFETY_INTEGRATION_RUN_ID: runId,
      },
    });
    onInterrupt = () => { emulator.kill("SIGINT"); };
    onTerminate = () => { emulator.kill("SIGTERM"); };
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
    const code = await new Promise((resolve, reject) => {
      emulator.once("error", reject);
      emulator.once("close", status => resolve(status ?? 1));
    });
    if (code !== 0) throw new Error("Disposable admin safety SQL races failed; no cloud target or live identity was used.");
    return 0;
  } finally {
    if (onInterrupt) process.removeListener("SIGINT", onInterrupt);
    if (onTerminate) process.removeListener("SIGTERM", onTerminate);
    if (!emulator || emulator.exitCode !== null || emulator.signalCode !== null || !emulator.pid) {
      await rm(fixtureRoot, { recursive: true, force: true });
    } else {
      console.error(`Emulator shutdown is incomplete; retained this invocation's temporary database at ${fixtureRoot}.`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runAdminSafetyIntegration().catch(error => { console.error(error.message); process.exitCode = 1; });
}
