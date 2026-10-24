import { createHash } from "node:crypto";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";
import type { NotificationRecoveryReleaseAttestation, NotificationRecoveryReleasePlan, NotificationRecoveryReleaseRow } from "./notificationRecoveryDeferral";

export interface NotificationRecoveryAdminOptions {
  projectId: string;
  channel: "EMAIL";
  deliveryKey?: string;
  deliveryId?: string;
  actorId: string;
  evidenceReference: string;
  verifiedMode?: GovNotifyDeliveryMode;
  apply: boolean;
  inspect: boolean;
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
const VALUE_OPTIONS = new Set(["--project", "--channel", "--delivery-key", "--delivery-id", "--actor", "--evidence-reference", "--verified-mode", "--confirm-project", "--expected-plan-hash"]);

export function parseNotificationRecoveryAdminArguments(args: string[], env: NodeJS.ProcessEnv = process.env): NotificationRecoveryAdminOptions {
  const values = new Map<string, string>();
  let apply = false;
  let inspect = false;
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--inspect") {
      if (inspect) throw new Error("RELEASE_OPTION_DUPLICATE");
      inspect = true;
    } else if (key === "--apply") {
      if (apply) throw new Error("RELEASE_OPTION_DUPLICATE");
      apply = true;
    } else {
      if (!VALUE_OPTIONS.has(key) || values.has(key)) throw new Error("RELEASE_OPTION_INVALID");
      const value = args[++index];
      if (!value || value.startsWith("--") || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error("RELEASE_OPTION_VALUE_INVALID");
      values.set(key, value);
    }
  }
  const projectId = values.get("--project");
  const channel = values.get("--channel") ?? "EMAIL";
  const deliveryKey = values.get("--delivery-key");
  const deliveryId = values.get("--delivery-id")?.toLowerCase();
  const actorId = values.get("--actor");
  const evidenceReference = values.get("--evidence-reference");
  const verifiedMode = values.get("--verified-mode");
  if (!projectId || !PROJECTS.has(projectId)) throw new Error("RELEASE_PROJECT_REQUIRED");
  if (channel !== "EMAIL") throw new Error("RELEASE_CHANNEL_UNSUPPORTED");
  if (Boolean(deliveryKey) === Boolean(deliveryId)) throw new Error("RELEASE_SELECTOR_REQUIRED");
  if (deliveryKey && deliveryKey.length > 2000) throw new Error("RELEASE_DELIVERY_KEY_INVALID");
  if (deliveryId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(deliveryId)) throw new Error("RELEASE_DELIVERY_ID_INVALID");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(actorId ?? "") || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,239}$/.test(evidenceReference ?? "")) throw new Error("RELEASE_ACTOR_EVIDENCE_REQUIRED");
  if (verifiedMode !== undefined && !MODES.has(verifiedMode)) throw new Error("RELEASE_MODE_INVALID");
  const expectedPlanHash = values.get("--expected-plan-hash");
  if (inspect && (apply || values.has("--confirm-project") || values.has("--expected-plan-hash") || verifiedMode !== undefined)) throw new Error("RELEASE_INSPECT_FLAGS_INVALID");
  if (apply && (values.get("--confirm-project") !== projectId || !/^[a-f0-9]{64}$/.test(expectedPlanHash ?? ""))) throw new Error("RELEASE_APPLY_CONFIRMATION_REQUIRED");
  if (!apply && (values.has("--confirm-project") || values.has("--expected-plan-hash"))) throw new Error("RELEASE_APPLY_FLAGS_INVALID");
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_EMULATOR_HOST") && value) throw new Error("RELEASE_EMULATOR_OVERRIDE");
  }
  for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (env[key] && env[key] !== projectId) throw new Error("RELEASE_ENVIRONMENT_PROJECT_CONFLICT");
  }
  if (env.FIREBASE_CONFIG) {
    let config;
    try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { throw new Error("RELEASE_ENVIRONMENT_FIREBASE_INVALID"); }
    if (!config || config.projectId !== projectId) throw new Error("RELEASE_ENVIRONMENT_PROJECT_CONFLICT");
  }
  return { projectId, channel, deliveryKey, deliveryId, actorId: actorId!, evidenceReference: evidenceReference!, verifiedMode: verifiedMode as GovNotifyDeliveryMode | undefined, apply, inspect, expectedPlanHash };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  return value;
}

