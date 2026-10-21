import { readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADMIN_SAFETY_DEMO_PROJECT, ADMIN_SAFETY_EMULATOR, ADMIN_SAFETY_EMULATOR_ENV } from "./run-admin-safety-integration.mjs";

/** Every process validates the runner-owned disposable context before loading a database SDK. */
export async function assertAdminSafetyFixture(env = process.env) {
  if (env.RUN_ADMIN_SAFETY_INTEGRATION !== "1" || env.ADMIN_SAFETY_INTEGRATION_PROJECT !== ADMIN_SAFETY_DEMO_PROJECT ||
      env.GCLOUD_PROJECT !== ADMIN_SAFETY_DEMO_PROJECT || env.GOOGLE_CLOUD_PROJECT !== ADMIN_SAFETY_DEMO_PROJECT ||
      env.DATA_CONNECT_EMULATOR_HOST !== ADMIN_SAFETY_EMULATOR) throw new Error("The admin safety fixture requires its disposable demo/loopback context.");
  // emulators:exec may add this after the parent rejected externally supplied
  // configuration. Accept only an inline, matching demo project in children.
  if (env.FIREBASE_CONFIG) {
    let config;
    try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { throw new Error("Ambiguous Firebase emulator configuration."); }
    if (!config || config.projectId !== ADMIN_SAFETY_DEMO_PROJECT) throw new Error("Conflicting Firebase emulator configuration.");
  }
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_EMULATOR_HOST") && value && ADMIN_SAFETY_EMULATOR_ENV[key] !== value) throw new Error(`Unexpected transport override in admin safety fixture: ${key}.`);
  }
  if (!env.ADMIN_SAFETY_FIXTURE_DIR || !path.isAbsolute(env.ADMIN_SAFETY_FIXTURE_DIR) || !env.ADMIN_SAFETY_INTEGRATION_RUN_ID) throw new Error("Runner-owned fixture context is missing.");
  const [fixtureRoot, temporaryRoot, repositoryRoot] = await Promise.all([
    realpath(env.ADMIN_SAFETY_FIXTURE_DIR), realpath(tmpdir()),
    realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")),
  ]);
  if (path.dirname(fixtureRoot) !== temporaryRoot || !/^sodc-admin-safety-[A-Za-z0-9]+$/.test(path.basename(fixtureRoot))) throw new Error("Fixture directory is outside the runner's disposable temporary root.");
  const marker = JSON.parse(await readFile(path.join(fixtureRoot, "ADMIN-SAFETY-FIXTURE.json"), "utf8"));
  const config = JSON.parse(await readFile(path.join(fixtureRoot, "firebase.json"), "utf8"));
  if (marker.schemaVersion !== "sodc-admin-safety-local/v1" || marker.projectId !== ADMIN_SAFETY_DEMO_PROJECT ||
      marker.repositoryRoot !== repositoryRoot || marker.runId !== env.ADMIN_SAFETY_INTEGRATION_RUN_ID ||
      config.dataconnect?.source !== "dataconnect" || config.emulators?.dataconnect?.host !== "127.0.0.1" ||
      config.emulators?.dataconnect?.port !== 9399 || config.emulators?.dataconnect?.dataDir !== "data") throw new Error("Disposable fixture metadata does not match this invocation.");
  return { projectId: ADMIN_SAFETY_DEMO_PROJECT, fixtureRoot, repositoryRoot, runId: marker.runId };
}
