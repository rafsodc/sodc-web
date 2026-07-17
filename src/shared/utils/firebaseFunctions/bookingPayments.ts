import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";
import { toCanonicalUuid } from "../uuid";

export interface SubmitEventBookingLine {
  ticketTypeId: string;
  sortOrder: number;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
}

export interface SubmitEventBookingRequest {
  idempotencyKey: string;
  eventId: string;
  baseBookingId?: string;
  baseRevisionNumber?: number;
  lines: SubmitEventBookingLine[];
  bookerDietaryNote?: string | null;
  sitNextToUserIds?: string[];
  accommodationRequested?: boolean;
  accommodationNote?: string | null;
}

export interface SubmitEventBookingResponse {
  bookingId: string;
  status: string;
  idempotentReplay?: boolean;
}

export interface CreateTicketCheckoutSessionRequest {
  ticketTypeId: string;
  quantity?: number;
}

export interface CreateTicketCheckoutSessionResponse {
  url: string;
  orderId: string;
}

export interface CreateEventBookingCheckoutSessionRequest {
  eventId: string;
}

export interface CreateEventBookingCheckoutSessionResponse {
  url: string;
  orderIds: string[];
}

export interface GetMyTicketOrderStripeArtifactsResponse {
  receiptUrl: string | null;
}

export interface GetMyTicketOrderStripeArtifactsBatchRequest {
  orderIds: string[];
}

export interface GetMyTicketOrderStripeArtifactsBatchResponse {
  artifactsByOrderId: Record<string, GetMyTicketOrderStripeArtifactsResponse>;
}

/**
 * Submits a booking for an event (validated server-side). Reuse the same idempotency key on retries.
 */
export async function submitEventBooking(
  payload: SubmitEventBookingRequest
): Promise<SubmitEventBookingResponse> {
  const callable = httpsCallable<SubmitEventBookingRequest, SubmitEventBookingResponse>(
    functions,
    "submitEventBooking"
  );
  const normalized: SubmitEventBookingRequest = {
    idempotencyKey: toCanonicalUuid(payload.idempotencyKey),
    eventId: toCanonicalUuid(payload.eventId),
    baseBookingId: payload.baseBookingId ? toCanonicalUuid(payload.baseBookingId) : undefined,
    baseRevisionNumber: payload.baseRevisionNumber,
    lines: payload.lines.map((line) => ({
      ...line,
      ticketTypeId: toCanonicalUuid(line.ticketTypeId),
    })),
    bookerDietaryNote: payload.bookerDietaryNote?.trim() || null,
    sitNextToUserIds: (payload.sitNextToUserIds ?? []).map((id) => id.trim()).filter(Boolean),
    accommodationRequested: payload.accommodationRequested ?? false,
    accommodationNote: payload.accommodationNote?.trim() || null,
  };
  const result = await callable(normalized);
  return result.data;
}

export async function createTicketCheckoutSession(
  payload: CreateTicketCheckoutSessionRequest
): Promise<CreateTicketCheckoutSessionResponse> {
  const callable = httpsCallable<CreateTicketCheckoutSessionRequest, CreateTicketCheckoutSessionResponse>(
    functions,
    "createTicketCheckoutSession"
  );
  const normalized: CreateTicketCheckoutSessionRequest = {
    ticketTypeId: toCanonicalUuid(payload.ticketTypeId),
    quantity: payload.quantity ?? 1,
  };
  const result = await callable(normalized);
  return result.data;
}

export async function createEventBookingCheckoutSession(
  payload: CreateEventBookingCheckoutSessionRequest
): Promise<CreateEventBookingCheckoutSessionResponse> {
  const callable = httpsCallable<
    CreateEventBookingCheckoutSessionRequest,
    CreateEventBookingCheckoutSessionResponse
  >(functions, "createEventBookingCheckoutSession");
  const result = await callable({
    eventId: toCanonicalUuid(payload.eventId),
  });
  return result.data;
}

export async function getMyTicketOrderStripeArtifactsBatch(
  payload: GetMyTicketOrderStripeArtifactsBatchRequest
): Promise<GetMyTicketOrderStripeArtifactsBatchResponse> {
  const callable = httpsCallable<GetMyTicketOrderStripeArtifactsBatchRequest, GetMyTicketOrderStripeArtifactsBatchResponse>(
    functions,
    "getMyTicketOrderStripeArtifactsBatch"
  );
  const result = await callable({
    orderIds: payload.orderIds.map((orderId) => toCanonicalUuid(orderId)),
  });
  const data = result.data as { result?: GetMyTicketOrderStripeArtifactsBatchResponse } & GetMyTicketOrderStripeArtifactsBatchResponse;
  return data.result ?? data;
}

export interface ReconcileMyCheckoutSessionOrdersRequest {
  orderId: string;
}

export interface ReconcileMyCheckoutSessionOrdersResponse {
  appliedCount: number;
  reconciledOrderIds: string[];
  orderIds: string[];
}

export async function reconcileMyCheckoutSessionOrders(
  payload: ReconcileMyCheckoutSessionOrdersRequest
): Promise<ReconcileMyCheckoutSessionOrdersResponse> {
  const callable = httpsCallable<
    ReconcileMyCheckoutSessionOrdersRequest,
    ReconcileMyCheckoutSessionOrdersResponse
  >(functions, "reconcileMyCheckoutSessionOrders");
  const result = await callable({ orderId: toCanonicalUuid(payload.orderId) });
  const data = result.data as { result?: ReconcileMyCheckoutSessionOrdersResponse } & ReconcileMyCheckoutSessionOrdersResponse;
  return data.result ?? data;
}
