import { createHash } from "node:crypto";
import * as logger from "firebase-functions/logger";
import {
  claimNotifyDeliveryReceipt,
  createNotifyDeliveryReceipt,
  getAnnouncementRecipientBySendAndUser,
  getLatestNotifyDeliveryReceiptForReference,
  getNotifyCallbackUserById,
  getNotifyDeliveryReceipt,
  getRecentNotifyDeliveryReceiptsForUser,
  getUserByEmail,
  markNotifyDeliveryReceiptFailed,
  markNotifyDeliveryReceiptProcessed,
  tryApplyNotifyDeliveryUserState,
  tryApplyNotifyDeliveryUserStateAndMarkLost,
  tryUpdateAnnouncementRecipientDeliveryStatus,
  MembershipStatus,
  NotifyDeliveryReceiptOutcome,
  NotifyDeliveryReceiptProcessingStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { parseAnnouncementReference } from "./announcementReference.js";
import { invalidateDcProfileCache } from "./users.js";

export const BOUNCE_THRESHOLD = 3;
export const DEFAULT_NOTIFY_RECEIPT_LEASE_MS = 10 * 60 * 1000;
const MAX_CAS_ATTEMPTS = 8;
const MAX_ERROR_MESSAGE_LENGTH = 500;

export type NotifyDeliveryStatus =
  | "delivered"
  | "permanent-failure"
  | "temporary-failure"
  | "technical-failure";

export interface NotifyReceipt {
  id: string;
  reference?: string;
  to: string;
  status: NotifyDeliveryStatus;
  notification_type?: string;
  created_at?: string;
  completed_at?: string;
  sent_at?: string;
}

interface ReceiptRecord {
  id: string;
  notifyStatus: string;
  reference: string | null;
  recipientHash: string;
  userId: string | null;
  eventAt: string;
  eventOrderingKey: string;
  affectsBounceState: boolean;
  processingStatus: NotifyDeliveryReceiptProcessingStatus;
  attemptCount: number;
  lastAttemptedAt: string;
}

interface OrderedReceipt {
  id: string;
  notifyStatus: string;
  eventAt: string;
  eventOrderingKey: string;
}

interface NotifyCallbackUser {
  id: string;
  membershipStatus: MembershipStatus;
  emailBounceCount: number;
  emailLastBounceAt: string | null;
  emailDeliveryVersion: number;
  emailDeliveryStatus: string | null;
  emailDeliveryStatusUpdatedAt: string | null;
  emailDeliveryReceiptId: string | null;
}

interface AnnouncementRecipientState {
  id: UUIDString;
  status: string;
  failureReason: string | null;
  deliveryVersion: number;
  deliveryStatusUpdatedAt: string | null;
  deliveryReceiptId: string | null;
}

export interface NotifyReceiptRepository {
  getReceipt(id: string): Promise<ReceiptRecord | null>;
  createReceipt(args: {
    id: string;
    notifyStatus: string;
    reference: string | null;
    recipientHash: string;
    userId: string | null;
    eventAt: string;
    eventOrderingKey: string;
    affectsBounceState: boolean;
    lastAttemptedAt: string;
  }): Promise<ReceiptRecord>;
  tryClaimReceipt(args: {
    id: string;
    expectedProcessingStatus: NotifyDeliveryReceiptProcessingStatus;
    expectedAttemptCount: number;
    attemptCount: number;
    lastAttemptedAt: string;
  }): Promise<boolean>;
  markReceiptProcessed(args: {
    id: string;
    attemptCount: number;
    outcome: NotifyDeliveryReceiptOutcome;
    processedAt: string;
  }): Promise<boolean>;
  markReceiptFailed(args: {
    id: string;
    attemptCount: number;
    lastErrorMessage: string | null;
  }): Promise<boolean>;
  findUserByEmail(email: string): Promise<NotifyCallbackUser | null>;
  getUserById(userId: string): Promise<NotifyCallbackUser | null>;
  getRecentStateReceiptsForUser(userId: string): Promise<OrderedReceipt[]>;
  tryApplyUserState(args: {
    userId: string;
    expectedEmailDeliveryVersion: number;
    emailDeliveryVersion: number;
    emailBounceCount: number;
    emailLastBounceAt: string | null;
    emailDeliveryStatus: string;
    emailDeliveryStatusUpdatedAt: string;
    emailDeliveryReceiptId: string;
    markLost: boolean;
  }): Promise<boolean>;
  findAnnouncementRecipient(sendId: string, userId: string): Promise<AnnouncementRecipientState | null>;
  getLatestStateReceiptForReference(reference: string): Promise<OrderedReceipt | null>;
  tryApplyAnnouncementState(args: {
    id: UUIDString;
    expectedDeliveryVersion: number;
    deliveryVersion: number;
    status: string;
    failureReason: string | null;
    deliveryStatusUpdatedAt: string;
    deliveryReceiptId: string;
  }): Promise<boolean>;
}

export interface NotifyReceiptProcessorDependencies {
  repository?: NotifyReceiptRepository;
  now?: () => string;
  leaseMs?: number;
  onMembershipLost?: (userId: string) => void | Promise<void>;
}

export interface NotifyReceiptProcessingResult {
  outcome: "processed" | "duplicate" | "in_progress";
  receiptOutcome?: NotifyDeliveryReceiptOutcome;
  attemptCount?: number;
}

export class NotifyReceiptConflictError extends Error {
  constructor(receiptId: string) {
    super(`Receipt ${receiptId} was replayed with conflicting metadata`);
    this.name = "NotifyReceiptConflictError";
  }
}

function mapUser(row: {
  id: string;
  membershipStatus: MembershipStatus;
  emailBounceCount: number;
  emailLastBounceAt?: string | null;
  emailDeliveryVersion: number;
  emailDeliveryStatus?: string | null;
  emailDeliveryStatusUpdatedAt?: string | null;
  emailDeliveryReceiptId?: string | null;
}): NotifyCallbackUser {
  return {
    id: row.id,
    membershipStatus: row.membershipStatus,
    emailBounceCount: row.emailBounceCount,
    emailLastBounceAt: row.emailLastBounceAt ?? null,
    emailDeliveryVersion: row.emailDeliveryVersion,
    emailDeliveryStatus: row.emailDeliveryStatus ?? null,
    emailDeliveryStatusUpdatedAt: row.emailDeliveryStatusUpdatedAt ?? null,
    emailDeliveryReceiptId: row.emailDeliveryReceiptId ?? null,
  };
}

export const dataConnectNotifyReceiptRepository: NotifyReceiptRepository = {
  async getReceipt(id) {
    const result = await getNotifyDeliveryReceipt({ id });
    const row = result.data.notifyDeliveryReceipt;
    if (!row) return null;
    return {
      id: row.id,
      notifyStatus: row.notifyStatus,
      reference: row.reference ?? null,
      recipientHash: row.recipientHash,
      userId: row.userId ?? null,
      eventAt: row.eventAt,
      eventOrderingKey: row.eventOrderingKey,
      affectsBounceState: row.affectsBounceState,
      processingStatus: row.processingStatus,
      attemptCount: row.attemptCount,
      lastAttemptedAt: row.lastAttemptedAt,
    };
  },

  async createReceipt(args) {
    await createNotifyDeliveryReceipt({
      id: args.id,
      notifyStatus: args.notifyStatus,
      reference: args.reference,
      recipientHash: args.recipientHash,
      userId: args.userId,
      eventAt: args.eventAt,
      eventOrderingKey: args.eventOrderingKey,
      affectsBounceState: args.affectsBounceState,
      lastAttemptedAt: args.lastAttemptedAt,
    });
    return {
      ...args,
      processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
      attemptCount: 1,
    };
  },

  async tryClaimReceipt(args) {
    const result = await claimNotifyDeliveryReceipt(args);
    return result.data.notifyDeliveryReceipt_updateMany === 1;
  },

  async markReceiptProcessed(args) {
    const result = await markNotifyDeliveryReceiptProcessed(args);
    return result.data.notifyDeliveryReceipt_updateMany === 1;
  },

  async markReceiptFailed(args) {
    const result = await markNotifyDeliveryReceiptFailed(args);
    return result.data.notifyDeliveryReceipt_updateMany === 1;
  },

  async findUserByEmail(email) {
    const result = await getUserByEmail({ email });
    const row = result.data?.users?.[0];
    return row ? mapUser(row) : null;
  },

  async getUserById(userId) {
    const result = await getNotifyCallbackUserById({ userId });
    return result.data.user ? mapUser(result.data.user) : null;
  },

  async getRecentStateReceiptsForUser(userId) {
    const result = await getRecentNotifyDeliveryReceiptsForUser({ userId });
    return result.data.notifyDeliveryReceipts.map((row) => ({
      id: row.id,
      notifyStatus: row.notifyStatus,
      eventAt: row.eventAt,
      eventOrderingKey: row.eventOrderingKey,
    }));
  },

  async tryApplyUserState(args) {
    const variables = {
      userId: args.userId,
      expectedEmailDeliveryVersion: args.expectedEmailDeliveryVersion,
      emailDeliveryVersion: args.emailDeliveryVersion,
      emailBounceCount: args.emailBounceCount,
      emailLastBounceAt: args.emailLastBounceAt,
      emailDeliveryStatus: args.emailDeliveryStatus,
      emailDeliveryStatusUpdatedAt: args.emailDeliveryStatusUpdatedAt,
      emailDeliveryReceiptId: args.emailDeliveryReceiptId,
    };
    const result = args.markLost
      ? await tryApplyNotifyDeliveryUserStateAndMarkLost(variables)
      : await tryApplyNotifyDeliveryUserState(variables);
    return result.data.user_updateMany === 1;
  },

  async findAnnouncementRecipient(sendId, userId) {
    const result = await getAnnouncementRecipientBySendAndUser({
      announcementSendId: sendId,
      userId,
    });
    const row = result.data?.announcementRecipients?.[0];
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      failureReason: row.failureReason ?? null,
      deliveryVersion: row.deliveryVersion,
      deliveryStatusUpdatedAt: row.deliveryStatusUpdatedAt ?? null,
      deliveryReceiptId: row.deliveryReceiptId ?? null,
    };
  },

  async getLatestStateReceiptForReference(reference) {
    const result = await getLatestNotifyDeliveryReceiptForReference({ reference });
    const row = result.data.notifyDeliveryReceipts[0];
    return row
      ? {
          id: row.id,
          notifyStatus: row.notifyStatus,
          eventAt: row.eventAt,
          eventOrderingKey: row.eventOrderingKey,
        }
      : null;
  },

  async tryApplyAnnouncementState(args) {
    const result = await tryUpdateAnnouncementRecipientDeliveryStatus(args);
    return result.data.announcementRecipient_updateMany === 1;
  },
};

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate|already exists|violates/i.test(message);
}

