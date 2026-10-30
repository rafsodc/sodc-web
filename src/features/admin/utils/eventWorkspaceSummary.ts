import type { EventBookingAdminRow, TicketOrderAdminRow } from "../components/sectionEventsManagerTypes";
import type { Guest } from "../../guests/api";
import { currentActiveBookings, pendingBookingRevisions, type TicketOrdersById } from "./bookingApprovalsAdmin";

export interface RequiredEventPayment {
  key: string;
  kind: "booking" | "organiser-guest";
  bookingId: string;
  ownerName: string;
  ownerEmail: string | null;
  revisionNumber: number | null;
  ticketCount: number;
  outstandingAmountPence: number;
  paymentPending: boolean;
}

/** Current payable places follow checkout eligibility; historical payments remain in the records view. */
export function getEventWorkspaceSummary(
  bookings: readonly EventBookingAdminRow[],
  ordersById: TicketOrdersById,
  guests: readonly Guest[] = [],
) {
  const active = currentActiveBookings(bookings);
  const requiredPayments: RequiredEventPayment[] = [];
  let unknownPaymentTicketCount = 0;
  for (const booking of active) {
    let outstandingAmountPence = 0;
    let ticketCount = 0;
    let paymentPending = false;
    for (const line of booking.lines) {
      if (line.bookingPlace?.attendanceRemoved) continue;
      if (line.ticketType.price <= 0) continue;
      const allocations = line.bookingPlace?.paymentAllocations ?? [];
      if (allocations.some((allocation) => !ordersById.has(allocation.ticketOrderId))) {
        unknownPaymentTicketCount += 1;
        continue;
      }
      const settled = allocations.reduce((total, allocation) => {
        const status = ordersById.get(allocation.ticketOrderId)?.status;
        return total + (status === "PAID" || status === "REFUNDED" ? Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor) : 0);
      }, 0);
      const remaining = Math.max(0, Math.round(line.ticketType.price * 100) - settled);
      if (!remaining) continue;
      outstandingAmountPence += remaining;
      ticketCount += 1;
      paymentPending ||= allocations.some((allocation) => ordersById.get(allocation.ticketOrderId)?.status === "PENDING" && allocation.allocatedAmountMinor > allocation.refundedAmountMinor);
    }
    if (ticketCount) requiredPayments.push({ key: booking.id, kind: "booking", bookingId: booking.id,
      ownerName: `${booking.booker.firstName} ${booking.booker.lastName}`.trim(), ownerEmail: booking.booker.email || null,
      revisionNumber: booking.revisionNumber, ticketCount, outstandingAmountPence, paymentPending });
  }
  const currentGuests = guests.filter((guest) => !guest.cancelled);
  for (const guest of currentGuests) {
    if (guest.paymentStatus !== "UNPAID" || guest.priceMinor <= 0) continue;
    requiredPayments.push({ key: `organiser:${guest.id}`, kind: "organiser-guest", bookingId: guest.id,
      ownerName: `${guest.firstName} ${guest.lastName}`.trim(), ownerEmail: guest.email,
      revisionNumber: null, ticketCount: 1, outstandingAmountPence: guest.priceMinor, paymentPending: false });
  }
  return {
    activeTicketCount: active.reduce((count, booking) => count + booking.lines.filter((line) => !line.bookingPlace?.attendanceRemoved).length, 0) + currentGuests.length,
    pendingRevisionCount: pendingBookingRevisions(bookings).length,
    outstandingAmountPence: requiredPayments.reduce((total, payment) => total + payment.outstandingAmountPence, 0),
    outstandingTicketCount: requiredPayments.reduce((total, payment) => total + payment.ticketCount, 0),
    unknownPaymentTicketCount,
    requiredPayments,
  };
}


/** Order totals already include quantity. Guest cash uses its separate GBP payment domain. */
export function getSettledEventPayments(
  ticketOrders: readonly TicketOrderAdminRow[],
  guests: readonly Guest[] = [],
) {
  const byCurrency = new Map<string, number>();
  let bookingOrdersEvidenceIncomplete = false;
  for (const order of ticketOrders) {
    if (order.status !== "PAID" && order.status !== "REFUNDED") continue;
    if ((order.status === "REFUNDED" || order.stripeRefundId || order.refundedAt) && order.refundedAmountMinor == null) {
      bookingOrdersEvidenceIncomplete = true;
      continue;
    }
    const currency = order.currency.trim().toUpperCase();
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + Math.max(0, order.totalAmountMinor - (order.refundedAmountMinor ?? 0)));
  }
  const bookingOrdersByCurrency = Array.from(byCurrency, ([currency, amountMinor]) => ({ currency, amountMinor })).sort((left, right) => left.currency.localeCompare(right.currency));
  let organiserGuestAmountPence: number | null = 0;
  for (const guest of guests) {
    if (guest.paymentStatus === "FREE" || guest.paymentStatus === "UNPAID") continue;
    // These four projection branches require paidAt. REFUND_PENDING does not
    // expose enough evidence in Guest to assert that the original funds settled.
    if (!["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_REQUIRED"].includes(guest.paymentStatus)) {
      organiserGuestAmountPence = null;
      break;
    }
    organiserGuestAmountPence += Math.max(0, guest.priceMinor - guest.refundedAmountMinor);
  }
  return { bookingOrdersByCurrency, bookingOrdersEvidenceIncomplete, organiserGuestAmountPence };
}
