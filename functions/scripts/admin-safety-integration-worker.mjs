import { createRequire } from "node:module";
import { assertAdminSafetyFixture } from "./admin-safety-integration-fixture.mjs";

// A worker is an independent OS process/SDK context. It waits at the IPC barrier
// before issuing its one actual conditional mutation; no Auth mock is loaded.
const context = await assertAdminSafetyFixture();
const require = createRequire(new URL("../package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getDataConnect } = require("firebase-admin/data-connect");
const sdk = require("@dataconnect/security-admin-generated");
const app = initializeApp({ projectId: context.projectId }, `admin-safety-worker-${process.pid}`);
const client = getDataConnect(sdk.connectorConfig, app);
const allowed = new Set(["beginSecurityTransition", "completeSecurityTransition", "recordSecurityNoop"]);
let used = false;
process.on("message", async request => {
  if (used) return;
  used = true;
  let response;
  try {
    if (!allowed.has(request?.operation) || typeof sdk[request.operation] !== "function" || !request.variables || typeof request.variables !== "object") throw new Error("Unknown local race operation");
    response = { kind: "result", ok: true, pid: process.pid, data: (await sdk[request.operation](client, request.variables)).data };
  } catch (error) {
    response = { kind: "result", ok: false, pid: process.pid, message: error instanceof Error ? error.message : "Local mutation failed" };
  } finally {
    await deleteApp(app);
  }
  process.send?.(response, () => process.disconnect());
});
process.send?.({ kind: "ready", pid: process.pid });
