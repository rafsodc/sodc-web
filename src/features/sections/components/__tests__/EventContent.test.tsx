import { describe, expect, it } from "vitest";
import { render, screen } from "../../../../test-utils";
import EventDetailHero from "../EventDetailHero";
import EventDetailsContent from "../EventDetailsContent";

const event = {
  id: "event-1",
  title: "Annual Dinner",
  location: "Main Hall",
  guestOfHonour: "Alex Example",
  sponsors: "Example Ltd\nPartner Org",
  details: "## Programme\n\nWelcome **everyone**.\n\n[More information](https://example.com/event)",
  startDateTime: "2026-10-01T18:00:00Z",
  endDateTime: "2026-10-01T22:00:00Z",
  bookingStartDateTime: "2026-08-01T00:00:00Z",
  bookingEndDateTime: "2026-09-20T23:59:59Z",
  maxGuestsWithoutModeratorApproval: 1,
  ticketTypes: [
    { id: "ticket-1", title: "Dinner ticket", price: 50 },
  ],
} as never;

describe("event content", () => {
  it("shows sponsors and safely rendered Markdown details", () => {
    render(
      <>
        <EventDetailHero event={event} />
        <EventDetailsContent details={(event as { details: string }).details} />
      </>
    );

    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Guest of honour")).toBeInTheDocument();
    expect(screen.getByText("Sponsored by")).toBeInTheDocument();
    expect(screen.getByText(/Example Ltd/)).toHaveTextContent("Example Ltd Partner Org");
    expect(screen.getByText("Booking window")).toBeInTheDocument();
    expect(screen.getByText("Guest bookings")).toBeInTheDocument();
    expect(screen.queryByText(/Dinner ticket/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event details", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Programme", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("everyone").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "More information" })).toHaveAttribute(
      "href",
      "https://example.com/event"
    );
  });

  it("omits optional metadata when it is not configured", () => {
    render(
      <EventDetailHero
        event={{
          ...(event as object),
          location: null,
          guestOfHonour: null,
          sponsors: null,
        } as never}
      />
    );

    expect(screen.queryByText("Location")).not.toBeInTheDocument();
    expect(screen.queryByText("Guest of honour")).not.toBeInTheDocument();
    expect(screen.queryByText("Sponsored by")).not.toBeInTheDocument();
  });

  it("shows friendly fallbacks when event dates are invalid", () => {
    render(
      <EventDetailHero
        event={{
          ...(event as object),
          startDateTime: "invalid-start",
          endDateTime: "invalid-end",
          bookingStartDateTime: "invalid-booking-start",
          bookingEndDateTime: "invalid-booking-end",
        } as never}
      />
    );

    expect(screen.getByText("Date unavailable")).toBeInTheDocument();
    expect(screen.getByText("Time unavailable")).toBeInTheDocument();
    expect(screen.getByText("Booking dates unavailable")).toBeInTheDocument();
  });

  it("renders no details surface for empty content", () => {
    const { container } = render(<EventDetailsContent details="   " />);
    expect(container).toBeEmptyDOMElement();
  });
});
