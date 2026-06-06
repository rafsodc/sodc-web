import { TicketOrderStatus } from "@dataconnect/generated";
import { getBookingPaymentAdjustmentStatusLabel } from "../../../shared/utils/paymentStatusLabels";

export interface TicketOrderDisplayInput {
  status: string;
  currency: string;
  totalAmountMinor: number;
  refundedAmountMinor?: number | null;
  disputeStatus?: string | null;
  disputeReason?: string | null;
}

export function formatPaymentAmount(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
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
