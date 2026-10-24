import {
  GovNotifyDeliveryMode as DataConnectGovNotifyDeliveryMode,
  NotificationRecoveryDeferredReason,
  NotificationChannel,
  markNotificationRecoveryDeferredForClaimById,
  releaseNotificationRecoveryDeferralForClaimById,
  type ReleaseNotificationRecoveryDeferralForClaimByIdVariables,
} from "@dataconnect/admin-generated";
import {
  createNotificationRecoveryClaim,
  recoveryDeliveryMode,
  type NotificationRecoveryClaim,
} from "./notificationRecoveryClaim";
import { notificationRecoveryIdentity } from "./notificationRecoveryIdentity";
import { parseNotificationRecoveryPayload } from "./notificationRecoveryPayload";
import { govNotifyReferenceForMode, GOV_NOTIFY_DELIVERY_MODES, type GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";
import type { RecoverableNotificationDelivery } from "./notificationRecoveryEngine";

export const NOTIFICATION_RECOVERY_DEFERRED_REASONS = [
  NotificationRecoveryDeferredReason.RECOVERY_DELIVERY_MODE_UNVERIFIABLE,
  NotificationRecoveryDeferredReason.RECOVERY_DELIVERY_MODE_CONFLICT,
] as const;

/** Shared exact snapshot, independent of mailer, scheduler, or provider modules. */
export function notificationRecoveryClaimVariables(claim: NotificationRecoveryClaim) {
  return {
    id: claim.id,
    channel: claim.channel,
    deliveryKey: claim.deliveryKey,
    notificationType: claim.notificationType,
    expectedStatus: claim.status,
    expectedAttemptCount: claim.attemptCount,
    expectedLastAttemptedAt: claim.lastAttemptedAt,
    expectedRecoveryPayload: claim.recoveryPayload,
    expectedRecoveryPayloadIsNull: claim.recoveryPayload === null,
    expectedDeliveryMode: claim.deliveryMode as DataConnectGovNotifyDeliveryMode | null,
    expectedDeliveryModeIsNull: claim.deliveryMode === null,
    expectedRecipientUserId: claim.recipientUserId,
    expectedRecipientUserIdIsNull: claim.recipientUserId === null,
  };
}

export async function markNotificationRecoveryDeferred(
  candidate: RecoverableNotificationDelivery,
  reason: string,
): Promise<boolean> {
  if (!NOTIFICATION_RECOVERY_DEFERRED_REASONS.includes(reason as NotificationRecoveryDeferredReason)) {
    throw new Error("NOTIFICATION_RECOVERY_DEFERRED_REASON_INVALID");
  }
  const result = await markNotificationRecoveryDeferredForClaimById({
    ...notificationRecoveryClaimVariables(createNotificationRecoveryClaim(candidate)),
    deferredReason: reason as NotificationRecoveryDeferredReason,
  });
  return result.data.notificationDelivery_updateMany === 1;
}

export interface NotificationRecoveryReleaseRow extends RecoverableNotificationDelivery {
  recoveryDeferredAt?: string | null;
  recoveryDeferredReason?: string | null;
  booking?: { id: string } | null;
  user?: { id: string } | null;
}

export interface NotificationRecoveryReleaseAttestation {
  verifiedMode?: GovNotifyDeliveryMode;
  evidenceReference: string;
  actorId: string;
}

export interface NotificationRecoveryReleasePlan {
  schemaVersion: "sodc-notification-recovery-release/v1";
  variables: ReleaseNotificationRecoveryDeferralForClaimByIdVariables;
  summary: {
    deliveryId: string;
    status: string;
    attemptCount: number;
    deferredAt: string;
    deferredReason: string;
    verifiedMode: GovNotifyDeliveryMode;
    fillsMissingDeliveryMode: boolean;
    actorId: string;
    evidenceReference: string;
  };
}

/** Pure planning: a proof may fill missing mode, never override contradictory evidence. */
export function planNotificationRecoveryRelease(
  row: NotificationRecoveryReleaseRow,
  attestation: NotificationRecoveryReleaseAttestation,
): NotificationRecoveryReleasePlan {
  if (typeof attestation.actorId !== "string" || typeof attestation.evidenceReference !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(attestation.actorId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,239}$/.test(attestation.evidenceReference)) {
    throw new Error("NOTIFICATION_RECOVERY_RELEASE_EVIDENCE_REQUIRED");
  }
  if (attestation.verifiedMode != null && !GOV_NOTIFY_DELIVERY_MODES.includes(attestation.verifiedMode)) {
    throw new Error("NOTIFICATION_RECOVERY_RELEASE_MODE_INVALID");
  }
  if (!row.recoveryDeferredAt || !Number.isFinite(Date.parse(row.recoveryDeferredAt)) ||
    !NOTIFICATION_RECOVERY_DEFERRED_REASONS.includes(row.recoveryDeferredReason as NotificationRecoveryDeferredReason)) {
    throw new Error("NOTIFICATION_RECOVERY_RELEASE_NOT_DEFERRED");
  }
  if (row.channel !== NotificationChannel.EMAIL) throw new Error("NOTIFICATION_RECOVERY_RELEASE_CHANNEL_UNSUPPORTED");
  const claim = createNotificationRecoveryClaim(row);
  const bookingId = row.booking?.id ?? row.subjectBookingId ?? null;
  const userId = row.user?.id ?? row.subjectUserId ?? null;
  if (!row.recoveryPayload) throw new Error("NOTIFICATION_RECOVERY_RELEASE_PAYLOAD_REQUIRED");
  const payload = parseNotificationRecoveryPayload(row.recoveryPayload);
  const identity = notificationRecoveryIdentity(payload);
  const knownMode = recoveryDeliveryMode(claim, payload.deliveryMode, identity.deliveryKey);
  if (knownMode && attestation.verifiedMode && knownMode !== attestation.verifiedMode) {
    throw new Error("NOTIFICATION_RECOVERY_RELEASE_MODE_CONFLICT");
  }
  const verifiedMode = knownMode ?? attestation.verifiedMode;
  if (!verifiedMode) throw new Error("NOTIFICATION_RECOVERY_RELEASE_VERIFIED_MODE_REQUIRED");
  if (identity.notificationType !== row.notificationType ||
    (identity.deliveryKey !== row.deliveryKey && govNotifyReferenceForMode(identity.deliveryKey, verifiedMode) !== row.deliveryKey)) {
    throw new Error("NOTIFICATION_RECOVERY_RELEASE_IDENTITY_MISMATCH");
  }
  const privilegedV2 = (payload.kind === "BOOKING_PENDING_MODERATOR" || payload.kind === "USER_PENDING_APPROVAL") && payload.version === 2;
  if (!privilegedV2 && claim.recipientUserId !== null) {
    throw new Error("NOTIFICATION_RECOVERY_RELEASE_RECIPIENT_IDENTITY_UNSUPPORTED");
  }
  if (privilegedV2) {
    const subject = payload.kind === "BOOKING_PENDING_MODERATOR"
      ? bookingId : userId;
    const expectedSubject = payload.kind === "BOOKING_PENDING_MODERATOR" ? payload.bookingId : payload.userId;
    if (claim.recipientUserId !== payload.recipientUserId || subject !== expectedSubject) {
      throw new Error("NOTIFICATION_RECOVERY_RELEASE_PRIVILEGED_IDENTITY_MISMATCH");
    }
  }
  return {
    schemaVersion: "sodc-notification-recovery-release/v1",
    variables: {
      ...notificationRecoveryClaimVariables(claim),
      expectedBookingId: bookingId,
      expectedBookingIdIsNull: bookingId === null,
      expectedUserId: userId,
      expectedUserIdIsNull: userId === null,
      expectedDeferredAt: row.recoveryDeferredAt,
      expectedDeferredReason: row.recoveryDeferredReason as NotificationRecoveryDeferredReason,
      verifiedDeliveryMode: verifiedMode as DataConnectGovNotifyDeliveryMode,
      actorId: attestation.actorId,
    },
    summary: {
      deliveryId: row.id,
      status: row.status,
      attemptCount: row.attemptCount,
      deferredAt: row.recoveryDeferredAt,
      deferredReason: row.recoveryDeferredReason!,
      verifiedMode,
      fillsMissingDeliveryMode: row.deliveryMode == null,
      actorId: attestation.actorId,
      evidenceReference: attestation.evidenceReference,
    },
  };
}

/** Non-sending application of a reviewed plan; caller owns fresh reread/hash/readback. */
export async function applyNotificationRecoveryRelease(plan: NotificationRecoveryReleasePlan): Promise<boolean> {
  const result = await releaseNotificationRecoveryDeferralForClaimById(plan.variables);
  return result.data.notificationDelivery_updateMany === 1;
}
