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
  status: BookingPaymentAdjustmentStatus;
}

function toMinorUnits(value: number): number {
  return Math.round(value * 100);
}

function bookingTotalMinor(booking?: BookingSnapshot | null): number {
  return (booking?.lines ?? []).reduce((acc, line) => acc + toMinorUnits(line.ticketType.price), 0);
}

function bookingHasSettledPayment(booking?: BookingSnapshot | null): boolean {
  return (booking?.lines ?? []).some((line) =>
    (line.bookingPlace?.paymentAllocations ?? []).some((allocation) => {
      const status = allocation.ticketOrder?.status;
      const settled = status === TicketOrderStatus.PAID || status === TicketOrderStatus.REFUNDED;
      const netPaidMinor =
        (allocation.allocatedAmountMinor ?? 0) - (allocation.refundedAmountMinor ?? 0);
      return settled && netPaidMinor > 0;
    })
  );
}

export function computeBookingPaymentDelta(
  previousBooking?: BookingSnapshot | null,
  revisedBooking?: BookingSnapshot | null
): BookingPaymentDelta {
  const previousTotalMinor = bookingTotalMinor(previousBooking);
  const revisedTotalMinor = bookingTotalMinor(revisedBooking);
  // An unpaid booking has no payment position to adjust. Its revised total is
  // collected by normal checkout, rather than presented as an incremental
  // charge/refund against money that was never received.
  const deltaAmountMinor = bookingHasSettledPayment(previousBooking)
    ? revisedTotalMinor - previousTotalMinor
    : 0;
  const status =
    deltaAmountMinor < 0
      ? BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND
      : deltaAmountMinor > 0
        ? BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE
        : BookingPaymentAdjustmentStatus.NOT_REQUIRED;
  return { previousTotalMinor, revisedTotalMinor, deltaAmountMinor, status };
}
