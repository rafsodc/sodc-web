import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
  TicketOrderStatus,
  type GetTicketOrderForWebhookData,
  type MarkTicketOrderPaidFromWebhookVariables,
  type UpsertPaymentReconciliationExceptionVariables,
} from "@dataconnect/admin-generated";
import type { SendNotificationOnceRequest } from "../../notificationDelivery";
import { reconcilePaidCheckoutSessionOrders } from "../../paymentReconciliationService";

interface MailRequest {
  templateName: string;
  to: string;
  reference?: string;
  personalisation: Record<string, unknown>;
  requestedDeliveryMode?: string;
}

const boundary = vi.hoisted(() => ({
  getOrder: vi.fn(),
  markPaid: vi.fn(),
  getException: vi.fn(),
  upsertException: vi.fn(),
  retrieveSession: vi.fn(),
  retrieveIntent: vi.fn(),
  confirmBooking: vi.fn(),
  createMailer: vi.fn(),
  sendEmail: vi.fn(),
  ledger: vi.fn(),
}));

vi.mock("@dataconnect/admin-generated", async (importOriginal) => ({
  ...await importOriginal<typeof import("@dataconnect/admin-generated")>(),
  getTicketOrderForWebhook: boundary.getOrder,
  markTicketOrderPaidFromWebhook: boundary.markPaid,
  getPaymentReconciliationExceptionByOrderAndType: boundary.getException,
  upsertPaymentReconciliationException: boundary.upsertException,
}));

vi.mock("../../paymentConfig", () => ({
  APP_BASE_URL: "https://sodc.example.invalid",
  stripeSecret: { value: () => "stripe-fixture" },
  requireStripe: () => ({
    checkout: { sessions: { retrieve: boundary.retrieveSession } },
    paymentIntents: { retrieve: boundary.retrieveIntent },
  }),
}));

vi.mock("../../bookingPaymentFinalization", () => ({
  confirmBookingIfFullyPaid: boundary.confirmBooking,
}));

vi.mock("../../mailer", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../mailer")>(),
  createConfiguredGovNotifyMailer: boundary.createMailer,
}));

vi.mock("../../notificationDelivery", () => ({
  sendNotificationOnce: boundary.ledger,
}));

const ORDER_ID = "00000000-0000-4000-8000-000000000741";
const EVENT_ID = "00000000-0000-4000-8000-000000000742";
const MEMBER_UID = "reconciliation-fixture-member";
const MEMBER_EMAIL = "member-fixture@example.invalid";
const OPS_EMAIL = "ops-fixture@example.invalid";
const RECONCILE_ID = `member-reconcile:${ORDER_ID}`;

type Order = NonNullable<GetTicketOrderForWebhookData["ticketOrder"]>;
let currentOrder: Order;
let exceptions: Map<PaymentReconciliationExceptionType, {
  id: string;
  status: PaymentReconciliationExceptionStatus;
}>;

function orderFixture(): Order {
  return {
    id: ORDER_ID,
    status: TicketOrderStatus.PENDING,
    quantity: 1,
    unitAmountMinor: 1000,
    totalAmountMinor: 1000,
    currency: "gbp",
    user: { id: MEMBER_UID, email: MEMBER_EMAIL, firstName: "Fixture", lastName: "Member" },
    event: {
      id: EVENT_ID,
      title: "Fixture event",
      location: "Fixture hall",
      startDateTime: "2026-11-17T18:00:00.000Z",
      endDateTime: "2026-11-17T20:00:00.000Z",
    },
    ticketType: { id: "00000000-0000-4000-8000-000000000743", title: "Member ticket" },
    stripeCheckoutSessionId: "cs_fixture",
    stripePaymentIntentId: null,
    webhookEventId: null,
    paymentAllocations: [],
  };
}

function reconcile() {
  // Use the production defaults, including applyPaymentTransitionToOrders,
  // emitPaymentLifecycleNotification, snapshot evaluation and both dispatchers.
  // Only external DB/Stripe, booking finalization and mail/ledger IO are faked.
  return reconcilePaidCheckoutSessionOrders({
    uid: MEMBER_UID,
    anchorOrderId: ORDER_ID,
    webhookEventId: RECONCILE_ID,
  });
}

