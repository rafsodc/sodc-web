import * as logger from "firebase-functions/logger";
import {
  claimNotificationDeliveryById,
  createNotificationDelivery,
  getNotificationDeliveryByChannelAndKey,
  markNotificationDeliveryFailedById,
  markNotificationDeliverySentById,
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  serializeNotificationRecoveryPayload,
  type NotificationRecoveryPayload,
} from "./notificationRecoveryPayload";

const MAX_ERROR_CODE_LENGTH = 120;
const MAX_ERROR_MESSAGE_LENGTH = 500;
export const DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS = 10 * 60 * 1000;

export interface NotificationSendResult {
  providerMessageId?: string | null;
}

export interface SendNotificationOnceRequest {
  channel: NotificationChannel;
  notificationType: string;
  deliveryKey: string;
  ticketOrderId?: UUIDString | null;
  bookingId?: UUIDString | null;
  userId?: string | null;
  provider?: string | null;
  recoveryPayload?: NotificationRecoveryPayload;
  send: () => Promise<NotificationSendResult | void>;
}

export interface SendNotificationOnceResult {
  outcome: "sent" | "duplicate" | "failed";
  reason?: "already_sent" | "in_progress" | "send_failed";
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
  markSent(args: {
    id: UUIDString;
    attemptCount: number;
    lastAttemptedAt: string;
    sentAt: string;
    provider?: string | null;
    providerMessageId?: string | null;
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

interface SendNotificationOnceDependencies {
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
    });
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
    const sendResult = await request.send();
    const completed = await repository.markSent({
      id: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
      lastAttemptedAt: attemptStartedAt,
      sentAt: now(),
      provider: request.provider ?? null,
      providerMessageId: sendResult?.providerMessageId ?? null,
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
    const errorDetails = extractErrorDetails(error);
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
