import {
  NotificationDeliveryStatus,
  type NotificationChannel,
  type UUIDString,
} from "@dataconnect/admin-generated";
import { GOV_NOTIFY_DELIVERY_MODES, type GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";

export const NOTIFICATION_RECOVERY_BATCH_LIMIT = 25;
export const NOTIFICATION_RECOVERY_MAX_ATTEMPTS = 6;
export const NOTIFICATION_RECOVERY_RETRY_DELAY_MS = 15 * 60 * 1000;
export const NOTIFICATION_RECOVERY_PENDING_LEASE_MS = 10 * 60 * 1000;

/** Trusted recovery-list snapshot. Never deserialize this policy from a payload or request. */
export interface NotificationRecoveryClaim {
  readonly id: UUIDString;
  readonly channel: NotificationChannel;
  readonly notificationType: string;
  readonly deliveryKey: string;
  readonly status: NotificationDeliveryStatus;
  readonly attemptCount: number;
  readonly lastAttemptedAt: string;
  readonly recoveryPayload: string | null;
  readonly deliveryMode: GovNotifyDeliveryMode | null;
}

export function createNotificationRecoveryClaim(candidate: {
  id: UUIDString;
  channel: NotificationChannel;
  notificationType: string;
  deliveryKey: string;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  lastAttemptedAt: string | null;
  recoveryPayload: string | null;
  deliveryMode?: GovNotifyDeliveryMode | null;
}): NotificationRecoveryClaim {
  if (!candidate.id || !candidate.channel || !candidate.notificationType || !candidate.deliveryKey ||
    ![NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.PENDING].includes(candidate.status) ||
    !Number.isInteger(candidate.attemptCount) || candidate.attemptCount < 0 ||
    candidate.attemptCount >= NOTIFICATION_RECOVERY_MAX_ATTEMPTS ||
    !candidate.lastAttemptedAt || !Number.isFinite(Date.parse(candidate.lastAttemptedAt)) ||
    (candidate.recoveryPayload !== null && typeof candidate.recoveryPayload !== "string") ||
    (candidate.deliveryMode != null && !GOV_NOTIFY_DELIVERY_MODES.includes(candidate.deliveryMode))) {
    throw new Error("NOTIFICATION_RECOVERY_CLAIM_INVALID");
  }
  // Explicit fields keep untrusted payload properties outside the claim policy.
  return Object.freeze({
    id: candidate.id,
    channel: candidate.channel,
    notificationType: candidate.notificationType,
    deliveryKey: candidate.deliveryKey,
    status: candidate.status,
    attemptCount: candidate.attemptCount,
    lastAttemptedAt: candidate.lastAttemptedAt,
    recoveryPayload: candidate.recoveryPayload,
    deliveryMode: candidate.deliveryMode ?? null,
  });
}

/** Operational ambiguity must retain the row without spending another recovery slot. */
export class NotificationRecoveryDeferredError extends Error {
  readonly code: string;
  constructor(code: "RECOVERY_DELIVERY_MODE_UNVERIFIABLE" | "RECOVERY_DELIVERY_MODE_CONFLICT") {
    super(code);
    this.name = "NotificationRecoveryDeferredError";
    this.code = code;
  }
}

export function recoveryDeliveryMode(
  claim: NotificationRecoveryClaim,
  payloadMode: GovNotifyDeliveryMode | undefined,
  logicalDeliveryKey: string,
): GovNotifyDeliveryMode | undefined {
  const suffix = /:notify-(simulation|team_test|live)$/.exec(claim.deliveryKey)?.[1];
  // Domain IDs/idempotency keys can themselves contain a mode-looking tail.
  // Only a suffix appended to the independently derived logical key is evidence.
  const suffixMode = suffix && claim.deliveryKey === `${logicalDeliveryKey}:notify-${suffix}`
    ? suffix.toUpperCase() as GovNotifyDeliveryMode : undefined;
  const modes = [claim.deliveryMode, suffixMode, payloadMode].filter((mode): mode is GovNotifyDeliveryMode => mode != null);
  if (new Set(modes).size > 1) throw new NotificationRecoveryDeferredError("RECOVERY_DELIVERY_MODE_CONFLICT");
  return modes[0];
}
