import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  TicketOrderStatus,
} from "@dataconnect/generated";
import {
  getBookingPaymentAdjustmentStatusLabel,
  getBookingStatusLabel,
  getTicketOrderStatusLabel,
} from "../../../shared/utils/paymentStatusLabels";
import { idsEqual } from "../../../shared/utils/uuid";

export interface EventBookingSummaryInput {
  status: BookingStatus | string;
  approvalStatus?: string;
  revisionNumber: number;
  lines?: Array<{ ticketType?: { id: string } | null }> | null;
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

export interface BookingTicketDisplayRow {
  id: string;
  ticketTypeId: string | null;
  ticketTitle: string;
  guestName: string | null;
  price: number | null;
  source: "line";
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
  return fromLines;
}

export function buildBookingTicketDisplayRows(booking: {
  lines?: Array<{
    id: string;
    guestDisplayName?: string | null;
    ticketType?: { id?: string; title?: string; price?: number | null } | null;
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

  return rows;
}

export function formatBookingTicketDisplayLabel(row: BookingTicketDisplayRow): string {
  const guestLabel = row.guestName ? `${row.ticketTitle} (${row.guestName})` : row.ticketTitle;
  return guestLabel;
}

export function getPayableBookingTicketRows(rows: BookingTicketDisplayRow[]): BookingTicketDisplayRow[] {
  return rows;
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

export function getEventBookingStatusHeading(booking: EventBookingSummaryInput): string {
  return getBookingStatusLabel(booking.status);
}
