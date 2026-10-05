import OrganiserTicketTypesManager from "../OrganiserTicketTypesManager";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "../../../test-utils";
import { guestCall, type Guest, type GuestTicket } from "../api";
import GuestTicketPage from "../GuestTicketPage";
import OrganiserGuestsManager from "../OrganiserGuestsManager";
import { organiserGuestTicketRows } from "../reporting";
vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  guestCall: vi.fn(),
}));
const call = vi.mocked(guestCall);
const ticket: GuestTicket = {
  firstName: "Alex",
  lastName: "Guest",
  eventTitle: "Dinner event",
  ticketTitle: "Guest dinner",
  priceMinor: 2000,
  includesDinner: true,
  includesSymposium: false,
  dietaryRequirements: "Vegetarian",
  dietaryEditable: true,
  paymentDueAt: "2020-01-01",
  paymentStatus: "UNPAID",
  cancelled: false,
  version: 3,
};
const guest: Guest = {
  ...ticket,
  id: "guest",
  email: "guest@example.test",
  ticketTypeId: "type",
  refundedAmountMinor: 0,
};
beforeEach(() => {
  call.mockReset();
});
describe("account-free guest ticket", () => {
  function show() {
    render(
      <MemoryRouter initialEntries={["/guest-ticket#personal-token"]}>
        <GuestTicketPage />
      </MemoryRouter>,
    );
  }
  it("loads using the fragment token without login and submits only dietary changes", async () => {
    call.mockResolvedValue(ticket);
    show();
    await screen.findByText("Dinner event");
    expect(call).toHaveBeenCalledWith("getOrganiserGuestTicket", {
      token: "personal-token",
    });
    fireEvent.change(screen.getByLabelText("Dietary requirements"), {
      target: { value: "Vegan" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save dietary requirements" }),
    );
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith("updateOrganiserGuestDietary", {
        token: "personal-token",
        version: 3,
        dietaryRequirements: "Vegan",
      }),
    );
    expect(
      await screen.findByText("Dietary requirements saved."),
    ).toBeInTheDocument();
  });
  it("allows late payment while dietary editing is closed", async () => {
    call.mockResolvedValue({ ...ticket, dietaryEditable: false });
    show();
    expect(
      await screen.findByRole("button", { name: "Pay £20.00" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Dietary requirements")).toBeDisabled();
  });
  it("shows cancellation and outstanding refunds without guest cancellation or payment controls", async () => {
    call.mockResolvedValue({
      ...ticket,
      cancelled: true,
      dietaryEditable: false,
      paymentStatus: "REFUND_REQUIRED",
    });
    show();
    expect(await screen.findByText(/outstanding refund/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pay £/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
  });
  it("shows invalid or replaced links without personal details", async () => {
    call.mockRejectedValue(new Error("not found"));
    show();
    expect(
      await screen.findByText(/This guest link is unavailable/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dinner event")).not.toBeInTheDocument();
  });
});
describe("organiser management and reports", () => {
  it("allows a guest to be saved without an email address", async () => {
    call.mockResolvedValue({
      event: { id: "event" },
      ticketTypes: [
        {
          id: "type",
          title: "Guest dinner",
          priceMinor: 2000,
          includesDinner: true,
          includesSymposium: false,
          active: true,
          version: 1,
        },
      ],
      guests: [],
    });
    render(<OrganiserGuestsManager eventId="event" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add guest" }));
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Guest" },
    });
    expect(screen.getByLabelText("Email (optional)")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Save guest" }));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        "manageOrganiserGuest",
        expect.objectContaining({
          eventId: "event",
          action: "create",
          firstName: "Alex",
          lastName: "Guest",
          email: "",
        }),
      ),
    );
  });
  it("keeps the guest list focused on people and reuses the shared ticket editor for moderators", async () => {
    call.mockResolvedValue({ event: {}, ticketTypes: [], guests: [] });
    const view = render(<OrganiserGuestsManager eventId="event" />);
    await screen.findByText(/Create an organiser\/club guest ticket in Ticket types/);
    expect(screen.queryByRole("button", { name: /add guest ticket type/i })).not.toBeInTheDocument();
    view.unmount();
    render(<OrganiserTicketTypesManager eventId="event" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add ticket type" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add ticket type" }));
    expect(screen.getByRole("combobox", { name: "Ticket category" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Club guests" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Dinner invitation" } });
    fireEvent.change(screen.getByLabelText("Sort order"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(call).toHaveBeenCalledWith("saveOrganiserGuestTicketType", expect.objectContaining({ eventId: "event", title: "Club guests", description: "Dinner invitation", sortOrder: 2, priceMinor: 0 })));
  });
  it("keeps cancellation explicit and shows paid refund obligations", async () => {
    call.mockResolvedValue({
      event: { id: "event" },
      ticketTypes: [],
      guests: [guest],
    });
    render(<OrganiserGuestsManager eventId="event" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel guest" }),
    );
    expect(
      screen.getByText(/does not issue an automatic refund/),
    ).toBeInTheDocument();
    expect(call).not.toHaveBeenCalledWith(
      "manageOrganiserGuest",
      expect.anything(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    );
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith("manageOrganiserGuest", {
        eventId: "event",
        id: "guest",
        version: 3,
        action: "cancel",
      }),
    );
  });
  it("includes unpaid/free organiser guests in reports and excludes cancellations", () => {
    const rows = organiserGuestTicketRows([
      guest,
      { ...guest, id: "free", priceMinor: 0, paymentStatus: "FREE" },
      { ...guest, id: "cancelled", cancelled: true },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      audience: "ORGANISER_GUEST",
      includesDinner: true,
      dietaryNote: "Vegetarian",
      paymentState: "UNPAID",
    });
    expect(rows[1].paymentState).toBe("FREE");
  });
});
