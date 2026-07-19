import { randomUUID } from "node:crypto";
import { NotifyClient } from "notifications-node-client";
import * as logger from "firebase-functions/logger";
import {
  createAnnouncementRecipient,
  getAnnouncementRecipientBySendAndUser,
  tryUpdateAnnouncementRecipientProcessingStatus,
} from "@dataconnect/admin-generated";
import { buildAnnouncementReference } from "./announcementReference";
import { govNotifyApiKey } from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";

// A task dispatch has a 60-second deadline. Keep the lease long enough that a
// timed-out invocation cannot still be calling Notify, but short enough that
// the configured Cloud Tasks retry window can reclaim abandoned work.
export const ANNOUNCEMENT_PROCESSING_LEASE_MS = 2 * 60 * 1000;
export const ANNOUNCEMENT_UNKNOWN_RECONCILIATION_DELAY_MS = 60 * 1000;

export const ANNOUNCEMENT_RECIPIENT_STATUSES = [
  "queued",
  "enqueue_failed",
  "sending",
  "retrying",
  "delivery_unknown",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "skipped",
] as const;

export type AnnouncementRecipientStatus = typeof ANNOUNCEMENT_RECIPIENT_STATUSES[number];

export interface AnnouncementEmailTask {
  sendId: string;
  recipientId: string;
  firstName: string;
  lastName: string;
  email: string;
  personalisation: Record<string, string>;
  unsubscribeUrl: string;
  templateUuid: string;
}

interface AnnouncementRecipientProcessingRecord {
  id: string;
  status: AnnouncementRecipientStatus;
  processingVersion: number;
  processingStartedAt: string | null;
  providerNotificationId: string | null;
}

export interface AnnouncementDeliveryRepository {
  get(sendId: string, recipientId: string): Promise<AnnouncementRecipientProcessingRecord | null>;
  createLegacyTaskRow(task: AnnouncementEmailTask): Promise<void>;
  tryUpdate(args: {
    id: string;
    expectedStatus: AnnouncementRecipientStatus;
    expectedProcessingVersion: number;
    status: AnnouncementRecipientStatus;
    processingVersion: number;
    processingStartedAt: string | null;
    sentAt: string | null;
    failureReason: string | null;
    providerNotificationId: string | null;
  }): Promise<boolean>;
}

export interface AnnouncementNotifyClient {
  getNotifications(
    templateType?: string,
    status?: string,
    reference?: string,
  ): Promise<{
    data?: {
      notifications?: Array<{ id?: string; reference?: string }>;
    };
  }>;
  sendEmail(
    templateId: string,
    emailAddress: string,
    options: {
      personalisation: Record<string, string>;
      reference: string;
      oneClickUnsubscribeURL: string;
    },
  ): Promise<{ data?: { id?: string; reference?: string } }>;
}

interface TaskContext {
  retryCount: number;
}

interface ProcessAnnouncementEmailDependencies {
  repository?: AnnouncementDeliveryRepository;
  client?: AnnouncementNotifyClient;
  now?: () => string;
  leaseMs?: number;
  reconciliationDelayMs?: number;
}

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate|already exists|violates/i.test(message);
}

function asStatus(value: string): AnnouncementRecipientStatus {
  return ANNOUNCEMENT_RECIPIENT_STATUSES.includes(value as AnnouncementRecipientStatus)
    ? value as AnnouncementRecipientStatus
    : "failed";
}

