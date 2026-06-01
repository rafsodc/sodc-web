import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketOrderStatus } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import {
  createGovNotifyTicketOrderLifecycleDispatcher,
  formatMinorCurrency,
  normaliseAppBaseUrl,
  ticketOrderStatusCustomerLabel,
} from "../paymentLifecycleEmailDispatcher";
import type { PaymentLifecycleNotification } from "../paymentNotifications";

const mockGet = vi.spyOn(admin, "getTicketOrderForWebhook");

describe("paymentLifecycleEmailDispatcher helpers", () => {
  it("formats minor currency", () => {
    expect(formatMinorCurrency(1299, "gbp")).toBe("12.99 GBP");
  });

  it("normalises app base URL", () => {
    expect(normaliseAppBaseUrl("https://app.example/")).toBe("https://app.example");
    expect(normaliseAppBaseUrl("https://app.example///")).toBe("https://app.example");
    expect(normaliseAppBaseUrl("https://app.example")).toBe("https://app.example");
  });

  it("maps status labels", () => {
    expect(ticketOrderStatusCustomerLabel(TicketOrderStatus.PAID)).toBe("Paid");
    expect(ticketOrderStatusCustomerLabel(TicketOrderStatus.FAILED)).toBe("Payment failed");
  });
});

const baseOrder = {
  id: "00000000-0000-4000-8000-000000000001",
  quantity: 2,
  unitAmountMinor: 2500,
  totalAmountMinor: 5000,
  currency: "gbp",
  user: {
    id: "user-1",
    email: "buyer@example.com",
    firstName: "Sam",
    lastName: "Buyer",
  },
  event: {
    id: "00000000-0000-4000-8000-00000000000e",
    title: "Annual dinner",
  },
  ticketType: {
    id: "00000000-0000-4000-8000-0000000000tt",
    title: "Member ticket",
  },
  stripeCheckoutSessionId: null as string | null,
  stripePaymentIntentId: null as string | null,
  stripeRefundId: null as string | null,
  refundedAmountMinor: null as number | null,
  refundedAt: null as string | null,
  stripeDisputeId: null as string | null,
  disputeStatus: null as string | null,
  disputeReason: null as string | null,
  disputeAmountMinor: null as number | null,
  disputeOpenedAt: null as string | null,
  disputeUpdatedAt: null as string | null,
  disputeClosedAt: null as string | null,
  webhookEventId: null as string | null,
};

describe("createGovNotifyTicketOrderLifecycleDispatcher", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("sends ticketOrderPaid with myPayments link and Notify reference", async () => {
    mockGet.mockResolvedValue({
      data: {
        ticketOrder: {
          ...baseOrder,
          status: TicketOrderStatus.PAID,
        },
      },
    } as Awaited<ReturnType<typeof admin.getTicketOrderForWebhook>>);

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "govuk_notify",
      providerNotificationId: "notify-msg-1",
    });
    const dispatch = createGovNotifyTicketOrderLifecycleDispatcher({
      getMailer: () => ({ sendEmail } as never),
      appBaseUrl: "https://app.example/",
    });

    const notification: PaymentLifecycleNotification = {
      type: "PAYMENT_PAID",
      orderId: baseOrder.id,
      stripeEventId: "evt_paid_1",
      occurredAt: "2026-05-17T12:00:00.000Z",
      status: TicketOrderStatus.PAID,
    };
    const result = await dispatch(notification);

    expect(result.providerMessageId).toBe("notify-msg-1");
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "ticketOrderPaid",
        to: "buyer@example.com",
        personalisation: expect.objectContaining({
          eventTitle: "Annual dinner",
          ticketTypeTitle: "Member ticket",
          myPaymentsUrl: "https://app.example/payments",
          quantity: 2,
        }),
        reference: "PAYMENT_PAID:00000000-0000-4000-8000-000000000001:evt_paid_1",
      })
    );
  });

  it("sends ticketOrderRefunded using refundedAmountMinor when present", async () => {
    mockGet.mockResolvedValue({
      data: {
        ticketOrder: {
          ...baseOrder,
          status: TicketOrderStatus.REFUNDED,
          refundedAmountMinor: 3000,
        },
      },
    } as Awaited<ReturnType<typeof admin.getTicketOrderForWebhook>>);

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "govuk_notify",
      providerNotificationId: "notify-msg-2",
    });
    const dispatch = createGovNotifyTicketOrderLifecycleDispatcher({
      getMailer: () => ({ sendEmail } as never),
      appBaseUrl: "https://app.example",
    });

    await dispatch({
      type: "PAYMENT_REFUNDED",
      orderId: baseOrder.id,
      stripeEventId: "evt_re_1",
      occurredAt: "2026-05-17T12:00:00.000Z",
      status: TicketOrderStatus.REFUNDED,
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "ticketOrderRefunded",
        personalisation: expect.objectContaining({
          refundFormatted: "30.00 GBP",
        }),
      })
    );
  });
});
