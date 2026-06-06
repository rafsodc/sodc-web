import { describe, expect, it } from "vitest";
import { BookingStatus } from "@dataconnect/generated";
import { bookingStatusChipColor, getMyBookingActionLabel } from "../myBookingsDisplay";

describe("myBookingsDisplay", () => {
  it("returns action labels by booking status", () => {
    expect(getMyBookingActionLabel(BookingStatus.DRAFT)).toBe("Continue booking");
    expect(getMyBookingActionLabel(BookingStatus.SUBMITTED)).toBe("View booking");
  });

  it("maps booking status to chip colors", () => {
    expect(bookingStatusChipColor(BookingStatus.CONFIRMED)).toBe("success");
    expect(bookingStatusChipColor(BookingStatus.DRAFT)).toBe("warning");
  });
});
