import * as logger from "firebase-functions/logger";
import {
  claimNotificationDeliveryById,
  claimNotificationDeliveryForRecoveryById,
  createNotificationDelivery,
  getNotificationDeliveryByChannelAndKey,
  markNotificationDeliveryFailedById,
  markNotificationDeliverySentById,
  markNotificationDeliverySkippedById,
  NotificationChannel,
  NotificationDeliveryStatus,
  GovNotifyDeliveryMode as DataConnectGovNotifyDeliveryMode,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  serializeNotificationRecoveryPayload,
  type NotificationRecoveryPayload,
} from "./notificationRecoveryPayload";
import {
  govNotifyReferenceForMode,
  type GovNotifyDeliveryMode,
} from "./govNotifyDeliveryMode";
import { resolveRuntimeGovNotifyDeliveryMode } from "./govNotifyDeliveryConfiguration";
import {
  createNotificationRecoveryClaim,
  NotificationRecoveryDeferredError,
  recoveryDeliveryMode,
  NOTIFICATION_RECOVERY_PENDING_LEASE_MS,
  NOTIFICATION_RECOVERY_RETRY_DELAY_MS,
  type NotificationRecoveryClaim,
} from "./notificationRecoveryClaim";

const MAX_ERROR_CODE_LENGTH = 120;
const MAX_ERROR_MESSAGE_LENGTH = 500;
export const DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS = 10 * 60 * 1000;

export interface NotificationSkipResult {
  outcome: "skipped";
  reason: string;
  providerMessageId?: never;
  deliveryMode?: never;
}

function isNotificationSkipResult(result: NotificationSendResult | NotificationSkipResult | void): result is NotificationSkipResult {
  return Boolean(result && "outcome" in result && result.outcome === "skipped");
}

export interface NotificationSendResult {
  providerMessageId?: string | null;
  deliveryMode?: GovNotifyDeliveryMode;
}

export interface SendNotificationOnceRequest {
  channel: NotificationChannel;
  notificationType: string;
  deliveryKey: string;
  ticketOrderId?: UUIDString | null;
  bookingId?: UUIDString | null;
  userId?: string | null;
  provider?: string | null;
  deliveryMode?: GovNotifyDeliveryMode;
  recoveryPayload?: NotificationRecoveryPayload;
  recipientUserId?: string;
  /** Recovery already has the exact persisted, mode-scoped key. */
  preserveDeliveryKey?: boolean;
  /** Internal recovery-list policy, deliberately separate from recoveryPayload. */
  recoveryClaim?: NotificationRecoveryClaim;
  send: (deliveryMode?: GovNotifyDeliveryMode, assertOwnership?: () => Promise<void>) => Promise<NotificationSendResult | NotificationSkipResult | void>;
}

export interface SendNotificationOnceResult {
  outcome: "sent" | "duplicate" | "failed" | "skipped";
  reason?: string;
  deliveryId?: UUIDString;
  attemptCount?: number;
}

interface NotificationDeliveryRecord {
  id: UUIDString;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  lastAttemptedAt: string | null;
}

