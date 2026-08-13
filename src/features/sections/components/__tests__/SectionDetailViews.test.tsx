import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "../../../../test-utils";
import { SectionEventDetailView } from "../SectionDetailViews";

const section = {
  id: "section-1",
  name: "Events",
  type: "EVENTS",
  purposeLinks: [],
} as never;

const event = {
  id: "event-1",
  title: "Annual Dinner",
  startDateTime: "2030-03-01T18:00:00Z",
  endDateTime: "2030-03-01T22:00:00Z",
  bookingStartDateTime: "2030-02-01T00:00:00Z",
  bookingEndDateTime: "2030-02-28T23:59:59Z",
  location: "Officers' Mess",
  guestOfHonour: null,
  maxGuestsWithoutModeratorApproval: 1,
  ticketTypes: [],
} as never;

describe("SectionEventDetailView", () => {
  it("keeps existing event content visible during a background refresh", () => {
    render(
      <MemoryRouter>
        <SectionEventDetailView
          section={section}
          event={event}
          loading
          isError={false}
          hasCurrentUser
          onBackToEvents={vi.fn()}
          onRetry={vi.fn()}
          onBookingComplete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Annual Dinner" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Loading event" })).not.toBeInTheDocument();
  });

  it("uses the loading state when there is no event snapshot yet", () => {
    render(
      <MemoryRouter>
        <SectionEventDetailView
          section={section}
          event={null}
          loading
          isError={false}
          hasCurrentUser
          onBackToEvents={vi.fn()}
          onRetry={vi.fn()}
          onBookingComplete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("progressbar", { name: "Loading event" })).toBeInTheDocument();
  });
});
