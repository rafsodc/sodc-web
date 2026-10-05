import type { ManagedTicketAudience } from "../../../shared/utils/ticketAudienceLabels";
import type {
  GetEventByIdData,
  ListBookingPaymentAdjustmentsForAdminData,
  ListEventBookingsForAdminData,
  ListTicketOrdersForAdminData,
} from "@dataconnect/generated";

export interface EventRow {
  id: string;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  sponsors?: string | null;
  details?: string | null;
  startDateTime: string;
  endDateTime: string;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
  maxGuestsWithoutModeratorApproval: number;
}

type StoredTicketType = NonNullable<GetEventByIdData["event"]>["ticketTypes"][number];
export type TicketTypeRow = Omit<StoredTicketType, "audience" | "userGroup"> & {
  audience: ManagedTicketAudience;
  userGroup: StoredTicketType["userGroup"] | null;
  active?: boolean;
  version?: number;
};
export type EventBookingAdminRow = NonNullable<NonNullable<ListEventBookingsForAdminData["event"]>["bookings"][number]>;
export type TicketOrderAdminRow = NonNullable<NonNullable<ListTicketOrdersForAdminData["event"]>["ticketOrders"][number]>;
export type BookingPaymentAdjustmentAdminRow = NonNullable<
  NonNullable<ListBookingPaymentAdjustmentsForAdminData["event"]>["bookings"][number]
>;
export type BookingApprovalStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