const dataConnectAnnouncementDeliveryRepository: AnnouncementDeliveryRepository = {
  async get(sendId, recipientId) {
    const result = await getAnnouncementRecipientBySendAndUser({
      announcementSendId: sendId,
      userId: recipientId,
    });
    const row = result.data?.announcementRecipients?.[0];
    if (!row) return null;
    return {
      id: row.id,
      status: asStatus(row.status),
      processingVersion: row.processingVersion,
      processingStartedAt: row.processingStartedAt ?? null,
      providerNotificationId: row.providerNotificationId ?? null,
    };
  },

  async createLegacyTaskRow(task) {
    try {
      await createAnnouncementRecipient({
        id: randomUUID(),
        announcementSendId: task.sendId,
        userId: task.recipientId,
        email: task.email,
        firstName: task.firstName,
        lastName: task.lastName,
        status: "queued",
        skippedReason: null,
        sentAt: null,
        failureReason: null,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  },

  async tryUpdate(args) {
    const result = await tryUpdateAnnouncementRecipientProcessingStatus({
      id: args.id,
      expectedStatus: args.expectedStatus,
      expectedProcessingVersion: args.expectedProcessingVersion,
      status: args.status,
      processingVersion: args.processingVersion,
      processingStartedAt: args.processingStartedAt,
      sentAt: args.sentAt,
      failureReason: args.failureReason,
      providerNotificationId: args.providerNotificationId,
    });
    return result.data.announcementRecipient_updateMany === 1;
  },
};

function isTerminal(status: AnnouncementRecipientStatus): boolean {
  return status === "sent" || status === "delivered" || status === "bounced" ||
    status === "failed" || status === "skipped";
}

function elapsedSince(value: string | null, now: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const start = Date.parse(value);
  const end = Date.parse(now);
  return Number.isFinite(start) && Number.isFinite(end)
    ? end - start
    : Number.POSITIVE_INFINITY;
}

function failureReason(error: unknown): string {
  const sanitized = sanitizeMailerError(error);
  const providerMessage = sanitized.providerErrors?.map((entry) => entry.message).find(Boolean);
  return (providerMessage ?? sanitized.message ?? sanitized.name ?? "Unknown GOV Notify error").slice(0, 500);
}

function httpStatus(error: unknown): number | undefined {
  return sanitizeMailerError(error).status;
}

function isRateLimitError(error: unknown): boolean {
  return httpStatus(error) === 429;
}

function isPermanentClientError(error: unknown): boolean {
  const status = httpStatus(error);
  return status !== undefined && status >= 400 && status < 500 && status !== 429;
}

async function providerNotificationForReference(
  client: AnnouncementNotifyClient,
  reference: string,
): Promise<string | null> {
  const result = await client.getNotifications("email", undefined, reference);
  const match = result.data?.notifications?.find((notification) => notification.reference === reference);
  return match?.id?.trim() || null;
}

async function markStatus(
  repository: AnnouncementDeliveryRepository,
  row: AnnouncementRecipientProcessingRecord,
  status: AnnouncementRecipientStatus,
  now: string,
  options: {
    failureReason?: string | null;
    providerNotificationId?: string | null;
    sentAt?: string | null;
    preserveProcessingStartedAt?: boolean;
  } = {},
): Promise<boolean> {
  return repository.tryUpdate({
    id: row.id,
    expectedStatus: row.status,
    expectedProcessingVersion: row.processingVersion,
    status,
    processingVersion: row.processingVersion,
    processingStartedAt: options.preserveProcessingStartedAt ? row.processingStartedAt : now,
    sentAt: options.sentAt ?? null,
    failureReason: options.failureReason ?? null,
    providerNotificationId: options.providerNotificationId ?? row.providerNotificationId,
  });
}

async function claimForSend(
  repository: AnnouncementDeliveryRepository,
  row: AnnouncementRecipientProcessingRecord,
  now: string,
): Promise<AnnouncementRecipientProcessingRecord | null> {
  const processingVersion = row.processingVersion + 1;
  const claimed = await repository.tryUpdate({
    id: row.id,
    expectedStatus: row.status,
    expectedProcessingVersion: row.processingVersion,
    status: "sending",
    processingVersion,
    processingStartedAt: now,
    sentAt: null,
    failureReason: null,
    providerNotificationId: row.providerNotificationId,
  });
  return claimed
    ? { ...row, status: "sending", processingVersion, processingStartedAt: now }
    : null;
}

async function reconcileAmbiguousAttempt(args: {
  row: AnnouncementRecipientProcessingRecord;
  repository: AnnouncementDeliveryRepository;
  client: AnnouncementNotifyClient;
  reference: string;
  now: string;
  leaseMs: number;
  reconciliationDelayMs: number;
}): Promise<"complete" | "retry_later" | "safe_to_claim"> {
  const elapsed = elapsedSince(args.row.processingStartedAt, args.now);
  const waitMs = args.row.status === "sending" ? args.leaseMs : args.reconciliationDelayMs;
  if (elapsed < waitMs) return "retry_later";

  const providerNotificationId = await providerNotificationForReference(args.client, args.reference);
  if (providerNotificationId) {
    const marked = await markStatus(args.repository, args.row, "sent", args.now, {
      providerNotificationId,
      sentAt: args.now,
    });
    if (!marked) {
      throw new Error("Announcement recipient changed while reconciling provider acceptance");
    }
    return "complete";
  }

  return "safe_to_claim";
}

/**
 * Processes one persisted announcement recipient. The database row is the source of
 * truth; task payload data is retained only so pre-existing queued tasks remain deploy-safe.
 */
export async function processAnnouncementEmailTask(
  task: AnnouncementEmailTask,
  context: TaskContext,
  dependencies: ProcessAnnouncementEmailDependencies = {},
): Promise<void> {
  const repository = dependencies.repository ?? dataConnectAnnouncementDeliveryRepository;
  const client = dependencies.client ?? new NotifyClient(govNotifyApiKey.value());
  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  const leaseMs = dependencies.leaseMs ?? ANNOUNCEMENT_PROCESSING_LEASE_MS;
  const reconciliationDelayMs = dependencies.reconciliationDelayMs ??
    ANNOUNCEMENT_UNKNOWN_RECONCILIATION_DELAY_MS;
  const reference = buildAnnouncementReference(task.sendId, task.recipientId);

  let row = await repository.get(task.sendId, task.recipientId);
  if (!row) {
    await repository.createLegacyTaskRow(task);
    row = await repository.get(task.sendId, task.recipientId);
  }
  if (!row) throw new Error("Announcement recipient row could not be created");
  if (isTerminal(row.status)) return;

  if (row.status === "sending" || row.status === "delivery_unknown") {
    const reconciliation = await reconcileAmbiguousAttempt({
      row,
      repository,
      client,
      reference,
      now,
      leaseMs,
      reconciliationDelayMs,
    });
    if (reconciliation === "complete") return;
    if (reconciliation === "retry_later") {
      throw new Error("Announcement delivery outcome is still being reconciled");
    }
  }

  const claimed = await claimForSend(repository, row, now);
  if (!claimed) {
    const winner = await repository.get(task.sendId, task.recipientId);
    if (winner && isTerminal(winner.status)) return;
    throw new Error("Announcement recipient is already being processed");
  }
  row = claimed;

  try {
    const response = await client.sendEmail(task.templateUuid, task.email, {
      personalisation: task.personalisation,
      reference,
      oneClickUnsubscribeURL: task.unsubscribeUrl,
    });
    const marked = await markStatus(repository, row, "sent", now, {
      providerNotificationId: response.data?.id ?? null,
      sentAt: now,
    });
    if (!marked) {
      throw new Error("Unable to persist announcement provider acceptance");
    }
  } catch (error) {
    const reason = failureReason(error);
    logger.error("Failed to send announcement email", {
      sendId: task.sendId,
      recipientId: task.recipientId,
      retryCount: context.retryCount,
      error: sanitizeMailerError(error),
    });

    if (isPermanentClientError(error)) {
      const marked = await markStatus(repository, row, "failed", now, { failureReason: reason });
      if (!marked) throw new Error("Unable to persist permanent announcement failure");
      return;
    }
    if (isRateLimitError(error)) {
      await markStatus(repository, row, "retrying", now, { failureReason: reason });
      throw error;
    }

    await markStatus(repository, row, "delivery_unknown", now, {
      failureReason: reason,
      preserveProcessingStartedAt: true,
    });
    throw error;
  }
}
