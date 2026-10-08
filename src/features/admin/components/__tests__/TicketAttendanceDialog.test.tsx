import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketAttendanceDialog from "../TicketAttendanceDialog";
import { guestCall } from "../../../guests/api";
import type { EventAttendeeTicketRow } from "../../utils/bookingApprovalsAdmin";
import type { TicketTypeRow } from "../sectionEventsManagerTypes";
vi.mock("../../../guests/api", () => ({ guestCall: vi.fn() }));
const row = { key: "booking:line", ticketId: "line", ticketTypeId: "original", attendanceVersion: 2, attendeeName: "Alex Member", dietaryNote: "No nuts", audience: "MEMBER" } as EventAttendeeTicketRow;
const ticketTypes = [{ id: "original", title: "Dinner", audience: "MEMBER" }, { id: "other", title: "Symposium", audience: "MEMBER" }, { id: "guest", title: "Guest", audience: "GUEST" }] as TicketTypeRow[];
const close = vi.fn();
const saved = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.mocked(guestCall).mockResolvedValue({ success: true }); });
describe("ticket attendance dialog", () => {
  it("saves details and a replacement ticket without financial input", async () => {
    render(<TicketAttendanceDialog eventId="event" row={row} action="edit" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText("Attendee name"), { target: { value: "Alex Updated" } });
    fireEvent.mouseDown(screen.getByLabelText("Ticket type"));
    expect(screen.queryByRole("option", { name: "Guest" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Symposium" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(guestCall).toHaveBeenCalledWith("manageTicketAttendance", { eventId: "event", id: "line", version: 2, action: "edit", attendeeName: "Alex Updated", dietaryNote: "No nuts", ticketTypeId: "other" });
  });
  it("requires delete confirmation and supports cancelling without writes", async () => {
    const view = render(<TicketAttendanceDialog eventId="event" row={row} action="delete" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    expect(screen.getByText(/Transactions stay unchanged/)).toBeInTheDocument();
    expect(guestCall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    view.rerender(<TicketAttendanceDialog eventId="event" row={row} action="delete" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete ticket" }));
    await waitFor(() => expect(guestCall).toHaveBeenCalledWith("manageTicketAttendance", expect.objectContaining({ action: "delete", id: "line", version: 2 })));
  });
  it("keeps failed edits open and prevents double submission", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(guestCall).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    render(<TicketAttendanceDialog eventId="event" row={row} action="edit" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    reject(new Error("The ticket changed. Refresh and try again."));
    expect(await screen.findByText(/The ticket changed/)).toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });
});
