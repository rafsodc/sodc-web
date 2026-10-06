import { TicketOrderStatus } from "@dataconnect/admin-generated";
import type {
  GetTicketOrdersForBookerAndEventData,
} from "@dataconnect/admin-generated";
import { bookingApprovalAllowsPayment } from "./bookingRules";
import type { HydratedBookingRow } from "./bookingQueryHydration";
import { bookingLinePriceMinor, bookingSettlementTotals } from "./bookingPaymentAdjustments";

type BookingRow = HydratedBookingRow;
type TicketOrderRow = NonNullable<GetTicketOrdersForBookerAndEventData["user"]>["ticketOrders"][number];

export interface BookingCheckoutPlaceItem {
  bookingPlaceId: string;
  ticketTypeId: string;
  title: string;
  unitAmountMinor: number;
}

export interface CheckoutOrderLine {
  ticketTypeId: string;
  bookingPlaceIds: string[];
  quantity: number;
  title: string;
  unitAmountMinor: number;
  existingOrderId: string | null;
}

export interface BookingAllocationRefund {
  allocationId: string;
  ticketOrderId: string;
  stripePaymentIntentId: string | null;
  amountMinor: number;
  resultingRefundedAmountMinor: number;
  resultingPendingAmountMinor: number;
  previousStripeRefundId: string | null;
}

function normalizeUuidKey(id: string): string {
  return id.trim().replace(/-/g, "").toLowerCase();
}

export function bookingIdsEqual(a: string, b: string): boolean {
  return normalizeUuidKey(a) === normalizeUuidKey(b);
}

/**
 * Pending revisions intentionally leave the prior payable revision active.
 * Checkout therefore selects the newest non-superseded revision whose own
 * approval decision permits payment, never the newest revision indiscriminately.
 */
export function selectLatestPaymentEligibleBooking(bookings: BookingRow[]): BookingRow | null {
  const eligible = bookings.filter(
    (booking) =>
      (booking.status === "SUBMITTED" || booking.status === "CONFIRMED") &&
      booking.supersededAt == null &&
      bookingApprovalAllowsPayment(booking.approvalStatus)
  );
  return eligible.reduce<BookingRow | null>((latest, booking) => {
    if (!latest) return booking;
    return booking.revisionNumber > latest.revisionNumber ? booking : latest;
  }, null);
}

