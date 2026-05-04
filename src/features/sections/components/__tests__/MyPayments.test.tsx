import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
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
    vi.mocked(firebaseFunctions.getMyTicketOrderStripeArtifactsBatch).mockResolvedValue({
      artifactsByOrderId: {
        "order-1": {
          receiptUrl: "https://pay.stripe.com/receipts/test",
          hostedInvoiceUrl: null,
          invoicePdfUrl: null,
        },
      },
    });
  });

  it("renders booking adjustment statuses alongside payment history", () => {
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
                updatedAt: "2026-04-01T12:00:00Z",
                refundedAmountMinor: null,
                disputeStatus: null,
                disputeReason: null,
                event: { id: "event-1", title: "Spring Ball" },
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

    render(<MyPayments onBack={() => undefined} />);

    expect(screen.getByText("PENDING AUTO REFUND")).toBeInTheDocument();
    expect(screen.getByText("Rev 2")).toBeInTheDocument();
    expect(screen.getByText("-5.00 GBP")).toBeInTheDocument();
  });

  it("auto-loads Stripe links and renders receipt action", async () => {
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
                updatedAt: "2026-04-01T12:00:00Z",
                refundedAmountMinor: null,
                disputeStatus: null,
                disputeReason: null,
                event: { id: "event-1", title: "Spring Ball" },
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
        data: { user: { id: "u-1", bookings: [] } },
        isLoading: false,
        isError: false,
      })
    );

    render(<MyPayments onBack={() => undefined} />);
    await waitFor(() => {
      expect(firebaseFunctions.getMyTicketOrderStripeArtifactsBatch).toHaveBeenCalledWith({ orderIds: ["order-1"] });
    });
    expect(await screen.findByRole("button", { name: "View receipt" })).toBeInTheDocument();
  });
});
