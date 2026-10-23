import { NotificationChannel, NotificationDeliveryStatus, type UUIDString } from "@dataconnect/admin-generated";
import type { NotificationDeliveryRepository } from "../../notificationDelivery";
import type { RecoverableNotificationDelivery } from "../../notificationRecoveryEngine";

export interface StoredTestDelivery extends RecoverableNotificationDelivery {
  providerMessageId?: string | null;
  sentAt?: string | null;
  skippedAt?: string | null;
  skipReason?: string | null;
  lastErrorCode?: string | null;
}

export function notificationTestRepository(initial: StoredTestDelivery[] = [], serverNow?: () => string) {
  const rows = new Map(initial.map((row) => [row.deliveryKey, { ...row }]));
  const find = (id: string) => [...rows.values()].find((row) => row.id === id)!;
  const owned = (id: string, attempt: number, at: string) => {
    const row = find(id);
    return row.status === NotificationDeliveryStatus.PENDING && row.attemptCount === attempt && row.lastAttemptedAt === at;
  };
  const repository: NotificationDeliveryRepository = {
    async getByChannelAndKey({ deliveryKey }) { return rows.get(deliveryKey) ?? null; },
    async createPending(args) {
      if (rows.has(args.deliveryKey)) throw new Error("duplicate key");
      const row: StoredTestDelivery = {
        id: `test-${rows.size + 1}` as UUIDString, channel: args.channel, notificationType: args.notificationType,
        deliveryKey: args.deliveryKey, status: NotificationDeliveryStatus.PENDING,
        attemptCount: args.attemptCount, lastAttemptedAt: args.lastAttemptedAt, createdAt: args.lastAttemptedAt,
        recoveryPayload: args.recoveryPayload ?? null, recipientUserId: args.recipientUserId, deliveryMode: args.deliveryMode ?? null,
        subjectBookingId: args.bookingId, subjectUserId: args.userId,
      };
      rows.set(args.deliveryKey, row);
      return { ...row };
    },
    async tryMarkPending(args) {
      const row = find(args.id);
      if (row.status !== args.expectedStatus || row.attemptCount !== args.expectedAttemptCount) return false;
      Object.assign(row, { status: NotificationDeliveryStatus.PENDING, attemptCount: args.attemptCount,
        lastAttemptedAt: args.lastAttemptedAt, recoveryPayload: args.recoveryPayload ?? row.recoveryPayload });
      return true;
    },
    async tryMarkPendingForRecovery({ claim, lastAttemptedAt }) {
      const row = rows.get(claim.deliveryKey);
      const waitMs = claim.status === NotificationDeliveryStatus.FAILED ? 900_000 : 600_000;
      const databaseNow = serverNow?.() ?? lastAttemptedAt;
      if (!row || row.id !== claim.id || row.channel !== claim.channel || row.deliveryKey !== claim.deliveryKey ||
        row.notificationType !== claim.notificationType || row.status !== claim.status ||
        row.attemptCount !== claim.attemptCount || row.attemptCount < 0 || row.attemptCount >= 6 ||
        row.lastAttemptedAt !== claim.lastAttemptedAt || row.recoveryPayload !== claim.recoveryPayload ||
        (row.deliveryMode ?? null) !== claim.deliveryMode ||
        ![NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.PENDING].includes(row.status) ||
        Date.parse(databaseNow) - Date.parse(row.lastAttemptedAt!) < waitMs) return false;
      Object.assign(row, { status: NotificationDeliveryStatus.PENDING, attemptCount: row.attemptCount + 1, lastAttemptedAt });
      return true;
    },
    async markSent(args) {
      if (!owned(args.id, args.attemptCount, args.lastAttemptedAt)) return false;
      Object.assign(find(args.id), { status: NotificationDeliveryStatus.SENT, sentAt: args.sentAt,
        providerMessageId: args.providerMessageId });
      return true;
    },
    async markSkipped(args) {
      if (!owned(args.id, args.attemptCount, args.lastAttemptedAt)) return false;
      Object.assign(find(args.id), { status: NotificationDeliveryStatus.SKIPPED, skippedAt: args.skippedAt,
        skipReason: args.skipReason, sentAt: null, providerMessageId: null });
      return true;
    },
    async markFailed(args) {
      if (!owned(args.id, args.attemptCount, args.lastAttemptedAt)) return false;
      Object.assign(find(args.id), { status: NotificationDeliveryStatus.FAILED, lastErrorCode: args.lastErrorCode });
      return true;
    },
  };
  return { repository, rows };
}

export const STAFF_BOOKING_ID = "11111111-1111-4111-8111-111111111111" as UUIDString;
export const STAFF_NOW = "2026-10-21T10:00:00Z";
export const STAFF_LATER = "2026-10-21T10:20:00Z";
export const STAFF_CHANNEL = NotificationChannel.EMAIL;
