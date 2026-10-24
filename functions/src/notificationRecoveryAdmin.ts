import { createHash } from "node:crypto";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";
import type { NotificationRecoveryReleaseAttestation, NotificationRecoveryReleasePlan, NotificationRecoveryReleaseRow } from "./notificationRecoveryDeferral";

export interface NotificationRecoveryAdminOptions {
  projectId: string;
  channel: "EMAIL";
  deliveryKey: string;
  actorId: string;
  evidenceReference: string;
  verifiedMode?: GovNotifyDeliveryMode;
  apply: boolean;
  expectedPlanHash?: string;
}
export interface NotificationRecoveryAdminDependencies {
  get(options: NotificationRecoveryAdminOptions): Promise<NotificationRecoveryReleaseRow | null>;
  plan(row: NotificationRecoveryReleaseRow, attestation: NotificationRecoveryReleaseAttestation): NotificationRecoveryReleasePlan;
  release(variables: NotificationRecoveryReleasePlan["variables"]): Promise<number>;
  dispose?(): void | Promise<void>;
}

const PROJECTS = new Set(["sodc-web", "sodc-web-beta", "sodc-web-production"]);
const MODES = new Set(["SIMULATION", "TEAM_TEST", "LIVE"]);
const VALUE_OPTIONS = new Set(["--project", "--channel", "--delivery-key", "--actor", "--evidence-reference", "--verified-mode", "--confirm-project", "--expected-plan-hash"]);

export function parseNotificationRecoveryAdminArguments(args: string[], env: NodeJS.ProcessEnv = process.env): NotificationRecoveryAdminOptions {
  const values = new Map<string, string>();
  let apply = false;
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--apply") {
      if (apply) throw new Error("Duplicate --apply");
      apply = true;
    } else {
      if (!VALUE_OPTIONS.has(key) || values.has(key)) throw new Error("Unknown or duplicate option");
      const value = args[++index];
      if (!value || value.startsWith("--") || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error("Missing or invalid option value");
      values.set(key, value);
    }
  }
  const projectId = values.get("--project");
  const channel = values.get("--channel") ?? "EMAIL";
  const deliveryKey = values.get("--delivery-key");
  const actorId = values.get("--actor");
  const evidenceReference = values.get("--evidence-reference");
  const verifiedMode = values.get("--verified-mode");
  if (!projectId || !PROJECTS.has(projectId)) throw new Error("Explicit known --project required");
  if (channel !== "EMAIL") throw new Error("Only supported EMAIL recovery can be released");
  if (!deliveryKey || deliveryKey.length > 2000) throw new Error("One exact --delivery-key required");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(actorId ?? "") || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,239}$/.test(evidenceReference ?? "")) throw new Error("Explicit --actor and --evidence-reference required");
  if (verifiedMode !== undefined && !MODES.has(verifiedMode)) throw new Error("Unknown --verified-mode");
  const expectedPlanHash = values.get("--expected-plan-hash");
  if (apply && (values.get("--confirm-project") !== projectId || !/^[a-f0-9]{64}$/.test(expectedPlanHash ?? ""))) throw new Error("Apply requires matching --confirm-project and reviewed --expected-plan-hash");
  if (!apply && (values.has("--confirm-project") || values.has("--expected-plan-hash"))) throw new Error("Write confirmations require --apply");
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_EMULATOR_HOST") && value) throw new Error("Emulator overrides are not accepted by the operator tool");
  }
  for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (env[key] && env[key] !== projectId) throw new Error("Conflicting project environment");
  }
  if (env.FIREBASE_CONFIG) {
    let config;
    try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { throw new Error("Invalid Firebase project environment"); }
    if (!config || config.projectId !== projectId) throw new Error("Conflicting Firebase project environment");
  }
  return { projectId, channel, deliveryKey, actorId: actorId!, evidenceReference: evidenceReference!, verifiedMode: verifiedMode as GovNotifyDeliveryMode | undefined, apply, expectedPlanHash };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  return value;
}

function releasePlanHash(options: NotificationRecoveryAdminOptions, plan: NotificationRecoveryReleasePlan) {
  return createHash("sha256").update(JSON.stringify(canonical({ projectId: options.projectId, channel: options.channel, deliveryKey: options.deliveryKey, plan }))).digest("hex");
}

function assertReleaseReadback(before: NotificationRecoveryReleaseRow, after: NotificationRecoveryReleaseRow | null, mode: GovNotifyDeliveryMode) {
  if (!after || after.recoveryDeferredAt != null || after.deliveryMode !== mode) throw new Error("RELEASE_READBACK_INCOMPLETE");
  for (const field of ["id", "channel", "deliveryKey", "notificationType", "status", "attemptCount", "lastAttemptedAt", "recoveryPayload", "recipientUserId", "recoveryDeferredReason"] as const) {
    if ((before[field] ?? null) !== (after[field] ?? null)) throw new Error("RELEASE_READBACK_HISTORY_CHANGED");
  }
  if ((before.booking?.id ?? before.subjectBookingId ?? null) !== (after.booking?.id ?? after.subjectBookingId ?? null) ||
      (before.user?.id ?? before.subjectUserId ?? null) !== (after.user?.id ?? after.subjectUserId ?? null)) throw new Error("RELEASE_READBACK_SUBJECT_CHANGED");
}

/** Validation precedes SDK/credential imports; dry runs never call the release operation. */
export async function runNotificationRecoveryAdmin(args: string[], createDependencies: (options: NotificationRecoveryAdminOptions) => Promise<NotificationRecoveryAdminDependencies>, env: NodeJS.ProcessEnv = process.env) {
  const options = parseNotificationRecoveryAdminArguments(args, env);
  const dependencies = await createDependencies(options);
  try {
    const before = await dependencies.get(options);
    if (!before || before.channel !== options.channel || before.deliveryKey !== options.deliveryKey) throw new Error("RELEASE_ROW_NOT_FOUND");
    const plan = dependencies.plan(before, { verifiedMode: options.verifiedMode, actorId: options.actorId, evidenceReference: options.evidenceReference });
    const planHash = releasePlanHash(options, plan);
    const { deliveryId, status, attemptCount, deferredAt, deferredReason, verifiedMode, fillsMissingDeliveryMode } = plan.summary;
    const receipt = { schemaVersion: "sodc-notification-recovery-release-receipt/v1", projectId: options.projectId, planHash,
      result: "PLAN", deliveryId, status, attemptCount, deferredAt, deferredReason, verifiedMode, fillsMissingDeliveryMode,
      actorId: options.actorId, evidenceReference: options.evidenceReference };
    if (!options.apply) return receipt;
    if (options.expectedPlanHash !== planHash) throw new Error("RELEASE_PLAN_CHANGED");
    if (await dependencies.release(plan.variables) !== 1) throw new Error("RELEASE_SNAPSHOT_CHANGED");
    assertReleaseReadback(before, await dependencies.get(options), verifiedMode);
    return { ...receipt, result: "RELEASED", verifiedAt: new Date().toISOString() };
  } finally { await dependencies.dispose?.(); }
}
