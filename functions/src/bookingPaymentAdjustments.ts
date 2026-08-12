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

function lineIsSettled(line: BookingLineSnapshot): boolean {
  return (line.bookingPlace?.paymentAllocations ?? []).some((allocation) => {
    const status = allocation.ticketOrder?.status;
    const settled = status === TicketOrderStatus.PAID || status === TicketOrderStatus.REFUNDED;
    const netPaidMinor = (allocation.allocatedAmountMinor ?? 0) - (allocation.refundedAmountMinor ?? 0);
    return settled && netPaidMinor > 0;
  });
}

function bookingHasSettledPayment(booking?: BookingSnapshot | null): boolean {
  return (booking?.lines ?? []).some(lineIsSettled);
}

/** Sum of previous-booking lines that are individually settled — not just "some line is
 *  paid" — so a still-unpaid line from an earlier, unresolved revision isn't dropped
 *  when a later revision is submitted on top of it. */
function settledTotalMinor(booking?: BookingSnapshot | null): number {
  return (booking?.lines ?? []).reduce(
    (acc, line) => acc + (lineIsSettled(line) ? toMinorUnits(line.ticketType.price) : 0),
    0
  );
}

export function computeBookingPaymentDelta(
  previousBooking?: BookingSnapshot | null,
  revisedBooking?: BookingSnapshot | null
): BookingPaymentDelta {
  const previousTotalMinor = bookingTotalMinor(previousBooking);
  const revisedTotalMinor = bookingTotalMinor(revisedBooking);
  const hasSettledPayment = bookingHasSettledPayment(previousBooking);
  // An unpaid booking has no payment position to adjust. Its revised total is
  // collected by normal checkout, rather than presented as an incremental
  // charge/refund against money that was never received.
  const deltaAmountMinor = hasSettledPayment ? revisedTotalMinor - previousTotalMinor : 0;
  const status =
    deltaAmountMinor < 0
      ? BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND
      : deltaAmountMinor > 0
        ? BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE
        : BookingPaymentAdjustmentStatus.NOT_REQUIRED;
  // What's actually been settled carries forward per line, not per booking — an
  // earlier revision's still-unpaid line stays owed even once a different line on
  // the same booking is paid, and even across a further revision submitted on top
  // of it before that earlier amount was ever resolved.
  const paymentRemainingMinor = Math.max(revisedTotalMinor - settledTotalMinor(previousBooking), 0);
  return { previousTotalMinor, revisedTotalMinor, deltaAmountMinor, paymentRemainingMinor, status };
}
