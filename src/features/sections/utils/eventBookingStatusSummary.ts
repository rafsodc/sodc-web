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
import { uuidsEqual, idsEqual } from "../../../shared/utils/uuid";

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
  quantity?: number | null;
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

export type BookingTicketPaymentStatus =
  | "paid"
  | "pending"
  | "failed"
  | "unpaid"
  | "awaiting_approval";

export interface BookingTicketDisplayRowWithPayment extends BookingTicketDisplayRow {
  paymentStatus: BookingTicketPaymentStatus;
  paymentStatusLabel: string;
}

export const EXPIRED_DRAFT_HOLD_MESSAGE =
  "Your previous booking draft expired due to inactivity. Start a new booking below.";

function normalizeTicketTypeKey(id: string): string {
  return id.trim().replace(/-/g, "").toLowerCase();
}

function requiredTicketTypeCounts(
  booking: EventBookingSummaryInput
): Map<string, { count: number; ticketTypeId: string }> {
  const counts = new Map<string, { count: number; ticketTypeId: string }>();
  const add = (ticketTypeId: string | undefined | null, amount = 1) => {
    if (!ticketTypeId || amount <= 0) {
      return;
    }
    const key = normalizeTicketTypeKey(ticketTypeId);
    const existing = counts.get(key);
    if (existing) {
      existing.count += amount;
      return;
    }
    counts.set(key, { count: amount, ticketTypeId });
  };

  for (const line of booking.lines ?? []) {
    add(line.ticketType?.id);
  }
  for (const request of booking.guestTicketRequests ?? []) {
    if (request.status !== GuestTicketRequestStatus.APPROVED) {
      continue;
    }
    add(request.guestTicketType?.id, Math.max(1, request.requestedGuestCount ?? 1));
  }
  return counts;
}

function ticketOrderQuantity(order: EventBookingPaymentOrderInput): number {
  return Math.max(1, order.quantity ?? 1);
}

function ticketTypeOrderCounts(
  orders: EventBookingPaymentOrderInput[],
  eventId: string,
  status: TicketOrderStatus
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (!idsEqual(order.event?.id, eventId)) {
      continue;
    }
    if (order.status !== status) {
      continue;
    }
    const ticketTypeId = order.ticketType?.id;
    if (!ticketTypeId) {
      continue;
    }
    const key = normalizeTicketTypeKey(ticketTypeId);
    counts.set(key, (counts.get(key) ?? 0) + ticketOrderQuantity(order));
  }
  return counts;
}

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

function takePaymentSlot(pool: Map<string, number>, ticketTypeId: string | null): boolean {
  if (!ticketTypeId) {
    return false;
  }
  const key = normalizeTicketTypeKey(ticketTypeId);
  const remaining = pool.get(key) ?? 0;
  if (remaining <= 0) {
    return false;
  }
  pool.set(key, remaining - 1);
  return true;
}

export function buildBookingTicketRowsWithPaymentStatus(params: {
  booking: Parameters<typeof buildBookingTicketDisplayRows>[0];
  eventId: string;
  ticketOrders: EventBookingPaymentOrderInput[];
}): BookingTicketDisplayRowWithPayment[] {
  const rows = buildBookingTicketDisplayRows(params.booking);
  const paidPool = new Map(ticketTypeOrderCounts(params.ticketOrders, params.eventId, TicketOrderStatus.PAID));
  const pendingPool = new Map(
    ticketTypeOrderCounts(params.ticketOrders, params.eventId, TicketOrderStatus.PENDING)
  );
  const failedPool = new Map(ticketTypeOrderCounts(params.ticketOrders, params.eventId, TicketOrderStatus.FAILED));

  return rows.map((row) => {
    if (row.source === "pending_guest_request") {
      return {
        ...row,
        paymentStatus: "awaiting_approval",
        paymentStatusLabel: "Awaiting approval",
      };
    }
    if (takePaymentSlot(paidPool, row.ticketTypeId)) {
      return {
        ...row,
        paymentStatus: "paid",
        paymentStatusLabel: getTicketOrderStatusLabel(TicketOrderStatus.PAID),
      };
    }
    if (takePaymentSlot(pendingPool, row.ticketTypeId)) {
      return {
        ...row,
        paymentStatus: "pending",
        paymentStatusLabel: getTicketOrderStatusLabel(TicketOrderStatus.PENDING),
      };
    }
    if (takePaymentSlot(failedPool, row.ticketTypeId)) {
      return {
        ...row,
        paymentStatus: "failed",
        paymentStatusLabel: getTicketOrderStatusLabel(TicketOrderStatus.FAILED),
      };
    }
    return {
      ...row,
      paymentStatus: "unpaid",
      paymentStatusLabel: "Unpaid",
    };
  });
}

export function bookingTicketPaymentChipColor(
  status: BookingTicketPaymentStatus
): "success" | "warning" | "error" | "default" {
  if (status === "paid") {
    return "success";
  }
  if (status === "failed") {
    return "error";
  }
  if (status === "pending" || status === "unpaid") {
    return "warning";
  }
  return "default";
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

  const requiredCounts = requiredTicketTypeCounts(booking);
  const paidCounts = ticketTypeOrderCounts(ticketOrders, eventId, TicketOrderStatus.PAID);
  const pendingCounts = ticketTypeOrderCounts(ticketOrders, eventId, TicketOrderStatus.PENDING);
  const failedCounts = ticketTypeOrderCounts(ticketOrders, eventId, TicketOrderStatus.FAILED);

  let hasUnpaid = false;
  let hasPartialPaid = false;
  let hasPending = false;
  let hasFailed = false;
  let firstUnpaidTicketTypeId: string | null = null;

  for (const { count: requiredCount, ticketTypeId } of requiredCounts.values()) {
    const key = normalizeTicketTypeKey(ticketTypeId);
    const paidCount = paidCounts.get(key) ?? 0;
    if (paidCount >= requiredCount) {
      continue;
    }
    hasUnpaid = true;
    if (!firstUnpaidTicketTypeId) {
      firstUnpaidTicketTypeId = ticketTypeId;
    }
    if (paidCount > 0) {
      hasPartialPaid = true;
    }
    if ((pendingCounts.get(key) ?? 0) > 0) {
      hasPending = true;
    }
    if ((failedCounts.get(key) ?? 0) > 0) {
      hasFailed = true;
    }
  }

  if (!hasUnpaid) {
    return {
      kind: "paid",
      label: getTicketOrderStatusLabel(TicketOrderStatus.PAID),
      severity: "success",
      unpaidTicketTypeId: null,
    };
  }

  if (hasFailed) {
    return {
      kind: "failed",
      label: getTicketOrderStatusLabel(TicketOrderStatus.FAILED),
      severity: "error",
      unpaidTicketTypeId: firstUnpaidTicketTypeId,
    };
  }

  if (hasPending) {
    return {
      kind: "pending",
      label: getTicketOrderStatusLabel(TicketOrderStatus.PENDING),
      severity: "warning",
      unpaidTicketTypeId: firstUnpaidTicketTypeId,
    };
  }

  if (hasPartialPaid) {
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
    if (
      paymentSummary.kind === "partial" ||
      paymentSummary.kind === "not_started" ||
      paymentSummary.kind === "pending" ||
      paymentSummary.kind === "failed"
    ) {
      steps.push("Approved guest tickets are on your booking — pay for any unpaid tickets to confirm them.");
    } else {
      steps.push("Approved guest tickets are included in your booking below.");
    }
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
