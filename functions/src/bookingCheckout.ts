import { TicketOrderStatus } from "@dataconnect/admin-generated";
import type {
  GetBookingsForBookerAndEventData,
  GetTicketOrdersForBookerAndEventData,
} from "@dataconnect/admin-generated";
import { bookingApprovalAllowsPayment } from "./bookingRules";

type BookingRow = NonNullable<GetBookingsForBookerAndEventData["user"]>["bookings"][number];
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

function paidAmountMinor(line: BookingRow["lines"][number]): number {
  return (line.bookingPlace.paymentAllocations ?? []).reduce(
    (total, allocation) =>
      allocation.ticketOrder.status === TicketOrderStatus.PAID ||
      allocation.ticketOrder.status === TicketOrderStatus.REFUNDED
        ? total + Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor)
        : total,
    0
  );
}

function hasSettledAllocation(line: BookingRow["lines"][number]): boolean {
  return (line.bookingPlace.paymentAllocations ?? []).some(
    (allocation) =>
      allocation.ticketOrder.status === TicketOrderStatus.PAID ||
      allocation.ticketOrder.status === TicketOrderStatus.REFUNDED
  );
}

/** Plans place-specific refunds for an approved revision that costs less than its paid entitlement. */
export function planBookingAllocationRefunds(booking: BookingRow): BookingAllocationRefund[] {
  const refunds: BookingAllocationRefund[] = [];
  for (const line of booking.lines) {
    const requiredAmountMinor = Math.round(line.ticketType.price * 100);
    let excessAmountMinor = Math.max(0, paidAmountMinor(line) - requiredAmountMinor);
    if (excessAmountMinor === 0) continue;

    const refundable = [...(line.bookingPlace.paymentAllocations ?? [])]
      .filter(
        (allocation) =>
          (allocation.ticketOrder.status === TicketOrderStatus.PAID ||
            allocation.ticketOrder.status === TicketOrderStatus.REFUNDED) &&
          allocation.allocatedAmountMinor > allocation.refundedAmountMinor
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    for (const allocation of refundable) {
      if (excessAmountMinor === 0) break;
      const available = allocation.allocatedAmountMinor - allocation.refundedAmountMinor;
      const amountMinor = Math.min(excessAmountMinor, available);
      refunds.push({
        allocationId: allocation.id,
        ticketOrderId: allocation.ticketOrder.id,
        stripePaymentIntentId: allocation.ticketOrder.stripePaymentIntentId ?? null,
        amountMinor,
        resultingRefundedAmountMinor: allocation.refundedAmountMinor + amountMinor,
      });
      excessAmountMinor -= amountMinor;
    }
  }
  return refunds;
}

export function bookingIsFullyPaid(booking: BookingRow): boolean {
  return (
    booking.lines.length > 0 &&
    booking.lines.every(
      (line) =>
        hasSettledAllocation(line) &&
        paidAmountMinor(line) >= Math.round(line.ticketType.price * 100)
    )
  );
}

/** Returns exact unpaid places; aggregate paid quantities can never satisfy a different guest. */
export function computeUnpaidBookingCheckoutItems(booking: BookingRow): BookingCheckoutPlaceItem[] {
  const items: BookingCheckoutPlaceItem[] = [];
  for (const line of booking.lines) {
    const bookingPlaceId = line.bookingPlace.id;
    const requiredAmountMinor = Math.round(line.ticketType.price * 100);
    const remainingAmountMinor = Math.max(0, requiredAmountMinor - paidAmountMinor(line));
    if (remainingAmountMinor === 0 && hasSettledAllocation(line)) continue;
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
