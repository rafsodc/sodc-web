import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../../test-utils";
import { SectionEventDetailView } from "../SectionDetailViews";
import { getEventAttendees } from "../../../../shared/utils/firebaseFunctions/sectionAccess";
vi.mock("../../../../shared/utils/firebaseFunctions/sectionAccess", () => ({ getEventAttendees: vi.fn() }));
vi.mock("../EventDetailHero", () => ({ default: () => <div>Event summary</div> }));
vi.mock("../EventBookingWizard", () => ({ default: () => <div>Booking form</div> }));
const getAttendees = vi.mocked(getEventAttendees);
const props = { section: {} as never, event: { id: "event", details: "Event programme" } as never, loading: false, isError: false, hasCurrentUser: true, onBackToEvents: vi.fn(), onRetry: vi.fn(), onBookingComplete: vi.fn() };
beforeEach(() => { getAttendees.mockReset(); getAttendees.mockResolvedValue({ attendees: [{ displayName: "Guest", includesSymposium: true, includesDinner: false }] }); });
describe("event detail tabs", () => {
  it("keeps booking on About and loads attendees only in their own tab", async () => {
    const user = userEvent.setup();
    render(<SectionEventDetailView {...props} />);
    expect(screen.getByRole("tabpanel", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book this event" })).toBeInTheDocument();
    expect(getAttendees).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Attendees" }));
    expect(await screen.findByRole("table", { name: "Event attendees" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Attendees" })).toBeInTheDocument();
    expect(screen.queryByText("Event programme")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "About" }));
    await user.click(screen.getByRole("button", { name: "Book this event" }));
    expect(screen.getByRole("tabpanel", { name: "Book" })).toHaveTextContent("Booking form");
  });
  it("supports keyboard tab navigation", async () => {
    const user = userEvent.setup();
    render(<SectionEventDetailView {...props} />);
    screen.getByRole("tab", { name: "About" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    expect(screen.getByRole("tab", { name: "Attendees" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("table", { name: "Event attendees" })).toBeInTheDocument();
  });
  it("does not expose the attendee tab to signed-out viewers", () => {
    render(<SectionEventDetailView {...props} hasCurrentUser={false} />);
    expect(screen.queryByRole("tab", { name: "Attendees" })).not.toBeInTheDocument();
    expect(getAttendees).not.toHaveBeenCalled();
  });
});
