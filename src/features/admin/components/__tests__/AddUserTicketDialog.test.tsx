import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import AddUserTicketDialog, { type ManagedBookingContext } from "../AddUserTicketDialog";
import MemberTicketsManager from "../../../guests/MemberTicketsManager";
import { guestCall } from "../../../guests/api";
import { searchSectionMembers, submitEventBooking } from "../../../../shared/utils/firebaseFunctions";
import { activeEventTicketRows } from "../../utils/bookingApprovalsAdmin";
import type { EventBookingAdminRow } from "../sectionEventsManagerTypes";

vi.mock("../../../guests/api", () => ({ guestCall: vi.fn() }));
vi.mock("../../../../config/firebase", () => ({ auth: { currentUser: { uid: "organiser" } } }));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({ submitEventBooking: vi.fn(), searchSectionMembers: vi.fn() }));
const selectedUser = { id: "member", firstName: "Selected", lastName: "Member", email: "member@example.com", membershipStatus: "REGULAR" };
const context: ManagedBookingContext = {
  user: selectedUser,
  booking: null,
  ticketTypes: [
    { id: "member-ticket", title: "Member dinner", audience: "MEMBER", price: 50 },
    { id: "guest-ticket", title: "Guest dinner", audience: "GUEST", price: 25 },
  ],
};
const onSaved = vi.fn();
const onClose = vi.fn();
function removedBooking(): EventBookingAdminRow {
  return {
    id: "booking", revisionGroupId: "booking", revisionNumber: 1, status: "CONFIRMED", approvalStatus: "APPROVED",
    supersededAt: null, booker: selectedUser, accommodationRequested: false, sitNextToUserIds: [],
    lines: [{ id: "member-line", sortOrder: 0, ticketType: { ...context.ticketTypes[0], includesDinner: true, includesSymposium: false },
      bookingPlace: { id: "place", attendanceRemoved: true, attendanceVersion: 2, paymentAllocations: [] } }],
  } as unknown as EventBookingAdminRow;
}
function mockContext(value: ManagedBookingContext) {
  vi.mocked(guestCall).mockImplementation(async (name) => (name === "searchSectionMembers"
    ? { members: [selectedUser], hasMore: false } : value) as never);
}
async function selectUser() {
  fireEvent.change(screen.getByLabelText("Booking user"), { target: { value: "Selected" } });
  fireEvent.click(await screen.findByRole("option", { name: "Selected Member — member@example.com" }));
  await screen.findByLabelText("Ticket type");
}
function show() {
  return render(<AddUserTicketDialog eventId="event" sectionId="section" onClose={onClose} onSaved={onSaved} />);
}
beforeEach(() => {
  vi.clearAllMocks();
  onSaved.mockReset();
  vi.mocked(submitEventBooking).mockReset();
  mockContext(context);
  vi.mocked(submitEventBooking).mockResolvedValue({ bookingId: "new", status: "SUBMITTED", approvalStatus: "NOT_REQUIRED", outcome: "READY_FOR_PAYMENT", paymentReady: true });
  vi.mocked(searchSectionMembers).mockResolvedValue({ members: [selectedUser, { id: "friend", firstName: "Friend", lastName: "Member" }], hasMore: false });
});

