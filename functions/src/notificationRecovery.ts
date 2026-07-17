import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  getNotificationDeliveryByChannelAndKey,
  listFailedNotificationDeliveriesForRecovery,
  listStalePendingNotificationDeliveriesForRecovery,
  recordNotificationRecoveryFailureById,
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@dataconnect/admin-generated";
import {
  bookingConfirmationDeliveryKey,
  bookingRevisionDeliveryKey,
  notifyBookingConfirmationEmail,
  notifyBookingRevisionEmail,
} from "./bookingEmailDispatcher";
import {
  guestTicketBookerDeliveryKey,
  guestTicketModeratorDeliveryKey,
  notifyBookerGuestTicketRequestReviewed,
  notifyModeratorsGuestTicketRequestSubmitted,
} from "./guestTicketRequestEmails";
import {
  classifyMembershipStatusEmailTransition,
  membershipStatusDeliveryKey,
  notifyMembershipStatusEmailIfNeeded,
} from "./membershipStatusEmailDispatcher";
import {
  notifyAdminsUserPendingApproval,
  pendingApprovalDeliveryKey,
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
import { APP_BASE_URL } from "./paymentConfig";
import { FUNCTIONS_REGION } from "./constants";
import { govNotifyApiKey, GOV_NOTIFY_PROVIDER } from "./mailer";

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
    case "GUEST_REQUEST_MODERATORS":
      return {
        notificationType: "GUEST_REQUEST_SUBMITTED_MODERATOR",
        deliveryKey: guestTicketModeratorDeliveryKey(
          payload.requestId,
          payload.recipientEmail
        ),
      };
    case "GUEST_REQUEST_BOOKER":
      return {
        notificationType:
          payload.status === "APPROVED"
            ? "GUEST_REQUEST_APPROVED"
            : "GUEST_REQUEST_REJECTED",
        deliveryKey: guestTicketBookerDeliveryKey(
          payload.requestId,
          payload.status
        ),
      };
    case "USER_PENDING_APPROVAL":
      return {
        notificationType: "USER_PENDING_APPROVAL",
        deliveryKey: pendingApprovalDeliveryKey(
          payload.userId,
          payload.recipientEmail
        ),
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
  notifyBookingConfirmation?: typeof notifyBookingConfirmationEmail;
  notifyBookingRevision?: typeof notifyBookingRevisionEmail;
  notifyMembershipStatus?: typeof notifyMembershipStatusEmailIfNeeded;
  notifyGuestRequestModerators?: typeof notifyModeratorsGuestTicketRequestSubmitted;
  notifyGuestRequestBooker?: typeof notifyBookerGuestTicketRequestReviewed;
  notifyPendingApproval?: typeof notifyAdminsUserPendingApproval;
  notifyPaymentReconciliationOps?: typeof notifyPaymentOpsReconciliationExceptionOpened;
  notifyPaymentDisputeOps?: typeof notifyPaymentOpsDisputeSideState;
  notifyPaymentLifecycle?: (
    payload: PaymentLifecycleRecoveryPayload
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
    (async (payload: PaymentLifecycleRecoveryPayload) => {
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
    if (
      identity.notificationType !== candidate.notificationType ||
      identity.deliveryKey !== candidate.deliveryKey
    ) {
      throw new Error("Notification recovery payload does not match its ledger identity");
    }

    switch (payload.kind) {
      case "BOOKING_CONFIRMATION":
        await (dependencies.notifyBookingConfirmation ?? notifyBookingConfirmationEmail)({
          bookingId: payload.bookingId,
          idempotencyKey: payload.idempotencyKey,
          appBaseUrl,
        });
        return;
      case "BOOKING_REVISION":
        await (dependencies.notifyBookingRevision ?? notifyBookingRevisionEmail)({
          bookingId: payload.bookingId,
          idempotencyKey: payload.idempotencyKey,
          paymentDelta: payload.paymentDelta,
          appBaseUrl,
        });
        return;
      case "MEMBERSHIP_STATUS":
        await (dependencies.notifyMembershipStatus ?? notifyMembershipStatusEmailIfNeeded)({
          userId: payload.userId,
          previousStatus: payload.previousStatus,
          newStatus: payload.newStatus,
          appBaseUrl,
        });
        return;
      case "GUEST_REQUEST_MODERATORS":
        await (dependencies.notifyGuestRequestModerators ?? notifyModeratorsGuestTicketRequestSubmitted)({
          requestId: payload.requestId,
          recipientEmails: [payload.recipientEmail],
          appBaseUrl,
        });
        return;
      case "GUEST_REQUEST_BOOKER":
        await (dependencies.notifyGuestRequestBooker ?? notifyBookerGuestTicketRequestReviewed)({
          requestId: payload.requestId,
          status: payload.status,
          appBaseUrl,
        });
        return;
      case "USER_PENDING_APPROVAL":
        await (dependencies.notifyPendingApproval ?? notifyAdminsUserPendingApproval)({
          userId: payload.userId,
          emailVerified: payload.emailVerified,
          recipientEmails: [payload.recipientEmail],
          appBaseUrl,
        });
        return;
      case "PAYMENT_LIFECYCLE":
        await notifyPaymentLifecycle(payload);
        return;
      case "PAYMENT_RECONCILIATION_OPS":
        await (dependencies.notifyPaymentReconciliationOps ?? notifyPaymentOpsReconciliationExceptionOpened)({
          orderId: payload.orderId,
          exceptionType: payload.exceptionType,
          exceptionNote: payload.exceptionNote,
          stripeEventId: payload.stripeEventId,
          recipientEmails: [payload.recipientEmail],
          appBaseUrl,
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
  };
}

export const recoverNotificationDeliveries = onSchedule(
  {
    schedule: "every 5 minutes",
    region: FUNCTIONS_REGION,
    timeoutSeconds: 300,
    maxInstances: 1,
    secrets: [govNotifyApiKey],
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
      recordFailure: async (candidate) => {
        const result = await recordNotificationRecoveryFailureById({
          id: candidate.id,
          expectedStatus: candidate.status,
          expectedAttemptCount: candidate.attemptCount,
          attemptCount: candidate.attemptCount + 1,
          lastAttemptedAt: now,
          lastErrorCode: "RECOVERY_DISPATCH_FAILED",
          lastErrorMessage: "Recovery dispatch did not complete the notification delivery",
        });
        return result.data.notificationDelivery_updateMany === 1;
      },
      onError: (candidate, error) => {
        logger.error("notification recovery attempt failed", {
          deliveryId: candidate.id,
          notificationType: candidate.notificationType,
          status: candidate.status,
          attemptCount: candidate.attemptCount,
          errorType: error instanceof Error ? error.name : typeof error,
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
