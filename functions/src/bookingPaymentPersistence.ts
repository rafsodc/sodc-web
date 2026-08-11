import { randomUUID } from "node:crypto";
import { TicketOrderStatus } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { getBookingServiceDataConnect } from "./bookingServiceDataConnect";

interface AllocatedTicketOrderVariables {
  orderId: UUIDString;
  userId: string;
  eventId: UUIDString;
  ticketTypeId: UUIDString;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  currency: string;
  status: TicketOrderStatus;
  webhookEventId?: string | null;
  createdBy: string;
  updatedBy: string;
  allocations: Array<{
    id: UUIDString;
    ticketOrderId: UUIDString;
    bookingPlaceId: UUIDString;
    allocatedAmountMinor: number;
    createdBy: string;
    updatedBy: string;
  }>;
}

export interface CreateAllocatedTicketOrderInput {
  userId: string;
  eventId: UUIDString;
  ticketTypeId: UUIDString;
  unitAmountMinor: number;
  bookingPlaceIds: UUIDString[];
  status?: TicketOrderStatus;
  webhookEventId?: string | null;
  createId?: () => UUIDString;
}

/** Creates an order and all exact ticket-place allocations transactionally. */
export async function createAllocatedTicketOrder(
  input: CreateAllocatedTicketOrderInput
): Promise<UUIDString> {
  const createId = input.createId ?? (() => randomUUID() as UUIDString);
  const orderId = createId();
  const quantity = input.bookingPlaceIds.length;
  if (quantity < 1) throw new Error("An allocated ticket order requires at least one booking place");

  const variables: AllocatedTicketOrderVariables = {
    orderId,
    userId: input.userId,
    eventId: input.eventId,
    ticketTypeId: input.ticketTypeId,
    quantity,
    unitAmountMinor: input.unitAmountMinor,
    totalAmountMinor: input.unitAmountMinor * quantity,
    currency: "gbp",
    status: input.status ?? TicketOrderStatus.PENDING,
    webhookEventId: input.webhookEventId ?? null,
    createdBy: "system",
    updatedBy: "system",
    allocations: input.bookingPlaceIds.map((bookingPlaceId) => ({
      id: createId(),
      ticketOrderId: orderId,
      bookingPlaceId,
      allocatedAmountMinor: input.unitAmountMinor,
      createdBy: "system",
      updatedBy: "system",
    })),
  };

  await getBookingServiceDataConnect().executeMutation<unknown, AllocatedTicketOrderVariables>(
    "CreateAllocatedTicketOrderFromCallable",
    variables
  );
  return orderId;
}
