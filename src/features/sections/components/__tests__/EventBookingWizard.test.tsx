import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import { BookingStatus, TicketAudience, TicketOrderStatus } from "@dataconnect/generated";
import * as reactGenerated from "@dataconnect/generated/react";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import * as bookingInvalidation from "../../../../shared/query/invalidation";
import EventBookingWizard from "../EventBookingWizard";

vi.mock("@dataconnect/generated/react", () => ({
  useGetCurrentUser: vi.fn(),
  useGetMyBookingsForEvent: vi.fn(),
  useGetMyTicketOrders: vi.fn(),
  useGetMyBookingPaymentAdjustments: vi.fn(),
  useGetUserAccessGroups: vi.fn(),
}));
vi.mock("../../../../config/firebase", () => ({ dataConnect: {} }));
vi.mock("../../../../shared/query/invalidation", () => ({
  refreshMyBookingsFromServer: vi.fn().mockResolvedValue({ user: { bookings: [] } }),
}));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getSectionMembersMerged: vi.fn().mockResolvedValue({ members: [] }),
  submitEventBooking: vi.fn().mockResolvedValue({
    bookingId: "booking-new",
    status: "SUBMITTED",
    approvalStatus: "PENDING",
    outcome: "PENDING_APPROVAL",
    paymentReady: false,
  }),
  createEventBookingCheckoutSession: vi.fn(),
}));

const section = {
  id: "section-1",
  name: "Events",
  type: "EVENTS",
  purposeLinks: [
    { purposes: ["ACCESS", "BOOKER"], userGroup: { id: "group-1", membershipStatuses: ["REGULAR"] } },
  ],
} as never;

const event = {
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
} as never;

const refetchMyBookings = vi.fn().mockResolvedValue({ data: { user: { bookings: [] } } });

function bookingWithGuest(paid: boolean) {
  return {
    id: "booking-1",
    status: BookingStatus.SUBMITTED,
    approvalStatus: "NOT_REQUIRED",
    approvalNote: null,
    revisionNumber: 1,
    supersededAt: null,
    updatedAt: "2026-08-11T10:00:00Z",
    sitNextToUserIds: [],
    accommodationRequested: false,
    lines: [
      {
        id: "member-line",
        sortOrder: 0,
        dietaryNote: "Vegetarian",
        bookingPlace: { id: "member-place", paymentAllocations: [] },
        ticketType: { id: "ticket-member", title: "Member standard", audience: TicketAudience.MEMBER, price: 50 },
      },
      {
        id: "guest-line",
        sortOrder: 1,
        guestDisplayName: "Alex Guest",
        dietaryNote: "Vegan",
        bookingPlace: {
          id: "guest-place",
          paymentAllocations: paid
            ? [{ id: "allocation-1", ticketOrderId: "order-1" }]
            : [],
        },
        ticketType: { id: "ticket-guest", title: "Guest standard", audience: TicketAudience.GUEST, price: 25 },
      },
    ],
  };
}

