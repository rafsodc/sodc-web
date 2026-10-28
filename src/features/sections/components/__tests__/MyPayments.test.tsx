import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import MyPayments from "../MyPayments";
import * as reactGenerated from "../../../../shared/query/authoritativeHooks";
import { dataConnectQueryResult } from "../../../../test-utils/dataConnectMocks";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import { invalidateMyBookings } from "../../../../shared/query/invalidation";
vi.mock("../../../../shared/query/invalidation", () => ({invalidateMyBookings: vi.fn().mockResolvedValue(undefined)}));

vi.mock("../../../../shared/query/authoritativeHooks", () => ({
  useGetMyTicketOrders: vi.fn(),
  useGetMyBookingPaymentAdjustments: vi.fn(),
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getMyTicketOrderStripeArtifactsBatch: vi.fn(),
  reconcileMyCheckoutSessionOrders: vi.fn().mockResolvedValue({
    appliedCount: 0,
    reconciledOrderIds: [],
    orderIds: [],
  }),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

describe("MyPayments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.mocked(invalidateMyBookings).mockReset().mockResolvedValue(undefined);
    vi.mocked(firebaseFunctions.reconcileMyCheckoutSessionOrders).mockReset().mockResolvedValue({appliedCount: 0, reconciledOrderIds: [], orderIds: []});
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

  it("groups paid member and guest orders from the same checkout into one card", () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        data: {
          user: {
            id: "u-1",
            ticketOrders: [
              {
                id: "order-member",
                status: "PAID",
                quantity: 1,
                totalAmountMinor: 5000,
                currency: "gbp",
                createdAt: "2026-04-01T12:00:00Z",
                updatedAt: "2026-04-01T12:00:00Z",
                refundedAmountMinor: null,
                disputeStatus: null,
                disputeReason: null,
                stripeCheckoutSessionId: "cs_test",
                stripePaymentIntentId: "pi_test",
                event: { id: "event-1", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z" },
                ticketType: { id: "ticket-1", title: "Member ticket" },
              },
              {
                id: "order-guest",
                status: "PAID",
                quantity: 2,
                totalAmountMinor: 5000,
                currency: "gbp",
                createdAt: "2026-04-01T12:00:00Z",
                updatedAt: "2026-04-01T12:00:00Z",
                refundedAmountMinor: null,
                disputeStatus: null,
                disputeReason: null,
                stripeCheckoutSessionId: "cs_test",
                stripePaymentIntentId: "pi_test",
                event: { id: "event-1", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z" },
                ticketType: { id: "ticket-2", title: "Guest ticket" },
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
    expect(screen.getByText(/member ticket, guest ticket × 2/i)).toBeInTheDocument();
    expect(screen.getByText(/£100\.00/)).toBeInTheDocument();
    expect(screen.getAllByText("Paid")).toHaveLength(1);
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

  it("does not present an unpaid booking amendment as a payment adjustment", () => {
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        data: { user: { id: "u-1", ticketOrders: [] } },
        isLoading: false,
        isError: false,
      })
    );
    vi.mocked(reactGenerated.useGetMyBookingPaymentAdjustments).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyBookingPaymentAdjustments>({
        data: {
          user: {
            id: "u-1",
            bookings: [{
              id: "booking-2",
              revisionNumber: 2,
              event: { id: "event-1", title: "Spring Ball" },
              adjustments: [{
                id: "adj-1",
                deltaAmountMinor: 0,
                status: "NOT_REQUIRED",
                orchestrationKey: "booking-2:adj-1",
                createdAt: "2026-04-01T12:05:00Z",
                updatedAt: "2026-04-01T12:06:00Z",
                supersededBooking: { id: "booking-1", revisionNumber: 1 },
              }],
            }],
          },
        },
        isLoading: false,
        isError: false,
      })
    );

    render(<MyPayments onBack={() => undefined} />);

    expect(screen.queryByText(/Booking changes/)).not.toBeInTheDocument();
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

  it.each(["orders", "related views"])("does not replay successful reconciliation after failed %s reads or later order snapshots", async failure => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    if (failure === "orders") refetch.mockRejectedValueOnce(new Error("Synthetic order read failure"));
    else vi.mocked(invalidateMyBookings).mockRejectedValueOnce(new Error("Synthetic related read failure"));
    const snapshot = (updatedAt = "2026-04-01T12:00:00Z") => dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
      data: {user: {id: "u-1", ticketOrders: ["PAID", "PENDING"].map((status, index) => ({
        id: "order-" + index, status: status as "PAID" | "PENDING", quantity: 1, totalAmountMinor: 2500, currency: "gbp",
        createdAt: "2026-04-01T12:00:00Z", updatedAt, refundedAmountMinor: null, disputeStatus: null, disputeReason: null,
        stripeCheckoutSessionId: index === 0 ? "cs_test" : null, stripePaymentIntentId: null,
        event: {id: "f02f77c7-7ae1-4bb3-a8fb-cc8d2168ab4a", title: "Spring Ball", startDateTime: "2026-05-01T18:00:00Z"},
        ticketType: {id: "ticket-" + index, title: index === 0 ? "Member ticket" : "Guest ticket"},
      }))}}, isLoading: false, isError: false, refetch,
    });
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(snapshot());
    const onBack = vi.fn(), user = userEvent.setup(), view = render(<MyPayments onBack={onBack} />);
    expect(await screen.findByText(/Your payment update completed, but/)).toBeInTheDocument();
    expect(firebaseFunctions.reconcileMyCheckoutSessionOrders).toHaveBeenCalledOnce();
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(snapshot("2026-04-01T12:01:00Z"));
    view.rerender(<MyPayments onBack={onBack} />);
    refetch.mockRejectedValueOnce(new Error("Synthetic retry read failure"));
    await user.click(screen.getByRole("button", {name: "Retry refresh"}));
    expect(await screen.findByText(/Your payment update completed, but/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Your payment update completed, but/)).not.toBeInTheDocument());
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(snapshot("2026-04-01T12:02:00Z"));
    view.rerender(<MyPayments onBack={onBack} />);
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(3));
    expect(firebaseFunctions.reconcileMyCheckoutSessionOrders).toHaveBeenCalledOnce();
    expect(firebaseFunctions.reconcileMyCheckoutSessionOrders).toHaveBeenCalledWith({orderId: "order-0"});
    expect(refetch).toHaveBeenCalledWith({throwOnError: true});
    expect(invalidateMyBookings).toHaveBeenCalledTimes(failure === "orders" ? 1 : 2);
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

  it("shows a safe retryable error without exposing query details", async () => {
    const refetch = vi.fn();
    vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
      dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>({
        isLoading: false,
        isError: true,
        error: new Error("Postgres ticket_orders relation failed"),
        refetch,
      }),
    );
    const user = userEvent.setup();
    render(<MyPayments onBack={() => undefined} />);

    expect(
      screen.getByText("We couldn’t load your payment history. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Postgres ticket_orders/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
