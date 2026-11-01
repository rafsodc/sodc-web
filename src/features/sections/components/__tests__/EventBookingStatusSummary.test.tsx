import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "../../../../test-utils";
import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/generated";
import EventBookingStatusSummary from "../EventBookingStatusSummary";

function ticketLine(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-1",
    sortOrder: 0,
    guestDisplayName: null,
    dietaryNote: null,
    bookingPlace: { id: "place-1", attendanceRemoved: false, paymentAllocations: [] },
    ticketType: { id: "ticket-member", title: "Member standard", audience: TicketAudience.MEMBER, price: 50 },
    ...overrides,
  };
}

function removedLine() {
  return ticketLine({ bookingPlace: { id: "place-1", attendanceRemoved: true, paymentAllocations: [] } });
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    status: BookingStatus.SUBMITTED,
    approvalStatus: "NOT_REQUIRED",
    approvalNote: null,
    revisionNumber: 1,
    supersededAt: null,
    updatedAt: "2026-08-11T10:00:00Z",
    lines: [ticketLine()],
    ...overrides,
  } as never;
}

function renderSummary(args: {
  booking?: ReturnType<typeof booking>;
  paymentBooking?: ReturnType<typeof booking> | null;
  orders?: unknown[];
  adjustments?: unknown[];
} = {}) {
  render(
    <MemoryRouter>
      <EventBookingStatusSummary
        booking={args.booking ?? booking()}
        paymentBooking={args.paymentBooking}
        eventId="event-1"
        eventTitle="Annual Dinner"
        ticketOrders={(args.orders ?? []) as never}
        paymentAdjustments={(args.adjustments ?? []) as never}
        onEditBooking={vi.fn()}
        onPayNow={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe("EventBookingStatusSummary", () => {
  it("shows awaiting approval without offering payment", () => {
    renderSummary({ booking: booking({ approvalStatus: "PENDING" }) });
    expect(screen.getByRole("heading", { name: "Awaiting approval" })).toBeInTheDocument();
    expect(screen.getByText(/complete booking is with the organiser/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay/i })).not.toBeInTheDocument();
  });

  it("shows the organiser note and one edit action when changes are requested", () => {
    renderSummary({ booking: booking({ approvalStatus: "REJECTED", approvalNote: "Please confirm both guest names." }) });
    expect(screen.getByRole("heading", { name: "Changes requested" })).toBeInTheDocument();
    expect(screen.getByText("Please confirm both guest names.")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Edit booking" })).toBeInTheDocument();
  });

  it("directs an approved booking to payment", () => {
    renderSummary();
    expect(screen.getByRole("heading", { name: "Payment required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
  });

  it("continues to offer payment when a charge adjustment records the unpaid balance", () => {
    renderSummary({
      adjustments: [{
        status: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE,
        deltaAmountMinor: 5000,
      }],
    });

    expect(screen.getByRole("heading", { name: "Payment required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
  });

  it("shows confirmed when every ticket is paid", () => {
    renderSummary({
      orders: [{
        status: TicketOrderStatus.PAID,
        quantity: 1,
        event: { id: "event-1" },
        ticketType: { id: "ticket-member" },
      }],
    });
    expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
  });

  it("explains an active submitted booking whose only ticket place was removed", () => {
    renderSummary({ booking: booking({ revisionNumber: 3, lines: [removedLine()] }) });

    expect(screen.getByRole("heading", { name: "No active tickets" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "All tickets in this booking have been removed. Contact an organiser if you expected to attend or need help with payment.",
    );
    expect(screen.queryByRole("heading", { name: "Payment required" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay for all tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not describe removed tickets as a confirmed attendance even with a historical paid order", () => {
    renderSummary({
      booking: booking({ status: BookingStatus.CONFIRMED, lines: [removedLine()] }),
      orders: [{ status: TicketOrderStatus.PAID, quantity: 1, event: { id: "event-1" }, ticketType: { id: "ticket-member" } }],
    });

    expect(screen.getByRole("heading", { name: "No active tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Confirmed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay for all tickets" })).not.toBeInTheDocument();
  });

  it("keeps an active unpaid place payable when another place was removed", () => {
    renderSummary({ booking: booking({ lines: [removedLine(), ticketLine({
      id: "active-line", bookingPlace: { id: "active-place", attendanceRemoved: false, paymentAllocations: [] },
    })] }) });

    expect(screen.getByRole("heading", { name: "Payment required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "No active tickets" })).not.toBeInTheDocument();
  });

  it.each([
    { label: "empty", lines: [] },
    { label: "missing", lines: undefined },
  ])("does not claim tickets were removed when their lines are $label", ({ lines }) => {
    renderSummary({ booking: booking({ lines }) });

    expect(screen.queryByRole("heading", { name: "No active tickets" })).not.toBeInTheDocument();
    expect(screen.queryByText(/all tickets in this booking have been removed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay for all tickets" })).not.toBeInTheDocument();
  });

  it("does not treat an unknown removal flag as a removed active place", () => {
    renderSummary({ booking: booking({ lines: [removedLine(), ticketLine({
      id: "unknown-line", bookingPlace: { id: "unknown-place", paymentAllocations: [] },
    })] }) });

    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No active tickets" })).not.toBeInTheDocument();
  });

  it.each([
    ["PENDING", "Awaiting approval"],
    ["REJECTED", "Changes requested"],
  ])("preserves %s approval information when the displayed tickets are removed", (approvalStatus, heading) => {
    renderSummary({ booking: booking({ approvalStatus, lines: [removedLine()] }) });

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No active tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay for all tickets" })).not.toBeInTheDocument();
  });

  it("keeps the separate approved booking payable while removed pending changes await approval", () => {
    renderSummary({
      booking: booking({ id: "pending-revision", revisionNumber: 2, approvalStatus: "PENDING", lines: [removedLine()] }),
      paymentBooking: booking({ id: "approved-revision", approvalStatus: "APPROVED" }),
    });

    expect(screen.getByRole("heading", { name: "Awaiting approval" })).toBeInTheDocument();
    expect(screen.getByText("Current active booking")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No active tickets" })).not.toBeInTheDocument();
  });

  it("preserves refund-processing information after all tickets are removed", () => {
    renderSummary({
      booking: booking({ lines: [removedLine()] }),
      adjustments: [{ status: BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND, deltaAmountMinor: -5000 }],
    });

    expect(screen.getByRole("heading", { name: "Payment processing" })).toBeInTheDocument();
    expect(screen.getByText("Your booking change is saved and the refund is being processed.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No active tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay for all tickets" })).not.toBeInTheDocument();
  });

  it("preserves payment-processing information for an active place", () => {
    renderSummary({
      orders: [{ status: TicketOrderStatus.PENDING, quantity: 1, event: { id: "event-1" }, ticketType: { id: "ticket-member" } }],
    });

    expect(screen.getByRole("heading", { name: "Payment processing" })).toBeInTheDocument();
    expect(screen.getByText("Your payment is being processed. This page will update when it completes.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No active tickets" })).not.toBeInTheDocument();
  });
});
