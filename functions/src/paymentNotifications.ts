import * as logger from "firebase-functions/logger";
import { NotificationChannel, TicketOrderStatus } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { sanitizeMailerError } from "./mailerErrors";
import { sendNotificationOnce, type NotificationSendResult } from "./notificationDelivery";

export type PaymentLifecycleNotificationType =
  | "PAYMENT_PAID"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED";

export interface PaymentLifecycleNotification {
  type: PaymentLifecycleNotificationType;
  orderId: UUIDString;
  eventId?: string | null;
  stripeEventId: string;
  status?: TicketOrderStatus;
  occurredAt: string;
}

export interface EmitPaymentLifecycleNotificationExtras {
  userId?: string | null;
  provider?: string | null;
}

type NotificationDispatcher = (notification: PaymentLifecycleNotification) => Promise<NotificationSendResult | void>;
type NotificationSender = typeof sendNotificationOnce;

async function defaultDispatcher(notification: PaymentLifecycleNotification): Promise<void> {
  logger.info("payment lifecycle notification", notification);
}

function paymentLifecycleDeliveryKey(notification: PaymentLifecycleNotification): string {
  return `payment:${notification.orderId}:${notification.type}:${notification.stripeEventId}`;
}

export async function emitPaymentLifecycleNotification(
  notification: PaymentLifecycleNotification,
  dispatcher: NotificationDispatcher = defaultDispatcher,
  notificationSender: NotificationSender = sendNotificationOnce,
  extras?: EmitPaymentLifecycleNotificationExtras
): Promise<void> {
  try {
    await notificationSender({
      channel: NotificationChannel.EMAIL,
      notificationType: notification.type,
      deliveryKey: paymentLifecycleDeliveryKey(notification),
      ticketOrderId: notification.orderId,
      userId: extras?.userId ?? null,
      provider: extras?.provider ?? null,
      send: async () => dispatcher(notification),
    });
  } catch (error) {
    logger.error("payment lifecycle notification failed", {
      notificationType: notification.type,
      orderId: notification.orderId,
      stripeEventId: notification.stripeEventId,
      error: sanitizeMailerError(error),
    });
  }
}
