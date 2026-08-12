import { describe, expect, it } from "vitest";
import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";
import { computeBookingPaymentDelta } from "../bookingPaymentAdjustments";

describe("bookingPaymentAdjustments", () => {
  const settledAllocation = {
    allocatedAmountMinor: 3000,
    refundedAmountMinor: 0,
    ticketOrder: { status: "PAID" },
  };

  it("marks refund path when revised booking total decreases", () => {
    const result = computeBookingPaymentDelta(
      { lines: [
        { ticketType: { price: 30 }, bookingPlace: { paymentAllocations: [settledAllocation] } },
        { ticketType: { price: 20 } },
      ] },
      { lines: [{ ticketType: { price: 30 } }] }
    );
    expect(result.deltaAmountMinor).toBe(-2000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND);
  });

  it("marks charge path when revised booking total increases", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{
        ticketType: { price: 30 },
        bookingPlace: { paymentAllocations: [settledAllocation] },
      }] },
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

  it("keeps an amended unpaid booking wholly unpaid", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{ ticketType: { price: 30 }, bookingPlace: { paymentAllocations: [] } }] },
      { lines: [{ ticketType: { price: 30 } }, { ticketType: { price: 20 } }] }
    );

    expect(result.previousTotalMinor).toBe(3000);
    expect(result.revisedTotalMinor).toBe(5000);
    expect(result.deltaAmountMinor).toBe(0);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
  });

  it("does not treat an uncompleted checkout as settled payment", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{
        ticketType: { price: 30 },
        bookingPlace: { paymentAllocations: [{
          allocatedAmountMinor: 3000,
          refundedAmountMinor: 0,
          ticketOrder: { status: "PENDING" },
        }] },
      }] },
      { lines: [{ ticketType: { price: 30 } }, { ticketType: { price: 20 } }] }
    );

    expect(result.deltaAmountMinor).toBe(0);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
  });

  it("treats a missing previous booking as having no payable lines", () => {
    const result = computeBookingPaymentDelta(
      undefined,
      { lines: [{ ticketType: { price: 30 } }] }
    );

    expect(result.previousTotalMinor).toBe(0);
    expect(result.deltaAmountMinor).toBe(0);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
  });
});
