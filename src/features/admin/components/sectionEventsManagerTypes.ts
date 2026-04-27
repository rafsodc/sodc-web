import type {
  GetEventByIdData,
  ListBookingPaymentAdjustmentsForAdminData,
  ListEventBookingsForAdminData,
  ListGuestTicketRequestsForAdminData,
  ListTicketOrdersForAdminData,
} from "@dataconnect/generated";

export interface EventRow {
  id: string;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: string;
  endDateTime: string;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
  maxGuestsWithoutModeratorApproval?: number | null;
}

export type TicketTypeRow = NonNullable<GetEventByIdData["event"]>["ticketTypes"][number];
export type GuestTicketRequestAdminRow = NonNullable<
  NonNullable<
    NonNullable<ListGuestTicketRequestsForAdminData["event"]>["bookings"][number]["guestTicketRequests"][number]
  >
>;
export type EventBookingAdminRow = NonNullable<NonNullable<ListEventBookingsForAdminData["event"]>["bookings"][number]>;
export type TicketOrderAdminRow = NonNullable<NonNullable<ListTicketOrdersForAdminData["event"]>["ticketOrders"][number]>;
export type BookingPaymentAdjustmentAdminRow = NonNullable<
  NonNullable<ListBookingPaymentAdjustmentsForAdminData["event"]>["bookings"][number]
>;
export type GuestRequestStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export type GuestTicketRequestWithBooking = GuestTicketRequestAdminRow & {
  bookingId: string;
  bookingStatus: string;
  booker?: {
    firstName: string;
    lastName: string;
  } | null;
};
