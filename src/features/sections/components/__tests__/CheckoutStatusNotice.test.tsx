import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "../../../../test-utils";
import CheckoutStatusNotice from "../CheckoutStatusNotice";
import * as dcReact from "@dataconnect/generated/react";

vi.mock("@dataconnect/generated/react", () => ({
  useGetMyTicketOrderById: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  reconcileMyCheckoutSessionOrders: vi.fn().mockResolvedValue({
    appliedCount: 0,
    reconciledOrderIds: [],
    orderIds: [],
  }),
}));

describe("CheckoutStatusNotice", () => {
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cancelled state", () => {
    vi.mocked(dcReact.useGetMyTicketOrderById).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(<CheckoutStatusNotice checkoutState="cancel" orderId={null} onDismiss={onDismiss} />);
    expect(screen.getByText(/checkout cancelled/i)).toBeInTheDocument();
  });

  it("renders error when success has no order id", () => {
    vi.mocked(dcReact.useGetMyTicketOrderById).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(<CheckoutStatusNotice checkoutState="success" orderId={null} onDismiss={onDismiss} />);
    expect(screen.getByText(/unable to confirm payment/i)).toBeInTheDocument();
  });

  it("renders paid state", () => {
    vi.mocked(dcReact.useGetMyTicketOrderById).mockReturnValue({
      data: {
        user: {
          ticketOrders: [
            {
              id: "abc",
              status: "PAID",
              ticketType: { title: "Member Ticket" },
              event: { title: "Spring Gala" },
              quantity: 2,
              totalAmountMinor: 2500,
              currency: "gbp",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(
      <CheckoutStatusNotice
        checkoutState="success"
        orderId="11111111-1111-1111-1111-111111111111"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText(/payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/member ticket purchase is complete/i)).toBeInTheDocument();
    expect(screen.getByText(/event: spring gala/i)).toBeInTheDocument();
    expect(screen.getByText(/quantity: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/amount: £25\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/reference: abc/i)).toBeInTheDocument();
  });

  it("polls while order is pending", () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    vi.mocked(dcReact.useGetMyTicketOrderById).mockReturnValue({
      data: {
        user: {
          ticketOrders: [{ id: "abc", status: "PENDING" }],
        },
      },
      isLoading: false,
      isError: false,
      refetch,
    } as never);

    render(
      <CheckoutStatusNotice
        checkoutState="success"
        orderId="11111111-1111-1111-1111-111111111111"
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(/payment processing/i)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