function normalizeReference(reference: string | undefined): string | null {
  return reference?.trim() || null;
}

function normalizeTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function eventTimestampForReceipt(receipt: NotifyReceipt, receivedAt: string): string {
  return (
    normalizeTimestamp(receipt.completed_at) ??
    normalizeTimestamp(receipt.sent_at) ??
    normalizeTimestamp(receipt.created_at) ??
    receivedAt
  );
}

export function recipientHashForEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function isNotifyDeliveryStatus(value: unknown): value is NotifyDeliveryStatus {
  return (
    value === "delivered" ||
    value === "permanent-failure" ||
    value === "temporary-failure" ||
    value === "technical-failure"
  );
}

function affectsBounceState(status: NotifyDeliveryStatus): boolean {
  return status === "delivered" || status === "permanent-failure";
}

function isLeaseExpired(lastAttemptedAt: string, currentTime: string, leaseMs: number): boolean {
  const lastAttemptedAtMs = Date.parse(lastAttemptedAt);
  const currentTimeMs = Date.parse(currentTime);
  return (
    !Number.isFinite(lastAttemptedAtMs) ||
    !Number.isFinite(currentTimeMs) ||
    currentTimeMs - lastAttemptedAtMs >= leaseMs
  );
}

function metadataMatches(
  existing: ReceiptRecord,
  expected: Pick<ReceiptRecord, "notifyStatus" | "reference" | "recipientHash" | "affectsBounceState">
): boolean {
  return (
    existing.notifyStatus === expected.notifyStatus &&
    existing.reference === expected.reference &&
    existing.recipientHash === expected.recipientHash &&
    existing.affectsBounceState === expected.affectsBounceState
  );
}

