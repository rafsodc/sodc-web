import {
  BookingPaymentAdjustmentStatus,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";

export interface BookingLineSnapshot {
  priceMinor?: number | null;
  ticketType: {
    price: number;
  };
  bookingPlace?: {
    paymentAllocations?: Array<{
      allocatedAmountMinor?: number;
      refundedAmountMinor?: number;
      refundPendingAmountMinor?: number;
      id?: string;
      ticketOrder?: { status?: TicketOrderStatus | string | null } | null;
    }> | null;
  } | null;
}

export interface BookingSnapshot {
  lines?: BookingLineSnapshot[] | null;
}

export interface BookingPaymentDelta {
  previousTotalMinor: number;
  revisedTotalMinor: number;
  deltaAmountMinor: number;
  /** What's still owed on the revised total: the full total if nothing is settled
   *  yet, or just the net increase over an already-settled previous total. */
  paymentRemainingMinor: number;
  settledAmountMinor: number;
  refundedAmountMinor: number;
  pendingRefundAmountMinor: number;
  refundDueMinor: number;
  status: BookingPaymentAdjustmentStatus;
}

function toMinorUnits(value: number): number {
  return Math.round(value * 100);
}

export function bookingLinePriceMinor(line: BookingLineSnapshot): number {
  return line.priceMinor ?? toMinorUnits(line.ticketType.price);
}

export function bookingTotalMinor(booking?: BookingSnapshot | null): number {
  return (booking?.lines ?? []).reduce((acc, line) => acc + bookingLinePriceMinor(line), 0);
}

export interface BookingSettlementTotals {
  grossPaidMinor: number;
  refundedAmountMinor: number;
  pendingRefundAmountMinor: number;
  settledAmountMinor: number;
}

/**
 * Returns the payer's position across a whole revision group. Stable places
 * appear in several revisions, so allocations are deliberately de-duplicated
 * by allocation id before any money is counted.
 */
export function bookingSettlementTotals(bookings: readonly BookingSnapshot[]): BookingSettlementTotals {
  const seen = new Set<string>();
  let anonymousIndex = 0;
  let grossPaidMinor = 0;
  let refundedAmountMinor = 0;
  let pendingRefundAmountMinor = 0;
  for (const booking of bookings) {
    for (const line of booking.lines ?? []) {
      for (const allocation of line.bookingPlace?.paymentAllocations ?? []) {
        const key = allocation.id?.trim() || `anonymous:${anonymousIndex++}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const status = allocation.ticketOrder?.status;
        if (status !== TicketOrderStatus.PAID && status !== TicketOrderStatus.REFUNDED) continue;
        const allocated = Math.max(0, allocation.allocatedAmountMinor ?? 0);
        const refunded = Math.min(allocated, Math.max(0, allocation.refundedAmountMinor ?? 0));
        const pending = Math.min(
          Math.max(0, allocated - refunded),
          Math.max(0, allocation.refundPendingAmountMinor ?? 0)
        );
        grossPaidMinor += allocated;
        refundedAmountMinor += refunded;
        pendingRefundAmountMinor += pending;
      }
    }
  }
  return {
    grossPaidMinor,
    refundedAmountMinor,
    pendingRefundAmountMinor,
    settledAmountMinor: Math.max(0, grossPaidMinor - refundedAmountMinor - pendingRefundAmountMinor),
  };
}

export function computeBookingPaymentDelta(
  previousBooking?: BookingSnapshot | null,
  revisedBooking?: BookingSnapshot | null,
  options?: {
    financialHistory?: readonly BookingSnapshot[];
    /** Organiser amendments expose the whole unpaid balance, including a wholly-unpaid booking. */
    includeUnpaidBalance?: boolean;
  }
): BookingPaymentDelta {
  const previousTotalMinor = bookingTotalMinor(previousBooking);
  const revisedTotalMinor = bookingTotalMinor(revisedBooking);
  const settlement = bookingSettlementTotals(options?.financialHistory ?? (previousBooking ? [previousBooking] : []));
  const netSettledMinor = settlement.settledAmountMinor;
  const paymentRemainingMinor = Math.max(revisedTotalMinor - netSettledMinor, 0);
  const refundDueMinor = Math.max(netSettledMinor - revisedTotalMinor, 0);
  // Keep ordinary wholly-unpaid amendments on the normal unpaid path. Once
  // money has settled, the adjustment represents the member's actual position,
  // not the face-value difference between revisions.
  const deltaAmountMinor = (!options?.includeUnpaidBalance && netSettledMinor === 0) || (paymentRemainingMinor === 0 && refundDueMinor === 0)
    ? 0
    : paymentRemainingMinor > 0
      ? paymentRemainingMinor
      : -refundDueMinor;
  const status =
    deltaAmountMinor < 0
      ? BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND
      : deltaAmountMinor > 0
        ? BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE
        : BookingPaymentAdjustmentStatus.NOT_REQUIRED;
  return {
    previousTotalMinor,
    revisedTotalMinor,
    deltaAmountMinor,
    paymentRemainingMinor,
    settledAmountMinor: netSettledMinor,
    refundedAmountMinor: settlement.refundedAmountMinor,
    pendingRefundAmountMinor: settlement.pendingRefundAmountMinor,
    refundDueMinor,
    status,
  };
}
