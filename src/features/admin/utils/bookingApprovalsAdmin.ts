import type { ManagedTicketAudience } from "../../../shared/utils/ticketAudienceLabels";
import {
  BookingApprovalStatus,
  BookingStatus,
  MembershipStatus,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/generated";
import type { EventBookingAdminRow } from "../components/sectionEventsManagerTypes";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";

export type TicketOrdersById = ReadonlyMap<string, { id: string; status: TicketOrderStatus }>;

export type AttendeePaymentState =
  | "FREE"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAYMENT_PENDING"
  | "PAID"
  | "REFUNDED"
  | "UNKNOWN"
  | "PARTIALLY_REFUNDED"
  | "REFUND_PENDING"
  | "REFUND_FAILED";

export interface EventAttendeeTicketRow {
  key: string;
  bookingId: string;
  attendeeName: string;
  email: string | null;
  rank: string | null;
  membershipStatus: MembershipStatus | null;
  audience: ManagedTicketAudience;
  ticketType: string;
  includesDinner: boolean;
  includesSymposium: boolean;
  accommodationRequested: boolean;
  seatingPreferences: string[];
  dietaryNote: string | null;
  approvalStatus: BookingApprovalStatus;
  paymentState: AttendeePaymentState;
}

export interface EventAttendeeTicketFilters {
  attendeeName: string;
  rank: string;
  membershipStatus: string;
  audience: string;
  ticketType: string;
  includesDinner: string;
  includesSymposium: string;
  accommodationRequested: string;
  approvalStatus: string;
  paymentState: string;
}

export const emptyEventAttendeeTicketFilters: EventAttendeeTicketFilters = {
  attendeeName: "",
  rank: "",
  membershipStatus: "",
  audience: "",
  ticketType: "",
  includesDinner: "",
  includesSymposium: "",
  accommodationRequested: "",
  approvalStatus: "",
  paymentState: "",
};

function includesText(value: string | null, filter: string): boolean {
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  return !normalizedFilter || (value ?? "").toLocaleLowerCase().includes(normalizedFilter);
}

function matchesBoolean(value: boolean, filter: string): boolean {
  return !filter || (value ? "YES" : "NO") === filter;
}

export function filterEventAttendeeTicketRows(
  rows: readonly EventAttendeeTicketRow[],
  filters: EventAttendeeTicketFilters
): EventAttendeeTicketRow[] {
  return rows.filter(
    (row) =>
      includesText(row.attendeeName, filters.attendeeName) &&
      includesText(row.rank, filters.rank) &&
      (!filters.membershipStatus || row.membershipStatus === filters.membershipStatus) &&
      (!filters.audience || row.audience === filters.audience) &&
      includesText(row.ticketType, filters.ticketType) &&
      matchesBoolean(row.includesDinner, filters.includesDinner) &&
      matchesBoolean(row.includesSymposium, filters.includesSymposium) &&
      matchesBoolean(row.accommodationRequested, filters.accommodationRequested) &&
      (!filters.approvalStatus || row.approvalStatus === filters.approvalStatus) &&
      (!filters.paymentState || row.paymentState === filters.paymentState)
  );
}

export function uniqueEventAttendeeEmails(rows: readonly EventAttendeeTicketRow[]): string[] {
  const emails = new Map<string, string>();
  for (const row of rows) {
    const email = row.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!emails.has(key)) emails.set(key, email);
  }
  return Array.from(emails.values());
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
  ticketOrdersById: TicketOrdersById,
  settledCreditMinor?: number
): AttendeePaymentState {
  const requiredMinor = line.priceMinor ?? Math.round(line.ticketType.price * 100);
  if (requiredMinor <= 0) return "FREE";
  const allocations = line.bookingPlace.paymentAllocations ?? [];
  if (allocations.some((allocation) => !ticketOrdersById.has(allocation.ticketOrderId))) return "UNKNOWN";

  let settledMinor = 0;
  let pendingMinor = 0;
  let settledAllocatedMinor = 0;
  let settledRefundedMinor = 0;
  for (const allocation of allocations) {
    const status = ticketOrdersById.get(allocation.ticketOrderId)?.status;
    if (status === TicketOrderStatus.PAID || status === TicketOrderStatus.REFUNDED) {
      settledAllocatedMinor += allocation.allocatedAmountMinor;
      settledRefundedMinor += allocation.refundedAmountMinor;
      if (allocation.refundFailureReason) return "REFUND_FAILED";
      if ((allocation.refundPendingAmountMinor ?? 0) > 0) return "REFUND_PENDING";
      settledMinor += Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor);
    } else if (status === TicketOrderStatus.PENDING) {
      pendingMinor += Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor);
    }
  }
  settledMinor = settledCreditMinor ?? settledMinor;
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
  return currentActiveBookings(bookings).flatMap((booking) => {
    const history = bookings.filter((row) =>
      row.revisionGroupId.replace(/-/g, "").toLowerCase() === booking.revisionGroupId.replace(/-/g, "").toLowerCase() &&
      row.booker.id === booking.booker.id
    );
    const allocations = new Map(history.flatMap((row) => row.lines.flatMap((line) =>
      line.bookingPlace?.paymentAllocations ?? []
    )).map((allocation) => [allocation.id, allocation]));
    // Credit remains with the booking/payer when a paid place is replaced.
    // Apply it once in the same line order as the checkout calculation.
    let creditMinor = Array.from(allocations.values()).reduce((total, allocation) => {
      const status = ticketOrdersById.get(allocation.ticketOrderId)?.status;
      return status === TicketOrderStatus.PAID || status === TicketOrderStatus.REFUNDED
        ? total + Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor - (allocation.refundPendingAmountMinor ?? 0))
        : total;
    }, 0);
    return [...booking.lines]
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
        const priceMinor = line.priceMinor ?? Math.round(line.ticketType.price * 100);
        const appliedCreditMinor = Math.min(priceMinor, creditMinor);
        creditMinor -= appliedCreditMinor;
        return {
          key: `${booking.id}:${line.id}`,
          bookingId: booking.id,
          attendeeName,
          email:
            line.ticketType.audience === TicketAudience.MEMBER
              ? booking.booker.email.trim() || null
              : line.guestUser?.email?.trim() || null,
          rank: (line.ticketType.audience === TicketAudience.MEMBER ? booking.booker.rank : line.guestUser?.rank)?.trim() || null,
          membershipStatus:
            line.ticketType.audience === TicketAudience.MEMBER
              ? booking.booker.membershipStatus
              : line.guestUser?.membershipStatus ?? null,
          audience: line.ticketType.audience,
          ticketType: line.ticketType.title,
          includesDinner: line.ticketType.includesDinner,
          includesSymposium: line.ticketType.includesSymposium,
          accommodationRequested: booking.accommodationRequested,
          seatingPreferences,
          dietaryNote: line.dietaryNote?.trim() || null,
          approvalStatus: booking.approvalStatus,
          paymentState: attendeePaymentState(line, ticketOrdersById, appliedCreditMinor),
        };
      });
  });
}

function csvCell(value: string | number): string {
  const rawText = String(value);
  const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function eventTicketRowsCsv(rows: readonly EventAttendeeTicketRow[]): string {
  const header = [
    "Attendee",
    "Rank",
    "Membership status",
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
    row.rank ?? "",
    row.membershipStatus ? getMembershipStatusLabel(row.membershipStatus) : "",
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
