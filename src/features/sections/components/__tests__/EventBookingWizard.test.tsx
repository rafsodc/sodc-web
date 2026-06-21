import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import EventBookingWizard from "../EventBookingWizard";
import { BookingStatus, GuestTicketRequestStatus, TicketAudience, TicketOrderStatus } from "@dataconnect/generated";
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
  createEventBookingCheckoutSession: vi.fn(),
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
              supersededAt: null,
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

  it("shows booking summary by default for paid submitted bookings", () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue({
      data: {
        user: {
          ticketOrders: [
            {
              status: TicketOrderStatus.PAID,
              event: { id: "event-1" },
              ticketType: { id: "ticket-member" },
            },
          ],
        },
      },
      isLoading: false,
    } as never);

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

  it("shows the booking summary with pay actions when payment is still due", async () => {
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

    await waitFor(() => {
      expect(screen.getByText("Your booking")).toBeInTheDocument();
      expect(screen.getByText("Payment not started")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
    expect(screen.queryByText("Complete your booking")).not.toBeInTheDocument();
  });

  it("does not allow confirmation until payment is complete", async () => {
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

    await waitFor(() => {
      expect(screen.getByText("Your booking")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip for now" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Your booking is confirmed/i)).not.toBeInTheDocument();
  });

  it("submits booking edits with base revision metadata", async () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue({
      data: {
        user: {
          ticketOrders: [
            {
              status: TicketOrderStatus.PAID,
              event: { id: "event-1" },
              ticketType: { id: "ticket-member" },
            },
          ],
        },
      },
      isLoading: false,
    } as never);

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
    expect(screen.queryByText("Number of guests")).not.toBeInTheDocument();
    expect(screen.getByText("Guest details")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();

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
      await user.type(extraGuestName, "Sam Extra");
    }
    await user.type(screen.getAllByLabelText("Dietary requirements (optional)")[0], "Vegetarian");
    const extraGuestDietary = screen.getAllByLabelText("Dietary requirements (optional)")[1];
    if (extraGuestDietary) {
      await user.type(extraGuestDietary, "Gluten free");
    }
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/may require organiser review/i)).toBeInTheDocument();
    expect(screen.getByText(/Alex Guest · Dietary: Vegetarian/i)).toBeInTheDocument();
    expect(screen.getByText(/Sam Extra · Dietary: Gluten free/i)).toBeInTheDocument();
  });

  it("submits separate dietary notes for each guest", async () => {
    const user = userEvent.setup();
    vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue({
      data: { user: { bookings: [] } },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({ data: { user: { bookings: [] } } }),
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
    await user.type(screen.getAllByLabelText("Dietary requirements (optional)")[0], "Vegetarian");
    await user.type(screen.getAllByLabelText("Guest name")[1], "Sam Extra");
    await user.type(screen.getAllByLabelText("Dietary requirements (optional)")[1], "Gluten free");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => {
      expect(firebaseFunctions.submitEventBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              ticketTypeId: "ticket-guest",
              guestDisplayName: "Alex Guest",
              dietaryNote: "Vegetarian",
            }),
          ]),
        })
      );
    });

    expect(firebaseFunctions.submitGuestTicketRequest).toHaveBeenCalledWith({
      bookingId: "booking-new",
      requestedGuestCount: 1,
      guestTicketTypeId: "ticket-guest",
      guestDisplayName: "Sam Extra",
      dietaryNote: "Gluten free",
    });
  });

  it("advances to the payment step after confirming a new booking", async () => {
    const user = userEvent.setup();
    let bookings: Array<Record<string, unknown>> = [];
    const submittedBooking = {
      id: "booking-new",
      status: BookingStatus.SUBMITTED,
      revisionNumber: 1,
      clientSubmissionKey: null,
      bookerDietaryNote: "",
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
    };

    vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockImplementation(
      () =>
        ({
          data: { user: { bookings } },
          isLoading: false,
          refetch: vi.fn().mockImplementation(async () => {
            bookings = [submittedBooking];
            return { data: { user: { bookings } } };
          }),
        }) as never
    );

    const { rerender } = render(
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
            ],
          } as never}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByLabelText(/member standard/i));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => {
      expect(firebaseFunctions.submitEventBooking).toHaveBeenCalled();
    });

    rerender(
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
            ],
          } as never}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Complete your booking")).toBeInTheDocument();
      expect(screen.getByText(/Pay for all tickets in one checkout/i)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/how many guest tickets in total/i)).not.toBeInTheDocument();
  });

  it("shows per-ticket payment status on the payment step and notes pending guest approval", async () => {
    const user = userEvent.setup();

    vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue({
      data: {
        user: {
          bookings: [
            {
              id: "booking-1",
              status: BookingStatus.SUBMITTED,
              revisionNumber: 2,
              supersededAt: null,
              clientSubmissionKey: null,
              bookerDietaryNote: "",
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
              guestTicketRequests: [
                {
                  id: "req-pending",
                  status: GuestTicketRequestStatus.PENDING,
                  requestedGuestCount: 1,
                  guestDisplayName: "Sam Extra",
                  dietaryNote: null,
                  guestTicketType: {
                    id: "ticket-guest",
                    title: "Guest standard",
                    price: 25,
                  },
                },
              ],
            },
          ],
        },
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({ data: { user: { bookings: [] } } }),
    } as never);
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue({
      data: {
        user: {
          ticketOrders: [
            {
              status: TicketOrderStatus.PAID,
              event: { id: "event-1" },
              ticketType: { id: "ticket-member" },
            },
          ],
        },
      },
      isLoading: false,
    } as never);

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

    await waitFor(() => {
      expect(screen.getByText("Your booking")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit booking" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Guest name"), "Sam Extra");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Save booking changes" }));

    await waitFor(() => {
      expect(screen.getByText("Complete your booking")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending confirmation")).toBeInTheDocument();
    expect(screen.getByText("Sam Extra")).toBeInTheDocument();
    expect(
      screen.getByText(/When your additional guest request is approved, return here to pay for their ticket/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Payment complete/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay for all tickets" })).not.toBeInTheDocument();
  });

  it("starts additional guest requests with blank guest details when guests are already approved", async () => {
    const user = userEvent.setup();

    vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue({
      data: {
        user: {
          bookings: [
            {
              id: "booking-1",
              status: BookingStatus.SUBMITTED,
              revisionNumber: 1,
              supersededAt: null,
              clientSubmissionKey: null,
              bookerDietaryNote: "",
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
                {
                  id: "line-2",
                  sortOrder: 1,
                  guestDisplayName: "Jamie Included",
                  dietaryNote: "Vegetarian",
                  ticketType: {
                    id: "ticket-guest",
                    title: "Guest standard",
                    audience: TicketAudience.GUEST,
                    price: 25,
                  },
                },
              ],
              guestTicketRequests: [
                {
                  id: "gtr-1",
                  status: "APPROVED",
                  requestedGuestCount: 1,
                  guestDisplayName: "Alex Approved",
                  dietaryNote: "Gluten free",
                  guestTicketType: {
                    id: "ticket-guest",
                    title: "Guest standard",
                    price: 25,
                  },
                },
              ],
            },
          ],
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue({
      data: {
        user: {
          ticketOrders: [
            {
              status: TicketOrderStatus.PAID,
              event: { id: "event-1" },
              ticketType: { id: "ticket-member" },
            },
            {
              status: TicketOrderStatus.PAID,
              event: { id: "event-1" },
              ticketType: { id: "ticket-guest" },
            },
          ],
        },
      },
      isLoading: false,
    } as never);

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

    await user.click(screen.getByRole("button", { name: /request additional guests/i }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByLabelText("Guest name")).toHaveValue("");
    expect(screen.getByLabelText("Dietary requirements (optional)")).toHaveValue("");
    expect(screen.queryByDisplayValue("Alex Approved")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Jamie Included")).not.toBeInTheDocument();
  });

  it("omits declined extra guests when editing a booking", async () => {
    const user = userEvent.setup();

    vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue({
      data: {
        user: {
          bookings: [
            {
              id: "booking-1",
              status: BookingStatus.SUBMITTED,
              revisionNumber: 2,
              supersededAt: null,
              clientSubmissionKey: null,
              bookerDietaryNote: "",
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
                {
                  id: "line-2",
                  sortOrder: 1,
                  guestDisplayName: "Jamie Included",
                  dietaryNote: "",
                  ticketType: {
                    id: "ticket-guest",
                    title: "Guest standard",
                    audience: TicketAudience.GUEST,
                    price: 25,
                  },
                },
              ],
              guestTicketRequests: [
                {
                  id: "gtr-approved",
                  status: "APPROVED",
                  requestedGuestCount: 1,
                  guestDisplayName: "Alex Approved",
                  dietaryNote: "",
                  guestTicketType: {
                    id: "ticket-guest",
                    title: "Guest standard",
                    price: 25,
                  },
                },
                {
                  id: "gtr-rejected",
                  status: "REJECTED",
                  requestedGuestCount: 1,
                  guestDisplayName: "Sam Declined",
                  dietaryNote: "",
                  guestTicketType: {
                    id: "ticket-guest",
                    title: "Guest standard",
                    price: 25,
                  },
                },
              ],
            },
          ],
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue({
      data: {
        user: {
          ticketOrders: [
            {
              status: TicketOrderStatus.PAID,
              event: { id: "event-1" },
              ticketType: { id: "ticket-member" },
            },
            {
              status: TicketOrderStatus.PAID,
              event: { id: "event-1" },
              ticketType: { id: "ticket-guest" },
            },
          ],
        },
      },
      isLoading: false,
    } as never);

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
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByLabelText("How many guest tickets in total?")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Jamie Included")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alex Approved")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Sam Declined")).not.toBeInTheDocument();
  });
});
