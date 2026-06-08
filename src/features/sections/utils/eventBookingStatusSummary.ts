import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  GuestTicketRequestStatus,
  TicketOrderStatus,
} from "@dataconnect/generated";
import {
  getBookingPaymentAdjustmentStatusLabel,
  getBookingStatusLabel,
  getTicketOrderStatusLabel,
} from "../../../shared/utils/paymentStatusLabels";

export interface EventBookingSummaryInput {
  status: BookingStatus | string;
  revisionNumber: number;
  lines?: Array<{ ticketType?: { id: string } | null }> | null;
  guestTicketRequests?: Array<{
    status: GuestTicketRequestStatus | string;
    requestedGuestCount?: number;
    guestTicketType?: { id: string } | null;
  }> | null;
}

export interface EventBookingPaymentOrderInput {
  status: TicketOrderStatus | string;
  event?: { id: string } | null;
  ticketType?: { id: string } | null;
}

export interface EventBookingPaymentAdjustmentInput {
  status: BookingPaymentAdjustmentStatus | string;
}

export type EventBookingPaymentSummaryKind =
  | "paid"
  | "pending"
  | "failed"
  | "not_started"
  | "partial"
  | "adjustment_charge"
  | "adjustment_refund";

export interface EventBookingPaymentSummary {
  kind: EventBookingPaymentSummaryKind;
  label: string;
  severity: "success" | "warning" | "error" | "info" | "default";
  unpaidTicketTypeId: string | null;
}

export interface EventBookingGuestRequestSummary {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  hasPending: boolean;
}

export interface BookingTicketDisplayRow {
  id: string;
  ticketTypeId: string | null;
  ticketTitle: string;
  guestName: string | null;
  price: number | null;
  source: "line" | "approved_guest_request" | "pending_guest_request";
}

export const EXPIRED_DRAFT_HOLD_MESSAGE =
  "Your previous booking draft expired due to inactivity. Start a new booking below.";

function ticketTypeIdsFromBooking(booking: EventBookingSummaryInput): string[] {
  const fromLines = (booking.lines ?? [])
    .map((line) => line.ticketType?.id)
    .filter((id): id is string => Boolean(id));
  const fromApprovedGuests = (booking.guestTicketRequests ?? []).flatMap((request) => {
    if (request.status !== GuestTicketRequestStatus.APPROVED) {
      return [];
    }
    const ticketTypeId = request.guestTicketType?.id;
    if (!ticketTypeId) {
      return [];
    }
    const count = Math.max(1, request.requestedGuestCount ?? 1);
    return Array.from({ length: count }, () => ticketTypeId);
  });
  return [...fromLines, ...fromApprovedGuests];
}

function guestTicketCountByStatus(
  requests: EventBookingSummaryInput["guestTicketRequests"],
  status: GuestTicketRequestStatus
): number {
  return (requests ?? [])
    .filter((request) => request.status === status)
    .reduce((sum, request) => sum + Math.max(1, request.requestedGuestCount ?? 1), 0);
}

export function buildBookingTicketDisplayRows(booking: {
  lines?: Array<{
    id: string;
    guestDisplayName?: string | null;
    ticketType?: { id?: string; title?: string; price?: number | null } | null;
  }> | null;
  guestTicketRequests?: Array<{
    id: string;
    status: GuestTicketRequestStatus | string;
    requestedGuestCount?: number;
    guestDisplayName?: string | null;
    guestTicketType?: { id?: string; title?: string; price?: number | null } | null;
  }> | null;
}): BookingTicketDisplayRow[] {
  const rows: BookingTicketDisplayRow[] = [];

  for (const line of booking.lines ?? []) {
    rows.push({
      id: line.id,
      ticketTypeId: line.ticketType?.id ?? null,
      ticketTitle: line.ticketType?.title ?? "Ticket",
      guestName: line.guestDisplayName ?? null,
      price: line.ticketType?.price ?? null,
      source: "line",
    });
  }

  for (const request of booking.guestTicketRequests ?? []) {
    const source =
      request.status === GuestTicketRequestStatus.APPROVED
        ? "approved_guest_request"
        : request.status === GuestTicketRequestStatus.PENDING
          ? "pending_guest_request"
          : null;
    if (!source) {
      continue;
    }
    const count = Math.max(1, request.requestedGuestCount ?? 1);
    for (let index = 0; index < count; index++) {
      rows.push({
        id: `${request.id}-${index}`,
        ticketTypeId: request.guestTicketType?.id ?? null,
        ticketTitle: request.guestTicketType?.title ?? "Guest ticket",
        guestName: request.guestDisplayName ?? null,
        price: request.guestTicketType?.price ?? null,
        source,
      });
    }
  }

  return rows;
}

