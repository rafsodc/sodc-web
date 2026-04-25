import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import SectionEventsManager from "../SectionEventsManager";
import * as reactGenerated from "@dataconnect/generated/react";
import userEvent from "@testing-library/user-event";
import { executeMutation } from "firebase/data-connect";
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from "../../../../test-utils/dataConnectMocks";

vi.mock("@dataconnect/generated/react", () => ({
  useGetEventsForSection: vi.fn(),
  useGetEventById: vi.fn(),
  useListEventBookingsForAdmin: vi.fn(),
  useListGuestTicketRequestsForAdmin: vi.fn(),
  useListTicketOrdersForAdmin: vi.fn(),
}));

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn().mockResolvedValue({ data: null }),
  executeMutation: vi.fn().mockResolvedValue({}),
  validateArgs: vi.fn((_config: unknown, dcOrVars: unknown, vars: unknown) => {
    if (vars !== undefined) return { dc: dcOrVars, vars };
    return { dc: {}, vars: dcOrVars };
  }),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

function mockGetEventsForSection(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetEventsForSection>(overrides)
  );
}

function mockGetEventById(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetEventById).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetEventById>(overrides)
  );
}

function mockGuestTicketRequests(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListGuestTicketRequestsForAdmin).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListGuestTicketRequestsForAdmin>(overrides)
  );
}

function mockEventBookings(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListEventBookingsForAdmin).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListEventBookingsForAdmin>(overrides)
  );
}

function mockTicketOrders(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListTicketOrdersForAdmin).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListTicketOrdersForAdmin>(overrides)
  );
}

vi.mock("@dataconnect/generated", async () => {
  const actual = await vi.importActual("@dataconnect/generated");
  return {
    ...actual,
    adminReviewGuestTicketRequestRef: vi.fn((_dc: unknown, _vars: unknown) => ({ type: "mutation" })),
  };
});