function releasePlanHash(options: NotificationRecoveryAdminOptions, plan: NotificationRecoveryReleasePlan) {
  return createHash("sha256").update(JSON.stringify(canonical({ projectId: options.projectId, channel: options.channel, deliveryKey: options.deliveryKey ?? null, deliveryId: options.deliveryId ?? null, plan }))).digest("hex");
}

function assertReleaseReadback(before: NotificationRecoveryReleaseRow, after: NotificationRecoveryReleaseRow | null, mode: GovNotifyDeliveryMode) {
  if (!after || after.recoveryDeferredAt != null || after.deliveryMode !== mode) throw new Error("RELEASE_READBACK_INCOMPLETE");
  for (const field of ["id", "channel", "deliveryKey", "notificationType", "status", "attemptCount", "lastAttemptedAt", "recoveryPayload", "recipientUserId", "recoveryDeferredReason"] as const) {
    if ((before[field] ?? null) !== (after[field] ?? null)) throw new Error("RELEASE_READBACK_HISTORY_CHANGED");
  }
  if ((before.booking?.id ?? before.subjectBookingId ?? null) !== (after.booking?.id ?? after.subjectBookingId ?? null) ||
      (before.user?.id ?? before.subjectUserId ?? null) !== (after.user?.id ?? after.subjectUserId ?? null)) throw new Error("RELEASE_READBACK_SUBJECT_CHANGED");
}

export type NotificationRecoveryAdminWriteOutcome = "NOT_APPLIED" | "WRITE_OUTCOME_UNKNOWN" | "APPLIED_UNVERIFIED";
export interface NotificationRecoveryAdminReceipt {
  schemaVersion: "sodc-notification-recovery-release-receipt/v1";
  projectId: string;
  planHash: string;
  result: "PLAN" | "RELEASED";
  deliveryId: string;
  status: string;
  attemptCount: number;
  deferredAt: string;
  deferredReason: string;
  verifiedMode: GovNotifyDeliveryMode;
  fillsMissingDeliveryMode: boolean;
  actorId: string;
  evidenceReference: string;
  verifiedAt?: string;
  warningCode?: "RELEASE_CLEANUP_FAILED";
}

export interface NotificationRecoveryAdminInspection {
  schemaVersion: "sodc-notification-recovery-inspection/v1";
  result: "INSPECTED";
  projectId: string;
  deliveryId: string;
  status: string;
  attemptCount: number;
  lastAttemptedAt: string | null;
  deferredAt: string | null;
  deferredReason: string | null;
  deliveryMode: GovNotifyDeliveryMode | null;
  actorId: string;
  evidenceReference: string;
  observedAt: string;
  warningCode?: "RELEASE_CLEANUP_FAILED";
}

