import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "../../../../test-utils";
import { readEventManagementTask } from "../../../../shared/navigation/sectionRoutes";
import EventWorkspaceShell from "../EventWorkspaceShell";
import type { EventRow } from "../sectionEventsManagerTypes";

const event: EventRow = {
  id: "event-1",
  title: "Autumn Symposium & Dinner",
  location: "RAF Club, London",
  startDateTime: "2026-11-20T13:00:00Z",
  endDateTime: "2026-11-20T22:30:00Z",
  bookingStartDateTime: "2026-10-01T09:00:00Z",
  bookingEndDateTime: "2026-11-12T17:00:00Z",
  maxGuestsWithoutModeratorApproval: 1,
};
const base = "/sections/section-1/manage/events/event-1";
let narrow = false;

function RoutedWorkspace({ pendingCount = 3 }: { pendingCount?: number }) {
  const location = useLocation();
  const [edits, setEdits] = useState(0);
  return <EventWorkspaceShell event={event} sectionId="section-1" sectionName="Symposium" selectedTask={readEventManagementTask(location.search)} pendingCount={pendingCount}>
    <h2>{readEventManagementTask(location.search)} task content</h2>
    <button onClick={() => setEdits(edits + 1)}>Local action {edits}</button>
  </EventWorkspaceShell>;
}
function renderWorkspace(search = "") {
  return render(<MemoryRouter initialEntries={[`${base}${search}`]}><RoutedWorkspace /></MemoryRouter>);
}

beforeEach(() => {
  narrow = false;
  vi.spyOn(Date, "now").mockReturnValue(new Date("2026-10-30T10:00:00Z").getTime());
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: narrow && query.includes("max-width:600px"), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});
afterEach(() => { vi.restoreAllMocks(); });

describe("Manage Event workspace", () => {
  it("keeps the event context and breadcrumbs above six linked tasks", () => {
    renderWorkspace();
    expect(screen.getByRole("heading", { level: 1, name: event.title })).toBeInTheDocument();
    expect(screen.getByText("RAF Club, London")).toBeInTheDocument();
    expect(screen.getByText("Bookings open")).toBeInTheDocument();
    const breadcrumbs = screen.getByRole("navigation", { name: "Event breadcrumbs" });
    expect(within(breadcrumbs).getByRole("link", { name: "Sections" })).toHaveAttribute("href", "/sections");
    expect(within(breadcrumbs).getByRole("link", { name: "Symposium" })).toHaveAttribute("href", "/sections/section-1");
    expect(within(breadcrumbs).getByRole("link", { name: "Events" })).toHaveAttribute("href", "/sections/section-1/manage/events");
    const tabs = screen.getByRole("tablist", { name: "Event sections" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview", "Event details", "Tickets & attendees", "Approvals (3)", "Communications", "Payments",
    ]);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toContainElement(screen.getByRole("heading", { name: "overview task content" }));
    expect(screen.getByRole("link", { name: "View event" })).toHaveAttribute("href", "/sections/section-1/events/event-1");
    expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute("href", `${base}?task=activity`);
    expect(within(tabs).queryByText("Activity")).not.toBeInTheDocument();
  });

  it.each(["tickets", "attendees", "removed", "guests"])("opens legacy %s inside Tickets & attendees", (task) => {
    renderWorkspace(`?task=${task}`);
    expect(screen.getByRole("tab", { name: "Tickets & attendees" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Tickets & attendees" })).toBeInTheDocument();
  });

  it.each(["communications", "announcement"])("opens %s inside Communications", (task) => {
    renderWorkspace(`?task=${task}`);
    expect(screen.getByRole("tab", { name: "Communications" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps Activity independent from the Payments tab", () => {
    renderWorkspace("?task=activity");
    expect(screen.getByRole("region", { name: "Activity" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "false");
  });

  it("supports tab keyboard focus and follows the link only when activated", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Event details" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "Event details" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Event details" })).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Payments" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("uses a labelled task selector on narrow screens and navigates through the URL", async () => {
    narrow = true;
    const user = userEvent.setup();
    renderWorkspace("?task=tickets");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Event section" });
    expect(select).toHaveTextContent("Tickets & attendees");
    await user.click(select);
    await user.click(screen.getByRole("option", { name: "Approvals (3)" }));
    expect(screen.getByRole("combobox", { name: "Event section" })).toHaveTextContent("Approvals (3)");
    expect(screen.getByRole("heading", { name: "approvals task content" })).toBeInTheDocument();
  });

  it("copies the complete current URL and announces success", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const completeUrl = "/sections/section-1/manage/events/event-1?task=approvals&approvalStatus=PENDING#revision";
    window.history.replaceState({}, "", completeUrl);
    renderWorkspace("?task=approvals");
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(writeText).toHaveBeenCalledWith(new URL(completeUrl, window.location.origin).href);
    expect(screen.getByRole("status")).toHaveTextContent("Page link copied.");
    window.history.replaceState({}, "", "/");
  });

  it("offers a selected readonly address when clipboard permission is denied", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: "Share" }));
    const dialog = await screen.findByRole("dialog", { name: "Copy page link" });
    const field = within(dialog).getByRole("textbox", { name: "Page link" });
    expect(field).toHaveAttribute("readonly");
    expect(field).toHaveValue(window.location.href);
    expect(field).toHaveFocus();
    expect((field as HTMLInputElement).selectionEnd).toBe(window.location.href.length);
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
