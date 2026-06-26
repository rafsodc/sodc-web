import { TicketOrderStatus } from "@dataconnect/generated";
import { formatPaymentAmount } from "../../../shared/utils/currencyDisplay";
import { uuidsEqual } from "../../../shared/utils/uuid";
import { getBookingPaymentAdjustmentStatusLabel } from "../../../shared/utils/paymentStatusLabels";

export { formatPaymentAmount };

export interface TicketOrderDisplayInput {
  status: string;
  currency: string;
  totalAmountMinor: number;
  refundedAmountMinor?: number | null;
  disputeStatus?: string | null;
  disputeReason?: string | null;
}

export interface TicketOrderListRow extends TicketOrderDisplayInput {
  id: string;
  quantity: number;
  updatedAt: string;
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  ticketType?: { id?: string; title?: string | null } | null;
  event?: { id?: string; title?: string | null; startDateTime?: string | null } | null;
}

export interface TicketOrderDisplayGroup {
  key: string;
  orders: TicketOrderListRow[];
  status: string;
  currency: string;
  totalAmountMinor: number;
  eventTitle: string;
  eventWhen: string | null;
  receiptOrderId: string;
  ticketSummary: string;
}

export function isSupersededFailedTicketOrder(order: TicketOrderListRow, orders: TicketOrderListRow[]): boolean {
  if (order.status !== TicketOrderStatus.FAILED) {
    return false;
  }
  const ticketTypeId = order.ticketType?.id;
  const eventId = order.event?.id;
  if (!ticketTypeId || !eventId) {
    return false;
  }
  const failedAt = Date.parse(order.updatedAt);
  return orders.some((candidate) => {
    if (candidate.status !== TicketOrderStatus.PAID) {
      return false;
    }
    if (!uuidsEqual(candidate.event?.id, eventId) || !uuidsEqual(candidate.ticketType?.id, ticketTypeId)) {
      return false;
    }
    return Date.parse(candidate.updatedAt) >= failedAt || !order.stripePaymentIntentId;
  });
}

function paymentGroupKey(order: TicketOrderListRow): string {
  if (order.stripePaymentIntentId) {
    return `pi:${order.stripePaymentIntentId}`;
  }
  if (order.stripeCheckoutSessionId) {
    return `cs:${order.stripeCheckoutSessionId}`;
  }
  return `order:${order.id}`;
}

function summarizeTicketLines(orders: TicketOrderListRow[]): string {
  return orders
    .map((order) => {
      const title = order.ticketType?.title ?? "Ticket";
      return order.quantity > 1 ? `${title} × ${order.quantity}` : title;
    })
    .join(", ");
}

export function groupTicketOrdersForDisplay(orders: TicketOrderListRow[]): TicketOrderDisplayGroup[] {
  const visibleOrders = orders.filter((order) => !isSupersededFailedTicketOrder(order, orders));
  const groups = new Map<string, TicketOrderListRow[]>();

  for (const order of visibleOrders) {
    const sharedStripeKey =
      order.stripePaymentIntentId || order.stripeCheckoutSessionId ? paymentGroupKey(order) : null;
    const key = sharedStripeKey ?? `order:${order.id}`;
    const existing = groups.get(key) ?? [];
    existing.push(order);
    groups.set(key, existing);
  }

  return [...groups.values()].map((groupOrders) => {
    const sorted = [...groupOrders].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const primary = sorted[0];
    const totalAmountMinor = sorted.reduce((sum, order) => sum + order.totalAmountMinor, 0);
    const allPaid = sorted.every((order) => order.status === TicketOrderStatus.PAID);
    const anyFailed = sorted.some((order) => order.status === TicketOrderStatus.FAILED);
    const status = allPaid
      ? TicketOrderStatus.PAID
      : anyFailed
        ? TicketOrderStatus.FAILED
        : primary.status;
    const receiptOrderId =
      sorted.find((order) => order.stripeCheckoutSessionId)?.id ??
      sorted.find((order) => order.stripePaymentIntentId)?.id ??
      primary.id;

    return {
      key: paymentGroupKey(primary),
      orders: sorted,
      status,
      currency: primary.currency,
      totalAmountMinor,
      eventTitle: primary.event?.title ?? "Event ticket",
      eventWhen: primary.event?.startDateTime ?? null,
      receiptOrderId,
      ticketSummary: summarizeTicketLines(sorted),
    };
  });
}

export function getTicketOrderOutcomeMessage(order: TicketOrderDisplayInput): string {
  if (order.status === TicketOrderStatus.FAILED) {
    return "Your payment did not go through. You can try again from the event page.";
  }
  if (order.status === TicketOrderStatus.REFUNDED) {
    const refunded = order.refundedAmountMinor ?? order.totalAmountMinor;
    return `We refunded ${formatPaymentAmount(refunded, order.currency)} to your payment method.`;
  }
  if (order.status === TicketOrderStatus.PENDING) {
    return "Waiting for your payment to complete.";
  }
  if (order.disputeStatus) {
    const reason = order.disputeReason ? ` (${order.disputeReason})` : "";
    return `There is an open dispute on this payment: ${order.disputeStatus}${reason}.`;
  }
  if (order.status === TicketOrderStatus.PAID) {
    return "Payment received. Your ticket is confirmed once booking is complete.";
  }
  return "Payment update recorded.";
}

export function getBookingAdjustmentSummary(params: {
  eventTitle: string;
  revisionNumber: number;
  deltaAmountMinor: number;
  status: string;
}): string {
  const amount = formatPaymentAmount(Math.abs(params.deltaAmountMinor), "gbp");
  const direction = params.deltaAmountMinor < 0 ? "refund" : "charge";
  const statusLabel = getBookingPaymentAdjustmentStatusLabel(params.status).toLowerCase();
  return `${params.eventTitle} (revision ${params.revisionNumber}): ${statusLabel} — ${direction} of ${amount}.`;
}

export function ticketOrderStatusChipColor(
  status: string
): "success" | "error" | "warning" | "default" {
  if (status === TicketOrderStatus.PAID) return "success";
  if (status === TicketOrderStatus.FAILED) return "error";
  if (status === TicketOrderStatus.REFUNDED) return "warning";
  return "default";
}
