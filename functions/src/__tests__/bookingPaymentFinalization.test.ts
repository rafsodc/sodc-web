import { describe, expect, it, vi } from "vitest";
import {
  BookingApprovalStatus,
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import { confirmBookingIfFullyPaid } from "../bookingPaymentFinalization";

function booking(status: TicketOrderStatus, approvalStatus = BookingApprovalStatus.APPROVED) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    status: BookingStatus.SUBMITTED,
    approvalStatus,
    revisionGroupId: "20000000-0000-4000-8000-000000000001",
    revisionNumber: 1,
    supersededAt: null,
    lines: [{
      id: "line-1",
      bookingPlace: { id: "place-1", paymentAllocations: [{ id: "allocation-1", allocatedAmountMinor: 5000, refundedAmountMinor: 0, stripeRefundId: null, createdAt: "2026-08-01T10:00:00Z", ticketOrder: { id: "order-1", status, stripePaymentIntentId: "pi_test" } }] },
      sortOrder: 0,
      ticketType: { id: "ticket-1", title: "Ticket", price: 50, audience: "MEMBER" },
    }],
  };
}

describe("booking payment finalization", () => {
  it("confirms an approval-eligible booking after every exact place is paid", async () => {
    const updateBookingStatus = vi.fn().mockResolvedValue({ data: {} });
    const settleAdjustments = vi.fn().mockResolvedValue({ data: {} });
    const result = await confirmBookingIfFullyPaid(
      { bookerId: "user-1", eventId: "30000000-0000-4000-8000-000000000001" },
      {
        getBookings: vi.fn().mockResolvedValue({ data: { user: { bookings: [booking(TicketOrderStatus.PAID)] } } }),
        updateBookingStatus,
        settleAdjustments,
      } as never
    );
    expect(result.confirmed).toBe(true);
    expect(updateBookingStatus).toHaveBeenCalledWith(expect.objectContaining({ status: BookingStatus.CONFIRMED }));
    expect(settleAdjustments).toHaveBeenCalledWith({
      revisionBookingId: "10000000-0000-4000-8000-000000000001",
      status: BookingPaymentAdjustmentStatus.SETTLED,
    });
  });

  it.each([
    [TicketOrderStatus.PENDING, BookingApprovalStatus.APPROVED],
    [TicketOrderStatus.PAID, BookingApprovalStatus.PENDING],
  ])("does not confirm with payment %s and approval %s", async (paymentStatus, approvalStatus) => {
    const updateBookingStatus = vi.fn();
    const result = await confirmBookingIfFullyPaid(
      { bookerId: "user-1", eventId: "30000000-0000-4000-8000-000000000001" },
      {
        getBookings: vi.fn().mockResolvedValue({ data: { user: { bookings: [booking(paymentStatus, approvalStatus)] } } }),
        updateBookingStatus,
        settleAdjustments: vi.fn(),
      } as never
    );
    expect(result.confirmed).toBe(false);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });
});
