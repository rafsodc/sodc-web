import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "../../../../test-utils";
import EventAttendees from "../EventAttendees";
import { getEventAttendees } from "../../../../shared/utils/firebaseFunctions/sectionAccess";

vi.mock("../../../../shared/utils/firebaseFunctions/sectionAccess", () => ({ getEventAttendees: vi.fn() }));
const getAttendees = vi.mocked(getEventAttendees);

describe("event attendees", () => {
  beforeEach(() => getAttendees.mockReset());
  it("shows loading followed by structured and legacy names, preserving namesakes", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof getEventAttendees>>) => void;
    getAttendees.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<EventAttendees eventId="event" />);
    expect(screen.getByLabelText("Loading attendees")).toBeInTheDocument();
    resolve({ attendees: [{ firstName: "Alex", lastName: "Smith", includesSymposium: true, includesDinner: false }, { firstName: "Alex", lastName: "Smith", includesSymposium: true, includesDinner: false }, { displayName: "Cher", includesSymposium: false, includesDinner: true }] });
    expect(await screen.findAllByText("Alex Smith")).toHaveLength(2);
    expect(screen.getByText("Cher")).toBeInTheDocument();
    expect(getAttendees).toHaveBeenCalledWith("event");
  });
  it("renders accessible columns and all four attendance combinations", async () => {
    getAttendees.mockResolvedValue({ attendees: [
      { displayName: "Both", includesSymposium: true, includesDinner: true },
      { displayName: "Symposium only", includesSymposium: true, includesDinner: false },
      { displayName: "Dinner only", includesSymposium: false, includesDinner: true },
      { displayName: "Neither", includesSymposium: false, includesDinner: false },
    ] });
    render(<EventAttendees eventId="event" />);
    const table = await screen.findByRole("table", { name: "Event attendees" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Name", "Symposium", "Dinner"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([["Yes", "Yes"], ["Yes", "No"], ["No", "Yes"], ["No", "No"]]);
  });
  it("shows an empty state", async () => {
    getAttendees.mockResolvedValue({ attendees: [] });
    render(<EventAttendees eventId="event" />);
    expect(await screen.findByText("No attendees yet.")).toBeInTheDocument();
  });
  it("allows retry after an error", async () => {
    getAttendees.mockRejectedValueOnce(new Error("failed")).mockResolvedValue({ attendees: [] });
    render(<EventAttendees eventId="event" />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No attendees yet.")).toBeInTheDocument();
  });
  it("paginates longer lists", async () => {
    getAttendees.mockResolvedValue({ attendees: Array.from({ length: 51 }, (_, i) => ({ firstName: `Person ${i}`, lastName: "Smith", includesSymposium: true, includesDinner: true })) });
    render(<EventAttendees eventId="event" />);
    expect(await screen.findByText("Person 0 Smith")).toBeInTheDocument();
    expect(screen.queryByText("Person 50 Smith")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(screen.getByText("Person 50 Smith")).toBeInTheDocument());
    expect(screen.queryByText("Person 0 Smith")).not.toBeInTheDocument();
  });
});