async function claimReceipt(args: {
  repository: NotifyReceiptRepository;
  receipt: NotifyReceipt;
  userId: string | null;
  receivedAt: string;
  leaseMs: number;
}): Promise<
  | { outcome: "claimed"; record: ReceiptRecord }
  | { outcome: "duplicate" | "in_progress"; record: ReceiptRecord }
> {
  const { repository, receipt, userId, receivedAt, leaseMs } = args;
  const reference = normalizeReference(receipt.reference);
  const recipientHash = recipientHashForEmail(receipt.to);
  const eventAt = eventTimestampForReceipt(receipt, receivedAt);
  const expected = {
    notifyStatus: receipt.status,
    reference,
    recipientHash,
    affectsBounceState: affectsBounceState(receipt.status),
  };

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const existing = await repository.getReceipt(receipt.id);
    if (!existing) {
      try {
        const created = await repository.createReceipt({
          id: receipt.id,
          ...expected,
          userId,
          eventAt,
          eventOrderingKey: `${eventAt}:${receipt.id}`,
          lastAttemptedAt: receivedAt,
        });
        return { outcome: "claimed", record: created };
      } catch (error) {
        if (isDuplicateKeyError(error)) continue;
        throw error;
      }
    }

    if (!metadataMatches(existing, expected)) {
      throw new NotifyReceiptConflictError(receipt.id);
    }
    if (existing.processingStatus === NotifyDeliveryReceiptProcessingStatus.PROCESSED) {
      return { outcome: "duplicate", record: existing };
    }
    if (
      existing.processingStatus === NotifyDeliveryReceiptProcessingStatus.PENDING &&
      !isLeaseExpired(existing.lastAttemptedAt, receivedAt, leaseMs)
    ) {
      return { outcome: "in_progress", record: existing };
    }

    const nextAttemptCount = existing.attemptCount + 1;
    const claimed = await repository.tryClaimReceipt({
      id: existing.id,
      expectedProcessingStatus: existing.processingStatus,
      expectedAttemptCount: existing.attemptCount,
      attemptCount: nextAttemptCount,
      lastAttemptedAt: receivedAt,
    });
    if (claimed) {
      return {
        outcome: "claimed",
        record: {
          ...existing,
          processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
          attemptCount: nextAttemptCount,
          lastAttemptedAt: receivedAt,
        },
      };
    }
  }
  throw new Error(`Unable to claim Notify receipt ${receipt.id} after repeated contention`);
}

