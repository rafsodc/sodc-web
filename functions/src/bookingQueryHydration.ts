import type { GetBookingsForBookerAndEventData } from "@dataconnect/admin-generated";

type RawBookingRow = NonNullable<GetBookingsForBookerAndEventData["user"]>["bookings"][number];
type RawBookingLine = RawBookingRow["lines"][number];
type RawBookingPlace = RawBookingLine["bookingPlace"];
type RawPaymentAllocation = RawBookingPlace["paymentAllocations"][number];
type BookingTicketOrder = NonNullable<GetBookingsForBookerAndEventData["user"]>["ticketOrders"][number];

export type HydratedBookingRow = Omit<RawBookingRow, "lines"> & {
  lines: Array<Omit<RawBookingLine, "bookingPlace"> & {
    bookingPlace: Omit<RawBookingPlace, "paymentAllocations"> & {
      paymentAllocations: Array<RawPaymentAllocation & { ticketOrder: BookingTicketOrder }>;
    };
  }>;
};

function normalizedId(id: string): string {
  return id.trim().replace(/-/g, "").toLowerCase();
}

/** Reattaches shallow order data after avoiding Data Connect's overlong nested SQL aliases. */
export function hydrateBookingsWithTicketOrders(
  data: GetBookingsForBookerAndEventData | undefined
): HydratedBookingRow[] {
  const user = data?.user;
  const ticketOrdersById = new Map(
    (user?.ticketOrders ?? []).map((order) => [normalizedId(order.id), order])
  );
  return (user?.bookings ?? []).map((booking) => ({
    ...booking,
    lines: booking.lines.map((line) => ({
      ...line,
      bookingPlace: {
        ...line.bookingPlace,
        paymentAllocations: line.bookingPlace.paymentAllocations.map((allocation) => {
          // Accept the previous nested response shape during rolling deployments;
          // the new connector returns ticketOrderId plus the sibling order list.
          const nestedTicketOrder = (allocation as RawPaymentAllocation & {
            ticketOrder?: BookingTicketOrder;
          }).ticketOrder;
          const ticketOrderId = allocation.ticketOrderId ?? nestedTicketOrder?.id;
          const ticketOrder = nestedTicketOrder ?? (
            ticketOrderId ? ticketOrdersById.get(normalizedId(ticketOrderId)) : undefined
          );
          if (!ticketOrder) {
            throw new Error(`Ticket order ${ticketOrderId ?? "unknown"} is missing for booking allocation ${allocation.id}`);
          }
          return { ...allocation, ticketOrder };
        }),
      },
    })),
  }));
}