export interface NotificationDeliveryRepository {
  getByChannelAndKey(args: {
    channel: NotificationChannel;
    deliveryKey: string;
  }): Promise<NotificationDeliveryRecord | null>;
  createPending(args: {
    channel: NotificationChannel;
    notificationType: string;
    deliveryKey: string;
    ticketOrderId?: UUIDString | null;
    bookingId?: UUIDString | null;
    userId?: string | null;
    provider?: string | null;
    recoveryPayload?: string | null;
    recipientUserId?: string;
    deliveryMode?: GovNotifyDeliveryMode;
    attemptCount: number;
    lastAttemptedAt: string;
  }): Promise<NotificationDeliveryRecord>;
  tryMarkPending(args: {
    id: UUIDString;
    expectedStatus: NotificationDeliveryStatus;
    expectedAttemptCount: number;
    attemptCount: number;
    lastAttemptedAt: string;
    provider?: string | null;
    recoveryPayload?: string | null;
  }): Promise<boolean>;
  tryMarkPendingForRecovery(args: {
    claim: NotificationRecoveryClaim;
    lastAttemptedAt: string;
    provider?: string | null;
  }): Promise<boolean>;
  markSent(args: {
    id: UUIDString;
    attemptCount: number;
    lastAttemptedAt: string;
    sentAt: string;
    provider?: string | null;
    providerMessageId?: string | null;
    deliveryMode?: GovNotifyDeliveryMode | null;
  }): Promise<boolean>;
  markSkipped(args: {
    id: UUIDString;
    attemptCount: number;
    lastAttemptedAt: string;
    skippedAt: string;
    skipReason: string;
  }): Promise<boolean>;
  markFailed(args: {
    id: UUIDString;
    attemptCount: number;
    lastAttemptedAt: string;
    provider?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }): Promise<boolean>;
}

export interface SendNotificationOnceDependencies {
  repository?: NotificationDeliveryRepository;
  now?: () => string;
  leaseMs?: number;
}

const dataConnectNotificationDeliveryRepository: NotificationDeliveryRepository = {
  async getByChannelAndKey(args) {
    const existing = await getNotificationDeliveryByChannelAndKey({
      channel: args.channel,
      deliveryKey: args.deliveryKey,
    });
    const row = existing.data?.notificationDeliveries?.[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      status: row.status,
      attemptCount: row.attemptCount,
      lastAttemptedAt: row.lastAttemptedAt ?? null,
    };
  },

  async createPending(args) {
    const created = await createNotificationDelivery({
      channel: args.channel,
      notificationType: args.notificationType,
      deliveryKey: args.deliveryKey,
      status: NotificationDeliveryStatus.PENDING,
      ticketOrderId: args.ticketOrderId ?? null,
      bookingId: args.bookingId ?? null,
      userId: args.userId ?? null,
      provider: args.provider ?? null,
      recoveryPayload: args.recoveryPayload ?? null,
      recipientUserId: args.recipientUserId ?? null,
      deliveryMode: args.deliveryMode as DataConnectGovNotifyDeliveryMode | undefined,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
    });
    return {
      id: created.data.notificationDelivery_insert.id,
      status: NotificationDeliveryStatus.PENDING,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
    };
  },

  async tryMarkPending(args) {
    const claimed = await claimNotificationDeliveryById({
      id: args.id,
      expectedStatus: args.expectedStatus,
      expectedAttemptCount: args.expectedAttemptCount,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
      provider: args.provider ?? null,
      recoveryPayload: args.recoveryPayload ?? null,
    });
    return claimed.data.notificationDelivery_updateMany === 1;
  },

  async tryMarkPendingForRecovery(args) {
    const claimed = await claimNotificationDeliveryForRecoveryById({
      id: args.claim.id,
      channel: args.claim.channel,
      deliveryKey: args.claim.deliveryKey,
      notificationType: args.claim.notificationType,
      expectedStatus: args.claim.status,
      expectedAttemptCount: args.claim.attemptCount,
      expectedLastAttemptedAt: args.claim.lastAttemptedAt,
      expectedRecoveryPayload: args.claim.recoveryPayload,
      expectedRecoveryPayloadIsNull: args.claim.recoveryPayload === null,
      expectedDeliveryMode: args.claim.deliveryMode as DataConnectGovNotifyDeliveryMode | null,
      expectedDeliveryModeIsNull: args.claim.deliveryMode === null,
      lastAttemptedAt: args.lastAttemptedAt,
      provider: args.provider ?? null,
    });
    return claimed.data.notificationDelivery_updateMany === 1;
  },

  async markSent(args) {
    const completed = await markNotificationDeliverySentById({
      id: args.id,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
      sentAt: args.sentAt,
      provider: args.provider ?? null,
      providerMessageId: args.providerMessageId ?? null,
      lastErrorCode: null,
      lastErrorMessage: null,
      deliveryMode: args.deliveryMode as DataConnectGovNotifyDeliveryMode | null | undefined,
    });
    return completed.data.notificationDelivery_updateMany === 1;
  },

  async markSkipped(args) {
    const completed = await markNotificationDeliverySkippedById(args);
    return completed.data.notificationDelivery_updateMany === 1;
  },

  async markFailed(args) {
    const completed = await markNotificationDeliveryFailedById({
      id: args.id,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
      provider: args.provider ?? null,
      lastErrorCode: args.lastErrorCode ?? null,
      lastErrorMessage: args.lastErrorMessage ?? null,
    });
    return completed.data.notificationDelivery_updateMany === 1;
  },
};

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate|already exists|violates/i.test(message);
}