function deriveBounceState(receipts: OrderedReceipt[]): {
  latest: OrderedReceipt;
  bounceCount: number;
  lastBounceAt: string | null;
} | null {
  const latest = receipts[0];
  if (!latest) return null;
  let bounceCount = 0;
  for (const receipt of receipts) {
    if (receipt.notifyStatus === "delivered") break;
    if (receipt.notifyStatus === "permanent-failure") {
      bounceCount += 1;
      if (bounceCount >= BOUNCE_THRESHOLD) break;
    }
  }
  return {
    latest,
    bounceCount,
    lastBounceAt: bounceCount > 0 ? latest.eventAt : null,
  };
}

async function applyDerivedUserState(args: {
  repository: NotifyReceiptRepository;
  userId: string;
  onMembershipLost: (userId: string) => void | Promise<void>;
}): Promise<"applied" | "no_state_change" | "no_user"> {
  const { repository, userId, onMembershipLost } = args;
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const [user, recentReceipts] = await Promise.all([
      repository.getUserById(userId),
      repository.getRecentStateReceiptsForUser(userId),
    ]);
    if (!user) return "no_user";
    const derived = deriveBounceState(recentReceipts);
    if (!derived) return "no_state_change";

    const markLost =
      derived.bounceCount >= BOUNCE_THRESHOLD && user.membershipStatus !== MembershipStatus.LOST;
    const stateAlreadyCurrent =
      user.emailBounceCount === derived.bounceCount &&
      user.emailLastBounceAt === derived.lastBounceAt &&
      user.emailDeliveryStatus === derived.latest.notifyStatus &&
      user.emailDeliveryStatusUpdatedAt === derived.latest.eventAt &&
      user.emailDeliveryReceiptId === derived.latest.id;
    if (stateAlreadyCurrent && !markLost) return "no_state_change";

    const applied = await repository.tryApplyUserState({
      userId,
      expectedEmailDeliveryVersion: user.emailDeliveryVersion,
      emailDeliveryVersion: user.emailDeliveryVersion + 1,
      emailBounceCount: derived.bounceCount,
      emailLastBounceAt: derived.lastBounceAt,
      emailDeliveryStatus: derived.latest.notifyStatus,
      emailDeliveryStatusUpdatedAt: derived.latest.eventAt,
      emailDeliveryReceiptId: derived.latest.id,
      markLost,
    });
    if (!applied) continue;
    if (markLost) await onMembershipLost(userId);
    return "applied";
  }
  throw new Error(`Unable to update Notify delivery state for user ${userId} after repeated contention`);
}

async function applyDerivedAnnouncementState(args: {
  repository: NotifyReceiptRepository;
  sendId: string;
  recipientId: string;
  reference: string;
}): Promise<"applied" | "no_state_change" | "no_recipient"> {
  const { repository, sendId, recipientId, reference } = args;
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const [recipient, latestReceipt] = await Promise.all([
      repository.findAnnouncementRecipient(sendId, recipientId),
      repository.getLatestStateReceiptForReference(reference),
    ]);
    if (!recipient) return "no_recipient";
    if (!latestReceipt) return "no_state_change";

    const status = latestReceipt.notifyStatus === "delivered" ? "delivered" : "bounced";
    const failureReason = status === "bounced" ? "GOV Notify reported permanent-failure" : null;
    const stateAlreadyCurrent =
      recipient.status === status &&
      recipient.failureReason === failureReason &&
      recipient.deliveryStatusUpdatedAt === latestReceipt.eventAt &&
      recipient.deliveryReceiptId === latestReceipt.id;
    if (stateAlreadyCurrent) return "no_state_change";

    const applied = await repository.tryApplyAnnouncementState({
      id: recipient.id,
      expectedDeliveryVersion: recipient.deliveryVersion,
      deliveryVersion: recipient.deliveryVersion + 1,
      status,
      failureReason,
      deliveryStatusUpdatedAt: latestReceipt.eventAt,
      deliveryReceiptId: latestReceipt.id,
    });
    if (applied) return "applied";
  }
  throw new Error(`Unable to update announcement recipient ${recipientId} after repeated contention`);
}

