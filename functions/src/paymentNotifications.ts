import * as logger from "firebase-functions/logger";
import { TicketOrderStatus } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { sanitizeMailerError } from "./mailerErrors";

export type PaymentLifecycleNotificationType =
  | "PAYMENT_PAID"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_DISPUTE_UPDATED";

export interface PaymentLifecycleNotification {
  type: PaymentLifecycleNotificationType;
  orderId: UUIDString;
  eventId?: string | null;
  stripeEventId: string;
  status?: TicketOrderStatus;
  disputeState?: string | null;
  occurredAt: string;
}

type NotificationDispatcher = (notification: PaymentLifecycleNotification) => Promise<void>;

async function defaultDispatcher(notification: PaymentLifecycleNotification): Promise<void> {
  logger.info("payment lifecycle notification", notification);
}

export async function emitPaymentLifecycleNotification(
  notification: PaymentLifecycleNotification,
  dispatcher: NotificationDispatcher = defaultDispatcher
): Promise<void> {
  try {
    await dispatcher(notification);
  } catch (error) {
    logger.error("payment lifecycle notification failed", {
      notificationType: notification.type,
      orderId: notification.orderId,
      stripeEventId: notification.stripeEventId,
      error: sanitizeMailerError(error),
    });
  }
}