function trimNullable(value: string | null | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, maxLength);
}

function extractErrorDetails(error: unknown): {
  code: string | null;
  message: string | null;
} {
  const errorObject = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
  const codeCandidate = errorObject?.code;
  const code =
    typeof codeCandidate === "string"
      ? codeCandidate
      : error instanceof Error && typeof error.name === "string"
        ? error.name
        : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error == null
          ? null
          : String(error);
  return {
    code: trimNullable(code, MAX_ERROR_CODE_LENGTH),
    message: trimNullable(message, MAX_ERROR_MESSAGE_LENGTH),
  };
}

function duplicateResult(
  reason: "already_sent" | "in_progress",
  record: NotificationDeliveryRecord
): SendNotificationOnceResult {
  return {
    outcome: "duplicate",
    reason,
    deliveryId: record.id,
    attemptCount: record.attemptCount,
  };
}

export function isNotificationDeliveryLeaseExpired(
  lastAttemptedAt: string | null,
  currentTime: string,
  leaseMs: number = DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS
): boolean {
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
    throw new Error("Notification delivery lease duration must be a positive number");
  }
  const currentTimeMs = Date.parse(currentTime);
  if (!Number.isFinite(currentTimeMs)) {
    throw new Error(`Invalid notification delivery current time: ${currentTime}`);
  }
  if (!lastAttemptedAt) {
    return true;
  }
  const lastAttemptedAtMs = Date.parse(lastAttemptedAt);
  if (!Number.isFinite(lastAttemptedAtMs)) {
    return true;
  }
  return currentTimeMs - lastAttemptedAtMs >= leaseMs;
}

async function claimExistingNotificationDelivery(
  request: SendNotificationOnceRequest,
  repository: NotificationDeliveryRepository,
  existing: NotificationDeliveryRecord,
  attemptStartedAt: string,
  leaseMs: number,
  recoveryPayload: string | null
): Promise<SendNotificationOnceResult | { delivery: NotificationDeliveryRecord; attemptCount: number }> {
  if (existing.status === NotificationDeliveryStatus.SKIPPED) {
    return { outcome: "skipped", reason: "already_skipped", deliveryId: existing.id, attemptCount: existing.attemptCount };
  }
  if (existing.status === NotificationDeliveryStatus.SENT) {
    return duplicateResult("already_sent", existing);
  }
  if (
    existing.status === NotificationDeliveryStatus.PENDING &&
    !isNotificationDeliveryLeaseExpired(existing.lastAttemptedAt, attemptStartedAt, leaseMs)
  ) {
    return duplicateResult("in_progress", existing);
  }

  const attemptCount = existing.attemptCount + 1;
  const claimed = await repository.tryMarkPending({
    id: existing.id,
    expectedStatus: existing.status,
    expectedAttemptCount: existing.attemptCount,
    attemptCount,
    lastAttemptedAt: attemptStartedAt,
    provider: request.provider ?? null,
    recoveryPayload,
  });
  if (claimed) {
    return {
      delivery: {
        id: existing.id,
        status: NotificationDeliveryStatus.PENDING,
        attemptCount,
        lastAttemptedAt: attemptStartedAt,
      },
      attemptCount,
    };
  }

  const winner = await repository.getByChannelAndKey({
    channel: request.channel,
    deliveryKey: request.deliveryKey,
  });
  if (!winner) {
    throw new Error(`Notification delivery claim for ${request.channel}:${request.deliveryKey} lost its row`);
  }
  if (winner.status === NotificationDeliveryStatus.SKIPPED) {
    return { outcome: "skipped", reason: "already_skipped", deliveryId: winner.id, attemptCount: winner.attemptCount };
  }
  return winner.status === NotificationDeliveryStatus.SENT
    ? duplicateResult("already_sent", winner)
    : duplicateResult("in_progress", winner);
}

