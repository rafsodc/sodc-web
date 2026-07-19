import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentReconciliationExceptionType,
  type UUIDString,
} from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import * as logger from "firebase-functions/logger";
import * as notificationDelivery from "../notificationDelivery";
import {
  PAYMENT_OPS_ALERT_EMAILS_ENV,
  notifyPaymentOpsDisputeSideState,
  notifyPaymentOpsReconciliationExceptionOpened,
  parsePaymentOpsAlertEmails,
} from "../paymentOpsInternalAlerts";
import { govNotifyTemplateEnvVarName } from "../mailer";

const ORDER_ID = "11111111-1111-4111-8111-111111111111" as UUIDString;
const getOrder = vi.spyOn(admin, "getTicketOrderForWebhook");
const sendNotification = vi.spyOn(notificationDelivery, "sendNotificationOnce");

describe("parsePaymentOpsAlertEmails", () => {
  it("returns empty list when unset or blank", () => {
    expect(parsePaymentOpsAlertEmails({})).toEqual([]);
    expect(parsePaymentOpsAlertEmails({ [PAYMENT_OPS_ALERT_EMAILS_ENV]: "  " })).toEqual([]);
  });

  it("parses comma-separated addresses, lowercases, trims, and dedupes", () => {
    expect(
      parsePaymentOpsAlertEmails({
        [PAYMENT_OPS_ALERT_EMAILS_ENV]: " OPS@EXAMPLE.COM , finance@example.com , ops@example.com ",
      })
    ).toEqual(["ops@example.com", "finance@example.com"]);
  });
});

describe("payment ops internal template env vars", () => {
  it("matches mailer naming for GOV.UK Notify template keys", () => {
    expect(govNotifyTemplateEnvVarName("paymentReconciliationExceptionAlert")).toBe(
      "GOV_NOTIFY_TEMPLATE_PAYMENT_RECONCILIATION_EXCEPTION_ALERT"
    );
    expect(govNotifyTemplateEnvVarName("paymentDisputeOpsAlert")).toBe(
      "GOV_NOTIFY_TEMPLATE_PAYMENT_DISPUTE_OPS_ALERT"
    );
  });
});

