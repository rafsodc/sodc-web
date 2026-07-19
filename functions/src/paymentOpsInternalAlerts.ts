import * as logger from "firebase-functions/logger";
import {
  getTicketOrderForWebhook,
  NotificationChannel,
  PaymentReconciliationExceptionType,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  createConfiguredGovNotifyMailer,
  GOV_NOTIFY_PROVIDER,
  recipientScopedNotifyReference,
} from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";
import { normaliseAppBaseUrl } from "./paymentLifecycleEmailDispatcher";
import { sendNotificationOnce } from "./notificationDelivery";

export const PAYMENT_OPS_ALERT_EMAILS_ENV = "PAYMENT_OPS_ALERT_EMAILS";

export const PAYMENT_OPS_ALERT_TEMPLATE_KEYS = [
  "paymentReconciliationExceptionAlert",
  "paymentDisputeOpsAlert",
] as const;

export type PaymentOpsInternalTemplates = {
  paymentReconciliationExceptionAlert: {
    orderId: string;
    eventTitle: string;
    customerDisplay: string;
    exceptionType: string;
    exceptionNote: string;
    reconciliationDashboardUrl: string;
    stripeEventId: string;
  };
  paymentDisputeOpsAlert: {
    orderId: string;
    eventTitle: string;
    customerDisplay: string;
    disputeStripeStatus: string;
    disputeReason: string;
    disputeLocalState: string;
    stripeDisputeId: string;
    stripeEventType: string;
    reconciliationDashboardUrl: string;
    stripeEventId: string;
  };
};

export function parsePaymentOpsAlertEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env[PAYMENT_OPS_ALERT_EMAILS_ENV]?.trim();
  if (!raw) {
    return [];
  }
  return Array.from(new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)));
}

export function createPaymentOpsInternalMailer(): ReturnType<
  typeof createConfiguredGovNotifyMailer<PaymentOpsInternalTemplates>
> {
  return createConfiguredGovNotifyMailer([...PAYMENT_OPS_ALERT_TEMPLATE_KEYS]);
}

export function paymentReconciliationOpsDeliveryKey(args: {
  orderId: string;
  exceptionType: string;
  stripeEventId: string;
  recipientEmail: string;
}): string {
  return `reconciliation-ops:${args.orderId}:${args.exceptionType}:${args.stripeEventId}:${args.recipientEmail}`;
}

export function paymentDisputeOpsDeliveryKey(args: {
  orderId: string;
  stripeEventId: string;
  recipientEmail: string;
}): string {
  return `dispute-ops:${args.orderId}:${args.stripeEventId}:${args.recipientEmail}`;
}

async function loadOrderOpsContext(orderId: UUIDString): Promise<{
  eventTitle: string;
  customerDisplay: string;
} | null> {
  const row = await getTicketOrderForWebhook({ id: orderId });
  const o = row.data?.ticketOrder;
  if (!o) {
    return null;
  }
  const u = o.user;
  const name = `${u.firstName} ${u.lastName}`.trim();
  const customerDisplay = name.length > 0 ? `${name} <${u.email}>` : u.email;
  return { eventTitle: o.event.title ?? "—", customerDisplay };
}

/**
 * Best-effort internal alerts for finance/ops, awaited by Stripe webhook processing.
 */
export async function notifyPaymentOpsReconciliationExceptionOpened(args: {
  orderId: UUIDString;
  exceptionType: PaymentReconciliationExceptionType;
  exceptionNote: string;
  stripeEventId: string;
  appBaseUrl: string;
  recipientEmails?: readonly string[];
  getMailer?: () => ReturnType<typeof createPaymentOpsInternalMailer>;
}): Promise<void> {
  const recipients = args.recipientEmails
    ? Array.from(
        new Set(
          args.recipientEmails
            .map((email) => email.trim().toLowerCase())
            .filter((email) => email.length > 0)
        )
      )
    : parsePaymentOpsAlertEmails();
  if (recipients.length === 0) {
    return;
  }
  try {
    const ctx = await loadOrderOpsContext(args.orderId);
    if (!ctx) {
      logger.warn("payment ops reconciliation alert skipped (order not found)", {
        orderId: args.orderId,
        exceptionType: args.exceptionType,
      });
      return;
    }
    const mailer = (args.getMailer ?? createPaymentOpsInternalMailer)();
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const reconciliationDashboardUrl = `${base}/admin/payments/reconciliation`;
    const reference = `reconciliation-ops:${args.orderId}:${args.exceptionType}:${args.stripeEventId}`;

    const personalisation: PaymentOpsInternalTemplates["paymentReconciliationExceptionAlert"] = {
      orderId: args.orderId,
      eventTitle: ctx.eventTitle,
      customerDisplay: ctx.customerDisplay,
      exceptionType: args.exceptionType,
      exceptionNote: args.exceptionNote,
      reconciliationDashboardUrl,
      stripeEventId: args.stripeEventId,
    };

    for (const to of recipients) {
      const deliveryKey = paymentReconciliationOpsDeliveryKey({
        orderId: args.orderId,
        exceptionType: args.exceptionType,
        stripeEventId: args.stripeEventId,
        recipientEmail: to,
      });
      try {
        await sendNotificationOnce({
          channel: NotificationChannel.EMAIL,
          notificationType: "RECONCILIATION_EXCEPTION_OPEN",
          deliveryKey,
          ticketOrderId: args.orderId,
          userId: null,
          provider: GOV_NOTIFY_PROVIDER,
          recoveryPayload: {
            version: 1,
            kind: "PAYMENT_RECONCILIATION_OPS",
            orderId: args.orderId,
            exceptionType: args.exceptionType,
            exceptionNote: args.exceptionNote,
            stripeEventId: args.stripeEventId,
            recipientEmail: to,
          },
          send: async () => {
            const r = await mailer.sendEmail({
              templateName: "paymentReconciliationExceptionAlert",
              to,
              personalisation,
              reference: recipientScopedNotifyReference(reference, to),
            });
            return { providerMessageId: r.providerNotificationId ?? null };
          },
        });
      } catch (error) {
        logger.error("payment ops reconciliation alert delivery failed", {
          orderId: args.orderId,
          exceptionType: args.exceptionType,
          error: sanitizeMailerError(error),
        });
      }
    }
  } catch (error) {
    logger.error("payment ops reconciliation alert failed", {
      orderId: args.orderId,
      exceptionType: args.exceptionType,
      error: sanitizeMailerError(error),
    });
  }
}

