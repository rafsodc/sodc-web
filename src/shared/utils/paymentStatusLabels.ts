import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  TicketOrderStatus,
} from "@dataconnect/generated";

const TICKET_ORDER_STATUS_LABELS: Record<TicketOrderStatus, string> = {
  [TicketOrderStatus.PENDING]: "Pending payment",
  [TicketOrderStatus.PAID]: "Paid",
  [TicketOrderStatus.FAILED]: "Payment failed",
  [TicketOrderStatus.REFUNDED]: "Refunded",
};

const BOOKING_PAYMENT_ADJUSTMENT_STATUS_LABELS: Record<BookingPaymentAdjustmentStatus, string> = {
  [BookingPaymentAdjustmentStatus.NOT_REQUIRED]: "No payment change",
  [BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND]: "Refund pending",
  [BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE]: "Additional payment pending",
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.DRAFT]: "Draft",
  [BookingStatus.SUBMITTED]: "Submitted",
  [BookingStatus.CONFIRMED]: "Confirmed",
  [BookingStatus.CANCELLED]: "Cancelled",
};

export function getTicketOrderStatusLabel(status: TicketOrderStatus | string): string {
  return TICKET_ORDER_STATUS_LABELS[status as TicketOrderStatus] ?? String(status);
}

export function getBookingPaymentAdjustmentStatusLabel(
  status: BookingPaymentAdjustmentStatus | string
): string {
  return (
    BOOKING_PAYMENT_ADJUSTMENT_STATUS_LABELS[status as BookingPaymentAdjustmentStatus] ??
    String(status).replaceAll("_", " ").toLowerCase()
  );
}

export function getBookingStatusLabel(status: BookingStatus | string): string {
  return BOOKING_STATUS_LABELS[status as BookingStatus] ?? String(status).toLowerCase();
}
