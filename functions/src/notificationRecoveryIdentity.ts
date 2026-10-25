import type { NotificationRecoveryPayload } from "./notificationRecoveryPayload";
import type { PaymentLifecycleNotification } from "./paymentNotifications";
import { bookingConfirmationDeliveryKey, bookingRevisionDeliveryKey, bookingPendingMemberDeliveryKey, bookingPendingModeratorDeliveryKey, bookingPendingModeratorUidDeliveryKey, bookingChangesRequestedDeliveryKey, bookingApprovedDeliveryKey, pendingApprovalDeliveryKey, pendingApprovalUidDeliveryKey, paymentReconciliationOpsDeliveryKey, paymentDisputeOpsDeliveryKey, paymentLifecycleDeliveryKey, classifyMembershipStatusEmailTransition, membershipStatusDeliveryKey } from "./notificationDeliveryKeys";

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
