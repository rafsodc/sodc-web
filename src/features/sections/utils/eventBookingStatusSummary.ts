import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  GuestTicketRequestStatus,
  TicketOrderStatus,
  type GetMyBookingsForEventData,
} from "@dataconnect/generated";
import {
  getBookingPaymentAdjustmentStatusLabel,
  getBookingStatusLabel,
  getTicketOrderStatusLabel,
} from "../../../shared/utils/paymentStatusLabels";

type TerminalBooking = NonNullable<GetMyBookingsForEventData["user"]>["bookings"][number];

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

function ticketTypeIdsFromBooking(booking: TerminalBooking): string[] {
  return (booking.lines ?? [])
    .map((line) => line.ticketType?.id)
    .filter((id): id is string => Boolean(id));
}

export function summarizeGuestTicketRequests(
  requests: TerminalBooking["guestTicketRequests"]
): EventBookingGuestRequestSummary {
  const list = requests ?? [];
  return {
    pendingCount: list.filter((r) => r.status === GuestTicketRequestStatus.PENDING).length,
    approvedCount: list.filter((r) => r.status === GuestTicketRequestStatus.APPROVED).length,
    rejectedCount: list.filter((r) => r.status === GuestTicketRequestStatus.REJECTED).length,
    hasPending: list.some((r) => r.status === GuestTicketRequestStatus.PENDING),
  };
}

export function summarizeEventBookingPayment(params: {
  booking: TerminalBooking;
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
    steps.push("Your last payment attempt failed. Use Pay now to try again.");
  } else if (paymentSummary.kind === "adjustment_charge") {
    steps.push("An additional payment is being processed for your latest booking revision.");
  } else if (paymentSummary.kind === "adjustment_refund") {
    steps.push("A refund for your booking revision is being processed.");
  }

  if (guestSummary.hasPending) {
    steps.push("Your extra guest ticket request is awaiting moderator review.");
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

export function getEventBookingStatusHeading(booking: TerminalBooking): string {
  return `${getBookingStatusLabel(booking.status)} · revision ${booking.revisionNumber}`;
}
