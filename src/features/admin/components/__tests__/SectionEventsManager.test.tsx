import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import SectionEventsManager from "../SectionEventsManager";
import * as reactGenerated from "@dataconnect/generated/react";
import userEvent from "@testing-library/user-event";
import { executeMutation } from "firebase/data-connect";

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
    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
      data: { section: { id: sectionId, events: [] } } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useGetEventById).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useListGuestTicketRequestsForAdmin).mockReturnValue({
      data: { event: { id: "ev-1", bookings: [] } } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useListEventBookingsForAdmin).mockReturnValue({
      data: { event: { id: "ev-1", bookings: [] } } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useListTicketOrdersForAdmin).mockReturnValue({
      data: { event: { id: "ev-1", ticketOrders: [] } } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
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
    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
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
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Annual Dinner")).toBeInTheDocument();
    });
    expect(screen.getByText("Main Hall")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ticket types/i })).toBeInTheDocument();
  });

  it("renders moderation queue and approves a pending request", async () => {
    const user = userEvent.setup();
    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
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
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useGetEventById).mockReturnValue({
      data: {
        event: {
          id: "ev-1",
          ticketTypes: [],
        },
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useListGuestTicketRequestsForAdmin).mockReturnValue({
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
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useListEventBookingsForAdmin).mockReturnValue({
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
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useListTicketOrdersForAdmin).mockReturnValue({
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
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /ticket types/i }));

    expect(screen.getByText(/additional guest ticket requests/i)).toBeInTheDocument();
    expect(screen.getByText(/booking audit activity/i)).toBeInTheDocument();
    expect(screen.getByText(/payment status activity/i)).toBeInTheDocument();
    expect(screen.getByText(/evt_123/i)).toBeInTheDocument();
    expect(screen.getByText("Jamie Guest")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(executeMutation).toHaveBeenCalled());
  });
});
