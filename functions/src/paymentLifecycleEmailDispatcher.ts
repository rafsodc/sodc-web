import * as logger from "firebase-functions/logger";
import { getTicketOrderForWebhook } from "@dataconnect/admin-generated";
import {
  type GetTicketOrderForWebhookData,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  createConfiguredGovNotifyMailer,
  type TransactionalMailer,
} from "./mailer";
import type { PaymentLifecycleNotification } from "./paymentNotifications";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";

export const TICKET_ORDER_MAIL_TEMPLATE_KEYS = ["ticketOrderPaid", "ticketOrderFailed", "ticketOrderRefunded"] as const;

export type TicketOrderPaidPersonalisation = {
  firstName: string;
  eventTitle: string;
  eventDateTime: string;
  eventLocation: string;
  ticketTypeTitle: string;
  quantity: number;
  totalFormatted: string;
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
  const currencyCode = currency.trim().toUpperCase();
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currencyCode}`;
  }
}

export function formatTransactionalEventDateTime(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDateTime} – ${endDateTime}`;
  }
  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const timeFormat = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/London",
  });
  if (dateKeyFormat.format(start) === dateKeyFormat.format(end)) {
    return `${dateFormat.format(start)}, ${timeFormat.format(start)} – ${timeFormat.format(end)}`;
  }
  return `${dateFormat.format(start)}, ${timeFormat.format(start)} – ${dateFormat.format(end)}, ${timeFormat.format(end)}`;
}

function buildPaidLikePersonalisation(args: {
  row: TicketOrderWebhookRow;
  appBaseUrl: string;
}): TicketOrderPaidPersonalisation {
  const { row, appBaseUrl } = args;
  const base = normaliseAppBaseUrl(appBaseUrl);
  const fn = row.user.firstName?.trim();
  const firstName = fn && fn.length > 0 ? fn : "Member";
  return {
    firstName,
    eventTitle: row.event.title ?? "",
    eventDateTime: formatTransactionalEventDateTime(
      row.event.startDateTime,
      row.event.endDateTime,
    ),
    eventLocation: row.event.location?.trim() || "To be confirmed",
    ticketTypeTitle: row.ticketType.title ?? "",
    quantity: row.quantity,
    totalFormatted: formatMinorCurrency(row.totalAmountMinor, row.currency),
    myPaymentsUrl: `${base}/payments`,
  };
}

export interface GovNotifyTicketOrderLifecycleDispatcherOptions {
  getMailer: () => TransactionalMailer<TicketOrderTransactionalTemplates>;
  appBaseUrl: string;
}

export function createGovNotifyTicketOrderLifecycleDispatcher(
  options: GovNotifyTicketOrderLifecycleDispatcherOptions
): (
  notification: PaymentLifecycleNotification,
  deliveryMode?: GovNotifyDeliveryMode,
) => Promise<{ providerMessageId?: string | null; deliveryMode?: GovNotifyDeliveryMode }> {
  return async (notification: PaymentLifecycleNotification, deliveryMode?: GovNotifyDeliveryMode) => {
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
          appBaseUrl: options.appBaseUrl,
        });
        const result = await mailer.sendEmail({
          templateName: "ticketOrderPaid",
          to: email,
          personalisation,
          reference,
          requestedDeliveryMode: deliveryMode,
        });
        return {
          providerMessageId: result.providerNotificationId ?? null,
          deliveryMode: result.deliveryMode?.effectiveMode,
        };
      }
      case "PAYMENT_FAILED": {
        const personalisation = buildPaidLikePersonalisation({
          row,
          appBaseUrl: options.appBaseUrl,
        });
        const result = await mailer.sendEmail({
          templateName: "ticketOrderFailed",
          to: email,
          personalisation,
          reference,
          requestedDeliveryMode: deliveryMode,
        });
        return {
          providerMessageId: result.providerNotificationId ?? null,
          deliveryMode: result.deliveryMode?.effectiveMode,
        };
      }
      case "PAYMENT_REFUNDED": {
        const refundMinor = row.refundedAmountMinor ?? row.totalAmountMinor;
        const personalisation: TicketOrderRefundedPersonalisation = {
          ...buildPaidLikePersonalisation({
            row,
            appBaseUrl: options.appBaseUrl,
          }),
          refundFormatted: formatMinorCurrency(refundMinor, row.currency),
        };
        const result = await mailer.sendEmail({
          templateName: "ticketOrderRefunded",
          to: email,
          personalisation,
          reference,
          requestedDeliveryMode: deliveryMode,
        });
        return {
          providerMessageId: result.providerNotificationId ?? null,
          deliveryMode: result.deliveryMode?.effectiveMode,
        };
      }
    }
  };
}

/** Call only inside webhook/callable execution where Gov Notify secrets/env resolve. */
export function defaultWebhookGovNotifyTicketOrderMailer(): TransactionalMailer<TicketOrderTransactionalTemplates> {
  return createConfiguredGovNotifyMailer([...TICKET_ORDER_MAIL_TEMPLATE_KEYS]);
}
