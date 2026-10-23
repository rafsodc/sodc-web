#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const NOTIFICATION_RECOVERY_DEMO_PROJECT = "demo-sodc-notification-recovery";
export const NOTIFICATION_RECOVERY_EMULATOR = "127.0.0.1:9398";
export const NOTIFICATION_RECOVERY_EMULATOR_ENV = {
  DATA_CONNECT_EMULATOR_HOST: NOTIFICATION_RECOVERY_EMULATOR,
  FIREBASE_DATA_CONNECT_EMULATOR_HOST: `http://${NOTIFICATION_RECOVERY_EMULATOR}`,
  FIREBASE_DATACONNECT_EMULATOR_HOST: NOTIFICATION_RECOVERY_EMULATOR,
};

/** Pure gate: validate before SDK, credentials, CLI, database or network access. */
export function validateNotificationRecoveryIntegrationEnvironment(env, args = []) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) throw new Error("Only --check is supported; this runner owns its disposable SQL emulator.");
  if (env.RUN_NOTIFICATION_RECOVERY_INTEGRATION !== "1") throw new Error("Set RUN_NOTIFICATION_RECOVERY_INTEGRATION=1 for disposable local SQL tests.");
  if (env.NOTIFICATION_RECOVERY_INTEGRATION_PROJECT !== NOTIFICATION_RECOVERY_DEMO_PROJECT) throw new Error("Only the fixed notification recovery demo project is accepted; cloud targets are unsupported.");
  for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (env[key] && env[key] !== NOTIFICATION_RECOVERY_DEMO_PROJECT) throw new Error(`Conflicting ${key}; refusing integration run.`);
  }
  if (env.FIREBASE_CONFIG || env.NOTIFICATION_RECOVERY_FIXTURE_DIR || env.NOTIFICATION_RECOVERY_INTEGRATION_RUN_ID) throw new Error("Externally supplied Firebase or fixture context is not accepted.");
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_EMULATOR_HOST") && value && NOTIFICATION_RECOVERY_EMULATOR_ENV[key] !== value) throw new Error("Unexpected emulator override; this runner starts its own loopback SQL emulator.");
  }
  return { projectId: NOTIFICATION_RECOVERY_DEMO_PROJECT, emulatorHost: NOTIFICATION_RECOVERY_EMULATOR, checkOnly: args[0] === "--check" };
}

/** Child processes independently validate the runner's disposable context before SDK imports. */
export async function assertNotificationRecoveryFixture(env = process.env) {
  if (env.RUN_NOTIFICATION_RECOVERY_INTEGRATION !== "1" || env.NOTIFICATION_RECOVERY_INTEGRATION_PROJECT !== NOTIFICATION_RECOVERY_DEMO_PROJECT ||
      env.GCLOUD_PROJECT !== NOTIFICATION_RECOVERY_DEMO_PROJECT || env.GOOGLE_CLOUD_PROJECT !== NOTIFICATION_RECOVERY_DEMO_PROJECT ||
      env.DATA_CONNECT_EMULATOR_HOST !== NOTIFICATION_RECOVERY_EMULATOR) throw new Error("Notification recovery SQL tests require their fixed demo and loopback context.");
  if (env.FIREBASE_CONFIG) {
    let config;
    try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { throw new Error("Ambiguous Firebase emulator configuration."); }
    if (!config || config.projectId !== NOTIFICATION_RECOVERY_DEMO_PROJECT) throw new Error("Conflicting Firebase emulator configuration.");
  }
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_EMULATOR_HOST") && value && NOTIFICATION_RECOVERY_EMULATOR_ENV[key] !== value) throw new Error(`Unexpected transport override: ${key}.`);
  }
  if (!env.NOTIFICATION_RECOVERY_FIXTURE_DIR || !path.isAbsolute(env.NOTIFICATION_RECOVERY_FIXTURE_DIR) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(env.NOTIFICATION_RECOVERY_INTEGRATION_RUN_ID ?? "")) throw new Error("Runner-owned fixture context is missing.");
  const [fixtureRoot, temporaryRoot, repositoryRoot] = await Promise.all([
    realpath(env.NOTIFICATION_RECOVERY_FIXTURE_DIR), realpath(tmpdir()),
    realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")),
  ]);
  if (path.dirname(fixtureRoot) !== temporaryRoot || !/^sodc-notification-recovery-[A-Za-z0-9]+$/.test(path.basename(fixtureRoot))) throw new Error("Fixture is outside this runner's disposable temporary root.");
  const marker = JSON.parse(await readFile(path.join(fixtureRoot, "NOTIFICATION-RECOVERY-FIXTURE.json"), "utf8"));
  const config = JSON.parse(await readFile(path.join(fixtureRoot, "firebase.json"), "utf8"));
  if (marker.schemaVersion !== "sodc-notification-recovery-local/v1" || marker.projectId !== NOTIFICATION_RECOVERY_DEMO_PROJECT ||
      marker.repositoryRoot !== repositoryRoot || marker.runId !== env.NOTIFICATION_RECOVERY_INTEGRATION_RUN_ID ||
      config.dataconnect?.source !== "dataconnect" || config.emulators?.dataconnect?.host !== "127.0.0.1" ||
      config.emulators?.dataconnect?.port !== 9398 || config.emulators?.dataconnect?.dataDir !== "data") throw new Error("Disposable fixture metadata does not match this invocation.");
  return { projectId: NOTIFICATION_RECOVERY_DEMO_PROJECT, fixtureRoot, repositoryRoot, runId: marker.runId };
}

