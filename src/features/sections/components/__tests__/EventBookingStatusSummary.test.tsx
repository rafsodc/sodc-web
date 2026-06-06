import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "../../../../test-utils";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import EventBookingStatusSummary from "../EventBookingStatusSummary";
import { BookingStatus, TicketOrderStatus } from "@dataconnect/generated";

describe("EventBookingStatusSummary", () => {
  const onEditBooking = vi.fn();
  const onPayNow = vi.fn();

  const renderSummary = (ui: ReactElement) =>
    render(<MemoryRouter>{ui}</MemoryRouter>);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows pending payment and guest review actions", () => {
    renderSummary(
      <EventBookingStatusSummary
        booking={{
          id: "booking-1",
          status: BookingStatus.SUBMITTED,
          revisionNumber: 2,
          lines: [
            {
              id: "line-1",
              guestDisplayName: null,
              ticketType: { id: "ticket-member", title: "Member standard", price: 50 },
            },
          ],
          guestTicketRequests: [{ id: "gtr-1", status: "PENDING", requestedGuestCount: 1 }],
        } as never}
        eventId="event-1"
        eventTitle="Annual Dinner"
        ticketOrders={[]}
        paymentAdjustments={[]}
        onEditBooking={onEditBooking}
        onPayNow={onPayNow}
      />
    );

    expect(screen.getByText("Your booking")).toBeInTheDocument();
    expect(screen.getByText("Payment not started")).toBeInTheDocument();
    expect(screen.getByText(/1 pending review/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit booking" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View in My Bookings" })).toBeInTheDocument();
  });

  it("hides Pay now when payment is complete", () => {
    renderSummary(
      <EventBookingStatusSummary
        booking={{
          id: "booking-1",
          status: BookingStatus.CONFIRMED,
          revisionNumber: 1,
          lines: [
            {
              id: "line-1",
              guestDisplayName: null,
              ticketType: { id: "ticket-member", title: "Member standard", price: 50 },
            },
          ],
          guestTicketRequests: [],
        } as never}
        eventId="event-1"
        eventTitle="Annual Dinner"
        ticketOrders={[
          {
            status: TicketOrderStatus.PAID,
            event: { id: "event-1" },
            ticketType: { id: "ticket-member" },
          },
        ]}
        paymentAdjustments={[]}
        onEditBooking={onEditBooking}
        onPayNow={onPayNow}
      />
    );

    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("calls edit handler from action button", async () => {
    const user = userEvent.setup();
    renderSummary(
      <EventBookingStatusSummary
        booking={{
          id: "booking-1",
          status: BookingStatus.SUBMITTED,
          revisionNumber: 1,
          lines: [],
          guestTicketRequests: [],
        } as never}
        eventId="event-1"
        eventTitle="Annual Dinner"
        ticketOrders={[]}
        paymentAdjustments={[]}
        onEditBooking={onEditBooking}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit booking" }));
    expect(onEditBooking).toHaveBeenCalledTimes(1);
  });
});