describe("payment ops internal alert orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrder.mockResolvedValue({
      data: {
        ticketOrder: {
          id: ORDER_ID,
          event: { title: "Annual dinner" },
          user: {
            firstName: "Sam",
            lastName: "Member",
            email: "member@example.com",
          },
        },
      },
    } as never);
    sendNotification.mockImplementation(async (request) => {
      const result = await request.send();
      return {
        outcome: "sent",
        deliveryId: ORDER_ID,
        providerMessageId: result?.providerMessageId ?? null,
      } as never;
    });
  });

  it("does not query order data when no reconciliation recipients are configured", async () => {
    await notifyPaymentOpsReconciliationExceptionOpened({
      orderId: ORDER_ID,
      exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
      exceptionNote: "Missing payment intent",
      stripeEventId: "evt_1",
      appBaseUrl: "https://app.example",
      recipientEmails: [],
    });

    expect(getOrder).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("deduplicates recipients and sends reconciliation context through the ledger", async () => {
    const sendEmail = vi.fn(async (_request: { reference?: string }) => ({
      providerNotificationId: "notify-1",
    }));

    await notifyPaymentOpsReconciliationExceptionOpened({
      orderId: ORDER_ID,
      exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
      exceptionNote: "Missing payment intent",
      stripeEventId: "evt_1",
      appBaseUrl: "https://app.example/",
      recipientEmails: ["OPS@example.com", "ops@example.com", "finance@example.com"],
      getMailer: () => ({ sendEmail } as never),
    });

    expect(getOrder).toHaveBeenCalledOnce();
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        notificationType: "RECONCILIATION_EXCEPTION_OPEN",
        deliveryKey: expect.stringContaining(":ops@example.com"),
        recoveryPayload: expect.objectContaining({
          kind: "PAYMENT_RECONCILIATION_OPS",
          recipientEmail: "ops@example.com",
        }),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@example.com",
        personalisation: expect.objectContaining({
          eventTitle: "Annual dinner",
          customerDisplay: "Sam Member <member@example.com>",
          reconciliationDashboardUrl: "https://app.example/admin/payments/reconciliation",
        }),
      })
    );
    const references = sendEmail.mock.calls.map(([request]) => request.reference);
    expect(new Set(references)).toHaveLength(2);
    for (const reference of references) {
      expect(reference).toMatch(/^reconciliation-ops:[0-9a-f-]+:[A-Z_]+:[a-z0-9_]+:[0-9a-f]{24}$/);
    }
  });

  it("continues to the next recipient after one ledger delivery fails", async () => {
    const sendEmail = vi.fn(async () => ({ providerNotificationId: "notify-2" }));
    sendNotification
      .mockRejectedValueOnce(new Error("ledger temporarily unavailable"))
      .mockImplementationOnce(async (request) => {
        await request.send();
        return { outcome: "sent" } as never;
      });

    await notifyPaymentOpsReconciliationExceptionOpened({
      orderId: ORDER_ID,
      exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
      exceptionNote: "Missing payment intent",
      stripeEventId: "evt_retry",
      appBaseUrl: "https://app.example",
      recipientEmails: ["first@example.com", "second@example.com"],
      getMailer: () => ({ sendEmail } as never),
    });

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "second@example.com" })
    );
    expect(logger.error).toHaveBeenCalledWith(
      "payment ops reconciliation alert delivery failed",
      expect.objectContaining({ orderId: ORDER_ID })
    );
  });

  it("skips a dispute alert when the order no longer exists", async () => {
    getOrder.mockResolvedValueOnce({ data: { ticketOrder: null } } as never);

    await notifyPaymentOpsDisputeSideState({
      orderId: ORDER_ID,
      stripeEventId: "evt_dispute",
      stripeEventType: "charge.dispute.created",
      disputeStripeStatus: "needs_response",
      disputeReason: "fraudulent",
      disputeLocalState: "DISPUTE_OPEN",
      stripeDisputeId: "dp_1",
      appBaseUrl: "https://app.example",
      recipientEmails: ["ops@example.com"],
    });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "payment ops dispute alert skipped (order not found)",
      { orderId: ORDER_ID }
    );
  });

  it("sends complete dispute state to the targeted recipient", async () => {
    const sendEmail = vi.fn(async (_request: { reference?: string }) => ({
      providerNotificationId: "notify-dispute",
    }));

    await notifyPaymentOpsDisputeSideState({
      orderId: ORDER_ID,
      stripeEventId: "evt_dispute",
      stripeEventType: "charge.dispute.updated",
      disputeStripeStatus: "under_review",
      disputeReason: "fraudulent",
      disputeLocalState: "DISPUTE_UPDATED",
      stripeDisputeId: "dp_1",
      appBaseUrl: "https://app.example/",
      recipientEmails: ["OPS@example.com", "finance@example.com"],
      getMailer: () => ({ sendEmail } as never),
    });

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: "DISPUTE_OPS_EVENT",
        recoveryPayload: expect.objectContaining({
          kind: "PAYMENT_DISPUTE_OPS",
          recipientEmail: "ops@example.com",
          disputeLocalState: "DISPUTE_UPDATED",
        }),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "paymentDisputeOpsAlert",
        to: "ops@example.com",
        personalisation: expect.objectContaining({
          disputeStripeStatus: "under_review",
          stripeDisputeId: "dp_1",
          reconciliationDashboardUrl: "https://app.example/admin/payments/reconciliation",
        }),
      })
    );
    const references = sendEmail.mock.calls.map(([request]) => request.reference);
    expect(new Set(references)).toHaveLength(2);
    for (const reference of references) {
      expect(reference).toMatch(/^dispute-ops:[0-9a-f-]+:[a-z0-9_]+:[0-9a-f]{24}$/);
    }
  });
});
