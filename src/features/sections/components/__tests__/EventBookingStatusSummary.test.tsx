import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "../../../../test-utils";
import { BookingStatus, TicketAudience, TicketOrderStatus } from "@dataconnect/generated";
import EventBookingStatusSummary from "../EventBookingStatusSummary";

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    status: BookingStatus.SUBMITTED,
    approvalStatus: "NOT_REQUIRED",
    approvalNote: null,
    revisionNumber: 1,
    supersededAt: null,
    updatedAt: "2026-08-11T10:00:00Z",
    lines: [{
      id: "line-1",
      sortOrder: 0,
      guestDisplayName: null,
      dietaryNote: null,
      bookingPlace: { id: "place-1", paymentAllocations: [] },
      ticketType: { id: "ticket-member", title: "Member standard", audience: TicketAudience.MEMBER, price: 50 },
    }],
    guestTicketRequests: [],
    ...overrides,
  } as never;
}

function renderSummary(args: { booking?: ReturnType<typeof booking>; orders?: unknown[] } = {}) {
  render(
    <MemoryRouter>
      <EventBookingStatusSummary
        booking={args.booking ?? booking()}
        eventId="event-1"
        eventTitle="Annual Dinner"
        ticketOrders={(args.orders ?? []) as never}
        paymentAdjustments={[]}
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
});
