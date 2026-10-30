import { attendeePaymentState } from "../../../../functions/src/shared/attendeeFilters";
export { attendeePaymentState, emptyEventAttendeeTicketFilters, filterEventAttendeeTicketRows } from "../../../../functions/src/shared/attendeeFilters";
export type { EventAttendeeTicketFilters } from "../../../../functions/src/shared/attendeeFilters";
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
  | "REFUND_PENDING";

export interface EventAttendeeTicketRow {
  key: string;
  bookingId: string;
  ticketId?: string;
  ticketTypeId?: string;
  attendanceVersion?: number;
  attendeeName: string;
  bookingOwnerName?: string;
  bookingOwnerEmail?: string | null;
  email: string | null;
  rank: string | null;
  membershipStatus: MembershipStatus | null;
  audience: ManagedTicketAudience;
  ticketType: string;
  includesDinner: boolean;
  includesSymposium: boolean;
  accommodationRequested: boolean;
  accommodationNote?: string | null;
  seatingPreferences: string[];
  sitNextToUserIds?: string[];
  dietaryNote: string | null;
  approvalStatus: BookingApprovalStatus;
  paymentState: AttendeePaymentState;
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

export function activeEventTicketRows(
  bookings: readonly EventBookingAdminRow[],
  ticketOrdersById: TicketOrdersById,
  userNamesById: ReadonlyMap<string, string> = new Map(),
  attendance: "current" | "removed" = "current"
): EventAttendeeTicketRow[] {
  return currentActiveBookings(bookings).flatMap((booking) =>
    [...booking.lines]
      .filter((line) => Boolean(line.bookingPlace?.attendanceRemoved) === (attendance === "removed"))
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((line) => {
        const ticket = line.bookingPlace?.attendanceTicketType ?? line.ticketType;
        const linkedName = line.guestUser
          ? `${line.guestUser.firstName} ${line.guestUser.lastName}`.trim()
          : "";
        const attendeeName =
          line.ticketType.audience === TicketAudience.MEMBER
            ? `${booking.booker.firstName} ${booking.booker.lastName}`.trim()
            : line.guestDisplayName?.trim() || linkedName || "Guest";
        const seatingPreferences = (line.bookingPlace?.attendanceSitNextToUserIds ?? booking.sitNextToUserIds ?? []).map(
          (userId) => userNamesById.get(userId) ?? "Unavailable member"
        );
        return {
          key: `${booking.id}:${line.id}`,
          bookingId: booking.id,
          ticketId: line.id,
          ticketTypeId: ticket.id,
          attendanceVersion: line.bookingPlace?.attendanceVersion ?? 0,
          attendeeName: line.bookingPlace?.attendanceName ?? attendeeName,
          bookingOwnerName: `${booking.booker.firstName} ${booking.booker.lastName}`.trim(),
          bookingOwnerEmail: booking.booker.email.trim() || null,
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
          ticketType: ticket.title,
          includesDinner: ticket.includesDinner,
          includesSymposium: ticket.includesSymposium,
          accommodationRequested: line.bookingPlace?.attendanceAccommodationRequested ?? booking.accommodationRequested,
          accommodationNote: line.bookingPlace?.attendanceAccommodationNote ?? booking.accommodationNote ?? null,
          seatingPreferences,
          sitNextToUserIds: line.bookingPlace?.attendanceSitNextToUserIds ?? booking.sitNextToUserIds ?? [],
          dietaryNote: line.bookingPlace?.attendanceDietaryNote ?? (line.dietaryNote?.trim() || null),
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
    "Rank",
    "Membership status",
    "Audience",
    "Ticket",
    "Dinner",
    "Symposium",
    "Accommodation",
    "Accommodation notes",
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
    row.accommodationNote ?? "",
    row.seatingPreferences.join("; "),
    row.dietaryNote ?? "",
    row.approvalStatus,
    row.paymentState,
  ]);
  return [header, ...body].map((cells) => cells.map(csvCell).join(",")).join("\n");
}
