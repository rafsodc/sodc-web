import {
  BookingPaymentAdjustmentStatus,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";

interface BookingLineSnapshot {
  ticketType: {
    price: number;
  };
  bookingPlace?: {
    paymentAllocations?: Array<{
      allocatedAmountMinor?: number;
      refundedAmountMinor?: number;
      ticketOrder?: { status?: TicketOrderStatus | string | null } | null;
    }> | null;
  } | null;
}

interface BookingSnapshot {
  lines?: BookingLineSnapshot[] | null;
}

export interface BookingPaymentDelta {
  previousTotalMinor: number;
  revisedTotalMinor: number;
  deltaAmountMinor: number;
  /** What's still owed on the revised total: the full total if nothing is settled
   *  yet, or just the net increase over an already-settled previous total. */
  paymentRemainingMinor: number;
  status: BookingPaymentAdjustmentStatus;
}

function toMinorUnits(value: number): number {
  return Math.round(value * 100);
}

function bookingTotalMinor(booking?: BookingSnapshot | null): number {
  return (booking?.lines ?? []).reduce((acc, line) => acc + toMinorUnits(line.ticketType.price), 0);
}

function lineNetSettledMinor(line: BookingLineSnapshot): number {
  return (line.bookingPlace?.paymentAllocations ?? []).reduce((total, allocation) => {
    const status = allocation.ticketOrder?.status;
    const settled = status === TicketOrderStatus.PAID || status === TicketOrderStatus.REFUNDED;
    const netPaidMinor = (allocation.allocatedAmountMinor ?? 0) - (allocation.refundedAmountMinor ?? 0);
    return total + (settled ? Math.max(0, netPaidMinor) : 0);
  }, 0);
}

function settledTotalMinor(booking?: BookingSnapshot | null): number {
  return (booking?.lines ?? []).reduce((total, line) => total + lineNetSettledMinor(line), 0);
}

export function computeBookingPaymentDelta(
  previousBooking?: BookingSnapshot | null,
  revisedBooking?: BookingSnapshot | null
): BookingPaymentDelta {
  const previousTotalMinor = bookingTotalMinor(previousBooking);
  const revisedTotalMinor = bookingTotalMinor(revisedBooking);
  const netSettledMinor = settledTotalMinor(previousBooking);
  const paymentRemainingMinor = Math.max(revisedTotalMinor - netSettledMinor, 0);
  const refundDueMinor = Math.max(netSettledMinor - revisedTotalMinor, 0);
  // Keep ordinary wholly-unpaid amendments on the normal unpaid path. Once
  // money has settled, the adjustment represents the member's actual position,
  // not the face-value difference between revisions.
  const deltaAmountMinor = netSettledMinor === 0 || (paymentRemainingMinor === 0 && refundDueMinor === 0)
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
  return { previousTotalMinor, revisedTotalMinor, deltaAmountMinor, paymentRemainingMinor, status };
}
