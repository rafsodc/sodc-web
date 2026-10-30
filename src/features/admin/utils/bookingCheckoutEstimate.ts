import type { EventBookingAdminRow } from "../components/sectionEventsManagerTypes";
import type { TicketOrdersById } from "./bookingApprovalsAdmin";

/** Mirrors checkout's place-specific refund and shortfall plans, without moving money. */
export function getBookingCheckoutEstimate(
  proposed: Pick<EventBookingAdminRow, "lines">,
  ordersById: TicketOrdersById,
) {
  let toPayMinor = 0;
  let refundDueMinor = 0;
  let unknownPaymentPlaceCount = 0;
  let hasPendingPayments = false;
  for (const line of proposed.lines) {
    if (line.bookingPlace?.attendanceRemoved) continue;
    const allocations = line.bookingPlace?.paymentAllocations;
    if (!Array.isArray(allocations) || !Number.isFinite(line.ticketType.price) || line.ticketType.price < 0 || allocations.some((allocation) =>
      !ordersById.has(allocation.ticketOrderId) ||
      !Number.isSafeInteger(allocation.allocatedAmountMinor) || allocation.allocatedAmountMinor < 0 ||
      !Number.isSafeInteger(allocation.refundedAmountMinor) || allocation.refundedAmountMinor < 0 || allocation.refundedAmountMinor > allocation.allocatedAmountMinor
    )) {
      unknownPaymentPlaceCount += 1;
      continue;
    }
    const settledMinor = allocations.reduce((amount, allocation) => {
      const status = ordersById.get(allocation.ticketOrderId)?.status;
      return amount + (status === "PAID" || status === "REFUNDED" ? Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor) : 0);
    }, 0);
    const requiredMinor = Math.round(line.ticketType.price * 100);
    // Refunds remain attached to their original place. Excess on one place
    // cannot pay for a new or upgraded place when checkout creates its orders.
    refundDueMinor += Math.max(0, settledMinor - requiredMinor);
    toPayMinor += Math.max(0, requiredMinor - settledMinor);
    hasPendingPayments ||= allocations.some((allocation) => ordersById.get(allocation.ticketOrderId)?.status === "PENDING" && allocation.allocatedAmountMinor > allocation.refundedAmountMinor);
  }
  return {
    refundDueMinor: unknownPaymentPlaceCount ? null : refundDueMinor,
    toPayMinor: unknownPaymentPlaceCount ? null : toPayMinor,
    unknownPaymentPlaceCount,
    hasPendingPayments,
  };
}
