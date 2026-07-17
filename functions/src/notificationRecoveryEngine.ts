import {
  NotificationDeliveryStatus,
  type NotificationChannel,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  parseNotificationRecoveryPayload,
  type NotificationRecoveryPayload,
} from "./notificationRecoveryPayload";
import { isNotificationDeliveryLeaseExpired } from "./notificationDelivery";

export const NOTIFICATION_RECOVERY_BATCH_LIMIT = 25;
export const NOTIFICATION_RECOVERY_MAX_ATTEMPTS = 6;
export const NOTIFICATION_RECOVERY_RETRY_DELAY_MS = 15 * 60 * 1000;

export interface RecoverableNotificationDelivery {
  id: UUIDString;
  channel: NotificationChannel;
  notificationType: string;
  deliveryKey: string;
  recoveryPayload: string | null;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  lastAttemptedAt: string | null;
  createdAt: string;
}

export interface NotificationRecoveryBatchSummary {
  scanned: number;
  recovered: number;
  failed: number;
  inProgress: number;
  alreadySent: number;
  notDue: number;
  exhausted: number;
  invalid: number;
}

export interface NotificationRecoveryBatchDependencies {
  candidates: readonly RecoverableNotificationDelivery[];
  now: string;
  dispatch: (
    candidate: RecoverableNotificationDelivery,
    payload: NotificationRecoveryPayload
  ) => Promise<void>;
  getCurrent: (
    candidate: RecoverableNotificationDelivery
  ) => Promise<RecoverableNotificationDelivery | null>;
  recordFailure?: (
    candidate: RecoverableNotificationDelivery
  ) => Promise<boolean>;
  maxAttempts?: number;
  retryDelayMs?: number;
  batchLimit?: number;
  onError?: (candidate: RecoverableNotificationDelivery, error: unknown) => void;
}

function emptySummary(): NotificationRecoveryBatchSummary {
  return {
    scanned: 0,
    recovered: 0,
    failed: 0,
    inProgress: 0,
    alreadySent: 0,
    notDue: 0,
    exhausted: 0,
    invalid: 0,
  };
}

function isFailedRetryDue(
  candidate: RecoverableNotificationDelivery,
  now: string,
  retryDelayMs: number
): boolean {
  return isNotificationDeliveryLeaseExpired(
    candidate.lastAttemptedAt,
    now,
    retryDelayMs
  );
}

async function recordRecoveryFailure(
  dependencies: NotificationRecoveryBatchDependencies,
  candidate: RecoverableNotificationDelivery
): Promise<void> {
  if (!dependencies.recordFailure) {
    return;
  }
  try {
    await dependencies.recordFailure(candidate);
  } catch (error: unknown) {
    dependencies.onError?.(candidate, error);
  }
}

export async function runNotificationRecoveryBatch(
  dependencies: NotificationRecoveryBatchDependencies
): Promise<NotificationRecoveryBatchSummary> {
  const summary = emptySummary();
  const maxAttempts =
    dependencies.maxAttempts ?? NOTIFICATION_RECOVERY_MAX_ATTEMPTS;
  const retryDelayMs =
    dependencies.retryDelayMs ?? NOTIFICATION_RECOVERY_RETRY_DELAY_MS;
  const batchLimit = dependencies.batchLimit ?? NOTIFICATION_RECOVERY_BATCH_LIMIT;

  for (const candidate of dependencies.candidates.slice(0, batchLimit)) {
    summary.scanned += 1;
    if (candidate.status === NotificationDeliveryStatus.SENT) {
      summary.alreadySent += 1;
      continue;
    }
    if (candidate.attemptCount >= maxAttempts) {
      summary.exhausted += 1;
      continue;
    }
    if (
      candidate.status === NotificationDeliveryStatus.PENDING &&
      !isNotificationDeliveryLeaseExpired(
        candidate.lastAttemptedAt,
        dependencies.now
      )
    ) {
      summary.inProgress += 1;
      continue;
    }
    if (
      candidate.status === NotificationDeliveryStatus.FAILED &&
      !isFailedRetryDue(candidate, dependencies.now, retryDelayMs)
    ) {
      summary.notDue += 1;
      continue;
    }
    if (!candidate.recoveryPayload) {
      summary.invalid += 1;
      await recordRecoveryFailure(dependencies, candidate);
      dependencies.onError?.(
        candidate,
        new Error("Notification delivery has no recovery payload")
      );
      continue;
    }

    let payload: NotificationRecoveryPayload;
    try {
      payload = parseNotificationRecoveryPayload(candidate.recoveryPayload);
    } catch (error: unknown) {
      summary.invalid += 1;
      await recordRecoveryFailure(dependencies, candidate);
      dependencies.onError?.(candidate, error);
      continue;
    }

    try {
      await dependencies.dispatch(candidate, payload);
      const current = await dependencies.getCurrent(candidate);
      if (current?.status === NotificationDeliveryStatus.SENT) {
        summary.recovered += 1;
      } else if (current?.status === NotificationDeliveryStatus.PENDING) {
        summary.inProgress += 1;
      } else {
        if (
          !current ||
          (current.status === candidate.status &&
            current.attemptCount === candidate.attemptCount &&
            current.lastAttemptedAt === candidate.lastAttemptedAt)
        ) {
          await recordRecoveryFailure(dependencies, candidate);
        }
        summary.failed += 1;
      }
    } catch (error: unknown) {
      summary.failed += 1;
      await recordRecoveryFailure(dependencies, candidate);
      dependencies.onError?.(candidate, error);
    }
  }

  return summary;
}