export async function notifyPaymentOpsDisputeSideState(args: {
  orderId: UUIDString;
  stripeEventId: string;
  stripeEventType: string;
  disputeStripeStatus: string;
  disputeReason: string;
  disputeLocalState: string;
  stripeDisputeId: string;
  appBaseUrl: string;
  recipientEmails?: readonly string[];
  getMailer?: () => ReturnType<typeof createPaymentOpsInternalMailer>;
}): Promise<void> {
  const recipients = args.recipientEmails
    ? Array.from(
        new Set(
          args.recipientEmails
            .map((email) => email.trim().toLowerCase())
            .filter((email) => email.length > 0)
        )
      )
    : parsePaymentOpsAlertEmails();
  if (recipients.length === 0) {
    return;
  }
  try {
    const ctx = await loadOrderOpsContext(args.orderId);
    if (!ctx) {
      logger.warn("payment ops dispute alert skipped (order not found)", { orderId: args.orderId });
      return;
    }
    const mailer = (args.getMailer ?? createPaymentOpsInternalMailer)();
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const reconciliationDashboardUrl = `${base}/admin/payments/reconciliation`;
    const reference = `dispute-ops:${args.orderId}:${args.stripeEventId}`;

    const personalisation: PaymentOpsInternalTemplates["paymentDisputeOpsAlert"] = {
      orderId: args.orderId,
      eventTitle: ctx.eventTitle,
      customerDisplay: ctx.customerDisplay,
      disputeStripeStatus: args.disputeStripeStatus,
      disputeReason: args.disputeReason,
      disputeLocalState: args.disputeLocalState,
      stripeDisputeId: args.stripeDisputeId,
      stripeEventType: args.stripeEventType,
      reconciliationDashboardUrl,
      stripeEventId: args.stripeEventId,
    };

    for (const to of recipients) {
      const deliveryKey = paymentDisputeOpsDeliveryKey({
        orderId: args.orderId,
        stripeEventId: args.stripeEventId,
        recipientEmail: to,
      });
      try {
        await sendNotificationOnce({
          channel: NotificationChannel.EMAIL,
          notificationType: "DISPUTE_OPS_EVENT",
          deliveryKey,
          ticketOrderId: args.orderId,
          userId: null,
          provider: GOV_NOTIFY_PROVIDER,
          recoveryPayload: {
            version: 1,
            kind: "PAYMENT_DISPUTE_OPS",
            orderId: args.orderId,
            stripeEventId: args.stripeEventId,
            stripeEventType: args.stripeEventType,
            disputeStripeStatus: args.disputeStripeStatus,
            disputeReason: args.disputeReason,
            disputeLocalState: args.disputeLocalState,
            stripeDisputeId: args.stripeDisputeId,
            recipientEmail: to,
          },
          send: async () => {
            const r = await mailer.sendEmail({
              templateName: "paymentDisputeOpsAlert",
              to,
              personalisation,
              reference: recipientScopedNotifyReference(reference, to),
            });
            return { providerMessageId: r.providerNotificationId ?? null };
          },
        });
      } catch (error) {
        logger.error("payment ops dispute alert delivery failed", {
          orderId: args.orderId,
          stripeEventId: args.stripeEventId,
          error: sanitizeMailerError(error),
        });
      }
    }
  } catch (error) {
    logger.error("payment ops dispute alert failed", {
      orderId: args.orderId,
      stripeEventId: args.stripeEventId,
      error: sanitizeMailerError(error),
    });
  }
}
