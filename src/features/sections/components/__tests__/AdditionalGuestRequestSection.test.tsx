import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../../test-utils";
import AdditionalGuestRequestSection from "../AdditionalGuestRequestSection";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  submitAdditionalGuestTicketRequests: vi.fn().mockResolvedValue([{ success: true, requestId: "req-new" }]),
}));

describe("AdditionalGuestRequestSection", () => {
  const guestTicketTypes = [
    { id: "660e8400-e29b-41d4-a716-446655440001", title: "Guest standard", price: 10 },
  ];

  const baseProps = {
    bookingId: "550e8400-e29b-41d4-a716-446655440000",
    eventTitle: "Spring Gala",
    guestTicketTypes,
    onRequestCreated: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseFunctions.submitAdditionalGuestTicketRequests).mockResolvedValue([
      { success: true, requestId: "req-new" },
    ]);
  });

  it("submits a single-guest request when count is 1", async () => {
    const user = userEvent.setup();
    render(
      <AdditionalGuestRequestSection {...baseProps} requests={[]} />
    );

    await user.type(screen.getByLabelText(/^guest name/i), "Alex Patron");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await vi.waitFor(() => {
      expect(firebaseFunctions.submitAdditionalGuestTicketRequests).toHaveBeenCalledTimes(1);
    });
    expect(firebaseFunctions.submitAdditionalGuestTicketRequests).toHaveBeenCalledWith({
      bookingId: "550e8400-e29b-41d4-a716-446655440000",
      guestTicketTypeId: "660e8400-e29b-41d4-a716-446655440001",
      guests: [{ guestDisplayName: "Alex Patron", dietaryNote: null }],
    });
    expect(baseProps.onRequestCreated).toHaveBeenCalled();
  });

  it("shows one guest-name field per requested guest and submits each name", async () => {
    const user = userEvent.setup();
    render(
      <AdditionalGuestRequestSection {...baseProps} requests={[]} />
    );

    await user.clear(screen.getByLabelText(/how many extra guest tickets/i));
    await user.type(screen.getByLabelText(/how many extra guest tickets/i), "2");

    const nameFields = screen.getAllByLabelText(/^guest name/i);
    expect(nameFields).toHaveLength(2);
    await user.type(nameFields[0], "Alex Patron");
    await user.type(nameFields[1], "Jamie Lee");

    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await vi.waitFor(() => {
      expect(firebaseFunctions.submitAdditionalGuestTicketRequests).toHaveBeenCalledTimes(1);
    });
    expect(firebaseFunctions.submitAdditionalGuestTicketRequests).toHaveBeenCalledWith({
      bookingId: "550e8400-e29b-41d4-a716-446655440000",
      guestTicketTypeId: "660e8400-e29b-41d4-a716-446655440001",
      guests: [
        { guestDisplayName: "Alex Patron", dietaryNote: null },
        { guestDisplayName: "Jamie Lee", dietaryNote: null },
      ],
    });
  });

  it("rejects submission when any guest name is blank", async () => {
    const user = userEvent.setup();
    render(
      <AdditionalGuestRequestSection {...baseProps} requests={[]} />
    );

    await user.clear(screen.getByLabelText(/how many extra guest tickets/i));
    await user.type(screen.getByLabelText(/how many extra guest tickets/i), "2");
    await user.type(screen.getAllByLabelText(/^guest name/i)[0], "Alex Patron");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByText(/enter a name for additional guest 2/i)).toBeInTheDocument();
    expect(firebaseFunctions.submitAdditionalGuestTicketRequests).not.toHaveBeenCalled();
  });

  it("shows pending message and hides submit when a PENDING request exists", () => {
    render(
      <AdditionalGuestRequestSection
        {...baseProps}
        guestTicketTypes={[]}
        requests={[
          {
            id: "req-1",
            status: "PENDING",
            requestedGuestCount: 1,
            reviewedAt: null,
            moderatorNote: null,
          } as never,
        ]}
      />
    );

    expect(screen.getByText(/you already have 1 pending request for/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit request/i })).not.toBeInTheDocument();
  });

  it("pluralizes the pending message when more than one request is pending", () => {
    render(
      <AdditionalGuestRequestSection
        {...baseProps}
        guestTicketTypes={[]}
        requests={[
          { id: "req-1", status: "PENDING", requestedGuestCount: 1, reviewedAt: null, moderatorNote: null } as never,
          { id: "req-2", status: "PENDING", requestedGuestCount: 1, reviewedAt: null, moderatorNote: null } as never,
        ]}
      />
    );

    expect(screen.getByText(/you already have 2 pending requests for/i)).toBeInTheDocument();
  });

  it("lists prior requests in the table, including legacy multi-guest counts", () => {
    render(
      <AdditionalGuestRequestSection
        {...baseProps}
        guestTicketTypes={[]}
        requests={[
          {
            id: "req-1",
            status: "APPROVED",
            requestedGuestCount: 2,
            guestDisplayName: "Jamie Lee",
            dietaryNote: "Vegan",
            guestTicketType: { id: "660e8400-e29b-41d4-a716-446655440001", title: "Guest standard", audience: "GUEST", price: 10 },
            reviewedAt: "2026-01-01T12:00:00.000Z",
            moderatorNote: "OK",
          } as never,
        ]}
      />
    );

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Guest standard")).toBeInTheDocument();
    expect(screen.getByText("Jamie Lee")).toBeInTheDocument();
    expect(screen.getByText("Vegan")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("does not expose a raw callable error", async () => {
    vi.mocked(firebaseFunctions.submitAdditionalGuestTicketRequests).mockRejectedValueOnce(
      new Error("FirebaseError: SQL guest_ticket_requests failed"),
    );
    const user = userEvent.setup();
    render(<AdditionalGuestRequestSection {...baseProps} requests={[]} />);

    await user.type(screen.getByLabelText(/^guest name/i), "Alex Patron");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(
      await screen.findByText("We couldn’t submit the guest request. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SQL guest_ticket_requests/)).not.toBeInTheDocument();
  });
});
