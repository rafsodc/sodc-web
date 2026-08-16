import {
  BookingApprovalStatus,
  BookingStatus,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/generated";
import type { EventBookingAdminRow } from "../components/sectionEventsManagerTypes";

export type TicketOrdersById = ReadonlyMap<string, { id: string; status: TicketOrderStatus }>;

export type AttendeePaymentState =
  | "FREE"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAYMENT_PENDING"
  | "PAID"
  | "REFUNDED"
  | "UNKNOWN";

export interface EventAttendeeTicketRow {
  key: string;
  bookingId: string;
  attendeeName: string;
  audience: TicketAudience;
  ticketType: string;
  includesDinner: boolean;
  includesSymposium: boolean;
  accommodationRequested: boolean;
  seatingPreferences: string[];
  dietaryNote: string | null;
  approvalStatus: BookingApprovalStatus;
  paymentState: AttendeePaymentState;
}

function terminal(booking: EventBookingAdminRow): boolean {
  return booking.status === BookingStatus.SUBMITTED || booking.status === BookingStatus.CONFIRMED;
}

function payableApproval(booking: EventBookingAdminRow): boolean {
  return (
    booking.approvalStatus === BookingApprovalStatus.NOT_REQUIRED ||
    booking.approvalStatus === BookingApprovalStatus.APPROVED
  );
}

export function pendingBookingRevisions(bookings: readonly EventBookingAdminRow[]): EventBookingAdminRow[] {
  return bookings
    .filter(
      (booking) =>
        terminal(booking) &&
        booking.supersededAt == null &&
        booking.approvalStatus === BookingApprovalStatus.PENDING
    )
    .sort((left, right) => right.revisionNumber - left.revisionNumber);
}

export function currentActiveBookings(bookings: readonly EventBookingAdminRow[]): EventBookingAdminRow[] {
  const latestByGroup = new Map<string, EventBookingAdminRow>();
  for (const booking of bookings) {
    if (!terminal(booking) || booking.supersededAt != null || !payableApproval(booking)) continue;
    const current = latestByGroup.get(booking.revisionGroupId);
    if (!current || booking.revisionNumber > current.revisionNumber) {
      latestByGroup.set(booking.revisionGroupId, booking);
    }
  }
  return Array.from(latestByGroup.values());
}

export function previousActiveBooking(
  booking: EventBookingAdminRow,
  bookings: readonly EventBookingAdminRow[]
): EventBookingAdminRow | null {
  return (
    currentActiveBookings(bookings)
      .filter(
        (candidate) =>
          candidate.revisionGroupId === booking.revisionGroupId && candidate.id !== booking.id
      )
      .sort((left, right) => right.revisionNumber - left.revisionNumber)[0] ?? null
  );
}

export function attendeePaymentState(
  line: EventBookingAdminRow["lines"][number],
  ticketOrdersById: TicketOrdersById
): AttendeePaymentState {
  if (line.ticketType.price <= 0) return "FREE";
  const allocations = line.bookingPlace.paymentAllocations ?? [];
  if (allocations.some((allocation) => !ticketOrdersById.has(allocation.ticketOrderId))) return "UNKNOWN";

  const requiredMinor = Math.round(line.ticketType.price * 100);
  let settledMinor = 0;
  let pendingMinor = 0;
  let settledAllocatedMinor = 0;
  let settledRefundedMinor = 0;
  for (const allocation of allocations) {
    const status = ticketOrdersById.get(allocation.ticketOrderId)?.status;
    if (status === TicketOrderStatus.PAID || status === TicketOrderStatus.REFUNDED) {
      settledAllocatedMinor += allocation.allocatedAmountMinor;
      settledRefundedMinor += allocation.refundedAmountMinor;
      settledMinor += Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor);
    } else if (status === TicketOrderStatus.PENDING) {
      pendingMinor += Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor);
    }
  }
  if (settledMinor >= requiredMinor) return "PAID";
  const outstandingMinor = requiredMinor - settledMinor;
  if (pendingMinor >= outstandingMinor) return "PAYMENT_PENDING";
  if (settledMinor > 0) return "PARTIALLY_PAID";
  if (settledAllocatedMinor > 0 && settledRefundedMinor >= settledAllocatedMinor) return "REFUNDED";
  return "UNPAID";
}

export function activeEventTicketRows(
  bookings: readonly EventBookingAdminRow[],
  ticketOrdersById: TicketOrdersById,
  userNamesById: ReadonlyMap<string, string> = new Map()
): EventAttendeeTicketRow[] {
  return currentActiveBookings(bookings).flatMap((booking) =>
    [...booking.lines]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((line) => {
        const linkedName = line.guestUser
          ? `${line.guestUser.firstName} ${line.guestUser.lastName}`.trim()
          : "";
        const attendeeName =
          line.ticketType.audience === TicketAudience.MEMBER
            ? `${booking.booker.firstName} ${booking.booker.lastName}`.trim()
            : line.guestDisplayName?.trim() || linkedName || "Guest";
        const seatingPreferences = (booking.sitNextToUserIds ?? []).map(
          (userId) => userNamesById.get(userId) ?? "Unavailable member"
        );
        return {
          key: `${booking.id}:${line.id}`,
          bookingId: booking.id,
          attendeeName,
          audience: line.ticketType.audience,
          ticketType: line.ticketType.title,
          includesDinner: line.ticketType.includesDinner,
          includesSymposium: line.ticketType.includesSymposium,
          accommodationRequested: booking.accommodationRequested,
          seatingPreferences,
          dietaryNote: line.dietaryNote?.trim() || null,
          approvalStatus: booking.approvalStatus,
          paymentState: attendeePaymentState(line, ticketOrdersById),
        };
      })
  );
}

function csvCell(value: string | number): string {
  const rawText = String(value);
  const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function eventTicketRowsCsv(rows: readonly EventAttendeeTicketRow[]): string {
  const header = [
    "Attendee",
    "Audience",
    "Ticket",
    "Dinner",
    "Symposium",
    "Accommodation",
    "Seating preferences",
    "Dietary requirements",
    "Approval",
    "Payment",
  ];
  const body = rows.map((row) => [
    row.attendeeName,
    row.audience,
    row.ticketType,
    row.includesDinner ? "Yes" : "No",
    row.includesSymposium ? "Yes" : "No",
    row.accommodationRequested ? "Yes" : "No",
    row.seatingPreferences.join("; "),
    row.dietaryNote ?? "",
    row.approvalStatus,
    row.paymentState,
  ]);
  return [header, ...body].map((cells) => cells.map(csvCell).join(",")).join("\n");
}
