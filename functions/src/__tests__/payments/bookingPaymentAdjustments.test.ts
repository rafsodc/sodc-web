import { describe, expect, it } from "vitest";
import { BookingPaymentAdjustmentStatus } from "@dataconnect/admin-generated";
import { computeBookingPaymentDelta } from "../../bookingPaymentAdjustments";

describe("bookingPaymentAdjustments", () => {
  const settledAllocation = {
    allocatedAmountMinor: 3000,
    refundedAmountMinor: 0,
    ticketOrder: { status: "PAID" },
  };

  it("does not create a refund when the revised total still equals the settled amount", () => {
    const result = computeBookingPaymentDelta(
      { lines: [
        { ticketType: { price: 30 }, bookingPlace: { paymentAllocations: [settledAllocation] } },
        { ticketType: { price: 20 } },
      ] },
      { lines: [{ ticketType: { price: 30 } }] }
    );
    expect(result.deltaAmountMinor).toBe(0);
    expect(result.paymentRemainingMinor).toBe(0);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
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
    expect(result.paymentRemainingMinor).toBe(2000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE);
  });

  it("marks no adjustment when totals are unchanged", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{ ticketType: { price: 30 } }] },
      { lines: [{ ticketType: { price: 30 } }] }
    );
    expect(result.deltaAmountMinor).toBe(0);
    expect(result.paymentRemainingMinor).toBe(3000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
  });

  it("keeps an amended unpaid booking wholly unpaid, with the full revised total still owed", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{ ticketType: { price: 30 }, bookingPlace: { paymentAllocations: [] } }] },
      { lines: [{ ticketType: { price: 30 } }, { ticketType: { price: 20 } }] }
    );

    expect(result.previousTotalMinor).toBe(3000);
    expect(result.revisedTotalMinor).toBe(5000);
    expect(result.deltaAmountMinor).toBe(0);
    expect(result.paymentRemainingMinor).toBe(5000);
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
    expect(result.paymentRemainingMinor).toBe(5000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
  });

  it("keeps an earlier unpaid line owed when a further revision is submitted before it was ever settled", () => {
    // Paid for ticket A (£10). Added ticket B (£10) — that revision's extra £10 was
    // never paid. Now a third ticket C (£10) is added on top, before B was settled.
    const result = computeBookingPaymentDelta(
      { lines: [
        { ticketType: { price: 10 }, bookingPlace: { paymentAllocations: [{
          allocatedAmountMinor: 1000,
          refundedAmountMinor: 0,
          ticketOrder: { status: "PAID" },
        }] } }, // ticket A: settled
        { ticketType: { price: 10 }, bookingPlace: { paymentAllocations: [] } }, // ticket B: still unpaid
      ] },
      { lines: [{ ticketType: { price: 10 } }, { ticketType: { price: 10 } }, { ticketType: { price: 10 } }] }
    );

    expect(result.previousTotalMinor).toBe(2000);
    expect(result.revisedTotalMinor).toBe(3000);
    // Only A is settled, so B's unpaid £10 must not be dropped: £20 remains (B + C), not £10.
    expect(result.paymentRemainingMinor).toBe(2000);
    expect(result.deltaAmountMinor).toBe(2000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE);
  });

  it("does not refund a partially paid booking while its revised total still exceeds settlement", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{
        ticketType: { price: 50 },
        bookingPlace: { paymentAllocations: [{
          allocatedAmountMinor: 2000,
          refundedAmountMinor: 0,
          ticketOrder: { status: "PAID" },
        }] },
      }] },
      { lines: [{ ticketType: { price: 40 } }] }
    );

    expect(result.paymentRemainingMinor).toBe(2000);
    expect(result.deltaAmountMinor).toBe(2000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE);
  });

  it("bases refunds on net settled allocations after earlier refunds", () => {
    const result = computeBookingPaymentDelta(
      { lines: [{
        ticketType: { price: 50 },
        bookingPlace: { paymentAllocations: [{
          allocatedAmountMinor: 5000,
          refundedAmountMinor: 1000,
          ticketOrder: { status: "PAID" },
        }] },
      }] },
      { lines: [{ ticketType: { price: 30 } }] }
    );

    expect(result.paymentRemainingMinor).toBe(0);
    expect(result.deltaAmountMinor).toBe(-1000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND);
  });

  it("treats a missing previous booking as having no payable lines, so the revised total is fully owed", () => {
    const result = computeBookingPaymentDelta(
      undefined,
      { lines: [{ ticketType: { price: 30 } }] }
    );

    expect(result.previousTotalMinor).toBe(0);
    expect(result.deltaAmountMinor).toBe(0);
    expect(result.paymentRemainingMinor).toBe(3000);
    expect(result.status).toBe(BookingPaymentAdjustmentStatus.NOT_REQUIRED);
  });

  it("nets a paid replacement against the full revision history", () => {
    const paidHistory = { lines: [{
      priceMinor: 5_000,
      ticketType: { price: 50 },
      bookingPlace: { paymentAllocations: [{
        id: "allocation-1",
        allocatedAmountMinor: 5_000,
        refundedAmountMinor: 0,
        refundPendingAmountMinor: 0,
        ticketOrder: { status: "PAID" },
      }] },
    }] };
    const upgraded = computeBookingPaymentDelta(
      paidHistory,
      { lines: [{ priceMinor: 7_000, ticketType: { price: 70 } }] },
      { financialHistory: [paidHistory], includeUnpaidBalance: true }
    );
    const downgraded = computeBookingPaymentDelta(
      paidHistory,
      { lines: [{ priceMinor: 3_000, ticketType: { price: 30 } }] },
      { financialHistory: [paidHistory], includeUnpaidBalance: true }
    );

    expect(upgraded).toMatchObject({ paymentRemainingMinor: 2_000, refundDueMinor: 0, deltaAmountMinor: 2_000 });
    expect(downgraded).toMatchObject({ paymentRemainingMinor: 0, refundDueMinor: 2_000, deltaAmountMinor: -2_000 });
  });

  it("counts a reused allocation once and treats a pending refund as committed", () => {
    const allocation = {
      id: "allocation-1",
      allocatedAmountMinor: 5_000,
      refundedAmountMinor: 500,
      refundPendingAmountMinor: 500,
      ticketOrder: { status: "PAID" },
    };
    const oldRevision = { lines: [{ ticketType: { price: 50 }, bookingPlace: { paymentAllocations: [allocation] } }] };
    const currentRevision = { lines: [{ ticketType: { price: 50 }, bookingPlace: { paymentAllocations: [allocation] } }] };
    const result = computeBookingPaymentDelta(
      currentRevision,
      { lines: [{ priceMinor: 3_000, ticketType: { price: 30 } }] },
      { financialHistory: [oldRevision, currentRevision], includeUnpaidBalance: true }
    );

    expect(result).toMatchObject({
      settledAmountMinor: 4_000,
      refundedAmountMinor: 500,
      pendingRefundAmountMinor: 500,
      refundDueMinor: 1_000,
    });
  });
});
