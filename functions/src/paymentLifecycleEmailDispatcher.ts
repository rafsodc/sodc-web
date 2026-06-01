import * as logger from "firebase-functions/logger";
import { getTicketOrderForWebhook } from "@dataconnect/admin-generated";
import {
  TicketOrderStatus,
  type GetTicketOrderForWebhookData,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  createConfiguredGovNotifyMailer,
  type TransactionalMailer,
} from "./mailer";
import type { PaymentLifecycleNotification } from "./paymentNotifications";

export const TICKET_ORDER_MAIL_TEMPLATE_KEYS = ["ticketOrderPaid", "ticketOrderFailed", "ticketOrderRefunded"] as const;

export type TicketOrderPaidPersonalisation = {
  customerFirstName: string;
  eventTitle: string;
  ticketTypeTitle: string;
  quantity: number;
  totalFormatted: string;
  currencyDisplay: string;
  orderStatusLabel: string;
  orderId: string;
  myPaymentsUrl: string;
};

export type TicketOrderFailedPersonalisation = TicketOrderPaidPersonalisation;

export type TicketOrderRefundedPersonalisation = TicketOrderPaidPersonalisation & {
  refundFormatted: string;
};

export type TicketOrderTransactionalTemplates = {
  ticketOrderPaid: TicketOrderPaidPersonalisation;
  ticketOrderFailed: TicketOrderFailedPersonalisation;
  ticketOrderRefunded: TicketOrderRefundedPersonalisation;
};

type TicketOrderWebhookRow = NonNullable<GetTicketOrderForWebhookData["ticketOrder"]>;

export function normaliseAppBaseUrl(baseUrl: string): string {
  let url = baseUrl;
  while (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
}

export function formatMinorCurrency(amountMinor: number, currency: string): string {
  const symbolOrCode = currency.trim().toUpperCase();
  const major = amountMinor / 100;
  return `${major.toFixed(2)} ${symbolOrCode}`;
}

export function ticketOrderStatusCustomerLabel(status: TicketOrderStatus): string {
  switch (status) {
    case TicketOrderStatus.PAID:
      return "Paid";
    case TicketOrderStatus.FAILED:
      return "Payment failed";
    case TicketOrderStatus.REFUNDED:
      return "Refunded";
    case TicketOrderStatus.PENDING:
      return "Pending payment";
    default:
      return String(status);
  }
}

function buildPaidLikePersonalisation(args: {
  row: TicketOrderWebhookRow;
  statusForEmail: TicketOrderStatus;
  appBaseUrl: string;
}): TicketOrderPaidPersonalisation {
  const { row, statusForEmail, appBaseUrl } = args;
  const base = normaliseAppBaseUrl(appBaseUrl);
  const fn = row.user.firstName?.trim();
  return {
    customerFirstName: fn && fn.length > 0 ? fn : "there",
    eventTitle: row.event.title ?? "",
    ticketTypeTitle: row.ticketType.title ?? "",
    quantity: row.quantity,
    totalFormatted: formatMinorCurrency(row.totalAmountMinor, row.currency),
    currencyDisplay: row.currency.trim().toUpperCase(),
    orderStatusLabel: ticketOrderStatusCustomerLabel(statusForEmail),
    orderId: row.id,
    myPaymentsUrl: `${base}/payments`,
  };
}

export interface GovNotifyTicketOrderLifecycleDispatcherOptions {
  getMailer: () => TransactionalMailer<TicketOrderTransactionalTemplates>;
  appBaseUrl: string;
}

export function createGovNotifyTicketOrderLifecycleDispatcher(
  options: GovNotifyTicketOrderLifecycleDispatcherOptions
): (notification: PaymentLifecycleNotification) => Promise<{ providerMessageId?: string | null }> {
  return async (notification: PaymentLifecycleNotification) => {
    const refreshed = await getTicketOrderForWebhook({ id: notification.orderId as UUIDString });
    const row = refreshed.data?.ticketOrder;
    if (!row) {
      logger.warn("ticket order missing while sending payment lifecycle email", {
        notificationType: notification.type,
        orderId: notification.orderId,
      });
      throw new Error("ticket_order_not_found_for_notification");
    }

    const email = row.user.email?.trim().toLowerCase();
    if (!email) {
      logger.warn("ticket order purchaser email missing", {
        notificationType: notification.type,
        orderId: notification.orderId,
      });
      throw new Error("ticket_order_missing_purchaser_email");
    }

    const mailer = options.getMailer();
    const reference = `${notification.type}:${notification.orderId}:${notification.stripeEventId}`;

    switch (notification.type) {
      case "PAYMENT_PAID": {
        const personalisation = buildPaidLikePersonalisation({
          row,
          statusForEmail: TicketOrderStatus.PAID,
          appBaseUrl: options.appBaseUrl,
        });
        const result = await mailer.sendEmail({
          templateName: "ticketOrderPaid",
          to: email,
          personalisation,
          reference,
        });
        return { providerMessageId: result.providerNotificationId ?? null };
      }
      case "PAYMENT_FAILED": {
        const personalisation = buildPaidLikePersonalisation({
          row,
          statusForEmail: TicketOrderStatus.FAILED,
          appBaseUrl: options.appBaseUrl,
        });
        const result = await mailer.sendEmail({
          templateName: "ticketOrderFailed",
          to: email,
          personalisation,
          reference,
        });
        return { providerMessageId: result.providerNotificationId ?? null };
      }
      case "PAYMENT_REFUNDED": {
        const refundMinor = row.refundedAmountMinor ?? row.totalAmountMinor;
        const personalisation: TicketOrderRefundedPersonalisation = {
          ...buildPaidLikePersonalisation({
            row,
            statusForEmail: TicketOrderStatus.REFUNDED,
            appBaseUrl: options.appBaseUrl,
          }),
          refundFormatted: formatMinorCurrency(refundMinor, row.currency),
        };
        const result = await mailer.sendEmail({
          templateName: "ticketOrderRefunded",
          to: email,
          personalisation,
          reference,
        });
        return { providerMessageId: result.providerNotificationId ?? null };
      }
    }
  };
}

/** Call only inside webhook/callable execution where Gov Notify secrets/env resolve. */
export function defaultWebhookGovNotifyTicketOrderMailer(): TransactionalMailer<TicketOrderTransactionalTemplates> {
  return createConfiguredGovNotifyMailer([...TICKET_ORDER_MAIL_TEMPLATE_KEYS]);
}
