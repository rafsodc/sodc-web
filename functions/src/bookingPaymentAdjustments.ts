import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";

interface BookingLineSnapshot {
  ticketType: {
    price: number;
  };
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

export function computeBookingPaymentDelta(
  previousBooking?: BookingSnapshot | null,
  revisedBooking?: BookingSnapshot | null
): BookingPaymentDelta {
  const previousTotalMinor = bookingTotalMinor(previousBooking);
  const revisedTotalMinor = bookingTotalMinor(revisedBooking);
  const deltaAmountMinor = revisedTotalMinor - previousTotalMinor;
  const status =
    deltaAmountMinor < 0
      ? BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND
      : deltaAmountMinor > 0
        ? BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE
        : BookingPaymentAdjustmentStatus.NOT_REQUIRED;
  return { previousTotalMinor, revisedTotalMinor, deltaAmountMinor, status };
}
