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
const writeText = vi.fn();
const write = vi.fn();
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
  paymentRequiredMinor: 2000,
  cancelled: false,
  version: 3,
};
const guest: Guest = {
  ...ticket,
  id: "guest",
  email: "guest@example.test",
  ticketTypeId: "type",
  refundedAmountMinor: 0,
  paidAmountMinor: 0,
  settledAmountMinor: 0,
  paymentRequiredMinor: 2000,
  refundPendingMinor: 0,
  refundFailureReason: null,
};
beforeEach(() => {
  call.mockReset();
  writeText.mockReset();
  write.mockReset();
  Object.defineProperty(globalThis, "ClipboardItem", {
    configurable: true,
    value: class ClipboardItem {
      items: Record<string, Blob | Promise<Blob>>;
      constructor(items: Record<string, Blob | Promise<Blob>>) {
        this.items = items;
      }
    },
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write, writeText },
  });
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
  it("copies a fresh guest link directly without opening a link dialog", async () => {
    const list = {
      event: { id: "event" },
      ticketTypes: [],
      guests: [guest],
    };
    call
      .mockResolvedValueOnce(list)
      .mockResolvedValueOnce({ link: "https://example.test/guest-ticket#new" })
      .mockResolvedValueOnce(list);
    write.mockResolvedValue(undefined);
    render(<OrganiserGuestsManager eventId="event" />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith("manageOrganiserGuest", {
        eventId: "event",
        action: "replace-link",
        id: "guest",
        version: 3,
      }),
    );
    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0][0][0] as {
      items: Record<string, Promise<Blob>>;
    };
    await expect(item.items["text/plain"]).resolves.toEqual(
      new Blob(["https://example.test/guest-ticket#new"], {
        type: "text/plain",
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Copy guest link" })).not.toBeInTheDocument();
    expect(
      await screen.findByText(/New guest link copied/),
    ).toBeInTheDocument();
  });
  it("shows the generated link without replacing it again when automatic copying fails", async () => {
    const list = {
      event: { id: "event" },
      ticketTypes: [],
      guests: [guest],
    };
    call
      .mockResolvedValueOnce(list)
      .mockResolvedValueOnce({ link: "https://example.test/guest-ticket#new" })
      .mockResolvedValueOnce(list);
    write.mockRejectedValue(new DOMException("Not allowed", "NotAllowedError"));
    writeText.mockResolvedValue(undefined);
    render(<OrganiserGuestsManager eventId="event" />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Copy guest link",
    });
    expect(screen.getByLabelText("Guest link")).toHaveValue(
      "https://example.test/guest-ticket#new",
    );
    expect(call).toHaveBeenCalledTimes(3);
    fireEvent.click(
      screen.getByRole("button", { name: "Copy link", hidden: false }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://example.test/guest-ticket#new",
      ),
    );
    expect(call).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
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
  });
  it("keeps cancellation explicit and explains the automatic refund", async () => {
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
      screen.getByText(/refund is started immediately/),
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