// emulators:exec accepts shell source; paths must be shell-quoted, never JSON-encoded.
const shellQuote = value => `'${value.replace(/'/g, "'\\''")}'`;

export async function runNotificationRecoveryIntegration(env = process.env, args = process.argv.slice(2)) {
  const options = validateNotificationRecoveryIntegrationEnvironment(env, args);
  if (options.checkOnly) {
    console.log("Notification recovery targeting check passed: fixed demo project and disposable loopback SQL only. No emulator, SDK, provider or network operation ran.");
    return 0;
  }
  const repositoryRoot = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "sodc-notification-recovery-"));
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
    await mkdir(path.join(fixtureRoot, "data"));
    await writeFile(path.join(fixtureRoot, "firebase.json"), JSON.stringify({
      dataconnect: { source: "dataconnect" },
      emulators: { dataconnect: { host: "127.0.0.1", port: 9398, dataDir: "data" } },
    }, null, 2));
    await writeFile(path.join(fixtureRoot, "NOTIFICATION-RECOVERY-FIXTURE.json"), JSON.stringify({
      schemaVersion: "sodc-notification-recovery-local/v1", projectId: options.projectId, repositoryRoot, runId,
    }, null, 2));
    const functionsRoot = path.join(repositoryRoot, "functions");
    const command = [process.execPath, path.join(functionsRoot, "node_modules/vitest/vitest.mjs"), "run", "--root", functionsRoot,
      "--config", path.join(functionsRoot, "vitest.notification-recovery-integration.config.ts")].map(shellQuote).join(" ");
    emulator = spawn("firebase", ["emulators:exec", "--only", "dataconnect", "--project", options.projectId,
      "--config", path.join(fixtureRoot, "firebase.json"), command], {
      cwd: fixtureRoot, stdio: "inherit", env: { ...env, ...NOTIFICATION_RECOVERY_EMULATOR_ENV,
        GCLOUD_PROJECT: options.projectId, GOOGLE_CLOUD_PROJECT: options.projectId,
        NOTIFICATION_RECOVERY_FIXTURE_DIR: fixtureRoot, NOTIFICATION_RECOVERY_INTEGRATION_RUN_ID: runId,
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
    if (code !== 0) throw new Error("Disposable notification recovery SQL tests failed; no cloud target, Auth identity or provider was used.");
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
  void runNotificationRecoveryIntegration().catch(error => { console.error(error.message); process.exitCode = 1; });
}