export function formatBookingTicketDisplayLabel(row: BookingTicketDisplayRow): string {
  const guestLabel = row.guestName ? `${row.ticketTitle} (${row.guestName})` : row.ticketTitle;
  if (row.source === "pending_guest_request") {
    return `${guestLabel} — awaiting approval`;
  }
  return guestLabel;
}

export function getPayableBookingTicketRows(rows: BookingTicketDisplayRow[]): BookingTicketDisplayRow[] {
  return rows.filter((row) => row.source !== "pending_guest_request");
}

export function isBookingPaymentComplete(summary: EventBookingPaymentSummary): boolean {
  return summary.kind === "paid" || summary.kind === "adjustment_refund";
}

export function bookingNeedsPayment(summary: EventBookingPaymentSummary | null | undefined): boolean {
  if (!summary) {
    return false;
  }
  return !isBookingPaymentComplete(summary) && summary.kind !== "adjustment_charge";
}

export function hasExpiredDraftHold(
  bookings: Array<{ status: BookingStatus | string }> | null | undefined
): boolean {
  const list = bookings ?? [];
  const hasCancelled = list.some((booking) => booking.status === BookingStatus.CANCELLED);
  const hasActive = list.some(
    (booking) =>
      booking.status === BookingStatus.DRAFT ||
      booking.status === BookingStatus.SUBMITTED ||
      booking.status === BookingStatus.CONFIRMED
  );
  return hasCancelled && !hasActive;
}

export function summarizeGuestTicketRequests(
  requests: EventBookingSummaryInput["guestTicketRequests"]
): EventBookingGuestRequestSummary {
  return {
    pendingCount: guestTicketCountByStatus(requests, GuestTicketRequestStatus.PENDING),
    approvedCount: guestTicketCountByStatus(requests, GuestTicketRequestStatus.APPROVED),
    rejectedCount: guestTicketCountByStatus(requests, GuestTicketRequestStatus.REJECTED),
    hasPending: (requests ?? []).some((request) => request.status === GuestTicketRequestStatus.PENDING),
  };
}

