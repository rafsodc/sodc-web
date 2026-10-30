import { BookingApprovalStatus, BookingStatus, MembershipStatus, TicketAudience, TicketOrderStatus } from "@dataconnect/generated";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "../../../../test-utils";
import { TicketAdminSurface } from "../sectionEventsManagerSurfaces/TicketAdminSurface";
import type { EventBookingAdminRow } from "../sectionEventsManagerTypes";
import type { EventManagementTask } from "../../../../shared/navigation/sectionRoutes";

function booking(overrides: Partial<EventBookingAdminRow> = {}): EventBookingAdminRow {
  return { id: "booking-2", revisionGroupId: "group", revisionNumber: 2, status: BookingStatus.SUBMITTED,
    approvalStatus: BookingApprovalStatus.PENDING, supersededAt: null, accommodationRequested: true, accommodationNote: "Accessible room", sitNextToUserIds: ["friend"],
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
    booker: { id: "owner", firstName: "Alex", lastName: "Member", email: "alex@example.com", membershipStatus: MembershipStatus.REGULAR },
    lines: [{ id: "line", sortOrder: 0, guestDisplayName: "Jamie Guest", dietaryNote: "No nuts", ticketType: { id: "ticket", title: "Dinner", audience: TicketAudience.GUEST, price: 75, includesDinner: true, includesSymposium: false },
      bookingPlace: { id: "place", attendanceVersion: 0, attendanceRemoved: false, paymentAllocations: [] } }], ...overrides };
}
const pending = booking();
const previous = booking({ id: "booking-1", revisionNumber: 1, approvalStatus: BookingApprovalStatus.APPROVED });
previous.lines = [{ ...previous.lines[0], guestDisplayName: "Previous Guest", ticketType: { ...previous.lines[0].ticketType, price: 50 }, bookingPlace: { ...previous.lines[0].bookingPlace, paymentAllocations: [{ id: "allocation", ticketOrderId: "paid", allocatedAmountMinor: 5000, refundedAmountMinor: 0 }] } }];
afterEach(() => vi.restoreAllMocks());

const orders = new Map([["paid", { id: "paid", status: TicketOrderStatus.PAID }]]);
function panelProps() {
  return { event: null, eventTitle: "Dinner", error: null, onDismissError: vi.fn(), onBack: vi.fn(), onEditEvent: vi.fn(), onAddTicketType: vi.fn(), loadingEventDetail: false, ticketTypes: [], deletingTicketTypeId: null, onEditTicketType: vi.fn(), onDeleteTicketType: vi.fn(), approvalStatusFilter: "PENDING" as const, onApprovalStatusFilterChange: vi.fn(), approvalBookings: [pending], allEventBookings: [previous, pending], ticketOrdersById: orders, attendeeTickets: [], moderatorNoteDraft: {} as Record<string, string>, onModeratorNoteChange: vi.fn(), reviewingBookingId: null, onReviewBooking: vi.fn(), loadingEventBookings: false, eventBookings: [], loadingTicketOrders: false, ticketOrders: [], loadingPaymentAdjustments: false, bookingPaymentAdjustments: [] };
}

