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

export type TicketTypeRow = NonNullable<GetEventByIdData["event"]>["ticketTypes"][number];
export type EventBookingAdminRow = NonNullable<NonNullable<ListEventBookingsForAdminData["event"]>["bookings"][number]>;
export type TicketOrderAdminRow = NonNullable<NonNullable<ListTicketOrdersForAdminData["event"]>["ticketOrders"][number]>;
export type BookingPaymentAdjustmentAdminRow = NonNullable<
  NonNullable<ListBookingPaymentAdjustmentsForAdminData["event"]>["bookings"][number]
>;
export type BookingApprovalStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
