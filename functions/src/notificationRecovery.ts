import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  getNotificationDeliveryByChannelAndKey,
  listFailedNotificationDeliveriesForRecovery,
  listStalePendingNotificationDeliveriesForRecovery,
  recordNotificationRecoveryFailureForClaimById,
  NotificationChannel,
  NotificationDeliveryStatus,
  GovNotifyDeliveryMode as DataConnectGovNotifyDeliveryMode,
} from "@dataconnect/admin-generated";
import {
  bookingChangesRequestedDeliveryKey,
  bookingApprovedDeliveryKey,
  bookingConfirmationDeliveryKey,
  bookingPendingMemberDeliveryKey,
  bookingPendingModeratorDeliveryKey,
  bookingPendingModeratorUidDeliveryKey,
  bookingRevisionDeliveryKey,
  notifyBookingChangesRequestedEmail,
  notifyBookingApprovedEmail,
  notifyBookingConfirmationEmail,
  notifyBookingPendingApprovalEmails,
  notifyBookingRevisionEmail,
} from "./bookingEmailDispatcher";
import {
  classifyMembershipStatusEmailTransition,
  membershipStatusDeliveryKey,
  notifyMembershipStatusEmailIfNeeded,
} from "./membershipStatusEmailDispatcher";
import {
  notifyAdminsUserPendingApproval,
  pendingApprovalDeliveryKey,
  pendingApprovalUidDeliveryKey,
} from "./pendingApprovalAdminAlert";
import {
  createGovNotifyTicketOrderLifecycleDispatcher,
  defaultWebhookGovNotifyTicketOrderMailer,
} from "./paymentLifecycleEmailDispatcher";
import {
  notifyPaymentOpsDisputeSideState,
  notifyPaymentOpsReconciliationExceptionOpened,
  paymentDisputeOpsDeliveryKey,
  paymentReconciliationOpsDeliveryKey,
} from "./paymentOpsInternalAlerts";
import {
  emitPaymentLifecycleNotification,
  paymentLifecycleDeliveryKey,
  type PaymentLifecycleNotification,
} from "./paymentNotifications";
import {
  DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS,
  sendNotificationOnce,
} from "./notificationDelivery";
import {
  NOTIFICATION_RECOVERY_BATCH_LIMIT,
  NOTIFICATION_RECOVERY_MAX_ATTEMPTS,
  NOTIFICATION_RECOVERY_RETRY_DELAY_MS,
  runNotificationRecoveryBatch,
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

export function notificationRecoveryIdentity(payload: NotificationRecoveryPayload): {
  notificationType: string;
  deliveryKey: string;
} {
  switch (payload.kind) {
    case "BOOKING_CONFIRMATION":
      return {
        notificationType: "BOOKING_CONFIRMATION",
        deliveryKey: bookingConfirmationDeliveryKey(
          payload.bookingId,
          payload.idempotencyKey
        ),
      };
    case "BOOKING_REVISION":
      return {
        notificationType: "BOOKING_REVISION",
        deliveryKey: bookingRevisionDeliveryKey(
          payload.bookingId,
          payload.idempotencyKey
        ),
      };
    case "BOOKING_PENDING_MEMBER":
      return {
        notificationType: "BOOKING_PENDING_APPROVAL_MEMBER",
        deliveryKey: bookingPendingMemberDeliveryKey(payload.bookingId, payload.idempotencyKey),
      };
    case "BOOKING_PENDING_MODERATOR":
      return {
        notificationType: "BOOKING_PENDING_APPROVAL_MODERATOR",
        deliveryKey: payload.version === 2
          ? bookingPendingModeratorUidDeliveryKey(payload.bookingId, payload.recipientUserId)
          : bookingPendingModeratorDeliveryKey(payload.bookingId, payload.recipientEmail),
      };
    case "BOOKING_CHANGES_REQUESTED":
      return {
        notificationType: "BOOKING_CHANGES_REQUESTED",
        deliveryKey: bookingChangesRequestedDeliveryKey(payload.bookingId),
      };
    case "BOOKING_APPROVED":
      return {
        notificationType: "BOOKING_APPROVED",
        deliveryKey: bookingApprovedDeliveryKey(payload.bookingId),
      };
    case "MEMBERSHIP_STATUS": {
      const transition = classifyMembershipStatusEmailTransition(
        payload.previousStatus,
        payload.newStatus
      );
      if (!transition) {
        throw new Error("Membership recovery payload does not describe an email transition");
      }
      return {
        notificationType:
          transition === "activation"
            ? "MEMBERSHIP_ACTIVATED"
            : "MEMBERSHIP_ACCESS_RESTRICTED",
        deliveryKey: membershipStatusDeliveryKey({
          kind: transition,
          userId: payload.userId,
          previousStatus: payload.previousStatus,
          newStatus: payload.newStatus,
        }),
      };
    }
    case "USER_PENDING_APPROVAL":
      return {
        notificationType: "USER_PENDING_APPROVAL",
        deliveryKey: payload.version === 2
          ? pendingApprovalUidDeliveryKey(payload.userId, payload.recipientUserId)
          : pendingApprovalDeliveryKey(payload.userId, payload.recipientEmail),
      };
    case "PAYMENT_LIFECYCLE": {
      const notification: PaymentLifecycleNotification = {
        type: payload.type,
        orderId: payload.orderId,
        eventId: payload.eventId,
        stripeEventId: payload.stripeEventId,
        status: payload.status ?? undefined,
        occurredAt: payload.occurredAt,
      };
      return {
        notificationType: payload.type,
        deliveryKey: paymentLifecycleDeliveryKey(notification),
      };
    }
    case "PAYMENT_RECONCILIATION_OPS":
      return {
        notificationType: "RECONCILIATION_EXCEPTION_OPEN",
        deliveryKey: paymentReconciliationOpsDeliveryKey({
          orderId: payload.orderId,
          exceptionType: payload.exceptionType,
          stripeEventId: payload.stripeEventId,
          recipientEmail: payload.recipientEmail,
        }),
      };
    case "PAYMENT_DISPUTE_OPS":
      return {
        notificationType: "DISPUTE_OPS_EVENT",
        deliveryKey: paymentDisputeOpsDeliveryKey({
          orderId: payload.orderId,
          stripeEventId: payload.stripeEventId,
          recipientEmail: payload.recipientEmail,
        }),
      };
  }
}

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
  };
}

