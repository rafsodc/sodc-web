import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import EventBookingWizard from "../EventBookingWizard";
import { BookingStatus, TicketAudience } from "@dataconnect/generated";
import * as reactGenerated from "@dataconnect/generated/react";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("@dataconnect/generated/react", () => ({
  useGetCurrentUser: vi.fn(),
  useGetMyBookingsForEvent: vi.fn(),
  useGetMyTicketOrders: vi.fn(),
  useGetMyBookingPaymentAdjustments: vi.fn(),
  useGetUserAccessGroups: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getSectionMembersMerged: vi.fn().mockResolvedValue({ members: [] }),
  submitEventBooking: vi.fn().mockResolvedValue({
    bookingId: "booking-new",
    status: "SUBMITTED",
  }),
  createTicketCheckoutSession: vi.fn(),
  submitGuestTicketRequest: vi.fn().mockResolvedValue({ success: true, requestId: "req-1" }),
}));

describe("EventBookingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reactGenerated.useGetCurrentUser).mockReturnValue({
      data: { user: { id: "user-1", membershipStatus: "REGULAR" } },
      isLoading: false,
    } as never);
    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: { user: { userGroups: [{ userGroup: { id: "group-1" } }] } },
    } as never);
    vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue({
      data: {
        user: {
          bookings: [
            {
              id: "booking-1",
              status: BookingStatus.SUBMITTED,
              revisionNumber: 2,
              clientSubmissionKey: null,
              bookerDietaryNote: "No nuts",
              sitNextToUserIds: [],
              accommodationRequested: false,
              accommodationNote: null,
              lines: [
                {
                  id: "line-1",
                  sortOrder: 0,
                  guestDisplayName: null,
                  dietaryNote: null,
                  ticketType: {
                    id: "ticket-member",
                    title: "Member standard",
                    audience: TicketAudience.MEMBER,
                    price: 50,
                  },
                },
              ],
              guestTicketRequests: [],
            },
          ],
        },
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({ data: { user: { bookings: [] } } }),
    } as never);
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue({
      data: { user: { ticketOrders: [] } },
      isLoading: false,
    } as never);
    vi.mocked(reactGenerated.useGetMyBookingPaymentAdjustments).mockReturnValue({
      data: { user: { bookings: [] } },
      isLoading: false,
    } as never);
  });

  it("shows booking summary by default for submitted bookings", () => {
    render(
      <MemoryRouter>
        <EventBookingWizard
        section={{
          id: "section-1",
          name: "Events",
          type: "EVENTS",
          description: null,
          purposeLinks: [
            { purposes: ["ACCESS", "BOOKER"], userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] } },
          ],
        } as never}
        event={{
          id: "event-1",
          title: "Annual Dinner",
          bookingStartDateTime: "2025-01-01T00:00:00Z",
          bookingEndDateTime: "2030-01-01T00:00:00Z",
          maxGuestsWithoutModeratorApproval: 1,
          ticketTypes: [
            {
              id: "ticket-member",
              title: "Member standard",
              audience: TicketAudience.MEMBER,
              price: 50,
              userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] },
            },
          ],
        } as never}
      />
      </MemoryRouter>
    );

    expect(screen.getByText("Your booking")).toBeInTheDocument();
    expect(screen.getAllByText("Revision 2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Edit your booking")).not.toBeInTheDocument();
  });

  it("submits booking edits with base revision metadata", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <EventBookingWizard
        section={{
          id: "section-1",
          name: "Events",
          type: "EVENTS",
          description: null,
          purposeLinks: [
            { purposes: ["ACCESS", "BOOKER"], userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] } },
          ],
        } as never}
        event={{
          id: "event-1",
          title: "Annual Dinner",
          bookingStartDateTime: "2025-01-01T00:00:00Z",
          bookingEndDateTime: "2030-01-01T00:00:00Z",
          maxGuestsWithoutModeratorApproval: 1,
          ticketTypes: [
            {
              id: "ticket-member",
              title: "Member standard",
              audience: TicketAudience.MEMBER,
              price: 50,
              userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] },
            },
            {
              id: "ticket-guest",
              title: "Guest standard",
              audience: TicketAudience.GUEST,
              price: 25,
              userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] },
            },
          ],
        } as never}
      />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Edit booking" }));
    expect(screen.getByText("Edit your booking")).toBeInTheDocument();
    expect(screen.getByText(/editing revision 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Save booking changes" }));

    await waitFor(() => {
      expect(firebaseFunctions.submitEventBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-1",
          baseBookingId: "booking-1",
          baseRevisionNumber: 2,
        })
      );
    });
  });

  it("shows moderation notice when guest count exceeds policy on review step", async () => {
    const user = userEvent.setup();
    vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue({
      data: { user: { bookings: [] } },
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    render(
      <MemoryRouter>
        <EventBookingWizard
          wizardOpen
          section={{
            id: "section-1",
            name: "Events",
            type: "EVENTS",
            description: null,
            purposeLinks: [
              { purposes: ["ACCESS", "BOOKER"], userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] } },
            ],
          } as never}
          event={{
            id: "event-1",
            title: "Annual Dinner",
            bookingStartDateTime: "2025-01-01T00:00:00Z",
            bookingEndDateTime: "2030-01-01T00:00:00Z",
            maxGuestsWithoutModeratorApproval: 1,
            ticketTypes: [
              {
                id: "ticket-member",
                title: "Member standard",
                audience: TicketAudience.MEMBER,
                price: 50,
                userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] },
              },
              {
                id: "ticket-guest",
                title: "Guest standard",
                audience: TicketAudience.GUEST,
                price: 25,
                userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] },
              },
            ],
          } as never}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByLabelText(/member standard/i));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const guestCountInput = screen.getByLabelText(/how many guest tickets in total/i);
    await user.clear(guestCountInput);
    await user.type(guestCountInput, "2");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.type(screen.getAllByLabelText("Guest name")[0], "Alex Guest");
    const extraGuestName = screen.getAllByLabelText("Guest name")[1];
    if (extraGuestName) {
      await user.type(extraGuestName, "Alex Guest");
    }
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/may require organiser review/i)).toBeInTheDocument();
  });
});