function processingOutcome(args: {
  user: "applied" | "no_state_change" | "no_user";
  announcement: "applied" | "no_state_change" | "no_recipient";
  hasAnnouncementReference: boolean;
}): NotifyDeliveryReceiptOutcome {
  if (args.user === "applied" || args.announcement === "applied") {
    return NotifyDeliveryReceiptOutcome.APPLIED;
  }
  if (args.user === "no_user") {
    return NotifyDeliveryReceiptOutcome.IGNORED_NO_USER;
  }
  if (args.hasAnnouncementReference && args.announcement === "no_recipient") {
    return NotifyDeliveryReceiptOutcome.IGNORED_NO_RECIPIENT;
  }
  return NotifyDeliveryReceiptOutcome.NO_STATE_CHANGE;
}

function errorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  return message ? message.slice(0, MAX_ERROR_MESSAGE_LENGTH) : null;
}

export async function processNotifyReceipt(
  receipt: NotifyReceipt,
  dependencies: NotifyReceiptProcessorDependencies = {}
): Promise<NotifyReceiptProcessingResult> {
  const repository = dependencies.repository ?? dataConnectNotifyReceiptRepository;
  const receivedAt = dependencies.now?.() ?? new Date().toISOString();
  const leaseMs = dependencies.leaseMs ?? DEFAULT_NOTIFY_RECEIPT_LEASE_MS;
  const onMembershipLost = dependencies.onMembershipLost ?? (() => invalidateDcProfileCache());
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
    throw new Error("Notify receipt lease duration must be a positive number");
  }

  const affectsState = affectsBounceState(receipt.status);
  const initialUser = affectsState ? await repository.findUserByEmail(receipt.to) : null;
  const claim = await claimReceipt({
    repository,
    receipt,
    userId: initialUser?.id ?? null,
    receivedAt,
    leaseMs,
  });
  if (claim.outcome !== "claimed") {
    return { outcome: claim.outcome, attemptCount: claim.record.attemptCount };
  }

  const attemptCount = claim.record.attemptCount;
  try {
    let outcome: NotifyDeliveryReceiptOutcome;
    if (!affectsState) {
      outcome = NotifyDeliveryReceiptOutcome.IGNORED_STATUS;
    } else {
      const parsedReference = parseAnnouncementReference(receipt.reference);
      const [userResult, announcementResult] = await Promise.all([
        initialUser
          ? applyDerivedUserState({ repository, userId: initialUser.id, onMembershipLost })
          : Promise.resolve<"no_user">("no_user"),
        parsedReference
          ? applyDerivedAnnouncementState({
              repository,
              sendId: parsedReference.sendId,
              recipientId: parsedReference.recipientId,
              reference: normalizeReference(receipt.reference)!,
            })
          : Promise.resolve<"no_state_change">("no_state_change"),
      ]);
      outcome = processingOutcome({
        user: userResult,
        announcement: announcementResult,
        hasAnnouncementReference: Boolean(parsedReference),
      });
    }

    const finalized = await repository.markReceiptProcessed({
      id: receipt.id,
      attemptCount,
      outcome,
      processedAt: receivedAt,
    });
    if (!finalized) {
      throw new Error(`Lost ownership while finalizing Notify receipt ${receipt.id}`);
    }
    logger.info("Processed GOV Notify delivery receipt", {
      receiptId: receipt.id,
      status: receipt.status,
      outcome,
      attemptCount,
    });
    return { outcome: "processed", receiptOutcome: outcome, attemptCount };
  } catch (error) {
    try {
      await repository.markReceiptFailed({
        id: receipt.id,
        attemptCount,
        lastErrorMessage: errorMessage(error),
      });
    } catch (markFailedError) {
      logger.error("Failed to mark GOV Notify receipt processing failure", {
        receiptId: receipt.id,
        attemptCount,
        error: errorMessage(markFailedError),
      });
    }
    throw error;
  }
}
