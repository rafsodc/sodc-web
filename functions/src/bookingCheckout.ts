import { GuestTicketRequestStatus, TicketOrderStatus } from "@dataconnect/admin-generated";
import type { GetBookingsForBookerAndEventData, GetTicketOrdersForBookerAndEventData } from "@dataconnect/admin-generated";

type BookingRow = NonNullable<GetBookingsForBookerAndEventData["user"]>["bookings"][number];
type TicketOrderRow = NonNullable<GetTicketOrdersForBookerAndEventData["user"]>["ticketOrders"][number];

export interface BookingCheckoutLineItem {
  ticketTypeId: string;
  quantity: number;
  title: string;
  unitAmountMinor: number;
}

function normalizeUuidKey(id: string): string {
  return id.trim().replace(/-/g, "").toLowerCase();
}

export function bookingIdsEqual(a: string, b: string): boolean {
  return normalizeUuidKey(a) === normalizeUuidKey(b);
}

export function selectLatestActiveBooking(bookings: BookingRow[]): BookingRow | null {
  const active = bookings.filter(
    (booking) =>
      (booking.status === "SUBMITTED" || booking.status === "CONFIRMED") && booking.supersededAt == null
  );
  return active.reduce<BookingRow | null>((latest, booking) => {
    if (!latest) return booking;
    return booking.revisionNumber > latest.revisionNumber ? booking : latest;
  }, null);
}

function requiredTicketTypeCounts(booking: BookingRow): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (ticketTypeId: string | undefined | null) => {
    if (!ticketTypeId) return;
    counts.set(ticketTypeId, (counts.get(ticketTypeId) ?? 0) + 1);
  };

  for (const line of booking.lines ?? []) {
    add(line.ticketType?.id);
  }
  for (const request of booking.guestTicketRequests ?? []) {
    if (request.status !== GuestTicketRequestStatus.APPROVED) {
      continue;
    }
    const ticketTypeId = request.guestTicketType?.id;
    if (!ticketTypeId) continue;
    const count = Math.max(1, request.requestedGuestCount ?? 1);
    for (let index = 0; index < count; index++) {
      add(ticketTypeId);
    }
  }
  return counts;
}

function paidTicketTypeCounts(orders: TicketOrderRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== TicketOrderStatus.PAID) {
      continue;
    }
    const ticketTypeId = order.ticketType?.id;
    if (!ticketTypeId) continue;
    counts.set(ticketTypeId, (counts.get(ticketTypeId) ?? 0) + Math.max(1, order.quantity ?? 1));
  }
  return counts;
}

function ticketTitleFromBooking(booking: BookingRow, ticketTypeId: string): string {
  const line = (booking.lines ?? []).find((row) => bookingIdsEqual(row.ticketType?.id ?? "", ticketTypeId));
  if (line?.ticketType?.title) {
    return line.ticketType.title;
  }
  const request = (booking.guestTicketRequests ?? []).find(
    (row) =>
      row.status === GuestTicketRequestStatus.APPROVED &&
      row.guestTicketType?.id &&
      bookingIdsEqual(row.guestTicketType.id, ticketTypeId)
  );
  return request?.guestTicketType?.title ?? "Event ticket";
}

function unitPriceFromBooking(booking: BookingRow, ticketTypeId: string): number | null {
  const line = (booking.lines ?? []).find((row) => bookingIdsEqual(row.ticketType?.id ?? "", ticketTypeId));
  if (line?.ticketType?.price != null) {
    return line.ticketType.price;
  }
  const request = (booking.guestTicketRequests ?? []).find(
    (row) =>
      row.status === GuestTicketRequestStatus.APPROVED &&
      row.guestTicketType?.id &&
      bookingIdsEqual(row.guestTicketType.id, ticketTypeId)
  );
  return request?.guestTicketType?.price ?? null;
}

export function computeUnpaidBookingCheckoutItems(args: {
  booking: BookingRow;
  ticketOrders: TicketOrderRow[];
}): BookingCheckoutLineItem[] {
  const required = requiredTicketTypeCounts(args.booking);
  const paid = paidTicketTypeCounts(args.ticketOrders);
  const items: BookingCheckoutLineItem[] = [];

  for (const [ticketTypeId, requiredCount] of required.entries()) {
    const paidCount = paid.get(ticketTypeId) ?? 0;
    const unpaidCount = requiredCount - paidCount;
    if (unpaidCount <= 0) {
      continue;
    }
    const price = unitPriceFromBooking(args.booking, ticketTypeId);
    if (price == null) {
      continue;
    }
    items.push({
      ticketTypeId,
      quantity: unpaidCount,
      title: ticketTitleFromBooking(args.booking, ticketTypeId),
      unitAmountMinor: Math.round(price * 100),
    });
  }

  return items;
}