function renderWizard(props: {
  bookings?: unknown[];
  bookingTicketOrders?: unknown[];
  bookingsError?: boolean;
  wizardOpen?: boolean;
} = {}) {
  vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue({
    data: {
      user: {
        bookings: props.bookings ?? [],
        bookingTicketOrders: props.bookingTicketOrders ?? [],
      },
    },
    isLoading: false,
    isError: props.bookingsError ?? false,
    error: props.bookingsError ? new Error("Query failed") : null,
    refetch: refetchMyBookings.mockResolvedValue({
      data: {
        user: {
          bookings: props.bookings ?? [],
          bookingTicketOrders: props.bookingTicketOrders ?? [],
        },
      },
    }),
  } as never);
  return render(
    <MemoryRouter>
      <EventBookingWizard section={section} event={event} wizardOpen={props.wizardOpen ?? true} />
    </MemoryRouter>
  );
}

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
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue({
      data: { user: { ticketOrders: [] } },
      isLoading: false,
    } as never);
    vi.mocked(reactGenerated.useGetMyBookingPaymentAdjustments).mockReturnValue({
      data: { user: { bookings: [] } },
      isLoading: false,
    } as never);
  });

  it("shows the simplified three-stage journey", () => {
    renderWizard();
    expect(screen.getByText("Your details")).toBeInTheDocument();
    expect(screen.getByText("Guests")).toBeInTheDocument();
    expect(screen.getByText("Review and submit")).toBeInTheDocument();
    expect(screen.queryByText("Pay")).not.toBeInTheDocument();
  });

  it("submits member and all guest dietary details atomically and explains over-limit approval", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByLabelText("Dietary requirements"), "Vegetarian");
    await user.click(screen.getByRole("button", { name: "Next" }));
    const count = screen.getByLabelText("Number of guests");
    await user.clear(count);
    await user.type(count, "2");

    const names = screen.getAllByLabelText("Guest name");
    await user.type(names[0]!, "Alex Guest");
    await user.type(names[1]!, "Sam Guest");
    const diets = screen.getAllByLabelText("Dietary requirements (optional)");
    await user.type(diets[0]!, "Vegan");
    await user.type(diets[1]!, "Gluten free");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/complete booking will be sent for organiser approval/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit booking" }));

    await waitFor(() => expect(firebaseFunctions.submitEventBooking).toHaveBeenCalledTimes(1));
    expect(bookingInvalidation.refreshMyBookingsFromServer).toHaveBeenCalledWith(
      expect.anything(),
      "event-1",
    );
    expect(vi.mocked(firebaseFunctions.submitEventBooking).mock.calls[0]?.[0].lines).toEqual([
      expect.objectContaining({ ticketTypeId: "ticket-member", dietaryNote: "Vegetarian" }),
      expect.objectContaining({ guestDisplayName: "Alex Guest", dietaryNote: "Vegan" }),
      expect.objectContaining({ guestDisplayName: "Sam Guest", dietaryNote: "Gluten free" }),
    ]);
  });

  it("shows a retryable error instead of an empty booking page when loading fails", async () => {
    const user = userEvent.setup();
    renderWizard({ bookingsError: true });

    expect(screen.getByRole("heading", { name: "Booking unavailable" })).toBeInTheDocument();
    expect(screen.getByText("We could not load your booking. Please try again.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetchMyBookings).toHaveBeenCalledOnce();
  });

  it("allows an unpaid guest to be removed while editing", async () => {
    const user = userEvent.setup();
    renderWizard({ bookings: [bookingWithGuest(false)] });
    await user.click(screen.getByRole("button", { name: "Edit booking" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Remove guest" }));

    expect(screen.getByLabelText("Number of guests")).toHaveValue(0);
    expect(screen.queryByLabelText("Guest name")).not.toBeInTheDocument();
  });

  it("blocks removal or transfer of a paid guest and explains the future refund route", async () => {
    const user = userEvent.setup();
    renderWizard({
      bookings: [bookingWithGuest(true)],
      bookingTicketOrders: [{ id: "order-1", status: TicketOrderStatus.PAID }],
    });
    await user.click(screen.getByRole("button", { name: "Edit booking" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Paid ticket")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove guest" })).toBeDisabled();
    expect(screen.getByText(/refund requests will be added later/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Guest name")).toBeDisabled();
  });

  it("keeps an approved revision payable while its newer amendment awaits approval", async () => {
    const activeRevision = bookingWithGuest(false);
    const pendingRevision = {
      ...bookingWithGuest(false),
      id: "booking-pending",
      revisionNumber: 2,
      approvalStatus: "PENDING",
      updatedAt: "2026-08-11T11:00:00Z",
      lines: bookingWithGuest(false).lines.map((line) =>
        line.id === "guest-line"
          ? { ...line, id: "pending-guest-line", guestDisplayName: "Pending Guest" }
          : { ...line, id: "pending-member-line" }
      ),
    };
    const user = userEvent.setup();

    renderWizard({ bookings: [activeRevision, pendingRevision] });

    expect(screen.getByRole("heading", { name: "Awaiting approval" })).toBeInTheDocument();
    expect(screen.getByText("Current active booking")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay for all tickets" })).toBeInTheDocument();
    expect(screen.getByText(/current approved booking remains active/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit booking" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Guest name")).toHaveValue("Pending Guest");
  });
});