describe("SectionEventsManager", () => {
  const sectionId = "section-1";
  const sectionName = "Events Section";
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    mockGuestTicketRequests({
      data: { event: { id: "ev-1", bookings: [] } },
      isLoading: false,
      isError: false,
    });
    mockEventBookings({
      data: { event: { id: "ev-1", bookings: [] } },
      isLoading: false,
      isError: false,
    });
    mockTicketOrders({
      data: { event: { id: "ev-1", ticketOrders: [] } },
      isLoading: false,
      isError: false,
    });
  });

  it("renders events list with section name and Back returns to sections", async () => {
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Events: Events Section/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();

    screen.getByRole("button", { name: /back/i }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows events table when section has events", async () => {
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Annual Dinner")).toBeInTheDocument();
    });
    expect(screen.getByText("Main Hall")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /event admin/i })).toBeInTheDocument();
  });

  it("renders error message when events query fails", async () => {
    mockGetEventsForSection({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();
    });
  });

  it("renders moderation queue and approves a pending request", async () => {
    const user = userEvent.setup();
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: {
        event: {
          id: "ev-1",
          title: "Annual Dinner",
          startDateTime: "2025-03-01T18:00:00Z",
          endDateTime: "2025-03-01T22:00:00Z",
          bookingStartDateTime: "2025-02-01T00:00:00Z",
          bookingEndDateTime: "2025-02-28T23:59:59Z",
          location: "Main Hall",
          guestOfHonour: "Jane Doe",
          maxGuestsWithoutModeratorApproval: 1,
          ticketTypes: [],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGuestTicketRequests({
      data: {
        event: {
          id: "ev-1",
          bookings: [
            {
              id: "b-1",
              status: "SUBMITTED",
              booker: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" },
              guestTicketRequests: [
                {
                  id: "r-1",
                  status: "PENDING",
                  requestedGuestCount: 2,
                  guestDisplayName: "Jamie Guest",
                  dietaryNote: "None",
                  moderatorNote: null,
                  createdAt: "2026-02-01T00:00:00Z",
                  reviewedAt: null,
                  guestTicketType: { id: "tt-1", title: "Guest standard", audience: "GUEST", price: 10 },
                },
              ],
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockEventBookings({
      data: {
        event: {
          id: "ev-1",
          bookings: [
            {
              id: "b-1",
              status: "SUBMITTED",
              lines: [{ id: "line-1" }],
              createdAt: "2026-02-01T00:00:00Z",
              updatedAt: "2026-02-01T01:00:00Z",
              createdBy: "u-1",
              updatedBy: "u-1",
              booker: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" },
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockTicketOrders({
      data: {
        event: {
          id: "ev-1",
          ticketOrders: [
            {
              id: "o-1",
              status: "PAID",
              quantity: 2,
              totalAmountMinor: 5000,
              currency: "gbp",
              webhookEventId: "evt_123",
              updatedAt: "2026-02-01T02:00:00Z",
              updatedBy: "system",
              user: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" },
              ticketType: { id: "tt-1", title: "Member ticket" },
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));

    expect(screen.getByText(/event admin: annual dinner/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^event details$/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^ticket types$/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^guest ticket requests$/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: /^booking audit activity$/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: /^payment status activity$/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    await user.click(screen.getByRole("button", { name: /^event details$/i }));
    expect(screen.getByRole("button", { name: /edit event details/i })).toBeInTheDocument();
    expect(screen.getByText(/max guests without moderator approval/i)).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /^guest ticket requests$/i }));
    expect(screen.getByText(/additional guest ticket requests/i)).toBeInTheDocument();
    expect(screen.getByText("Jamie Guest")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^booking audit activity$/i }));
    expect(screen.getByText(/booking audit activity/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^payment status activity$/i }));
    expect(screen.getByText(/payment status activity/i)).toBeInTheDocument();
    expect(screen.getByText(/evt_123/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(executeMutation).toHaveBeenCalled());
  });

  it("opens event edit dialog from the event admin details section", async () => {
    const user = userEvent.setup();
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
              maxGuestsWithoutModeratorApproval: 2,
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: {
        event: {
          id: "ev-1",
          title: "Annual Dinner",
          startDateTime: "2025-03-01T18:00:00Z",
          endDateTime: "2025-03-01T22:00:00Z",
          bookingStartDateTime: "2025-02-01T00:00:00Z",
          bookingEndDateTime: "2025-02-28T23:59:59Z",
          location: "Main Hall",
          guestOfHonour: "Jane Doe",
          maxGuestsWithoutModeratorApproval: 2,
          ticketTypes: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^event details$/i }));
    await user.click(screen.getByRole("button", { name: /edit event details/i }));

    expect(screen.getByRole("dialog", { name: /edit event/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue("Annual Dinner");
    expect(screen.getByLabelText(/location/i)).toHaveValue("Main Hall");
    expect(screen.getByLabelText(/max guests without moderator approval/i)).toHaveValue(2);
  });

  it("shows empty-state alerts for moderation, booking audit, and payment activity", async () => {
    const user = userEvent.setup();
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: {
        event: {
          id: "ev-1",
          title: "Annual Dinner",
          startDateTime: "2025-03-01T18:00:00Z",
          endDateTime: "2025-03-01T22:00:00Z",
          bookingStartDateTime: "2025-02-01T00:00:00Z",
          bookingEndDateTime: "2025-02-28T23:59:59Z",
          location: "Main Hall",
          guestOfHonour: "Jane Doe",
          maxGuestsWithoutModeratorApproval: null,
          ticketTypes: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^guest ticket requests$/i }));
    await user.click(screen.getByRole("button", { name: /^booking audit activity$/i }));
    await user.click(screen.getByRole("button", { name: /^payment status activity$/i }));

    expect(screen.getByText(/no guest ticket requests for this filter/i)).toBeInTheDocument();
    expect(screen.getByText(/no bookings found for this event/i)).toBeInTheDocument();
    expect(screen.getByText(/no payment orders found for this event/i)).toBeInTheDocument();
  });
});
