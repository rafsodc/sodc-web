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
  ticketTypes: [],
} as never;

describe("event content", () => {
  it("shows sponsors and safely rendered Markdown details", () => {
    render(
      <>
        <EventDetailHero event={event} />
        <EventDetailsContent details={(event as { details: string }).details} />
      </>
    );

    expect(screen.getByText(/Sponsored by:/)).toHaveTextContent("Example Ltd Partner Org");
    expect(screen.getByRole("heading", { name: "Event details", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Programme", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("everyone").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "More information" })).toHaveAttribute(
      "href",
      "https://example.com/event"
    );
  });

  it("renders no details surface for empty content", () => {
    const { container } = render(<EventDetailsContent details="   " />);
    expect(container).toBeEmptyDOMElement();
  });
});