describe("event management task panels", () => {
  it("renders only the selected panel with linkable local attendee and ticket navigation", () => {
    render(<MemoryRouter><TicketAdminSurface {...panelProps()} selectedTask="tickets" taskHref={(task) => `/event?task=${task}`} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Tickets & attendees", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add ticket type" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Attendees" })).toHaveAttribute("href", "/event?task=attendees");
    expect(screen.getByRole("tab", { name: "Removed" })).toHaveAttribute("href", "/event?task=removed");
    expect(screen.getByRole("link", { name: "Manage organiser guests" })).toHaveAttribute("href", "/event?task=guests");
    expect(screen.queryByRole("heading", { name: /Event admin/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Booking approvals" })).not.toBeInTheDocument();
    expect(screen.queryByText("Payment status activity")).not.toBeInTheDocument();
  });

  it("requires review of complete revisions and financial effect before sending the exact decision", async () => {
    const user = userEvent.setup(); const props = panelProps();
    render(<TicketAdminSurface {...props} selectedTask="approvals" />);
    expect(screen.queryByRole("button", { name: "Approve revision" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review change" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Previous active booking")).toBeInTheDocument();
    expect(within(dialog).getByText("Previous Guest")).toBeInTheDocument();
    expect(within(dialog).getByText("Jamie Guest")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Dietary: No nuts")).toHaveLength(2);
    expect(within(dialog).getAllByText(/Accessible room/)).toHaveLength(2);
    expect(within(dialog).getByText("Financial effect")).toBeInTheDocument();
    expect(within(dialog).getByText("£25.00")).toBeInTheDocument();
    expect(props.onReviewBooking).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Approve revision" }));
    expect(props.onReviewBooking).toHaveBeenCalledWith(pending, BookingApprovalStatus.APPROVED);
  });

  it.each([
    { allocated: 5000, refunded: 0, proposedPrice: 75, expected: "£25.00", label: "Estimated booking balance after approval" },
    { allocated: 3000, refunded: 0, proposedPrice: 75, expected: "£45.00", label: "Estimated booking balance after approval" },
    { allocated: 5000, refunded: 1000, proposedPrice: 75, expected: "£35.00", label: "Estimated booking balance after approval" },
    { allocated: 5000, refunded: 5000, proposedPrice: 75, expected: "£75.00", label: "Estimated booking balance after approval" },
    { allocated: 5000, refunded: 0, proposedPrice: 35, expected: "£15.00", label: "Estimated refund due" },
    { allocated: 5000, refunded: 0, proposedPrice: 50, expected: "£0.00", label: "Estimated booking balance after approval" },
  ])("previews the server's complete-revision financial calculation with $allocated settled and $refunded refunded", async ({ allocated, refunded, proposedPrice, expected, label }) => {
    const user = userEvent.setup();
    const before = booking({ id: "before", revisionNumber: 1, approvalStatus: BookingApprovalStatus.APPROVED });
    before.lines[0].bookingPlace.paymentAllocations = [{ id: "allocation", ticketOrderId: "paid", allocatedAmountMinor: allocated, refundedAmountMinor: refunded }];
    const proposed = booking(); proposed.lines[0].ticketType.price = proposedPrice;
    render(<TicketAdminSurface {...panelProps()} selectedTask="approvals" approvalBookings={[proposed]} allEventBookings={[before, proposed]} />);
    await user.click(screen.getByRole("button", { name: "Review change" }));
    const field = screen.getByText(label).parentElement;
    expect(field).not.toBeNull();
    expect(within(field!).getByText(expected)).toBeInTheDocument();
  });

  it("retains removed revision evidence and explains the separate currently payable balance", async () => {
    const user = userEvent.setup(); const proposed = booking();
    proposed.lines[0].bookingPlace.attendanceRemoved = true;
    render(<TicketAdminSurface {...panelProps()} selectedTask="approvals" approvalBookings={[proposed]} allEventBookings={[previous, proposed]} />);
    await user.click(screen.getByRole("button", { name: "Review change" }));
    expect(screen.getByText("Removed from attendance")).toBeInTheDocument();
    expect(screen.getByText("This estimate includes the complete booking revision. Payments shows the places currently eligible for payment.")).toBeInTheDocument();
    expect(within(screen.getByText("Estimated booking balance after approval").parentElement!).getByText("£25.00")).toBeInTheDocument();
  });

  it("uses zero previous settled credit for a first revision even if proposed lines contain allocations", async () => {
    const user = userEvent.setup(); const proposed = booking();
    proposed.lines[0].bookingPlace.paymentAllocations = [{ id: "allocation", ticketOrderId: "paid", allocatedAmountMinor: 7500, refundedAmountMinor: 0 }];
    render(<TicketAdminSurface {...panelProps()} selectedTask="approvals" approvalBookings={[proposed]} allEventBookings={[proposed]} />);
    await user.click(screen.getByRole("button", { name: "Review change" }));
    expect(within(screen.getByText("Net payment already settled").parentElement!).getByText("£0.00")).toBeInTheDocument();
    expect(within(screen.getByText("Estimated booking balance after approval").parentElement!).getByText("£75.00")).toBeInTheDocument();
  });

  it("keeps a moderator note when closing and moving away from the approvals task", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [task, setTask] = useState<EventManagementTask>("approvals");
      const [notes, setNotes] = useState<Record<string, string>>({});
      return <><button onClick={() => setTask(task === "approvals" ? "details" : "approvals")}>Switch task</button><TicketAdminSurface {...panelProps()} selectedTask={task} moderatorNoteDraft={notes} onModeratorNoteChange={(id, value) => setNotes((current) => ({ ...current, [id]: value }))} /></>;
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Review change" }));
    await user.type(screen.getByRole("textbox", { name: "Moderator note" }), "Please confirm the guest.");
    await user.click(screen.getByRole("button", { name: "Close review" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Switch task" }));
    await user.click(screen.getByRole("button", { name: "Switch task" }));
    await user.click(screen.getByRole("button", { name: "Review change" }));
    expect(screen.getByRole("textbox", { name: "Moderator note" })).toHaveValue("Please confirm the guest.");
  });

  it("prevents another decision or note change after a confirmed save while cached data still says Pending", async () => {
    const user = userEvent.setup(); const props = panelProps(); const retry = vi.fn();
    function view(savedReviewDecisions?: Readonly<Record<string, number>>, reviewingBookingId: string | null = null) {
      return <><button onClick={retry}>Retry refresh</button><TicketAdminSurface {...props} selectedTask="approvals" savedReviewDecisions={savedReviewDecisions} reviewingBookingId={reviewingBookingId} /></>;
    }
    const rendered = render(view());
    await user.click(screen.getByRole("button", { name: "Review change" }));
    await user.click(screen.getByRole("button", { name: "Approve revision" }));
    expect(props.onReviewBooking).toHaveBeenCalledTimes(1);
    rendered.rerender(view({ [pending.id]: pending.revisionNumber }, pending.id));
    expect(screen.getByText("Decision saved. Close this review and use Retry refresh to load the updated list.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving decision…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request changes" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Moderator note" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close review" })).toBeEnabled();
    rendered.rerender(view({ [pending.id]: pending.revisionNumber }));
    const savedApproveButton = screen.getByRole("button", { name: "Approve revision" });
    expect(savedApproveButton).toBeDisabled();
    fireEvent.click(savedApproveButton);
    expect(props.onReviewBooking).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Close review" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("only blocks a saved decision for the exact matching revision", async () => {
    const user = userEvent.setup();
    render(<TicketAdminSurface {...panelProps()} selectedTask="approvals" savedReviewDecisions={{ [pending.id]: pending.revisionNumber - 1 }} />);
    await user.click(screen.getByRole("button", { name: "Review change" }));
    expect(screen.queryByText(/Decision saved/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve revision" })).toBeEnabled();
  });

  it("blocks approval when a newer revision replaces the one opened in the dialog", async () => {
    const user = userEvent.setup(); const props = panelProps();
    const view = render(<TicketAdminSurface {...props} selectedTask="approvals" />);
    await user.click(screen.getByRole("button", { name: "Review change" }));
    view.rerender(<TicketAdminSurface {...props} selectedTask="approvals" allEventBookings={[previous, pending, booking({ id: "booking-3", revisionNumber: 3 })]} />);
    expect(screen.getByRole("button", { name: "Approve revision" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request changes" })).toBeDisabled();
    expect(screen.getByText(/This revision has changed/)).toBeInTheDocument();
    expect(props.onReviewBooking).not.toHaveBeenCalled();
  });

  it("switches payment views and opens contact review without sending a notification", async () => {
    const user = userEvent.setup(); const props = panelProps(); const onContactUnpaid = vi.fn();
    render(<TicketAdminSurface {...props} selectedTask="payments" allEventBookings={[booking({ approvalStatus: BookingApprovalStatus.APPROVED })]} onContactUnpaid={onContactUnpaid} />);
    expect(screen.getByRole("heading", { name: "Outstanding balance: £75.00" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Contact unpaid bookers" }));
    expect(onContactUnpaid).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("tab", { name: "All payment records" }));
    expect(screen.getByText("No payment orders found for this event.")).toBeInTheDocument();
  });

  it.each(["organiser guests only", "partial payment", "payment in progress", "refunded", "removed", "pending revision only"])("disables the booker shortcut for %s without an exact current unpaid booking line", (kind) => {
    const active = booking({ approvalStatus: BookingApprovalStatus.APPROVED });
    const ticketOrdersById = new Map([
      ["paid", { id: "paid", status: TicketOrderStatus.PAID }],
      ["pending", { id: "pending", status: TicketOrderStatus.PENDING }],
      ["refunded", { id: "refunded", status: TicketOrderStatus.REFUNDED }],
    ]);
    if (kind === "partial payment") active.lines[0].bookingPlace.paymentAllocations = [{ id: "allocation", ticketOrderId: "paid", allocatedAmountMinor: 2500, refundedAmountMinor: 0 }];
    if (kind === "payment in progress") active.lines[0].bookingPlace.paymentAllocations = [{ id: "allocation", ticketOrderId: "pending", allocatedAmountMinor: 7500, refundedAmountMinor: 0 }];
    if (kind === "refunded") active.lines[0].bookingPlace.paymentAllocations = [{ id: "allocation", ticketOrderId: "refunded", allocatedAmountMinor: 7500, refundedAmountMinor: 7500 }];
    if (kind === "removed") active.lines[0].bookingPlace.attendanceRemoved = true;
    if (kind === "pending revision only") active.approvalStatus = BookingApprovalStatus.PENDING;
    const guest = { id: "guest", firstName: "Robin", lastName: "Guest", email: "robin@example.com", dietaryRequirements: "", ticketTypeId: "guest-ticket", ticketTitle: "Guest dinner", priceMinor: 2500, includesDinner: true, includesSymposium: false, version: 1, cancelled: false, paymentStatus: "UNPAID", refundedAmountMinor: 0 };
    const onContactUnpaid = vi.fn();
    render(<TicketAdminSurface {...panelProps()} selectedTask="payments" allEventBookings={kind === "organiser guests only" ? [] : [active]} organiserGuests={[guest]} ticketOrdersById={ticketOrdersById} onContactUnpaid={onContactUnpaid} />);
    const contact = screen.getByRole("button", { name: "Contact unpaid bookers" });
    expect(contact).toBeDisabled();
    fireEvent.click(contact);
    expect(onContactUnpaid).not.toHaveBeenCalled();
  });

  it("enables the booker shortcut when any nonremoved active line is exactly unpaid alongside partial payments and a pending amendment", async () => {
    const user = userEvent.setup(); const onContactUnpaid = vi.fn();
    const active = booking({ id: "active", revisionNumber: 1, approvalStatus: BookingApprovalStatus.APPROVED });
    active.lines[0].bookingPlace.paymentAllocations = [{ id: "allocation", ticketOrderId: "paid", allocatedAmountMinor: 2500, refundedAmountMinor: 0 }];
    active.lines.push({ ...active.lines[0], id: "unpaid-line", guestDisplayName: "Unpaid accompanying guest", bookingPlace: { ...active.lines[0].bookingPlace, id: "unpaid-place", paymentAllocations: [] } });
    render(<TicketAdminSurface {...panelProps()} selectedTask="payments" allEventBookings={[active, pending]} onContactUnpaid={onContactUnpaid} />);
    expect(screen.getByRole("button", { name: "Contact unpaid bookers" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Contact unpaid bookers" }));
    expect(onContactUnpaid).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Booking owners of unpaid member or accompanying guest tickets only. Excludes organiser guests, partial payments and payments in progress. Review recipients before sending.")).toBeInTheDocument();
  });

  it("uses labelled cards for approval and payment records on narrow screens", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: query.includes("max-width"), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const user = userEvent.setup();
    const first = render(<TicketAdminSurface {...panelProps()} selectedTask="approvals" />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alex Member" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review change" }));
    expect(screen.getByRole("button", { name: "Approve revision" })).toBeInTheDocument();
    first.unmount();
    render(<TicketAdminSurface {...panelProps()} selectedTask="payments" allEventBookings={[booking({ approvalStatus: BookingApprovalStatus.APPROVED })]} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("£75.00")).toBeInTheDocument();
  });

  it("labels mixed payment summaries accurately and links to the relevant management tasks", async () => {
    const user = userEvent.setup();
    const guest = { id: "guest", firstName: "Robin", lastName: "Guest", email: "robin@example.com", dietaryRequirements: "", ticketTypeId: "guest-ticket", ticketTitle: "Guest dinner", priceMinor: 2500, includesDinner: true, includesSymposium: false, version: 1, cancelled: false, paymentStatus: "UNPAID", refundedAmountMinor: 0 };
    render(<MemoryRouter><TicketAdminSurface {...panelProps()} selectedTask="payments" allEventBookings={[booking({ approvalStatus: BookingApprovalStatus.APPROVED })]} organiserGuests={[guest]} taskHref={(task) => `/event?task=${task}`} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Payments", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/2 tickets across 2 bookings or organiser guests/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage guest" })).toHaveAttribute("href", "/event?task=guests");
    expect(screen.getByRole("link", { name: "View booking activity" })).toHaveAttribute("href", "/event?task=activity");
    await user.click(screen.getByRole("tab", { name: "All payment records" }));
    expect(screen.getByRole("link", { name: "Manage guest" })).toHaveAttribute("href", "/event?task=guests");
  });

  it("withholds settled totals when payment sources are unavailable", () => {
    render(<TicketAdminSurface {...panelProps()} selectedTask="payments" settledPaymentsUnavailable paymentDataUnavailable />);
    expect(screen.getByRole("heading", { name: "Net settled booking orders", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Unavailable until payment order records load.")).toBeInTheDocument();
    expect(screen.getByText("Unavailable until organiser guest payment evidence is complete.")).toBeInTheDocument();
    expect(screen.queryByText("No settled booking order payments recorded.")).not.toBeInTheDocument();
  });

  it("withholds the required balance and contact shortcut when source records are unavailable", async () => {
    const user = userEvent.setup();
    render(<TicketAdminSurface {...panelProps()} selectedTask="payments" paymentDataUnavailable onContactUnpaid={vi.fn()} />);
    expect(screen.getByText(/Payment summary unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Outstanding balance/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contact unpaid bookers" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "All payment records" }));
    expect(screen.getByText("No payment orders found for this event.")).toBeInTheDocument();
  });

  it("disables contact when allocation details are missing", () => {
    const active = booking({ approvalStatus: BookingApprovalStatus.APPROVED });
    active.lines[0].bookingPlace.paymentAllocations = [{ id: "missing", ticketOrderId: "missing", allocatedAmountMinor: 7500, refundedAmountMinor: 0 }];
    render(<TicketAdminSurface {...panelProps()} selectedTask="payments" allEventBookings={[active]} onContactUnpaid={vi.fn()} />);
    expect(screen.getByText(/Payment records are incomplete/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact unpaid bookers" })).toBeDisabled();
  });
});
