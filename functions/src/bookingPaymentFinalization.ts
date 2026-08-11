import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  getBookingsForBookerAndEvent,
  settleBookingPaymentAdjustmentsFromCallable,
  updateBookingStatusFromCallable,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  bookingIsFullyPaid,
  selectLatestPaymentEligibleBooking,
} from "./bookingCheckout";

export interface BookingPaymentFinalizationDependencies {
  getBookings: typeof getBookingsForBookerAndEvent;
  updateBookingStatus: typeof updateBookingStatusFromCallable;
  settleAdjustments: typeof settleBookingPaymentAdjustmentsFromCallable;
}

const defaultDependencies: BookingPaymentFinalizationDependencies = {
  getBookings: getBookingsForBookerAndEvent,
  updateBookingStatus: updateBookingStatusFromCallable,
  settleAdjustments: settleBookingPaymentAdjustmentsFromCallable,
};

/** Confirms only the latest active, approval-eligible revision once every exact place is paid. */
export async function confirmBookingIfFullyPaid(
  args: { bookerId: string; eventId: UUIDString },
  dependencies: BookingPaymentFinalizationDependencies = defaultDependencies
): Promise<{ bookingId: UUIDString | null; confirmed: boolean }> {
  const result = await dependencies.getBookings(args);
  const booking = selectLatestPaymentEligibleBooking(result.data?.user?.bookings ?? []);
  if (!booking || !bookingIsFullyPaid(booking)) {
    return { bookingId: booking?.id ?? null, confirmed: false };
  }
  if (booking.status !== BookingStatus.CONFIRMED) {
    await dependencies.updateBookingStatus({ id: booking.id, status: BookingStatus.CONFIRMED });
  }
  await dependencies.settleAdjustments({
    revisionBookingId: booking.id,
    status: BookingPaymentAdjustmentStatus.SETTLED,
  });
  return { bookingId: booking.id, confirmed: true };
}