describe("member checkout reconciliation template wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PAYMENT_OPS_ALERT_EMAILS", OPS_EMAIL);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Live network is forbidden"); }));
    currentOrder = orderFixture();
    exceptions = new Map();
    boundary.getOrder.mockImplementation(async ({ id }: { id: string }) => ({
      data: { ticketOrder: id === ORDER_ID ? structuredClone(currentOrder) : undefined },
    }));
    boundary.markPaid.mockImplementation(async (args: MarkTicketOrderPaidFromWebhookVariables) => {
      expect(args.id).toBe(ORDER_ID);
      currentOrder = {
        ...currentOrder,
        status: TicketOrderStatus.PAID,
        stripeCheckoutSessionId: args.stripeCheckoutSessionId,
        stripePaymentIntentId: args.stripePaymentIntentId,
        webhookEventId: args.webhookEventId,
      };
      return { data: { ticketOrder_update: { id: ORDER_ID } } };
    });
    boundary.getException.mockImplementation(async ({ exceptionType }: {
      exceptionType: PaymentReconciliationExceptionType;
    }) => ({ data: { paymentReconciliationExceptions: exceptions.has(exceptionType) ? [exceptions.get(exceptionType)] : [] } }));
    boundary.upsertException.mockImplementation(async (args: UpsertPaymentReconciliationExceptionVariables) => {
      exceptions.set(args.exceptionType, { id: args.id, status: args.status });
      return { data: { paymentReconciliationException_upsert: { id: args.id } } };
    });
    boundary.retrieveSession.mockReset().mockResolvedValue({
      id: "cs_fixture",
      payment_status: "paid",
      payment_intent: "pi_fixture",
      metadata: { orderIds: ORDER_ID },
    });
    boundary.confirmBooking.mockResolvedValue({ bookingId: null, confirmed: false });
    boundary.createMailer.mockImplementation(() => ({ sendEmail: boundary.sendEmail }));
    boundary.sendEmail.mockImplementation(async (_request: MailRequest) => ({
      provider: "govuk_notify",
      providerNotificationId: "notify-fixture",
      deliveryMode: { requestedMode: "SIMULATION", siteMode: "SIMULATION", effectiveMode: "SIMULATION" },
    }));
    boundary.ledger.mockImplementation(async (request: SendNotificationOnceRequest) => {
      await request.send("SIMULATION");
      return { outcome: "sent", deliveryId: ORDER_ID, attemptCount: 1 };
    });
  });

  afterEach(() => {
    try {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("reaches the real paid-ticket dispatcher from the reconciliation service defaults", async () => {
    await expect(reconcile()).resolves.toEqual({
      appliedCount: 1, reconciledOrderIds: [ORDER_ID], orderIds: [ORDER_ID],
    });

    expect(boundary.markPaid).toHaveBeenCalledExactlyOnceWith({
      id: ORDER_ID, webhookEventId: RECONCILE_ID,
      stripeCheckoutSessionId: "cs_fixture", stripePaymentIntentId: "pi_fixture",
    });
    expect(boundary.sendEmail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      templateName: "ticketOrderPaid",
      to: MEMBER_EMAIL,
      requestedDeliveryMode: "SIMULATION",
      personalisation: expect.objectContaining({ eventTitle: "Fixture event", myPaymentsUrl: "https://sodc.example.invalid/payments" }),
    }));
    expect(boundary.ledger).toHaveBeenCalledWith(expect.objectContaining({
      notificationType: "PAYMENT_PAID", ticketOrderId: ORDER_ID, userId: MEMBER_UID,
    }));
    expect(boundary.markPaid.mock.invocationCallOrder[0]).toBeLessThan(boundary.sendEmail.mock.invocationCallOrder[0]);
    expect(exceptions.get(PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT)?.status)
      .toBe(PaymentReconciliationExceptionStatus.RESOLVED);
  });

  it("also reaches the real ops-alert dispatcher when paid reconciliation opens a missing-intent exception", async () => {
    boundary.retrieveSession.mockResolvedValue({
      id: "cs_fixture", payment_status: "paid", payment_intent: null, metadata: { orderIds: ORDER_ID },
    });

    await reconcile();

    expect(boundary.sendEmail.mock.calls.map(([request]) => request.templateName))
      .toEqual(["ticketOrderPaid", "paymentReconciliationExceptionAlert"]);
    expect(boundary.sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({
      templateName: "paymentReconciliationExceptionAlert",
      to: OPS_EMAIL,
      requestedDeliveryMode: "SIMULATION",
      personalisation: expect.objectContaining({
        orderId: ORDER_ID,
        exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
        reconciliationDashboardUrl: "https://sodc.example.invalid/admin/payments/reconciliation",
      }),
    }));
    expect(boundary.ledger).toHaveBeenLastCalledWith(expect.objectContaining({
      notificationType: "RECONCILIATION_EXCEPTION_OPEN", ticketOrderId: ORDER_ID,
      recoveryPayload: expect.objectContaining({ kind: "PAYMENT_RECONCILIATION_OPS", recipientEmail: OPS_EMAIL }),
    }));
    expect(exceptions.get(PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT)?.status)
      .toBe(PaymentReconciliationExceptionStatus.OPEN);
  });

  it("does not emit the ops template for an exception that is already open", async () => {
    boundary.retrieveSession.mockResolvedValue({
      id: "cs_fixture", payment_status: "paid", payment_intent: null, metadata: { orderIds: ORDER_ID },
    });
    exceptions.set(PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT, {
      id: "00000000-0000-4000-8000-000000000744", status: PaymentReconciliationExceptionStatus.OPEN,
    });

    await reconcile();

    expect(boundary.sendEmail.mock.calls.map(([request]) => request.templateName)).toEqual(["ticketOrderPaid"]);
    expect(boundary.ledger).toHaveBeenCalledTimes(1);
    expect(exceptions.get(PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT)?.status)
      .toBe(PaymentReconciliationExceptionStatus.OPEN);
  });
});
