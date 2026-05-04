import { describe, expect, it } from "vitest";
import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";
import { computeBookingPaymentDelta } from "../bookingPaymentAdjustments";

describe("bookingPaymentAdjustments", () => {
  it("marks refund path when revised booking total decreases", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{ ticketType: { price: 30 } }, { ticketType: { price: 20 } }] },
      { lines: [{ ticketType: { price: 30 } }] }
    );
    expect(result.deltaAmountMinor).toBe(-2000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND);
  });

  it("marks charge path when revised booking total increases", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{ ticketType: { price: 30 } }] },
      { lines: [{ ticketType: { price: 30 } }, { ticketType: { price: 20 } }] }
    );
    expect(result.deltaAmountMinor).toBe(2000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE);
  });

  it("marks no adjustment when totals are unchanged", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{ ticketType: { price: 30 } }] },
      { lines: [{ ticketType: { price: 30 } }] }
    );
    expect(result.deltaAmountMinor).toBe(0);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
  });
});