/** The scheduled worker uses only the guarded operation; legacy workers retain their old API. */
export async function recordNotificationRecoveryFailureForClaim(
  candidate: RecoverableNotificationDelivery,
  now: string,
): Promise<boolean> {
  const claim = createNotificationRecoveryClaim(candidate);
  const result = await recordNotificationRecoveryFailureForClaimById({
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
    const failedAttemptedBefore = new Date(
      startedAt - NOTIFICATION_RECOVERY_RETRY_DELAY_MS
    ).toISOString();
    const stalePendingBefore = new Date(
      startedAt - DEFAULT_NOTIFICATION_DELIVERY_LEASE_MS
    ).toISOString();

    const [failedResult, pendingResult] = await Promise.all([
      listFailedNotificationDeliveriesForRecovery({
        attemptedBefore: failedAttemptedBefore,
        maxAttemptCount: NOTIFICATION_RECOVERY_MAX_ATTEMPTS,
        limit: NOTIFICATION_RECOVERY_BATCH_LIMIT,
      }),
      listStalePendingNotificationDeliveriesForRecovery({
        attemptedBefore: stalePendingBefore,
        maxAttemptCount: NOTIFICATION_RECOVERY_MAX_ATTEMPTS,
        limit: NOTIFICATION_RECOVERY_BATCH_LIMIT,
      }),
    ]);

    const candidates = [
      ...(failedResult.data?.notificationDeliveries ?? []),
      ...(pendingResult.data?.notificationDeliveries ?? []),
    ]
      .map(mapRecoveryRow)
      .sort((left, right) =>
        (left.lastAttemptedAt ?? left.createdAt).localeCompare(
          right.lastAttemptedAt ?? right.createdAt
        )
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