export function summarizeEventBookingPayment(params: {
  booking: EventBookingSummaryInput;
  eventId: string;
  ticketOrders: EventBookingPaymentOrderInput[];
  adjustments: EventBookingPaymentAdjustmentInput[];
}): EventBookingPaymentSummary {
  const { booking, eventId, ticketOrders, adjustments } = params;
  const pendingCharge = adjustments.find(
    (a) => a.status === BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE
  );
  if (pendingCharge) {
    return {
      kind: "adjustment_charge",
      label: getBookingPaymentAdjustmentStatusLabel(pendingCharge.status),
      severity: "warning",
      unpaidTicketTypeId: null,
    };
  }

  const pendingRefund = adjustments.find(
    (a) => a.status === BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND
  );
  if (pendingRefund) {
    return {
      kind: "adjustment_refund",
      label: getBookingPaymentAdjustmentStatusLabel(pendingRefund.status),
      severity: "info",
      unpaidTicketTypeId: null,
    };
  }

  const bookedTicketTypeIds = ticketTypeIdsFromBooking(booking);
  if (bookedTicketTypeIds.length === 0) {
    return {
      kind: "not_started",
      label: "Payment not started",
      severity: "warning",
      unpaidTicketTypeId: null,
    };
  }

  const eventOrders = ticketOrders.filter((order) => order.event?.id === eventId);
  const relevantOrders = eventOrders.filter((order) =>
    bookedTicketTypeIds.includes(order.ticketType?.id ?? "")
  );

  if (relevantOrders.length === 0) {
    const memberLine = (booking.lines ?? []).find((line) => line.ticketType?.id);
    return {
      kind: "not_started",
      label: "Payment not started",
      severity: "warning",
      unpaidTicketTypeId: memberLine?.ticketType?.id ?? null,
    };
  }

  const statusesByTicketType = new Map<string, TicketOrderStatus[]>();
  for (const order of relevantOrders) {
    const ticketTypeId = order.ticketType?.id;
    if (!ticketTypeId) continue;
    const existing = statusesByTicketType.get(ticketTypeId) ?? [];
    existing.push(order.status as TicketOrderStatus);
    statusesByTicketType.set(ticketTypeId, existing);
  }

  const perTypeSummary = bookedTicketTypeIds.map((ticketTypeId) => {
    const statuses = statusesByTicketType.get(ticketTypeId) ?? [];
    if (statuses.includes(TicketOrderStatus.PAID)) return "paid" as const;
    if (statuses.includes(TicketOrderStatus.PENDING)) return "pending" as const;
    if (statuses.includes(TicketOrderStatus.FAILED)) return "failed" as const;
    return "missing" as const;
  });

  const firstUnpaidTicketTypeId = bookedTicketTypeIds.find((_, index) => perTypeSummary[index] !== "paid") ?? null;

  if (perTypeSummary.every((status) => status === "paid")) {
    return {
      kind: "paid",
      label: getTicketOrderStatusLabel(TicketOrderStatus.PAID),
      severity: "success",
      unpaidTicketTypeId: null,
    };
  }

  if (perTypeSummary.some((status) => status === "failed")) {
    return {
      kind: "failed",
      label: getTicketOrderStatusLabel(TicketOrderStatus.FAILED),
      severity: "error",
      unpaidTicketTypeId: firstUnpaidTicketTypeId,
    };
  }

  if (perTypeSummary.some((status) => status === "pending")) {
    return {
      kind: "pending",
      label: getTicketOrderStatusLabel(TicketOrderStatus.PENDING),
      severity: "warning",
      unpaidTicketTypeId: firstUnpaidTicketTypeId,
    };
  }

  if (perTypeSummary.some((status) => status === "paid")) {
    return {
      kind: "partial",
      label: "Partially paid",
      severity: "warning",
      unpaidTicketTypeId: firstUnpaidTicketTypeId,
    };
  }

  return {
    kind: "not_started",
    label: "Payment not started",
    severity: "warning",
    unpaidTicketTypeId: firstUnpaidTicketTypeId,
  };
}

export function getEventBookingNextSteps(params: {
  bookingStatus: BookingStatus | string;
  paymentSummary: EventBookingPaymentSummary;
  guestSummary: EventBookingGuestRequestSummary;
}): string {
  const { bookingStatus, paymentSummary, guestSummary } = params;
  const steps: string[] = [];

  if (paymentSummary.kind === "pending" || paymentSummary.kind === "not_started" || paymentSummary.kind === "partial") {
    steps.push("Complete payment to secure your place.");
  } else if (paymentSummary.kind === "failed") {
    steps.push("Your payment hold expired or the last attempt failed. Use Pay now to try again.");
  } else if (paymentSummary.kind === "adjustment_charge") {
    steps.push("An additional payment is being processed for your latest booking revision.");
  } else if (paymentSummary.kind === "adjustment_refund") {
    steps.push("A refund for your booking revision is being processed.");
  }

  if (guestSummary.hasPending) {
    steps.push("Your extra guest ticket request is awaiting moderator review.");
  } else if (guestSummary.approvedCount > 0) {
    steps.push("Approved guest tickets are included in your booking below.");
  } else if (guestSummary.rejectedCount > 0 && guestSummary.approvedCount === 0) {
    steps.push("A guest ticket request was declined. You can submit a revised request below.");
  }

  if (steps.length === 0) {
    if (bookingStatus === BookingStatus.CONFIRMED) {
      return "Your booking is confirmed. You can edit it until the booking window closes.";
    }
    return "Your booking is submitted. We'll confirm your place once everything is in order.";
  }

  return steps.join(" ");
}

export function getEventBookingStatusHeading(booking: EventBookingSummaryInput): string {
  return `${getBookingStatusLabel(booking.status)} · revision ${booking.revisionNumber}`;
}
