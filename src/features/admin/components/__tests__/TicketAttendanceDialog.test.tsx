import { searchSectionMembers } from "../../../../shared/utils/firebaseFunctions";
import { BookingApprovalStatus, TicketAudience } from "@dataconnect/generated";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketAttendanceDialog from "../TicketAttendanceDialog";
import { guestCall } from "../../../guests/api";
import type { EventAttendeeTicketRow } from "../../utils/bookingApprovalsAdmin";
import type { TicketTypeRow } from "../sectionEventsManagerTypes";
vi.mock("../../../guests/api", () => ({ guestCall: vi.fn() }));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({ searchSectionMembers: vi.fn() }));
const row: EventAttendeeTicketRow = {
  accommodationRequested: false, seatingPreferences: [], key: "booking:line", bookingId: "booking",
  email: null, rank: null, membershipStatus: null, ticketType: "Dinner", includesDinner: true,
  includesSymposium: false, approvalStatus: BookingApprovalStatus.APPROVED, paymentState: "PAID",
  ticketId: "line", ticketTypeId: "original", attendanceVersion: 2, attendeeName: "Alex Member",
  dietaryNote: "No nuts", audience: TicketAudience.MEMBER,
};
const ticketTypes = [{ id: "original", title: "Dinner", audience: "MEMBER" }, { id: "other", title: "Symposium", audience: "MEMBER" }, { id: "guest", title: "Guest", audience: "GUEST" }] as TicketTypeRow[];
const close = vi.fn();
const saved = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.mocked(guestCall).mockResolvedValue({ success: true }); vi.mocked(searchSectionMembers).mockResolvedValue({ members: [{ id: "user-jamie", firstName: "Jamie", lastName: "Guest" }, { id: "user-taylor", firstName: "Taylor", lastName: "Member" }, { id: "original-person", firstName: "Original", lastName: "person" }], hasMore: false }); });
describe("ticket attendance dialog", () => {
  it("saves details and a replacement ticket without financial input", async () => {
    render(<TicketAttendanceDialog sectionId="section" eventId="event" row={row} action="edit" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText("Attendee name"), { target: { value: "Alex Updated" } });
    fireEvent.mouseDown(screen.getByLabelText("Ticket type"));
    expect(screen.queryByRole("option", { name: "Guest" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Symposium" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(guestCall).toHaveBeenCalledWith("manageTicketAttendance", { eventId: "event", id: "line", version: 2, action: "edit", attendeeName: "Alex Updated", dietaryNote: "No nuts", ticketTypeId: "other" });
  });
  it("saves accommodation and seating changes for this ticket", async () => {
    render(<TicketAttendanceDialog sectionId="section" eventId="event" row={row} action="edit" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.click(screen.getByLabelText("Request accommodation"));
    fireEvent.change(screen.getByLabelText("Accommodation notes"), { target: { value: "Accessible room" } });
    fireEvent.change(screen.getByLabelText("Sit next to (optional)"), { target: { value: "Jamie" } });
    fireEvent.click(await screen.findByRole("option", { name: "Jamie Guest" }));
    fireEvent.change(screen.getByLabelText("Sit next to (optional)"), { target: { value: "Taylor" } });
    fireEvent.click(await screen.findByRole("option", { name: "Taylor Member" }));
    expect(searchSectionMembers).toHaveBeenCalledWith("section", "Taylor", ["user-jamie"]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(guestCall).toHaveBeenCalledWith("manageTicketAttendance", expect.objectContaining({ accommodationRequested: true, accommodationNote: "Accessible room", sitNextToUserIds: ["user-jamie", "user-taylor"] }));
  });
  it("clears inherited preferences and edits an accompanying guest name", async () => {
    const guest = { ...row, audience: TicketAudience.GUEST, ticketTypeId: "guest", attendeeName: "Old Guest", accommodationRequested: true, accommodationNote: "Old note", seatingPreferences: ["Original person"], sitNextToUserIds: ["original-person"] };
    render(<TicketAttendanceDialog sectionId="section" eventId="event" row={guest} action="edit" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText("Attendee name"), { target: { value: "New Guest" } });
    fireEvent.click(screen.getByLabelText("Request accommodation"));
    fireEvent.change(screen.getByLabelText("Accommodation notes"), { target: { value: "" } });
    fireEvent.click(screen.getByTitle("Clear"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(guestCall).toHaveBeenCalledWith("manageTicketAttendance", expect.objectContaining({ attendeeName: "New Guest", accommodationRequested: false, accommodationNote: "", sitNextToUserIds: [] }));
  });
  it("does not save unselected search text as a seating preference", async () => {
    render(<TicketAttendanceDialog sectionId="section" eventId="event" row={row} action="edit" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText("Sit next to (optional)"), { target: { value: "Free text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(vi.mocked(guestCall).mock.calls[0][1]).not.toHaveProperty("sitNextToUserIds");
  });
  it("requires delete confirmation and supports cancelling without writes", async () => {
    const view = render(<TicketAttendanceDialog sectionId="section" eventId="event" row={row} action="delete" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    expect(screen.getByText(/Transactions stay unchanged/)).toBeInTheDocument();
    expect(guestCall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    view.rerender(<TicketAttendanceDialog sectionId="section" eventId="event" row={row} action="delete" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete ticket" }));
    await waitFor(() => expect(guestCall).toHaveBeenCalledWith("manageTicketAttendance", expect.objectContaining({ action: "delete", id: "line", version: 2 })));
  });
  it("keeps failed edits open and prevents double submission", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(guestCall).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    render(<TicketAttendanceDialog sectionId="section" eventId="event" row={row} action="edit" ticketTypes={ticketTypes} onClose={close} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    reject(new Error("The ticket changed. Refresh and try again."));
    expect(await screen.findByText(/The ticket changed/)).toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });
});
