import { markNotificationRecoveryDeferred, notificationRecoveryClaimVariables } from "./notificationRecoveryDeferral";
import { notificationRecoveryIdentity } from "./notificationRecoveryIdentity";
export { notificationRecoveryIdentity } from "./notificationRecoveryIdentity";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  getNotificationDeliveryByChannelAndKey,
  listFailedNotificationDeliveriesForAutomaticRecovery,
  listStalePendingNotificationDeliveriesForAutomaticRecovery,
  recordNotificationRecoveryFailureForClaimById,
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@dataconnect/admin-generated";
import {
  notifyBookingChangesRequestedEmail,
  notifyBookingApprovedEmail,
  notifyBookingConfirmationEmail,
  notifyBookingPendingApprovalEmails,
  notifyBookingRevisionEmail,
} from "./bookingEmailDispatcher";
import {
  notifyMembershipStatusEmailIfNeeded,
} from "./membershipStatusEmailDispatcher";
import {
  notifyAdminsUserPendingApproval,
} from "./pendingApprovalAdminAlert";
import {
  createGovNotifyTicketOrderLifecycleDispatcher,
  defaultWebhookGovNotifyTicketOrderMailer,
} from "./paymentLifecycleEmailDispatcher";
import {
  notifyPaymentOpsDisputeSideState,
  notifyPaymentOpsReconciliationExceptionOpened,
} from "./paymentOpsInternalAlerts";
import {
  emitPaymentLifecycleNotification,
} from "./paymentNotifications";
import {
  sendNotificationOnce,
} from "./notificationDelivery";
import {
  NOTIFICATION_RECOVERY_BATCH_LIMIT,
  NOTIFICATION_RECOVERY_MAX_ATTEMPTS,
  NOTIFICATION_RECOVERY_RETRY_DELAY_MS,
  runNotificationRecoveryBatch,
  fairNotificationRecoveryCandidates,
  type RecoverableNotificationDelivery,
} from "./notificationRecoveryEngine";
import type { NotificationRecoveryPayload } from "./notificationRecoveryPayload";
import {
  createNotificationRecoveryClaim,
  NotificationRecoveryDeferredError,
  recoveryDeliveryMode,
  type NotificationRecoveryClaim,
} from "./notificationRecoveryClaim";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";
import { APP_BASE_URL } from "./paymentConfig";
import { FUNCTIONS_REGION } from "./constants";
import { govNotifySecrets, GOV_NOTIFY_PROVIDER } from "./mailer";
import { govNotifyReferenceForMode } from "./govNotifyDeliveryMode";

type PaymentLifecycleRecoveryPayload = Extract<
  NotificationRecoveryPayload,
  { kind: "PAYMENT_LIFECYCLE" }
>;

export interface NotificationRecoveryDispatcherDependencies {
  sendNotification?: typeof sendNotificationOnce;
  notifyBookingConfirmation?: typeof notifyBookingConfirmationEmail;
  notifyBookingRevision?: typeof notifyBookingRevisionEmail;
  notifyBookingPending?: typeof notifyBookingPendingApprovalEmails;
  notifyBookingChangesRequested?: typeof notifyBookingChangesRequestedEmail;
  notifyBookingApproved?: typeof notifyBookingApprovedEmail;
  notifyMembershipStatus?: typeof notifyMembershipStatusEmailIfNeeded;
  notifyPendingApproval?: typeof notifyAdminsUserPendingApproval;
  notifyPaymentReconciliationOps?: typeof notifyPaymentOpsReconciliationExceptionOpened;
  notifyPaymentDisputeOps?: typeof notifyPaymentOpsDisputeSideState;
  notifyPaymentLifecycle?: (
    payload: PaymentLifecycleRecoveryPayload,
    recoveryClaim: NotificationRecoveryClaim,
    deliveryMode?: GovNotifyDeliveryMode,
  ) => Promise<void>;
}

