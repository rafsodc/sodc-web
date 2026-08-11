import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "../../../../test-utils";
import { MemoryRouter } from "react-router-dom";
import MyBookings from "../MyBookings";
import * as reactGenerated from "@dataconnect/generated/react";
import { BookingStatus } from "@dataconnect/generated";
import { dataConnectQueryResult } from "../../../../test-utils/dataConnectMocks";
import userEvent from "@testing-library/user-event";

vi.mock("@dataconnect/generated/react", () => ({
  useGetMyBookings: vi.fn(),
  useGetMyTicketOrders: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

describe("MyBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        data: { user: { id: "u-1", ticketOrders: [] } },
        isLoading: false,
        isError: false,
      })
    );
  });

  it("renders booking cards with status and deep link action", () => {
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        data: {
          user: {
            id: "u-1",
            bookings: [
              {
                id: "booking-1",
                status: BookingStatus.SUBMITTED,
                approvalStatus: "PENDING",
                revisionNumber: 2,
                updatedAt: "2026-04-01T12:00:00Z",
                event: {
                  id: "event-1",
                  title: "Spring Ball",
                  startDateTime: "2026-05-01T18:00:00Z",
                  endDateTime: "2026-05-01T22:00:00Z",
                  section: { id: "section-1", name: "Events Section" },
                },
                lines: [{ id: "line-1", ticketType: { id: "tt-1", title: "Member ticket", audience: "MEMBER", price: 25 } }],
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    render(
      <MemoryRouter>
        <MyBookings onBack={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByText("Spring Ball")).toBeInTheDocument();
    expect(screen.getByText("Events Section")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View booking" })).toHaveAttribute("href", "/sections/section-1");
  });

  it("shows approved guest names in the ticket summary line", () => {
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        data: {
          user: {
            id: "u-1",
            bookings: [
              {
                id: "booking-1",
                status: BookingStatus.SUBMITTED,
                approvalStatus: "APPROVED",
                revisionNumber: 2,
                updatedAt: "2026-04-01T12:00:00Z",
                event: {
                  id: "event-1",
                  title: "Spring Ball",
                  startDateTime: "2026-05-01T18:00:00Z",
                  endDateTime: "2026-05-01T22:00:00Z",
                  section: { id: "section-1", name: "Events Section" },
                },
                lines: [
                  { id: "line-1", ticketType: { id: "tt-1", title: "Member ticket", audience: "MEMBER", price: 25 } },
                  {
                    id: "line-2",
                    guestDisplayName: "Alex Guest",
                    ticketType: { id: "tt-guest", title: "Guest ticket", audience: "GUEST", price: 15 },
                  },
                ],
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    render(
      <MemoryRouter>
        <MyBookings onBack={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Member ticket · Guest ticket \(Alex Guest\)/)).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("shows every guest line while the complete booking awaits approval", () => {
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        data: {
          user: {
            id: "u-1",
            bookings: [
              {
                id: "booking-1",
                status: BookingStatus.SUBMITTED,
                approvalStatus: "PENDING",
                revisionNumber: 2,
                updatedAt: "2026-04-01T12:00:00Z",
                event: {
                  id: "event-1",
                  title: "Spring Ball",
                  startDateTime: "2026-05-01T18:00:00Z",
                  endDateTime: "2026-05-01T22:00:00Z",
                  section: { id: "section-1", name: "Events Section" },
                },
                lines: [
                  { id: "line-1", ticketType: { id: "tt-1", title: "Member ticket", audience: "MEMBER", price: 25 } },
                  {
                    id: "line-2",
                    guestDisplayName: "Sam Extra",
                    ticketType: { id: "tt-guest", title: "Guest ticket", audience: "GUEST", price: 15 },
                  },
                ],
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    render(
      <MemoryRouter>
        <MyBookings onBack={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Member ticket · Guest ticket \(Sam Extra\)/)).toBeInTheDocument();
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
  });

  it("shows continue booking for drafts", () => {
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        data: {
          user: {
            id: "u-1",
            bookings: [
              {
                id: "booking-draft",
                status: BookingStatus.DRAFT,
                approvalStatus: "NOT_REQUIRED",
                revisionNumber: 1,
                updatedAt: "2026-04-01T12:00:00Z",
                event: {
                  id: "event-1",
                  title: "Summer Dinner",
                  startDateTime: "2026-06-01T18:00:00Z",
                  endDateTime: "2026-06-01T22:00:00Z",
                  section: { id: "section-1", name: "Events Section" },
                },
                lines: [],
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    render(
      <MemoryRouter>
        <MyBookings onBack={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Complete booking" })).toBeInTheDocument();
  });

  it("shows empty state when there are no bookings", () => {
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        data: { user: { id: "u-1", bookings: [] } },
        isLoading: false,
        isError: false,
      })
    );

    render(
      <MemoryRouter>
        <MyBookings onBack={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it("shows a safe failure and retries without exposing query details", async () => {
    const refetch = vi.fn();
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        isLoading: false,
        isError: true,
        error: new Error("booking_rows database failure"),
        refetch,
      })
    );

    render(
      <MemoryRouter>
        <MyBookings onBack={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByText(/could not load your bookings/i)).toBeInTheDocument();
    expect(screen.queryByText(/booking_rows/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("distinguishes access denied from a retryable failure", () => {
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        isLoading: false,
        isError: true,
        error: { code: "permission-denied", message: "internal policy name" },
      })
    );

    render(
      <MemoryRouter>
        <MyBookings onBack={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByText(/internal policy name/i)).not.toBeInTheDocument();
  });
});
