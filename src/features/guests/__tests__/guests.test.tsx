import { searchSectionMembers } from "../../../shared/utils/firebaseFunctions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { render, screen, fireEvent, waitFor, within, act } from "../../../test-utils";
import { guestCall, type Guest, type GuestTicket } from "../api";
import GuestTicketPage from "../GuestTicketPage";
import OrganiserGuestsManager from "../OrganiserGuestsManager";
import { organiserGuestTicketRows } from "../reporting";
vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  guestCall: vi.fn(),
}));
vi.mock("../../../shared/utils/firebaseFunctions", () => ({ searchSectionMembers: vi.fn() }));
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
  vi.mocked(searchSectionMembers).mockResolvedValue({ members: [{ id: "user-alex", firstName: "Alex", lastName: "Member" }, { id: "user-taylor", firstName: "Taylor", lastName: "Guest" }], hasMore: false });
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

  it("ignores the previous guest's delayed save when the fragment changes", async () => {
    let resolveSave!: (value: unknown) => void;
    call.mockImplementation(async (name, input) => {
      if (name === "updateOrganiserGuestDietary") return new Promise((resolve) => { resolveSave = resolve; });
      return input.token === "second-token" ? { ...ticket, firstName: "Beth", dietaryRequirements: "Gluten free" } : ticket;
    });
    function SwitchLink() {
      const navigate = useNavigate();
      return <button onClick={() => navigate("/guest-ticket#second-token")}>Switch guest link</button>;
    }
    render(<MemoryRouter initialEntries={["/guest-ticket#personal-token"]}><GuestTicketPage /><SwitchLink /></MemoryRouter>);
    await screen.findByText("Dinner event");
    fireEvent.click(screen.getByRole("button", { name: "Save dietary requirements" }));
    await waitFor(() => expect(resolveSave).toBeDefined());
    fireEvent.click(screen.getByText("Switch guest link"));
    await waitFor(() => expect(screen.getByLabelText("Dietary requirements")).toHaveValue("Gluten free"));
    await act(async () => resolveSave({ success: true }));
    expect(screen.queryByText("Dietary requirements saved.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Dietary requirements")).toHaveValue("Gluten free");
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
    render(<OrganiserGuestsManager sectionId="section" eventId="event" />);
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
    render(<OrganiserGuestsManager sectionId="section" eventId="event" />);
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
    render(<OrganiserGuestsManager sectionId="section" eventId="event" />);
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
    const view = render(<OrganiserGuestsManager sectionId="section" eventId="event" />);
    await screen.findByText(/Create an organiser\/club guest ticket in Ticket types/);
    expect(screen.queryByRole("button", { name: /add guest ticket type/i })).not.toBeInTheDocument();
    view.unmount();
  });
  it("edits a paid organiser guest name, accommodation and seating without payment fields", async () => {
    call.mockResolvedValue({ event: { id: "event" }, ticketTypes: [{ id: "type", title: "Guest dinner" }], guests: [{ ...guest, paymentStatus: "PAID" }] });
    render(<OrganiserGuestsManager sectionId="section" eventId="event" />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit guest" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("First name"), { target: { value: "Jamie" } });
    fireEvent.change(dialog.getByLabelText("Last name"), { target: { value: "Updated" } });
    fireEvent.click(dialog.getByLabelText("Request accommodation"));
    fireEvent.change(dialog.getByLabelText("Accommodation notes"), { target: { value: "Twin room" } });
    fireEvent.change(dialog.getByLabelText("Sit next to (optional)"), { target: { value: "Alex" } });
    fireEvent.click(await screen.findByRole("option", { name: "Alex Member" }));
    fireEvent.change(dialog.getByLabelText("Sit next to (optional)"), { target: { value: "Taylor" } });
    fireEvent.click(await screen.findByRole("option", { name: "Taylor Guest" }));
    fireEvent.click(dialog.getByRole("button", { name: "Save guest" }));
    await waitFor(() => expect(call).toHaveBeenCalledWith("manageOrganiserGuest", expect.objectContaining({
      action: "edit", id: "guest", version: 3, firstName: "Jamie", lastName: "Updated",
      accommodationRequested: true, accommodationNote: "Twin room", sitNextToUserIds: ["user-alex", "user-taylor"],
    })));
    expect(await screen.findByText("Guest list saved.")).toBeInTheDocument();
    // This integration flow includes two debounced searches and a MUI dialog;
    // coverage instrumentation on CI can take longer than the default 5 seconds.
  }, 10_000);
  it("includes organiser guest accommodation and seating in reports", () => {
    const [row] = organiserGuestTicketRows([{ ...guest, accommodationRequested: true, accommodationNote: "Twin room", seatingPreferences: ["Alex"] }]);
    expect(row).toMatchObject({ accommodationRequested: true, accommodationNote: "Twin room", seatingPreferences: ["Alex"] });
  });
  it("keeps cancellation explicit and shows paid refund obligations", async () => {
    call.mockResolvedValue({
      event: { id: "event" },
      ticketTypes: [],
      guests: [guest],
    });
    render(<OrganiserGuestsManager sectionId="section" eventId="event" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete ticket" }),
    );
    expect(
      screen.getByText(/Handle any payment/),
    ).toBeInTheDocument();
    expect(call).not.toHaveBeenCalledWith(
      "manageOrganiserGuest",
      expect.anything(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete ticket" }),
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
