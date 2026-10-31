import { act, cleanup, render, screen, waitFor } from "../../../../test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { SectionEventDetailView } from "../SectionDetailViews";
import { preloadMemberEventPanel } from "../memberEventPanels";

const pendingModules = vi.hoisted(() => {
  let releaseBooking!: () => void;
  let failAttendees!: (error: Error) => void;
  let releaseDetails!: () => void;
  return {
    booking: new Promise<void>(resolve => { releaseBooking = resolve; }),
    attendees: new Promise<void>((_resolve, reject) => { failAttendees = reject; }),
    details: new Promise<void>(resolve => { releaseDetails = resolve; }),
    releaseBooking: () => releaseBooking(),
    failAttendees: (error: Error) => failAttendees(error),
    releaseDetails: () => releaseDetails(),
    bookingImports: vi.fn(), attendeesImports: vi.fn(), bookingMounts: vi.fn(), bookingWrites: vi.fn(),
    detailsImports: vi.fn(),
  };
});
vi.mock("../EventBookingWizard", async () => {
  pendingModules.bookingImports();
  await pendingModules.booking;
  return { default: function BookingStub() {
    const [note, setNote] = useState("");
    useEffect(() => { pendingModules.bookingMounts(); }, []);
    return <><label>Booking draft<input value={note} onChange={event => setNote(event.target.value)} /></label><button onClick={pendingModules.bookingWrites}>Save booking</button></>;
  } };
});
vi.mock("../memberEventPanels", async importOriginal => {
  const actual = await importOriginal<typeof import("../memberEventPanels")>();
  return { ...actual, loadEventAttendees: () => {
    pendingModules.attendeesImports();
    return pendingModules.attendees.then(() => ({ default: () => <div>Attendee panel</div> }));
  } };
});
vi.mock("../EventDetailsContent", async importOriginal => {
  pendingModules.detailsImports();
  await pendingModules.details;
  return importOriginal();
});

const section = { id: "section-1", name: "Events", type: "EVENTS", purposeLinks: [] } as never;
const eventData = { id: "event-1", title: "Annual Dinner", details: "**Published event details**", startDateTime: "2030-03-01T18:00:00Z", endDateTime: "2030-03-01T22:00:00Z", bookingStartDateTime: "2030-02-01T00:00:00Z", bookingEndDateTime: "2030-02-28T23:59:59Z", maxGuestsWithoutModeratorApproval: 1, ticketTypes: [] };
const event = eventData as never;
function History() {
  const navigate = useNavigate();
  const location = useLocation();
  return <><output>{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>History back</button><button onClick={() => navigate(1)}>History forward</button></>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps the hero immediate and does not request a description module for empty details", () => {
  render(<MemoryRouter><SectionEventDetailView section={section} event={{ ...eventData, details: " " } as never} loading={false} isError={false} hasCurrentUser onBackToEvents={vi.fn()} onRetry={vi.fn()} onBookingComplete={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Annual Dinner" })).toBeInTheDocument();
  expect(screen.queryByRole("progressbar", { name: "Loading event details" })).not.toBeInTheDocument();
  expect(pendingModules.detailsImports).not.toHaveBeenCalled();
  expect(pendingModules.bookingImports).not.toHaveBeenCalled();
  expect(pendingModules.attendeesImports).not.toHaveBeenCalled();
});

it("defers unvisited panels, shares intent preloading, preserves a visited booking and isolates another panel's failed module", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/sections/section-1/events/event-1"]}><History /><SectionEventDetailView section={section} event={event} loading={false} isError={false} hasCurrentUser onBackToEvents={vi.fn()} onRetry={vi.fn()} onBookingComplete={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Annual Dinner" })).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Loading event details" })).toBeInTheDocument();
  const detailsPreload = preloadMemberEventPanel("about");
  await waitFor(() => expect(pendingModules.detailsImports).toHaveBeenCalledOnce());
  await act(async () => { pendingModules.releaseDetails(); await detailsPreload; });
  await screen.findByText("Published event details");
  expect(pendingModules.bookingImports).not.toHaveBeenCalled();
  expect(pendingModules.attendeesImports).not.toHaveBeenCalled();

  const preload = preloadMemberEventPanel("book");
  await waitFor(() => expect(pendingModules.bookingImports).toHaveBeenCalledOnce());
  expect(screen.queryByLabelText("Booking draft")).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Book" }));
  expect(screen.getByRole("progressbar", { name: "Loading booking" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Book" })).toHaveAttribute("aria-selected", "true");
  await act(async () => { pendingModules.releaseBooking(); await preload; });
  const draft = await screen.findByLabelText("Booking draft");
  await user.type(draft, "Keep this unsaved selection");
  await user.click(screen.getByRole("tab", { name: "About" }));
  expect(screen.getByText("Published event details")).toBeInTheDocument();
  expect(screen.getByLabelText("Booking draft")).not.toBeVisible();
  await user.click(screen.getByRole("button", { name: "History back" }));
  expect(screen.getByLabelText("Booking draft")).toBeVisible();
  expect(screen.getByLabelText("Booking draft")).toHaveValue("Keep this unsaved selection");
  await user.click(screen.getByRole("button", { name: "History forward" }));
  expect(screen.getByLabelText("Booking draft")).not.toBeVisible();
  expect(pendingModules.bookingMounts).toHaveBeenCalledOnce();
  expect(pendingModules.bookingImports).toHaveBeenCalledOnce();

  vi.spyOn(console, "error").mockImplementation(() => {});
  await user.click(screen.getByRole("tab", { name: "Attendees" }));
  expect(screen.getByRole("progressbar", { name: "Loading attendees" })).toBeInTheDocument();
  await waitFor(() => expect(pendingModules.attendeesImports).toHaveBeenCalledOnce());
  await act(async () => pendingModules.failAttendees(new Error("Failed to fetch dynamically imported module")));
  await screen.findByRole("heading", { name: "This page couldn’t load" });
  expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  expect(screen.getByText(/check any recent save before trying it again/)).toBeInTheDocument();
  expect(screen.getByLabelText("Booking draft")).toHaveValue("Keep this unsaved selection");
  expect(pendingModules.bookingMounts).toHaveBeenCalledOnce();
  expect(pendingModules.bookingWrites).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("Published event details")).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Book" }));
  expect(screen.getByLabelText("Booking draft")).toHaveValue("Keep this unsaved selection");
  expect(pendingModules.bookingMounts).toHaveBeenCalledOnce();
  expect(pendingModules.bookingWrites).not.toHaveBeenCalled();
});
