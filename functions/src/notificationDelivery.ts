import * as logger from "firebase-functions/logger";
import {
  createNotificationDelivery,
  getNotificationDeliveryByChannelAndKey,
  markNotificationDeliveryFailedById,
  markNotificationDeliveryPendingById,
  markNotificationDeliverySentById,
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";

const MAX_ERROR_CODE_LENGTH = 120;
const MAX_ERROR_MESSAGE_LENGTH = 500;

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
    attemptCount: number;
    lastAttemptedAt: string;
  }): Promise<NotificationDeliveryRecord>;
  markPending(args: {
    id: UUIDString;
    attemptCount: number;
    lastAttemptedAt: string;
    provider?: string | null;
  }): Promise<void>;
  markSent(args: {
    id: UUIDString;
    attemptCount: number;
    lastAttemptedAt: string;
    sentAt: string;
    provider?: string | null;
    providerMessageId?: string | null;
  }): Promise<void>;
  markFailed(args: {
    id: UUIDString;
    attemptCount: number;
    lastAttemptedAt: string;
    provider?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }): Promise<void>;
}

interface SendNotificationOnceDependencies {
  repository?: NotificationDeliveryRepository;
  now?: () => string;
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
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
    });
    return {
      id: created.data.notificationDelivery_insert.id,
      status: NotificationDeliveryStatus.PENDING,
      attemptCount: args.attemptCount,
    };
  },

  async markPending(args) {
    await markNotificationDeliveryPendingById({
      id: args.id,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
      provider: args.provider ?? null,
    });
  },

  async markSent(args) {
    await markNotificationDeliverySentById({
      id: args.id,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
      sentAt: args.sentAt,
      provider: args.provider ?? null,
      providerMessageId: args.providerMessageId ?? null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  },

  async markFailed(args) {
    await markNotificationDeliveryFailedById({
      id: args.id,
      attemptCount: args.attemptCount,
      lastAttemptedAt: args.lastAttemptedAt,
      provider: args.provider ?? null,
      lastErrorCode: args.lastErrorCode ?? null,
      lastErrorMessage: args.lastErrorMessage ?? null,
    });
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

async function claimNotificationDelivery(
  request: SendNotificationOnceRequest,
  repository: NotificationDeliveryRepository,
  attemptStartedAt: string
): Promise<SendNotificationOnceResult | { delivery: NotificationDeliveryRecord; attemptCount: number }> {
  const existing = await repository.getByChannelAndKey({
    channel: request.channel,
    deliveryKey: request.deliveryKey,
  });
  if (existing?.status === NotificationDeliveryStatus.SENT) {
    return duplicateResult("already_sent", existing);
  }
  if (existing?.status === NotificationDeliveryStatus.PENDING) {
    return duplicateResult("in_progress", existing);
  }
  if (existing?.status === NotificationDeliveryStatus.FAILED) {
    const attemptCount = existing.attemptCount + 1;
    await repository.markPending({
      id: existing.id,
      attemptCount,
      lastAttemptedAt: attemptStartedAt,
      provider: request.provider ?? null,
    });
    return {
      delivery: {
        id: existing.id,
        status: NotificationDeliveryStatus.PENDING,
        attemptCount,
      },
      attemptCount,
    };
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
  if (raced.status === NotificationDeliveryStatus.SENT) {
    return duplicateResult("already_sent", raced);
  }
  if (raced.status === NotificationDeliveryStatus.PENDING) {
    return duplicateResult("in_progress", raced);
  }

  const attemptCount = raced.attemptCount + 1;
  await repository.markPending({
    id: raced.id,
    attemptCount,
    lastAttemptedAt: attemptStartedAt,
    provider: request.provider ?? null,
  });
  return {
    delivery: {
      id: raced.id,
      status: NotificationDeliveryStatus.PENDING,
      attemptCount,
    },
    attemptCount,
  };
}

export async function sendNotificationOnce(
  request: SendNotificationOnceRequest,
  dependencies: SendNotificationOnceDependencies = {}
): Promise<SendNotificationOnceResult> {
  const repository = dependencies.repository ?? dataConnectNotificationDeliveryRepository;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const attemptStartedAt = now();
  const claimResult = await claimNotificationDelivery(request, repository, attemptStartedAt);

  if ("outcome" in claimResult) {
    return claimResult;
  }

  try {
    const sendResult = await request.send();
    await repository.markSent({
      id: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
      lastAttemptedAt: attemptStartedAt,
      sentAt: now(),
      provider: request.provider ?? null,
      providerMessageId: sendResult?.providerMessageId ?? null,
    });
    return {
      outcome: "sent",
      deliveryId: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
    };
  } catch (error) {
    const errorDetails = extractErrorDetails(error);
    await repository.markFailed({
      id: claimResult.delivery.id,
      attemptCount: claimResult.attemptCount,
      lastAttemptedAt: attemptStartedAt,
      provider: request.provider ?? null,
      lastErrorCode: errorDetails.code,
      lastErrorMessage: errorDetails.message,
    });
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
