import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../../test-utils";
import AdditionalGuestRequestSection from "../AdditionalGuestRequestSection";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  submitGuestTicketRequest: vi.fn().mockResolvedValue({ success: true, requestId: "req-new" }),
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
    vi.mocked(firebaseFunctions.submitGuestTicketRequest).mockResolvedValue({
      success: true,
      requestId: "req-new",
    });
  });

  it("submits guest ticket request callable and refetches when count is valid", async () => {
    const user = userEvent.setup();
    render(
      <AdditionalGuestRequestSection {...baseProps} requests={[]} />
    );

    await user.type(screen.getByLabelText(/^guest name/i), "Alex Patron");
    await user.clear(screen.getByLabelText(/how many extra guest tickets/i));
    await user.type(screen.getByLabelText(/how many extra guest tickets/i), "2");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await vi.waitFor(() => {
      expect(firebaseFunctions.submitGuestTicketRequest).toHaveBeenCalledTimes(1);
    });
    expect(firebaseFunctions.submitGuestTicketRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        requestedGuestCount: 2,
        guestTicketTypeId: "660e8400-e29b-41d4-a716-446655440001",
        guestDisplayName: "Alex Patron",
        dietaryNote: null,
      })
    );
    expect(baseProps.onRequestCreated).toHaveBeenCalled();
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
            requestedGuestCount: 3,
            reviewedAt: null,
            moderatorNote: null,
          } as never,
        ]}
      />
    );

    expect(screen.getByText(/you already have a pending request/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit request/i })).not.toBeInTheDocument();
  });

  it("lists prior requests in the table", () => {
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
    expect(screen.getByText("Guest standard")).toBeInTheDocument();
    expect(screen.getByText("Jamie Lee")).toBeInTheDocument();
    expect(screen.getByText("Vegan")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});
