import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketOrderStatus, type UUIDString } from "@dataconnect/admin-generated";

const mocks = vi.hoisted(() => ({ executeMutation: vi.fn() }));
vi.mock("../bookingServiceDataConnect", () => ({
  getBookingServiceDataConnect: vi.fn(() => ({ executeMutation: mocks.executeMutation })),
}));

import { createAllocatedTicketOrder } from "../bookingPaymentPersistence";

const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
] as UUIDString[];

describe("allocated ticket order persistence", () => {
  beforeEach(() => mocks.executeMutation.mockReset().mockResolvedValue({ data: {} }));

  it("creates the order and each exact place allocation in one named transaction", async () => {
    let index = 0;
    const orderId = await createAllocatedTicketOrder({
      userId: "user-1",
      eventId: "20000000-0000-4000-8000-000000000001",
      ticketTypeId: "30000000-0000-4000-8000-000000000001",
      unitAmountMinor: 2500,
      bookingPlaceIds: [
        "40000000-0000-4000-8000-000000000001",
        "40000000-0000-4000-8000-000000000002",
      ],
      createId: () => ids[index++]!,
    });

    expect(orderId).toBe(ids[0]);
    expect(mocks.executeMutation).toHaveBeenCalledWith(
      "CreateAllocatedTicketOrderFromCallable",
      {
        orderId: ids[0],
        userId: "user-1",
        eventId: "20000000-0000-4000-8000-000000000001",
        ticketTypeId: "30000000-0000-4000-8000-000000000001",
        quantity: 2,
        unitAmountMinor: 2500,
        totalAmountMinor: 5000,
        currency: "gbp",
        status: TicketOrderStatus.PENDING,
        webhookEventId: null,
        createdBy: "system",
        updatedBy: "system",
        allocations: [
          expect.objectContaining({ id: ids[1], ticketOrderId: ids[0], bookingPlaceId: "40000000-0000-4000-8000-000000000001", allocatedAmountMinor: 2500 }),
          expect.objectContaining({ id: ids[2], ticketOrderId: ids[0], bookingPlaceId: "40000000-0000-4000-8000-000000000002", allocatedAmountMinor: 2500 }),
        ],
      }
    );
  });
});
