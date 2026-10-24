#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function defaultDependencies(options) {
  const [{ initializeApp, applicationDefault, deleteApp }, { getDataConnect }, sdk, helper] = await Promise.all([
    import("firebase-admin/app"), import("firebase-admin/data-connect"),
    import("../src/dataconnect-admin-generated/index.cjs.js"), import("../lib/notificationRecoveryDeferral.js"),
  ]);
  return createNotificationRecoveryAdminDependencies(options, { initializeApp, applicationDefault, deleteApp, getDataConnect, sdk, helper });
}

/** Explicit connector and named app keep project and operation routing together. */
export async function createNotificationRecoveryAdminDependencies(options, { initializeApp, applicationDefault, deleteApp, getDataConnect, sdk, helper }) {
  const app = initializeApp({ projectId: options.projectId, credential: applicationDefault() }, `notification-recovery-admin-${randomUUID()}`);
  let dc;
  try { dc = getDataConnect(sdk.connectorConfig, app); }
  catch (error) { await deleteApp(app); throw error; }
  return {
    get: async ({ channel, deliveryKey, deliveryId }) => {
      const result = deliveryId ? await sdk.getNotificationDeliveryById(dc, {id: deliveryId}) : await sdk.getNotificationDeliveryByChannelAndKey(dc, {channel, deliveryKey});
      return result.data.notificationDeliveries[0] ?? null;
    },
    plan: helper.planNotificationRecoveryRelease,
    release: async variables => (await sdk.releaseNotificationRecoveryDeferralForClaimById(dc, variables)).data.notificationDelivery_updateMany,
    dispose: () => deleteApp(app),
  };
}

/** Keep failed-write receipts on stdout for the same audit capture as successful plans. */
export async function runNotificationRecoveryAdminCli(args, {core, createDependencies = defaultDependencies, stdout, stderr}) {
  let report;
  let exitCode = 0;
  try { report = await core.runNotificationRecoveryAdmin(args, createDependencies); }
  catch (error) { report = core.formatNotificationRecoveryAdminError(error); exitCode = 1; }
  stdout(JSON.stringify(report, null, 2));
  if (exitCode) stderr(`${report.code}: ${report.result}`);
  return exitCode;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.versions.node.split(".")[0] !== "24") {
    console.error("RELEASE_NODE_VERSION_INVALID: requires Node 24");
    process.exitCode = 1;
  } else {
    let coreLoaded = false;
    void import("../lib/notificationRecoveryAdmin.js")
      .then(core => { coreLoaded = true; return runNotificationRecoveryAdminCli(process.argv.slice(2), {core, stdout: value => console.log(value), stderr: value => console.error(value)}); })
      .then(code => { process.exitCode = code; })
      .catch(() => { console.error(JSON.stringify({schemaVersion: "sodc-notification-recovery-release-receipt/v1",
        result: coreLoaded ? "WRITE_OUTCOME_UNKNOWN" : "NOT_APPLIED", code: coreLoaded ? "RELEASE_OUTPUT_FAILED" : "RELEASE_TOOL_INITIALIZATION_FAILED"})); process.exitCode = 1; });
  }
}
