import { describe, expect, it } from "vitest";
import { TicketOrderStatus } from "@dataconnect/admin-generated";
import type { GetBookingsForBookerAndEventData } from "@dataconnect/admin-generated";
import { hydrateBookingsWithTicketOrders } from "../bookingQueryHydration";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const ALLOCATION_ID = "22222222-2222-4222-8222-222222222222";

function queryData(ticketOrders: Array<{ id: string; status: TicketOrderStatus }>) {
  return {
    user: {
      ticketOrders,
      bookings: [{
        id: "33333333-3333-4333-8333-333333333333",
        lines: [{
          bookingPlace: {
            paymentAllocations: [{ id: ALLOCATION_ID, ticketOrderId: ORDER_ID }],
          },
        }],
      }],
    },
  } as unknown as GetBookingsForBookerAndEventData;
}

describe("booking query hydration", () => {
  it("reattaches shallow ticket-order data to each payment allocation", () => {
    const bookings = hydrateBookingsWithTicketOrders(
      queryData([{ id: ORDER_ID, status: TicketOrderStatus.PAID }])
    );

    expect(bookings[0]?.lines[0]?.bookingPlace.paymentAllocations[0]?.ticketOrder).toMatchObject({
      id: ORDER_ID,
      status: TicketOrderStatus.PAID,
    });
  });

  it("fails closed when an allocation references an order omitted by the sibling query", () => {
    expect(() => hydrateBookingsWithTicketOrders(queryData([]))).toThrow(
      `Ticket order ${ORDER_ID} is missing for booking allocation ${ALLOCATION_ID}`
    );
  });
});