/** Plans allocation-specific refunds against the net position of one revision group. */
export function planBookingAllocationRefunds(
  booking: BookingRow,
  financialHistory: readonly BookingRow[] = [booking]
): BookingAllocationRefund[] {
  const refunds: BookingAllocationRefund[] = [];
  const requiredTotalMinor = booking.lines.reduce(
    (total, line) => total + bookingLinePriceMinor(line),
    0
  );
  let excessAmountMinor = Math.max(
    0,
    bookingSettlementTotals(financialHistory).settledAmountMinor - requiredTotalMinor
  );
  const seen = new Set<string>();
  const refundable = financialHistory
    .flatMap((row) => row.lines)
    .flatMap((line) => line.bookingPlace.paymentAllocations ?? [])
    .filter((allocation) => {
      if (seen.has(allocation.id)) return false;
      seen.add(allocation.id);
      return (
        (allocation.ticketOrder.status === TicketOrderStatus.PAID ||
          allocation.ticketOrder.status === TicketOrderStatus.REFUNDED) &&
        allocation.allocatedAmountMinor >
          allocation.refundedAmountMinor + (allocation.refundPendingAmountMinor ?? 0)
      );
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  for (const allocation of refundable) {
    if (excessAmountMinor === 0) break;
    const pending = allocation.refundPendingAmountMinor ?? 0;
    const available = allocation.allocatedAmountMinor - allocation.refundedAmountMinor - pending;
    const amountMinor = Math.min(excessAmountMinor, available);
    refunds.push({
      allocationId: allocation.id,
      ticketOrderId: allocation.ticketOrder.id,
      stripePaymentIntentId: allocation.ticketOrder.stripePaymentIntentId ?? null,
      amountMinor,
      resultingRefundedAmountMinor: allocation.refundedAmountMinor + amountMinor,
      resultingPendingAmountMinor: pending + amountMinor,
      previousStripeRefundId: allocation.stripeRefundId ?? null,
    });
    excessAmountMinor -= amountMinor;
  }
  return refunds;
}

export function bookingIsFullyPaid(
  booking: BookingRow,
  financialHistory: readonly BookingRow[] = [booking]
): boolean {
  const required = booking.lines.reduce((total, line) => total + bookingLinePriceMinor(line), 0);
  return booking.lines.length > 0 && bookingSettlementTotals(financialHistory).settledAmountMinor >= required;
}

/** Applies the booking/payer's settled credit once, then returns the exact current places to charge. */
export function computeUnpaidBookingCheckoutItems(
  booking: BookingRow,
  financialHistory: readonly BookingRow[] = [booking]
): BookingCheckoutPlaceItem[] {
  const items: BookingCheckoutPlaceItem[] = [];
  let availableCreditMinor = bookingSettlementTotals(financialHistory).settledAmountMinor;
  for (const line of booking.lines) {
    const bookingPlaceId = line.bookingPlace.id;
    const requiredAmountMinor = bookingLinePriceMinor(line);
    const appliedCreditMinor = Math.min(requiredAmountMinor, availableCreditMinor);
    availableCreditMinor -= appliedCreditMinor;
    const remainingAmountMinor = requiredAmountMinor - appliedCreditMinor;
    if (remainingAmountMinor === 0 && requiredAmountMinor > 0) continue;
    items.push({
      bookingPlaceId,
      ticketTypeId: line.ticketType.id,
      title: line.ticketType.title,
      unitAmountMinor: remainingAmountMinor,
    });
  }
  return items;
}

function pendingOrderPlaceIds(order: TicketOrderRow): string[] {
  return (order.paymentAllocations ?? []).map((allocation) => allocation.bookingPlace.id);
}

/**
 * Reuses a pending order only when every allocation still maps to an exact
 * unpaid place at the same price. Remaining places are grouped by ticket type
 * and price, but retain their individual allocation identities.
 */
export function planCheckoutOrderLines(
  unpaidItems: BookingCheckoutPlaceItem[],
  ticketOrders: TicketOrderRow[]
): CheckoutOrderLine[] {
  const remaining = new Map(unpaidItems.map((item) => [normalizeUuidKey(item.bookingPlaceId), item]));
  const lines: CheckoutOrderLine[] = [];
  const pending = ticketOrders
    .filter((order) => order.status === TicketOrderStatus.PENDING && order.unitAmountMinor > 0)
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

  for (const order of pending) {
    const placeIds = pendingOrderPlaceIds(order);
    if (placeIds.length === 0 || placeIds.length !== Math.max(1, order.quantity ?? 1)) continue;
    const items = placeIds.map((id) => remaining.get(normalizeUuidKey(id)));
    if (items.some((item) => !item)) continue;
    const resolved = items as BookingCheckoutPlaceItem[];
    const matches = resolved.every(
      (item) =>
        bookingIdsEqual(item.ticketTypeId, order.ticketType.id) &&
        item.unitAmountMinor === order.unitAmountMinor
    );
    if (!matches) continue;

    lines.push({
      ticketTypeId: resolved[0]!.ticketTypeId,
      bookingPlaceIds: placeIds,
      quantity: placeIds.length,
      title: resolved[0]!.title,
      unitAmountMinor: resolved[0]!.unitAmountMinor,
      existingOrderId: order.id,
    });
    for (const id of placeIds) remaining.delete(normalizeUuidKey(id));
  }

  const groups = new Map<string, BookingCheckoutPlaceItem[]>();
  for (const item of remaining.values()) {
    const key = `${normalizeUuidKey(item.ticketTypeId)}:${item.unitAmountMinor}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    lines.push({
      ticketTypeId: group[0]!.ticketTypeId,
      bookingPlaceIds: group.map((item) => item.bookingPlaceId),
      quantity: group.length,
      title: group[0]!.title,
      unitAmountMinor: group[0]!.unitAmountMinor,
      existingOrderId: null,
    });
  }
  return lines;
}

export function stalePendingOrderIds(ticketOrders: TicketOrderRow[], reusedOrderIds: Iterable<string>): string[] {
  const reused = new Set([...reusedOrderIds].map(normalizeUuidKey));
  return ticketOrders
    .filter(
      (order) =>
        order.status === TicketOrderStatus.PENDING && !reused.has(normalizeUuidKey(order.id))
    )
    .map((order) => order.id);
}
