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
    get: async ({ channel, deliveryKey }) => (await sdk.getNotificationDeliveryByChannelAndKey(dc, { channel, deliveryKey })).data.notificationDeliveries[0] ?? null,
    plan: helper.planNotificationRecoveryRelease,
    release: async variables => (await sdk.releaseNotificationRecoveryDeferralForClaimById(dc, variables)).data.notificationDelivery_updateMany,
    dispose: () => deleteApp(app),
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.versions.node.split(".")[0] !== "24") {
    console.error("Notification recovery operator tool requires Node 24.");
    process.exitCode = 1;
  } else {
    void import("../lib/notificationRecoveryAdmin.js")
      .then(core => core.runNotificationRecoveryAdmin(process.argv.slice(2), defaultDependencies))
      .then(receipt => console.log(JSON.stringify(receipt, null, 2)))
      .catch(() => { console.error("Notification recovery release incomplete. Check arguments, reviewed plan and current row; no automatic retry or send was attempted."); process.exitCode = 1; });
  }
}
