import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "../../../../test-utils";
import { MemoryRouter } from "react-router-dom";
import MyBookings from "../MyBookings";
import * as reactGenerated from "@dataconnect/generated/react";
import { BookingStatus } from "@dataconnect/generated";
import { dataConnectQueryResult } from "../../../../test-utils/dataConnectMocks";

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
                guestTicketRequests: [{ id: "gtr-1", status: "PENDING", requestedGuestCount: 1 }],
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
    expect(screen.getByText(/1 guest request pending/i)).toBeInTheDocument();
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
                guestTicketRequests: [
                  {
                    id: "gtr-1",
                    status: "APPROVED",
                    requestedGuestCount: 1,
                    guestDisplayName: "Alex Guest",
                    guestTicketType: { id: "tt-guest", title: "Guest ticket", price: 15 },
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
    expect(screen.getByText(/1 guest request approved/i)).toBeInTheDocument();
  });

  it("shows pending guest names awaiting approval in the ticket summary line", () => {
    vi.mocked(reactGenerated.useGetMyBookings).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookings>({
        data: {
          user: {
            id: "u-1",
            bookings: [
              {
                id: "booking-1",
                status: BookingStatus.SUBMITTED,
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
                guestTicketRequests: [
                  {
                    id: "gtr-1",
                    status: "PENDING",
                    requestedGuestCount: 1,
                    guestDisplayName: "Sam Extra",
                    guestTicketType: { id: "tt-guest", title: "Guest ticket", price: 15 },
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

    expect(screen.getByText(/Guest ticket \(Sam Extra\) — pending confirmation/)).toBeInTheDocument();
    expect(screen.getByText(/1 guest request pending/i)).toBeInTheDocument();
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
                guestTicketRequests: [],
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

    expect(screen.getByRole("link", { name: "Continue booking" })).toBeInTheDocument();
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

    expect(screen.getByText(/you do not have any bookings yet/i)).toBeInTheDocument();
  });
});
