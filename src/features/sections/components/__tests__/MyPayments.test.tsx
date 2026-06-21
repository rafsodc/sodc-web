import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import MyPayments from "../MyPayments";
import * as reactGenerated from "@dataconnect/generated/react";
import { dataConnectQueryResult } from "../../../../test-utils/dataConnectMocks";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("@dataconnect/generated/react", () => ({
  useGetMyTicketOrders: vi.fn(),
  useGetMyBookingPaymentAdjustments: vi.fn(),
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getMyTicketOrderStripeArtifactsBatch: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

describe("MyPayments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.mocked(reactGenerated.useGetMyBookingPaymentAdjustments).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookingPaymentAdjustments>({
        data: { user: { id: "u-1", bookings: [] } },
        isLoading: false,
        isError: false,
      })
    );
    vi.mocked(firebaseFunctions.getMyTicketOrderStripeArtifactsBatch).mockResolvedValue({
      artifactsByOrderId: {
        "order-1": {
          receiptUrl: "https://pay.stripe.com/receipts/test",
        },
        "07dba59c-18ee-4801-8ce0-e7f3d1c83eb5": {
          receiptUrl: "https://pay.stripe.com/receipts/test",
        },
      },
    });
  });

  it("renders payment cards without ops-style table headers", () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        data: {
          user: {
            id: "u-1",
            ticketOrders: [
              {
                id: "order-1",
                status: "PAID",
                quantity: 1,
                totalAmountMinor: 2500,
                currency: "gbp",
                createdAt: "2026-04-01T12:00:00Z",
                updatedAt: "2026-04-01T12:00:00Z",
                refundedAmountMinor: null,
                disputeStatus: null,
                disputeReason: null,
                event: { id: "event-1", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z" },
                ticketType: { id: "ticket-1", title: "Member ticket" },
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    render(<MyPayments onBack={() => undefined} />);

    expect(screen.getByText("Spring Ball")).toBeInTheDocument();
    expect(screen.getByText(/member ticket/i)).toBeInTheDocument();
    expect(screen.getByText(/£25\.00/)).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText("Lifecycle detail")).not.toBeInTheDocument();
    expect(screen.queryByText("Stripe artifacts")).not.toBeInTheDocument();
  });

  it("shows booking changes in a collapsible section", async () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        data: {
          user: {
            id: "u-1",
            ticketOrders: [
              {
                id: "order-1",
                status: "PAID",
                quantity: 1,
                totalAmountMinor: 2500,
                currency: "gbp",
                createdAt: "2026-04-01T12:00:00Z",
                updatedAt: "2026-04-01T12:00:00Z",
                refundedAmountMinor: null,
                disputeStatus: null,
                disputeReason: null,
                event: { id: "event-1", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z" },
                ticketType: { id: "ticket-1", title: "Member ticket" },
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );
    vi.mocked(reactGenerated.useGetMyBookingPaymentAdjustments).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookingPaymentAdjustments>({
        data: {
          user: {
            id: "u-1",
            bookings: [
              {
                id: "booking-2",
                revisionNumber: 2,
                event: { id: "event-1", title: "Spring Ball" },
                adjustments: [
                  {
                    id: "adj-1",
                    deltaAmountMinor: -500,
                    status: "PENDING_AUTO_REFUND",
                    orchestrationKey: "booking-2:adj-1",
                    createdAt: "2026-04-01T12:05:00Z",
                    updatedAt: "2026-04-01T12:06:00Z",
                    supersededBooking: { id: "booking-1", revisionNumber: 1 },
                  },
                ],
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    const user = userEvent.setup();
    render(<MyPayments onBack={() => undefined} />);

    expect(screen.getByText("Booking changes (1)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /booking changes \(1\)/i }));

    expect(
      screen.getByText(/Spring Ball \(revision 2\): refund pending — refund of £5\.00\./i)
    ).toBeInTheDocument();
  });

  it("auto-loads receipt links and renders View receipt", async () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        data: {
          user: {
            id: "u-1",
            ticketOrders: [
              {
                id: "07DBA59C-18EE-4801-8CE0-E7F3D1C83EB5",
                status: "PAID",
                quantity: 1,
                totalAmountMinor: 2500,
                currency: "gbp",
                createdAt: "2026-04-01T12:00:00Z",
                updatedAt: "2026-04-01T12:00:00Z",
                refundedAmountMinor: null,
                disputeStatus: null,
                disputeReason: null,
                event: { id: "event-1", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z" },
                ticketType: { id: "ticket-1", title: "Member ticket" },
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    render(<MyPayments onBack={() => undefined} />);
    await waitFor(() => {
      expect(firebaseFunctions.getMyTicketOrderStripeArtifactsBatch).toHaveBeenCalledWith({
        orderIds: ["07DBA59C-18EE-4801-8CE0-E7F3D1C83EB5"],
      });
    });
    expect(await screen.findByRole("button", { name: "View receipt" })).toBeInTheDocument();
  });

  it("shows a clear empty state", () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        data: { user: { id: "u-1", ticketOrders: [] } },
        isLoading: false,
        isError: false,
      })
    );

    render(<MyPayments onBack={() => undefined} />);

    expect(screen.getByText(/you have not made any ticket payments yet/i)).toBeInTheDocument();
  });
});
