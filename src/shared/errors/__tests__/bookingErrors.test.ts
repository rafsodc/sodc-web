import { describe, expect, it } from "vitest";
import { toBookingUserFacingError } from "../bookingErrors";

describe("booking and payment error mapping", () => {
  it.each([
    ["INVALID_LINES", "Add at least one valid ticket"],
    ["NO_SECTION_ACCESS", "do not have access"],
    ["NO_BOOKER_PURPOSE", "not available to your membership group"],
    ["NOT_AUTHORIZED_BOOKER", "not eligible to book"],
    ["OUTSIDE_BOOKING_WINDOW", "booking window is closed"],
    ["TICKET_TYPE_NOT_FOUND", "no longer available"],
    ["INELIGIBLE_TICKET_TYPE", "not eligible for one of the selected"],
    ["SELF_TICKET_REQUIRED", "ticket for yourself"],
    ["GUEST_BEFORE_SELF", "member ticket before"],
    ["TOO_MANY_GUEST_LINES", "additional guest request"],
    ["INVALID_GUEST_FIELDS", "Review the guest names"],
    ["GUEST_APPROVAL_REQUIRED", "need moderator approval"],
    ["BOOKING_ALREADY_SUBMITTED", "already have a submitted booking"],
    ["BOOKING_REVISION_BASE_REQUIRED", "Refresh your booking"],
    ["BOOKING_REVISION_BASE_NOT_FOUND", "no longer current"],
    ["BOOKING_REVISION_CONFLICT", "changed while you were editing"],
    ["PAID_BOOKING_PLACE_REMOVAL_REQUIRES_REFUND", "already been paid"],
  ])("maps %s without exposing callable text", (code, expected) => {
    const mapped = toBookingUserFacingError(
      {
        code: "functions/failed-precondition",
        details: { code },
        message: "SQL booking_revision internal detail",
      },
      "booking-submit",
    );
    expect(mapped.message).toContain(expected);
    expect(mapped.message).not.toContain("SQL");
  });

  it.each([
    ["booking-submit", "We couldn’t submit your booking."],
    ["checkout-start", "We couldn’t start checkout."],
    ["guest-request", "We couldn’t submit the guest request."],
    ["payment-history", "We couldn’t load your payment history."],
  ] as const)("uses a safe %s fallback", (context, expected) => {
    const mapped = toBookingUserFacingError(
      new Error("Stripe secret and internal server detail"),
      context,
    );
    expect(mapped.message).toContain(expected);
    expect(mapped.message).not.toContain("Stripe");
  });
});