export function createNotificationRecoveryDispatcher(
  appBaseUrl: string,
  dependencies: NotificationRecoveryDispatcherDependencies = {}
) {
  const paymentLifecycleDispatcher =
    createGovNotifyTicketOrderLifecycleDispatcher({
      getMailer: defaultWebhookGovNotifyTicketOrderMailer,
      appBaseUrl,
    });
  const notifyPaymentLifecycle =
    dependencies.notifyPaymentLifecycle ??
    (async (payload: PaymentLifecycleRecoveryPayload, recoveryClaim: NotificationRecoveryClaim, deliveryMode?: GovNotifyDeliveryMode) => {
      await emitPaymentLifecycleNotification(
        {
          type: payload.type,
          orderId: payload.orderId,
          eventId: payload.eventId,
          stripeEventId: payload.stripeEventId,
          status: payload.status ?? undefined,
          occurredAt: payload.occurredAt,
        },
        paymentLifecycleDispatcher,
        sendNotificationOnce,
        {
          userId: payload.userId,
          provider: GOV_NOTIFY_PROVIDER,
          deliveryMode,
          recoveryClaim,
        }
      );
    });

  return async (
    candidate: RecoverableNotificationDelivery,
    payload: NotificationRecoveryPayload
  ): Promise<void> => {
    if (candidate.channel !== NotificationChannel.EMAIL) {
      throw new Error(`Unsupported notification recovery channel: ${candidate.channel}`);
    }
    const identity = notificationRecoveryIdentity(payload);
    const recoveryClaim = createNotificationRecoveryClaim(candidate);
    const deliveryMode = recoveryDeliveryMode(recoveryClaim, payload.deliveryMode, identity.deliveryKey);
    const legacyStaffSkip = (payload.kind === "BOOKING_PENDING_MODERATOR" || payload.kind === "USER_PENDING_APPROVAL") && payload.version === 1;
    if (!deliveryMode && !legacyStaffSkip) {
      throw new NotificationRecoveryDeferredError("RECOVERY_DELIVERY_MODE_UNVERIFIABLE");
    }
    if (
      identity.notificationType !== candidate.notificationType ||
      (identity.deliveryKey !== candidate.deliveryKey &&
        (!deliveryMode || govNotifyReferenceForMode(identity.deliveryKey, deliveryMode) !== candidate.deliveryKey))
    ) {
      throw new Error("Notification recovery payload does not match its ledger identity");
    }

    if (payload.kind === "BOOKING_PENDING_MODERATOR" || payload.kind === "USER_PENDING_APPROVAL") {
      if (payload.version === 1) {
        await (dependencies.sendNotification ?? sendNotificationOnce)({
          channel: candidate.channel, notificationType: candidate.notificationType,
          deliveryKey: candidate.deliveryKey, preserveDeliveryKey: true,
          recoveryPayload: payload,
          recipientUserId: candidate.recipientUserId ?? undefined,
          recoveryClaim,
          send: async () => ({ outcome: "skipped", reason: "LEGACY_RECIPIENT_IDENTITY_UNVERIFIABLE" }),
        });
        return;
      }
      if (candidate.recipientUserId !== payload.recipientUserId ||
        (payload.kind === "BOOKING_PENDING_MODERATOR" ? candidate.subjectBookingId !== payload.bookingId : candidate.subjectUserId !== payload.userId)) {
        throw new Error("Privileged recovery recipient or subject does not match its ledger identity");
      }
    }

    switch (payload.kind) {
      case "BOOKING_CONFIRMATION":
        await (dependencies.notifyBookingConfirmation ?? notifyBookingConfirmationEmail)({
          bookingId: payload.bookingId,
          idempotencyKey: payload.idempotencyKey,
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "BOOKING_REVISION":
        await (dependencies.notifyBookingRevision ?? notifyBookingRevisionEmail)({
          bookingId: payload.bookingId,
          idempotencyKey: payload.idempotencyKey,
          paymentDelta: payload.paymentDelta,
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "BOOKING_PENDING_MEMBER":
        await (dependencies.notifyBookingPending ?? notifyBookingPendingApprovalEmails)({
          bookingId: payload.bookingId,
          idempotencyKey: payload.idempotencyKey,
          recipientUserIds: [],
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "BOOKING_PENDING_MODERATOR":
        await (dependencies.notifyBookingPending ?? notifyBookingPendingApprovalEmails)({
          bookingId: payload.bookingId,
          idempotencyKey: `recovery:${payload.bookingId}`,
          recipientUserIds: [payload.version === 2 ? payload.recipientUserId : ""],
          recoveryDeliveryKey: candidate.deliveryKey,
          notifyMember: false,
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "BOOKING_CHANGES_REQUESTED":
        await (dependencies.notifyBookingChangesRequested ?? notifyBookingChangesRequestedEmail)({
          bookingId: payload.bookingId,
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "BOOKING_APPROVED":
        await (dependencies.notifyBookingApproved ?? notifyBookingApprovedEmail)({
          bookingId: payload.bookingId,
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "MEMBERSHIP_STATUS":
        await (dependencies.notifyMembershipStatus ?? notifyMembershipStatusEmailIfNeeded)({
          userId: payload.userId,
          previousStatus: payload.previousStatus,
          newStatus: payload.newStatus,
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "USER_PENDING_APPROVAL":
        await (dependencies.notifyPendingApproval ?? notifyAdminsUserPendingApproval)({
          userId: payload.userId,
          emailVerified: payload.emailVerified,
          recipientUserIds: [payload.version === 2 ? payload.recipientUserId : ""],
          recoveryDeliveryKey: candidate.deliveryKey,
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "PAYMENT_LIFECYCLE":
        await notifyPaymentLifecycle(payload, recoveryClaim, deliveryMode);
        return;
      case "PAYMENT_RECONCILIATION_OPS":
        await (dependencies.notifyPaymentReconciliationOps ?? notifyPaymentOpsReconciliationExceptionOpened)({
          orderId: payload.orderId,
          exceptionType: payload.exceptionType,
          exceptionNote: payload.exceptionNote,
          stripeEventId: payload.stripeEventId,
          recipientEmails: [payload.recipientEmail],
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
      case "PAYMENT_DISPUTE_OPS":
        await (dependencies.notifyPaymentDisputeOps ?? notifyPaymentOpsDisputeSideState)({
          orderId: payload.orderId,
          stripeEventId: payload.stripeEventId,
          stripeEventType: payload.stripeEventType,
          disputeStripeStatus: payload.disputeStripeStatus,
          disputeReason: payload.disputeReason,
          disputeLocalState: payload.disputeLocalState,
          stripeDisputeId: payload.stripeDisputeId,
          recipientEmails: [payload.recipientEmail],
          appBaseUrl,
          deliveryMode,
          recoveryClaim,
        });
        return;
    }
  };
}

function mapRecoveryRow(row: {
  id: RecoverableNotificationDelivery["id"];
  channel: RecoverableNotificationDelivery["channel"];
  notificationType: string;
  deliveryKey: string;
  recoveryPayload?: string | null;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  lastAttemptedAt?: string | null;
  createdAt: string;
  recipientUserId?: string | null;
  booking?: { id: string } | null;
  user?: { id: string } | null;
  deliveryMode?: GovNotifyDeliveryMode | null;
  recoveryDeferredAt?: string | null;
  recoveryDeferredReason?: string | null;
}): RecoverableNotificationDelivery {
  return {
    id: row.id,
    channel: row.channel,
    notificationType: row.notificationType,
    deliveryKey: row.deliveryKey,
    recoveryPayload: row.recoveryPayload ?? null,
    status: row.status,
    attemptCount: row.attemptCount,
    lastAttemptedAt: row.lastAttemptedAt ?? null,
    createdAt: row.createdAt,
    recipientUserId: row.recipientUserId ?? null,
    subjectBookingId: row.booking?.id ?? null,
    subjectUserId: row.user?.id ?? null,
    deliveryMode: row.deliveryMode ?? null,
    recoveryDeferredAt: row.recoveryDeferredAt ?? null,
    recoveryDeferredReason: row.recoveryDeferredReason ?? null,
  };
}

/** The scheduled worker uses only the guarded operation; legacy workers retain their old API. */
export async function recordNotificationRecoveryFailureForClaim(
  candidate: RecoverableNotificationDelivery,
  now: string,
): Promise<boolean> {
  const claim = createNotificationRecoveryClaim(candidate);
  const result = await recordNotificationRecoveryFailureForClaimById({
    ...notificationRecoveryClaimVariables(claim),
    lastAttemptedAt: now,
    lastErrorCode: "RECOVERY_DISPATCH_FAILED",
    lastErrorMessage: "Recovery dispatch did not complete the notification delivery",
  });
  return result.data.notificationDelivery_updateMany === 1;
}

export const recoverNotificationDeliveries = onSchedule(
  {
    schedule: "every 5 minutes",
    region: FUNCTIONS_REGION,
    timeoutSeconds: 300,
    maxInstances: 1,
    secrets: [...govNotifySecrets],
  },
  async () => {
    const startedAt = Date.now();
    const now = new Date(startedAt).toISOString();
    const [failedResult, pendingResult] = await Promise.all([
      listFailedNotificationDeliveriesForAutomaticRecovery({
        limit: NOTIFICATION_RECOVERY_BATCH_LIMIT,
      }),
      listStalePendingNotificationDeliveriesForAutomaticRecovery({
        limit: NOTIFICATION_RECOVERY_BATCH_LIMIT,
      }),
    ]);

    const candidates = fairNotificationRecoveryCandidates(
      (failedResult.data?.notificationDeliveries ?? []).map(mapRecoveryRow),
      (pendingResult.data?.notificationDeliveries ?? []).map(mapRecoveryRow),
    );
    const dispatch = createNotificationRecoveryDispatcher(APP_BASE_URL);
    const summary = await runNotificationRecoveryBatch({
      candidates,
      now,
      dispatch,
      getCurrent: async (candidate) => {
        const result = await getNotificationDeliveryByChannelAndKey({
          channel: candidate.channel,
          deliveryKey: candidate.deliveryKey,
        });
        const row = result.data?.notificationDeliveries?.[0];
        return row ? mapRecoveryRow(row) : null;
      },
      recordFailure: (candidate) => recordNotificationRecoveryFailureForClaim(candidate, now),
      defer: markNotificationRecoveryDeferred,
      onDeferred: (candidate, reason, persisted) => {
        logger.warn("notification recovery deferred without sending", { deliveryId: candidate.id, reason, persisted });
      },
      onError: (candidate, error) => {
        logger.error("notification recovery attempt failed", {
          deliveryId: candidate.id,
          notificationType: candidate.notificationType,
          status: candidate.status,
          attemptCount: candidate.attemptCount,
          errorType: error instanceof Error ? error.name : typeof error,
          deferredReason: error instanceof NotificationRecoveryDeferredError ? error.code : undefined,
        });
      },
    });

    logger.info("notification recovery job completed", {
      durationMs: Date.now() - startedAt,
      summary,
      limits: {
        batch: NOTIFICATION_RECOVERY_BATCH_LIMIT,
        maxAttempts: NOTIFICATION_RECOVERY_MAX_ATTEMPTS,
        retryDelayMs: NOTIFICATION_RECOVERY_RETRY_DELAY_MS,
      },
    });
  }
);
