import { ORGANISER_GUEST } from "../../shared/utils/ticketAudienceLabels";
import { BookingApprovalStatus } from "@dataconnect/generated";
import type { EventAttendeeTicketRow } from "../admin/utils/bookingApprovalsAdmin";
import type { Guest } from "./api";
export function organiserGuestTicketRows(
  guests: readonly Guest[],
): EventAttendeeTicketRow[] {
  return guests
    .filter((g) => !g.cancelled)
    .map((g) => ({
      key: `organiser:${g.id}`,
      bookingId: g.id,
      attendeeName: `${g.firstName} ${g.lastName}`,
      rank: null,
      audience: ORGANISER_GUEST,
      ticketType: `${g.ticketTitle} (organiser guest)`,
      includesDinner: g.includesDinner,
      includesSymposium: g.includesSymposium,
      accommodationRequested: false,
      seatingPreferences: [],
      dietaryNote: g.dietaryRequirements,
      approvalStatus: BookingApprovalStatus.NOT_REQUIRED,
      paymentState:
        g.paymentStatus === "FREE"
          ? "FREE"
          : g.paymentStatus === "UNPAID"
            ? "UNPAID"
            : g.paymentStatus === "REFUNDED"
              ? "REFUNDED"
              : g.paymentStatus === "REFUND_PENDING"
                ? "REFUND_PENDING"
                : g.paymentStatus === "PARTIALLY_REFUNDED"
                  ? "PARTIALLY_REFUNDED"
                  : "PAID",
    }));
}