async function claimNotificationDelivery(
  request: SendNotificationOnceRequest,
  repository: NotificationDeliveryRepository,
  attemptStartedAt: string,
  leaseMs: number,
  recoveryPayload: string | null
): Promise<SendNotificationOnceResult | { delivery: NotificationDeliveryRecord; attemptCount: number }> {
  const existing = await repository.getByChannelAndKey({
    channel: request.channel,
    deliveryKey: request.deliveryKey,
  });
  if (request.recoveryClaim) {
    const claim = request.recoveryClaim;
    if (!existing) return { outcome: "duplicate", reason: "recovery_row_missing" };
    if (existing.id !== claim.id || existing.status !== claim.status ||
      existing.attemptCount !== claim.attemptCount || existing.lastAttemptedAt !== claim.lastAttemptedAt) {
      return { outcome: "duplicate", reason: "recovery_candidate_changed", deliveryId: existing.id, attemptCount: existing.attemptCount };
    }
    const waitMs = claim.status === NotificationDeliveryStatus.FAILED
      ? NOTIFICATION_RECOVERY_RETRY_DELAY_MS : NOTIFICATION_RECOVERY_PENDING_LEASE_MS;
    if (!isNotificationDeliveryLeaseExpired(claim.lastAttemptedAt, attemptStartedAt, waitMs)) {
      return { outcome: "duplicate", reason: "recovery_not_due", deliveryId: existing.id, attemptCount: existing.attemptCount };
    }
    const claimed = await repository.tryMarkPendingForRecovery({ claim, lastAttemptedAt: attemptStartedAt, provider: request.provider });
    if (!claimed) return { outcome: "duplicate", reason: "recovery_claim_lost", deliveryId: existing.id, attemptCount: existing.attemptCount };
    const attemptCount = claim.attemptCount + 1;
    return { delivery: { id: claim.id, status: NotificationDeliveryStatus.PENDING,
      attemptCount, lastAttemptedAt: attemptStartedAt }, attemptCount };
  }
  if (existing) {
    return claimExistingNotificationDelivery(
      request,
      repository,
      existing,
      attemptStartedAt,
      leaseMs,
      recoveryPayload
    );
  }

  try {
    const created = await repository.createPending({
      channel: request.channel,
      notificationType: request.notificationType,
      deliveryKey: request.deliveryKey,
      ticketOrderId: request.ticketOrderId ?? null,
      bookingId: request.bookingId ?? null,
      userId: request.userId ?? null,
      provider: request.provider ?? null,
      recoveryPayload,
      recipientUserId: request.recipientUserId,
      deliveryMode: request.deliveryMode,
      attemptCount: 1,
      lastAttemptedAt: attemptStartedAt,
    });
    return { delivery: created, attemptCount: 1 };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const raced = await repository.getByChannelAndKey({
    channel: request.channel,
    deliveryKey: request.deliveryKey,
  });
  if (!raced) {
    throw new Error(`Notification delivery race for ${request.channel}:${request.deliveryKey} but no row was found`);
  }
  return claimExistingNotificationDelivery(
    request,
    repository,
    raced,
    attemptStartedAt,
    leaseMs,
    recoveryPayload
  );
}

export async function sendNotificationOnce(
  request: SendNotificationOnceRequest,
  dependencies: SendNotificationOnceDependencies = {}
): Promise<SendNotificationOnceResult> {
  if (request.recoveryClaim) {
    const claim = createNotificationRecoveryClaim(request.recoveryClaim);
    const originalMode = recoveryDeliveryMode(claim, request.deliveryMode, request.deliveryKey);
    if (request.provider === "govuk_notify" && !originalMode) {
      throw new NotificationRecoveryDeferredError("RECOVERY_DELIVERY_MODE_UNVERIFIABLE");
    }
    const scopedKey = originalMode ? govNotifyReferenceForMode(request.deliveryKey, originalMode) : request.deliveryKey;
    const keyMatches = request.deliveryKey === claim.deliveryKey || (!request.preserveDeliveryKey && scopedKey === claim.deliveryKey);
    if (request.channel !== claim.channel || request.notificationType !== claim.notificationType || !keyMatches) {
      throw new Error("NOTIFICATION_RECOVERY_CLAIM_IDENTITY_MISMATCH");
    }
    request = { ...request, recoveryClaim: claim, deliveryKey: claim.deliveryKey, preserveDeliveryKey: true,
      deliveryMode: originalMode ?? request.deliveryMode };
  }
  const requestedRecoveryMode = request.recoveryClaim ? request.deliveryMode : undefined;
  const deliveryMode = request.provider === "govuk_notify"
    ? (await resolveRuntimeGovNotifyDeliveryMode(request.deliveryMode ?? "LIVE")).effectiveMode
    : request.deliveryMode;
  if (deliveryMode) {
    request = {
      ...request,
      deliveryKey: request.preserveDeliveryKey ? request.deliveryKey : govNotifyReferenceForMode(request.deliveryKey, deliveryMode),
      deliveryMode,
      // A preserved physical key and its payload mode are one recovery identity.
      // The effective mode still controls sending, but must not corrupt a failed skip retry.
      recoveryPayload: request.recoveryPayload && !request.preserveDeliveryKey
        ? { ...request.recoveryPayload, deliveryMode }
        : request.recoveryPayload,
    };
  }
  const repository = dependencies.repository ?? dataConnectNotificationDeliveryRepository;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const leaseMs = dependencies.leaseMs ?? DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS;
  const attemptStartedAt = now();
  const recoveryPayload = request.recoveryPayload
    ? serializeNotificationRecoveryPayload(request.recoveryPayload)
    : null;
  const claimResult = await claimNotificationDelivery(
    request,
    repository,
    attemptStartedAt,
    leaseMs,
    recoveryPayload
  );

  if ("outcome" in claimResult) {
    return claimResult;
  }

  try {
    const sendResult: NotificationSendResult | NotificationSkipResult | void = requestedRecoveryMode && requestedRecoveryMode !== deliveryMode
        ? { outcome: "skipped" as const, reason: "DELIVERY_MODE_CHANGED" }
        : await request.send(deliveryMode, async () => {
      const current = await repository.getByChannelAndKey({ channel: request.channel, deliveryKey: request.deliveryKey });
      if (!current || current.id !== claimResult.delivery.id || current.status !== NotificationDeliveryStatus.PENDING ||
        current.attemptCount !== claimResult.attemptCount || current.lastAttemptedAt !== attemptStartedAt ||
        isNotificationDeliveryLeaseExpired(current.lastAttemptedAt, now(), leaseMs)) {
        throw Object.assign(new Error("Notification delivery lease is no longer owned"), { code: "NOTIFICATION_DELIVERY_OWNERSHIP_LOST" });
      }
    });
    if (isNotificationSkipResult(sendResult)) {
      const completed = await repository.markSkipped({
        id: claimResult.delivery.id,
        attemptCount: claimResult.attemptCount,
        lastAttemptedAt: attemptStartedAt,
        skippedAt: now(),
        skipReason: sendResult.reason.slice(0, MAX_ERROR_CODE_LENGTH),
      });
      if (completed) {
        return { outcome: "skipped", reason: sendResult.reason,
          deliveryId: claimResult.delivery.id, attemptCount: claimResult.attemptCount };
      }
      const current = await repository.getByChannelAndKey({ channel: request.channel, deliveryKey: request.deliveryKey });
      if (current?.status === NotificationDeliveryStatus.SKIPPED) {
        return { outcome: "skipped", reason: "already_skipped", deliveryId: current.id, attemptCount: current.attemptCount };
      }
      if (current?.status === NotificationDeliveryStatus.SENT) return duplicateResult("already_sent", current);
      if (current && (current.attemptCount !== claimResult.attemptCount || current.lastAttemptedAt !== attemptStartedAt)) {
        return duplicateResult("in_progress", current);
      }
      throw new Error("NOTIFICATION_SKIP_NOT_PERSISTED");
    }
    const completed = await repository.markSent({
      id: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
      lastAttemptedAt: attemptStartedAt,
      sentAt: now(),
      provider: request.provider ?? null,
      providerMessageId: sendResult && "providerMessageId" in sendResult ? sendResult.providerMessageId ?? null : null,
      deliveryMode: sendResult && "deliveryMode" in sendResult ? sendResult.deliveryMode ?? null : null,
    });
    if (!completed) {
      logger.warn("notification delivery sent after its lease was replaced", {
        channel: request.channel,
        notificationType: request.notificationType,
        deliveryKey: request.deliveryKey,
        deliveryId: claimResult.delivery.id,
        attemptCount: claimResult.attemptCount,
      });
    }
    return {
      outcome: "sent",
      deliveryId: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === "NOTIFICATION_DELIVERY_OWNERSHIP_LOST") {
      const current = await repository.getByChannelAndKey({ channel: request.channel, deliveryKey: request.deliveryKey });
      if (current?.status === NotificationDeliveryStatus.SKIPPED) return {
        outcome: "skipped", reason: "already_skipped", deliveryId: current.id, attemptCount: current.attemptCount,
      };
      if (current?.status === NotificationDeliveryStatus.SENT) return duplicateResult("already_sent", current);
      if (current) return duplicateResult("in_progress", current);
      return { outcome: "failed", reason: "ownership_lost" };
    }
    const errorDetails = extractErrorDetails(error);
    if (request.recipientUserId) {
      // A provider exception can contain the entire private request. Staff ledgers/logs keep safe codes only.
      const safeCode = (error as { code?: string })?.code;
      errorDetails.code = typeof safeCode === "string" && /^[A-Z_]{1,120}$/.test(safeCode) ? safeCode : "PRIVILEGED_DELIVERY_FAILED";
      errorDetails.message = "Privileged notification delivery failed";
    }
    const completed = await repository.markFailed({
      id: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
      lastAttemptedAt: attemptStartedAt,
      provider: request.provider ?? null,
      lastErrorCode: errorDetails.code,
      lastErrorMessage: errorDetails.message,
    });
    if (!completed) {
      logger.warn("notification delivery failure occurred after its lease was replaced", {
        channel: request.channel,
        notificationType: request.notificationType,
        deliveryKey: request.deliveryKey,
        deliveryId: claimResult.delivery.id,
        attemptCount: claimResult.attemptCount,
      });
    }
    logger.error("notification delivery failed", {
      channel: request.channel,
      notificationType: request.notificationType,
      deliveryKey: request.deliveryKey,
      ticketOrderId: request.ticketOrderId ?? null,
      bookingId: request.bookingId ?? null,
      userId: request.userId ?? null,
      errorCode: errorDetails.code,
      errorMessage: errorDetails.message,
    });
    return {
      outcome: "failed",
      reason: "send_failed",
      deliveryId: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
    };
  }
}