describe("adding tickets for a user", () => {
  it("offers restoration instead of requiring a guest when the user's member ticket was removed", async () => {
    mockContext({ ...context, booking: { id: "booking", revisionNumber: 1, approvalStatus: "APPROVED",
      lines: [{ ticketTypeId: "member-ticket", sortOrder: 0 }], accommodationRequested: false, accommodationNote: null, sitNextToUserIds: [] } });
    const rows = activeEventTicketRows([removedBooking()], new Map(), new Map(), "removed");
    const restore = vi.fn();
    render(<AddUserTicketDialog eventId="event" sectionId="section" onClose={onClose} onSaved={onSaved} removedTickets={rows} onRestore={restore} />);
    await selectUser();
    expect(screen.getByText(/This user's member ticket was removed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore ticket" }));
    expect(restore).toHaveBeenCalledWith(rows[0]);
    expect(submitEventBooking).not.toHaveBeenCalled();
  });

  it("restores a removed member ticket from the manager and refreshes attendance", async () => {
    const booking = removedBooking();
    vi.mocked(guestCall).mockImplementation(async (name) => {
      if (name === "manageTicketAttendance") {
        booking.lines[0].bookingPlace.attendanceRemoved = false;
        return { success: true } as never;
      }
      return { bookings: [booking], orders: [], seatingUsers: [], ticketTypes: context.ticketTypes } as never;
    });
    render(<MemberTicketsManager eventId="event" sectionId="section" />);
    fireEvent.click(await screen.findByRole("button", { name: "Removed tickets (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore ticket for Selected Member" }));
    expect(screen.getByRole("dialog", { name: "Restore ticket" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore ticket" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Removed tickets (1)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ticket for Selected Member" })).toBeInTheDocument();
    expect(guestCall).toHaveBeenCalledWith("manageTicketAttendance", expect.objectContaining({ id: "member-line", action: "restore", version: 2 }));
    expect(submitEventBooking).not.toHaveBeenCalled();
  });

  it("opens the user-ticket form from the organiser ticket manager", async () => {
    vi.mocked(guestCall).mockResolvedValue({ bookings: [], orders: [], seatingUsers: [], ticketTypes: [] });
    render(<MemberTicketsManager eventId="event" sectionId="section" />);
    fireEvent.click(screen.getByRole("button", { name: "Add ticket" }));
    expect(screen.getByRole("dialog", { name: "Add ticket for a user" })).toBeInTheDocument();
    await waitFor(() => expect(guestCall).toHaveBeenCalledWith("getManagedEventTickets", { eventId: "event" }));
  });

  it("creates a member ticket for the selected user with preferences and no checkout", async () => {
    show();
    await selectUser();
    expect(guestCall).toHaveBeenCalledWith("searchSectionMembers", { sectionId: "section", searchTerm: "Selected", forBooking: true });
    expect(guestCall).toHaveBeenCalledWith("getManagedBookingContext", { eventId: "event", bookerId: "member" });
    fireEvent.change(screen.getByLabelText("Dietary requirements"), { target: { value: "Vegetarian" } });
    fireEvent.click(screen.getByLabelText("Request accommodation"));
    fireEvent.change(screen.getByLabelText("Accommodation notes"), { target: { value: "Ground floor" } });
    fireEvent.change(screen.getByLabelText("Sit next to (optional)"), { target: { value: "Friend" } });
    fireEvent.click(await screen.findByRole("option", { name: "Friend Member" }));
    expect(screen.queryByRole("option", { name: "Selected Member" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add ticket" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(submitEventBooking).toHaveBeenCalledWith(expect.objectContaining({
      bookerId: "member", eventId: "event", idempotencyKey: expect.any(String),
      lines: [{ ticketTypeId: "member-ticket", sortOrder: 0, guestDisplayName: null, dietaryNote: "Vegetarian" }],
      accommodationRequested: true, accommodationNote: "Ground floor", sitNextToUserIds: ["friend"],
    }));
  });

  it("adds a guest while preserving the existing booking and preferences", async () => {
    const booking = { id: "booking", revisionNumber: 3, approvalStatus: "APPROVED", accommodationRequested: true,
      accommodationNote: "Existing note", sitNextToUserIds: ["friend"],
      lines: [{ ticketTypeId: "member-ticket", sortOrder: 0, dietaryNote: "Existing dietary note" }],
    };
    mockContext({ ...context, booking });
    show();
    await selectUser();
    expect(screen.getByLabelText("Request accommodation")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add ticket" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "Alex Guest" } });
    fireEvent.change(screen.getByLabelText("Dietary requirements"), { target: { value: "Vegan" } });
    fireEvent.click(screen.getByRole("button", { name: "Add ticket" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(submitEventBooking).toHaveBeenCalledWith(expect.objectContaining({
      bookerId: "member", baseBookingId: "booking", baseRevisionNumber: 3,
      accommodationRequested: true, accommodationNote: "Existing note", sitNextToUserIds: ["friend"],
      lines: [...booking.lines, { ticketTypeId: "guest-ticket", sortOrder: 1, guestDisplayName: "Alex Guest", dietaryNote: "Vegan" }],
    }));
  });

  it("keeps the same submission key on retries and blocks concurrent submissions", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(submitEventBooking).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    show(); await selectUser();
    fireEvent.click(screen.getByRole("button", { name: "Add ticket" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    reject(new Error("Network failure"));
    await screen.findByText("We couldn’t submit your booking. Please try again.");
    const first = vi.mocked(submitEventBooking).mock.calls[0][0];
    fireEvent.click(screen.getByRole("button", { name: "Add ticket" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(vi.mocked(submitEventBooking).mock.calls[1][0].idempotencyKey).toBe(first.idempotencyKey);
  });

  it("never submits twice if refreshing after success fails", async () => {
    onSaved.mockRejectedValueOnce(new Error("Refresh failed"));
    show(); await selectUser();
    fireEvent.click(screen.getByRole("button", { name: "Add ticket" }));
    const retry = await screen.findByRole("button", { name: "Refresh tickets" });
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    expect(submitEventBooking).toHaveBeenCalledOnce();
  });

  it("blocks saving when no eligible ticket type exists", async () => {
    mockContext({ ...context, ticketTypes: [] });
    show(); await selectUser();
    expect(screen.getByText(/No eligible member ticket types/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add ticket" })).toBeDisabled();
  });

  it("shows context errors without allowing a submission", async () => {
    vi.mocked(guestCall).mockImplementation(async (name) => {
      if (name === "getManagedBookingContext") throw { details: { code: "NOT_AUTHORIZED_BOOKER" } };
      return { members: [selectedUser], hasMore: false } as never;
    });
    show();
    fireEvent.change(screen.getByLabelText("Booking user"), { target: { value: "Selected" } });
    fireEvent.click(await screen.findByRole("option", { name: "Selected Member — member@example.com" }));
    expect(await screen.findByText("You are not eligible to book this event.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add ticket" })).not.toBeInTheDocument();
  });
});