const ERROR_CODES = new Set([
  "RELEASE_INSPECT_FLAGS_INVALID",
  "RELEASE_OPTION_DUPLICATE", "RELEASE_OPTION_INVALID", "RELEASE_OPTION_VALUE_INVALID", "RELEASE_PROJECT_REQUIRED", "RELEASE_CHANNEL_UNSUPPORTED",
  "RELEASE_SELECTOR_REQUIRED", "RELEASE_DELIVERY_ID_INVALID", "RELEASE_DELIVERY_KEY_INVALID", "RELEASE_ACTOR_EVIDENCE_REQUIRED", "RELEASE_MODE_INVALID",
  "RELEASE_APPLY_CONFIRMATION_REQUIRED", "RELEASE_APPLY_FLAGS_INVALID", "RELEASE_EMULATOR_OVERRIDE", "RELEASE_ENVIRONMENT_PROJECT_CONFLICT", "RELEASE_ENVIRONMENT_FIREBASE_INVALID",
  "RELEASE_ARGUMENTS_INVALID", "RELEASE_PREPARATION_FAILED", "RELEASE_ROW_READ_FAILED", "RELEASE_ROW_NOT_FOUND", "RELEASE_PLAN_INVALID", "RELEASE_PLAN_CHANGED",
  "RELEASE_SNAPSHOT_CHANGED", "RELEASE_WRITE_OUTCOME_UNKNOWN", "RELEASE_WRITE_RESPONSE_INVALID", "RELEASE_READBACK_FAILED", "RELEASE_READBACK_INCOMPLETE",
  "RELEASE_READBACK_HISTORY_CHANGED", "RELEASE_READBACK_SUBJECT_CHANGED", "NOTIFICATION_RECOVERY_CLAIM_INVALID",
  "NOTIFICATION_RECOVERY_RELEASE_EVIDENCE_REQUIRED", "NOTIFICATION_RECOVERY_RELEASE_MODE_INVALID", "NOTIFICATION_RECOVERY_RELEASE_NOT_DEFERRED",
  "NOTIFICATION_RECOVERY_RELEASE_PAYLOAD_REQUIRED", "NOTIFICATION_RECOVERY_RELEASE_VERIFIED_MODE_REQUIRED", "NOTIFICATION_RECOVERY_RELEASE_MODE_CONFLICT",
  "NOTIFICATION_RECOVERY_RELEASE_IDENTITY_MISMATCH", "NOTIFICATION_RECOVERY_RELEASE_PRIVILEGED_IDENTITY_MISMATCH", "NOTIFICATION_RECOVERY_RELEASE_CHANNEL_UNSUPPORTED",
  "NOTIFICATION_RECOVERY_RELEASE_RECIPIENT_IDENTITY_UNSUPPORTED", "RECOVERY_DELIVERY_MODE_UNVERIFIABLE", "RECOVERY_DELIVERY_MODE_CONFLICT",
]);

function fixedErrorCode(error: unknown, fallback: string): string {
  return error instanceof Error && ERROR_CODES.has(error.message) ? error.message : fallback;
}

export class NotificationRecoveryAdminError extends Error {
  cleanupFailed = false;
  constructor(readonly code: string, readonly outcome: NotificationRecoveryAdminWriteOutcome, readonly receipt?: NotificationRecoveryAdminReceipt) {
    super(code);
    this.name = "NotificationRecoveryAdminError";
  }
}

/** Serialize only fixed codes and the already-sanitized receipt, never SDK text or variables. */
export function formatNotificationRecoveryAdminError(error: unknown) {
  if (!(error instanceof NotificationRecoveryAdminError)) {
    return {schemaVersion: "sodc-notification-recovery-release-receipt/v1", result: "WRITE_OUTCOME_UNKNOWN", code: "RELEASE_WRITE_OUTCOME_UNKNOWN"};
  }
  const context = error.receipt;
  const fallback = error.outcome === "WRITE_OUTCOME_UNKNOWN" ? "RELEASE_WRITE_OUTCOME_UNKNOWN" : error.outcome === "APPLIED_UNVERIFIED" ? "RELEASE_READBACK_FAILED" : "RELEASE_PREPARATION_FAILED";
  return {
    schemaVersion: "sodc-notification-recovery-release-receipt/v1",
    ...(context ? {projectId: context.projectId, planHash: context.planHash, deliveryId: context.deliveryId, status: context.status,
      attemptCount: context.attemptCount, deferredAt: context.deferredAt, deferredReason: context.deferredReason, verifiedMode: context.verifiedMode,
      fillsMissingDeliveryMode: context.fillsMissingDeliveryMode, actorId: context.actorId, evidenceReference: context.evidenceReference} : {}),
    result: error.outcome, code: ERROR_CODES.has(error.code) ? error.code : fallback,
    ...(error.cleanupFailed ? {warningCode: "RELEASE_CLEANUP_FAILED"} : {}),
  };
}

