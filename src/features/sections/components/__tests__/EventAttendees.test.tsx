import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "../../../../test-utils";
import EventAttendees from "../EventAttendees";
import { getEventAttendees } from "../../../../shared/utils/firebaseFunctions/sectionAccess";

vi.mock("../../../../shared/utils/firebaseFunctions/sectionAccess", () => ({ getEventAttendees: vi.fn() }));
const ticketTypes = [{ includesSymposium: true, includesDinner: true }];
const getAttendees = vi.mocked(getEventAttendees);

describe("event attendees", () => {
  beforeEach(() => getAttendees.mockReset());
  it("shows loading followed by structured and legacy names, preserving namesakes", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof getEventAttendees>>) => void;
    getAttendees.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<EventAttendees eventId="event" ticketTypes={ticketTypes} />);
    expect(screen.getByLabelText("Loading attendees")).toBeInTheDocument();
    resolve({ attendees: [{ audience: "MEMBER", firstName: "Alex", lastName: "Smith", includesSymposium: true, includesDinner: false }, { audience: "MEMBER", firstName: "Alex", lastName: "Smith", includesSymposium: true, includesDinner: false }, { audience: "GUEST", displayName: "Cher", includesSymposium: false, includesDinner: true }] });
    expect(await screen.findAllByText("Alex Smith")).toHaveLength(2);
    expect(screen.getByText("Cher")).toBeInTheDocument();
    expect(screen.getAllByText("Member")).toHaveLength(2);
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(getAttendees).toHaveBeenCalledWith("event");
  });
  it("renders accessible columns and all four attendance combinations", async () => {
    getAttendees.mockResolvedValue({ attendees: [
      { audience: "GUEST", displayName: "Both", includesSymposium: true, includesDinner: true },
      { audience: "GUEST", displayName: "Symposium only", includesSymposium: true, includesDinner: false },
      { audience: "GUEST", displayName: "Dinner only", includesSymposium: false, includesDinner: true },
      { audience: "GUEST", displayName: "Neither", includesSymposium: false, includesDinner: false },
    ] });
    render(<EventAttendees eventId="event" ticketTypes={ticketTypes} />);
    const table = await screen.findByRole("table", { name: "Event attendees" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Name", "Type", "Symposium", "Dinner"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([["Guest", "Yes", "Yes"], ["Guest", "Yes", "No"], ["Guest", "No", "Yes"], ["Guest", "No", "No"]]);
  });
  it.each([
    [false, false, ["Name", "Type"]],
    [true, false, ["Name", "Type", "Symposium"]],
    [false, true, ["Name", "Type", "Dinner"]],
    [true, true, ["Name", "Type", "Symposium", "Dinner"]],
  ] as const)("shows only offered columns (symposium=%s, dinner=%s), even without bookings for them", async (includesSymposium, includesDinner, columns) => {
    getAttendees.mockResolvedValue({ attendees: [{ audience: "MEMBER", displayName: "Attendee", includesSymposium: false, includesDinner: false }] });
    render(<EventAttendees eventId="event" ticketTypes={[{ includesSymposium, includesDinner }]} />);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(columns);
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")).toHaveLength(columns.length - 1);
  });
  it("shows only names and type when there are no ticket types", async () => {
    getAttendees.mockResolvedValue({ attendees: [{ audience: "GUEST", displayName: "Attendee", includesSymposium: false, includesDinner: false }] });
    render(<EventAttendees eventId="event" ticketTypes={[]} />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Name", "Type"]);
  });
  it("shows an empty state", async () => {
    getAttendees.mockResolvedValue({ attendees: [] });
    render(<EventAttendees eventId="event" ticketTypes={ticketTypes} />);
    expect(await screen.findByText("No attendees yet.")).toBeInTheDocument();
  });
  it("allows retry after an error", async () => {
    getAttendees.mockRejectedValueOnce(new Error("failed")).mockResolvedValue({ attendees: [] });
    render(<EventAttendees eventId="event" ticketTypes={ticketTypes} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No attendees yet.")).toBeInTheDocument();
  });
  it("paginates longer lists", async () => {
    getAttendees.mockResolvedValue({ attendees: Array.from({ length: 51 }, (_, i) => ({ audience: "MEMBER", firstName: `Person ${i}`, lastName: "Smith", includesSymposium: true, includesDinner: true })) });
    render(<EventAttendees eventId="event" ticketTypes={ticketTypes} />);
    expect(await screen.findByText("Person 0 Smith")).toBeInTheDocument();
    expect(screen.queryByText("Person 50 Smith")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(screen.getByText("Person 50 Smith")).toBeInTheDocument());
    expect(screen.queryByText("Person 0 Smith")).not.toBeInTheDocument();
  });
});
