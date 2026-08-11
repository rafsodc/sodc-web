import { toUserFacingError, type UserFacingErrorInput } from "./errorHandling";

export type BookingErrorContext =
  | "booking-submit"
  | "checkout-start"
  | "guest-request"
  | "payment-history";

const BOOKING_DOMAIN_ERRORS: Record<string, UserFacingErrorInput> = {
  INVALID_LINES: {
    category: "validation",
    title: "Check your booking",
    message: "Add at least one valid ticket and review the booking details.",
    retryable: false,
  },
  NO_SECTION_ACCESS: {
    category: "authorization",
    title: "Booking unavailable",
    message: "You do not have access to book this section’s events.",
    retryable: false,
  },
  NO_BOOKER_PURPOSE: {
    category: "authorization",
    title: "Booking unavailable",
    message: "Online booking is not available to your membership group for this event.",
    retryable: false,
  },
  NOT_AUTHORIZED_BOOKER: {
    category: "authorization",
    title: "Booking unavailable",
    message: "You are not eligible to book this event.",
    retryable: false,
  },
  OUTSIDE_BOOKING_WINDOW: {
    category: "precondition",
    title: "Booking closed",
    message: "The booking window is closed.",
    retryable: false,
  },
  TICKET_TYPE_NOT_FOUND: {
    category: "not-found",
    title: "Ticket unavailable",
    message: "A selected ticket is no longer available. Refresh and choose another ticket.",
    retryable: true,
  },
  INELIGIBLE_TICKET_TYPE: {
    category: "authorization",
    title: "Ticket unavailable",
    message: "You are not eligible for one of the selected ticket types.",
    retryable: false,
  },
  SELF_TICKET_REQUIRED: {
    category: "validation",
    title: "Member ticket required",
    message: "Choose a ticket for yourself before adding guests.",
    retryable: false,
  },
  GUEST_BEFORE_SELF: {
    category: "validation",
    title: "Check your booking",
    message: "Choose your member ticket before adding a guest ticket.",
    retryable: false,
  },
  TOO_MANY_GUEST_LINES: {
    category: "validation",
    title: "Too many guests",
    message: "Reduce the number of guests and submit the complete booking again.",
    retryable: false,
  },
  INVALID_GUEST_FIELDS: {
    category: "validation",
    title: "Check guest details",
    message: "Review the guest names and ticket types, then try again.",
    retryable: false,
  },
  GUEST_APPROVAL_REQUIRED: {
    category: "precondition",
    title: "Guest approval required",
    message: "One or more guest places need moderator approval before you can continue.",
    retryable: false,
  },
  BOOKING_ALREADY_SUBMITTED: {
    category: "conflict",
    title: "Already booked",
    message: "You already have a submitted booking for this event.",
    retryable: false,
  },
  BOOKING_REVISION_BASE_REQUIRED: {
    category: "conflict",
    title: "Booking changed",
    message: "Refresh your booking before making further changes.",
    retryable: true,
  },
  BOOKING_REVISION_BASE_NOT_FOUND: {
    category: "conflict",
    title: "Booking changed",
    message: "The booking you tried to update is no longer current. Refresh and review the latest booking.",
    retryable: true,
  },
  BOOKING_REVISION_CONFLICT: {
    category: "conflict",
    title: "Booking changed",
    message: "Your booking changed while you were editing it. Refresh and review the latest version.",
    retryable: true,
  },
  PAID_BOOKING_PLACE_REMOVAL_REQUIRES_REFUND: {
    category: "precondition",
    title: "Paid ticket cannot be changed",
    message: "This ticket has already been paid for. Guest refunds and ticket transfers are not available yet.",
    retryable: false,
  },
};

const FALLBACKS: Record<BookingErrorContext, UserFacingErrorInput> = {
  "booking-submit": {
    title: "Booking not submitted",
    message: "We couldn’t submit your booking. Please try again.",
    retryable: true,
  },
  "checkout-start": {
    title: "Checkout not started",
    message: "We couldn’t start checkout. Please try again.",
    retryable: true,
  },
  "guest-request": {
    title: "Request not submitted",
    message: "We couldn’t update the booking. Please try again.",
    retryable: true,
  },
  "payment-history": {
    title: "Payments unavailable",
    message: "We couldn’t load your payment history. Please try again.",
    retryable: true,
  },
};

export function toBookingUserFacingError(error: unknown, context: BookingErrorContext) {
  return toUserFacingError(error, {
    domainErrors: BOOKING_DOMAIN_ERRORS,
    fallback: FALLBACKS[context],
  });
}