/** Stages distinguish rejected, uncertain and confirmed writes; no stage retries a mutation. */
export async function runNotificationRecoveryAdmin(args: string[], createDependencies: (options: NotificationRecoveryAdminOptions) => Promise<NotificationRecoveryAdminDependencies>, env: NodeJS.ProcessEnv = process.env): Promise<NotificationRecoveryAdminReceipt | NotificationRecoveryAdminInspection> {
  let dependencies: NotificationRecoveryAdminDependencies | undefined;
  let receipt: NotificationRecoveryAdminReceipt | undefined;
  let result: NotificationRecoveryAdminReceipt | NotificationRecoveryAdminInspection | undefined;
  let failure: NotificationRecoveryAdminError | undefined;
  let outcome: NotificationRecoveryAdminWriteOutcome = "NOT_APPLIED";
  let fallback = "RELEASE_ARGUMENTS_INVALID";
  try {
    const options = parseNotificationRecoveryAdminArguments(args, env);
    fallback = "RELEASE_PREPARATION_FAILED";
    dependencies = await createDependencies(options);
    fallback = "RELEASE_ROW_READ_FAILED";
    const before = await dependencies.get(options);
    if (!before || before.channel !== options.channel || (options.deliveryId ? before.id !== options.deliveryId : before.deliveryKey !== options.deliveryKey)) throw new Error("RELEASE_ROW_NOT_FOUND");
    if (options.inspect) {
      result = {schemaVersion: "sodc-notification-recovery-inspection/v1", result: "INSPECTED", projectId: options.projectId,
        deliveryId: before.id, status: before.status, attemptCount: before.attemptCount, lastAttemptedAt: before.lastAttemptedAt,
        deferredAt: before.recoveryDeferredAt ?? null, deferredReason: before.recoveryDeferredReason ?? null, deliveryMode: before.deliveryMode ?? null,
        actorId: options.actorId, evidenceReference: options.evidenceReference, observedAt: new Date().toISOString()};
    } else {
    fallback = "RELEASE_PLAN_INVALID";
    const plan = dependencies.plan(before, { verifiedMode: options.verifiedMode, actorId: options.actorId, evidenceReference: options.evidenceReference });
    const planHash = releasePlanHash(options, plan);
    const { deliveryId, status, attemptCount, deferredAt, deferredReason, verifiedMode, fillsMissingDeliveryMode } = plan.summary;
    receipt = { schemaVersion: "sodc-notification-recovery-release-receipt/v1", projectId: options.projectId, planHash,
      result: "PLAN", deliveryId, status, attemptCount, deferredAt, deferredReason, verifiedMode, fillsMissingDeliveryMode,
      actorId: options.actorId, evidenceReference: options.evidenceReference };
    if (!options.apply) result = receipt;
    else {
      if (options.expectedPlanHash !== planHash) throw new Error("RELEASE_PLAN_CHANGED");
      outcome = "WRITE_OUTCOME_UNKNOWN";
      fallback = "RELEASE_WRITE_OUTCOME_UNKNOWN";
      const affected = await dependencies.release(plan.variables);
      if (affected === 0) { outcome = "NOT_APPLIED"; throw new Error("RELEASE_SNAPSHOT_CHANGED"); }
      if (affected !== 1) throw new Error("RELEASE_WRITE_RESPONSE_INVALID");
      outcome = "APPLIED_UNVERIFIED";
      fallback = "RELEASE_READBACK_FAILED";
      assertReleaseReadback(before, await dependencies.get(options), verifiedMode);
      result = { ...receipt, result: "RELEASED", verifiedAt: new Date().toISOString() };
    }
    }
  } catch (error) { failure = new NotificationRecoveryAdminError(fixedErrorCode(error, fallback), outcome, receipt); }
  try { await dependencies?.dispose?.(); }
  catch {
    if (failure) failure.cleanupFailed = true;
    else if (result) result = {...result, warningCode: "RELEASE_CLEANUP_FAILED"};
  }
  if (failure) throw failure;
  return result!;
}
