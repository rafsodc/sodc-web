import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import {
  PaymentWebhookEventOutcome,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import * as logger from "firebase-functions/logger";

const serviceMocks = vi.hoisted(() => ({
  applyTransitions: vi.fn(),
  upsertSnapshot: vi.fn(),
}));
const opsMocks = vi.hoisted(() => ({
  notifyDispute: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onRequest: vi.fn().mockImplementation((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("../paymentReconciliationService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../paymentReconciliationService")>()),
  applyPaymentTransitionToOrders: serviceMocks.applyTransitions,
  upsertReconciliationSnapshot: serviceMocks.upsertSnapshot,
}));

vi.mock("../paymentOpsInternalAlerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../paymentOpsInternalAlerts")>()),
  notifyPaymentOpsDisputeSideState: opsMocks.notifyDispute,
}));

import { stripeWebhook, stripeWebhookPayments } from "../paymentWebhook";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const WEBHOOK_SECRET = "whsec_payments_test";
const LEGACY_SECRET = "whsec_legacy_test";

const getWebhookEvent = vi.spyOn(admin, "getPaymentWebhookEventByStripeEventId");
const createWebhookEvent = vi.spyOn(admin, "createPaymentWebhookEvent");
const getOrder = vi.spyOn(admin, "getTicketOrderForWebhook");
const upsertDispute = vi.spyOn(admin, "upsertTicketOrderDisputeFromWebhook");

type Handler = (
  req: { headers: Record<string, unknown>; rawBody: Buffer },
  res: ReturnType<typeof responseHarness>["res"]
) => Promise<void>;

const handler = stripeWebhookPayments as unknown as Handler;
const legacyHandler = stripeWebhook as unknown as Handler;

function stripeEvent(args: {
  id?: string;
  type: string;
  object?: Record<string, unknown>;
}) {
  return {
    id: args.id ?? "evt_test_1",
    object: "event",
    api_version: "2025-06-30.basil",
    created: 1_752_780_000,
    data: { object: args.object ?? { id: "obj_1" } },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: args.type,
  };
}

function signedRequest(event: ReturnType<typeof stripeEvent>, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const stripe = new Stripe("sk_test_signature");
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return {
    headers: { "stripe-signature": signature },
    rawBody: Buffer.from(payload),
  };
}

function responseHarness() {
  const send = vi.fn();
  const status = vi.fn((code: number) => ({
    send: (body: string) => send(code, body),
  }));
  return { res: { status }, status, send };
}

describe("stripe payment webhook orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET", "sk_test_webhook");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET_PAYMENTS", WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", LEGACY_SECRET);
    getWebhookEvent.mockResolvedValue({
      data: { paymentWebhookEvents: [] },
    } as never);
    createWebhookEvent.mockResolvedValue({ data: {} } as never);
    getOrder.mockResolvedValue({
      data: {
        ticketOrder: {
          id: ORDER_ID,
          status: TicketOrderStatus.PAID,
          totalAmountMinor: 5000,
          refundedAmountMinor: null,
          stripePaymentIntentId: "pi_1",
          disputeStatus: null,
        },
      },
    } as never);
    upsertDispute.mockResolvedValue({ data: {} } as never);
    serviceMocks.applyTransitions.mockResolvedValue({
      appliedCount: 1,
      reconciledOrderIds: [ORDER_ID],
    });
    serviceMocks.upsertSnapshot.mockResolvedValue(undefined);
    opsMocks.notifyDispute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without a Stripe signature before any ledger access", async () => {
    const response = responseHarness();

    await handler(
      { headers: {}, rawBody: Buffer.from("{}") },
      response.res
    );

    expect(response.send).toHaveBeenCalledWith(400, "Missing stripe-signature");
    expect(getWebhookEvent).not.toHaveBeenCalled();
  });

  it("fails closed when neither webhook secret is configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET_PAYMENTS;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const response = responseHarness();

    await handler(
      { headers: {}, rawBody: Buffer.from("{}") },
      response.res
    );

    expect(response.send).toHaveBeenCalledWith(500, "Webhook secret not configured");
    expect(getWebhookEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid signatures without trusting event content", async () => {
    const response = responseHarness();

    await handler(
      {
        headers: { "stripe-signature": "t=1,v1=invalid" },
        rawBody: Buffer.from(JSON.stringify(stripeEvent({ type: "checkout.session.completed" }))),
      },
      response.res
    );

    expect(response.send).toHaveBeenCalledWith(400, "Webhook error");
    expect(getWebhookEvent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("routes a valid but unsupported event out of the payments domain", async () => {
    const response = responseHarness();

    await handler(
      signedRequest(stripeEvent({ type: "customer.updated" })),
      response.res
    );

    expect(response.send).toHaveBeenCalledWith(200, "Ignored out-of-domain event");
    expect(getWebhookEvent).not.toHaveBeenCalled();
    expect(createWebhookEvent).not.toHaveBeenCalled();
  });

  it("uses the legacy secret only as a logged fallback", async () => {
    const response = responseHarness();

    await handler(
      signedRequest(stripeEvent({ type: "customer.updated" }), LEGACY_SECRET),
      response.res
    );

    expect(response.send).toHaveBeenCalledWith(200, "Ignored out-of-domain event");
    expect(logger.warn).toHaveBeenCalledWith(
      "stripeWebhookPayments verified with fallback webhook secret",
      { domain: "payments", fallbackIndex: 1 }
    );
  });

  it("keeps the legacy endpoint routed through signature verification", async () => {
    const response = responseHarness();

    await legacyHandler(
      signedRequest(stripeEvent({ type: "customer.updated" }), LEGACY_SECRET),
      response.res
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "stripeWebhook legacy endpoint invoked",
      { migrationTarget: "stripeWebhookPayments" }
    );
    expect(response.send).toHaveBeenCalledWith(200, "Ignored out-of-domain event");
  });

  it("reconciles a duplicate completed checkout without appending a second ledger row", async () => {
    getWebhookEvent.mockResolvedValueOnce({
      data: { paymentWebhookEvents: [{ id: "existing" }] },
    } as never);
    const response = responseHarness();
    const event = stripeEvent({
      id: "evt_duplicate",
      type: "checkout.session.completed",
      object: {
        id: "cs_test_1",
        payment_intent: "pi_test_1",
        metadata: { orderIds: ORDER_ID },
      },
    });

    await handler(signedRequest(event), response.res);

    expect(serviceMocks.applyTransitions).toHaveBeenCalledWith({
      orderIds: [ORDER_ID],
      intent: "MARK_PAID",
      webhookEventId: "evt_duplicate:reconcile",
      paidContext: {
        stripeCheckoutSessionId: "cs_test_1",
        stripePaymentIntentId: "pi_test_1",
      },
      recoverFailedCheckoutPayment: true,
      paymentIntentIdFromEvent: "pi_test_1",
    });
    expect(createWebhookEvent).not.toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(200, "Duplicate event");
  });

  it("applies a payment transition before recording the processed event", async () => {
    const response = responseHarness();
    const event = stripeEvent({
      id: "evt_paid",
      type: "checkout.session.completed",
      object: {
        id: "cs_test_1",
        payment_intent: "pi_test_1",
        metadata: { orderIds: ORDER_ID },
      },
    });

    await handler(signedRequest(event), response.res);

    expect(serviceMocks.applyTransitions).toHaveBeenCalledWith(
      expect.objectContaining({
        orderIds: [ORDER_ID],
        intent: "MARK_PAID",
        webhookEventId: "evt_paid",
      })
    );
    expect(createWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: "evt_paid",
        outcome: PaymentWebhookEventOutcome.PROCESSED,
        reason: "transition_applied:MARK_PAID:1_orders",
      })
    );
    expect(serviceMocks.applyTransitions.mock.invocationCallOrder[0]).toBeLessThan(
      createWebhookEvent.mock.invocationCallOrder[0]
    );
    expect(response.send).toHaveBeenCalledWith(200, "ok");
  });

  it("records an event for a missing order without attempting a transition", async () => {
    getOrder.mockResolvedValueOnce({ data: { ticketOrder: null } } as never);
    const response = responseHarness();
    const event = stripeEvent({
      id: "evt_unknown_order",
      type: "checkout.session.completed",
      object: { id: "cs_unknown", metadata: { orderIds: ORDER_ID } },
    });

    await handler(signedRequest(event), response.res);

    expect(createWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: "evt_unknown_order",
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "order_not_found",
        ticketOrderId: ORDER_ID,
      })
    );
    expect(serviceMocks.applyTransitions).not.toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(200, "Order not found");
  });

  it("does not acknowledge or ledger a transition when mutation processing fails", async () => {
    serviceMocks.applyTransitions.mockRejectedValueOnce(new Error("database unavailable"));
    const response = responseHarness();
    const event = stripeEvent({
      id: "evt_retry",
      type: "checkout.session.completed",
      object: { metadata: { orderIds: ORDER_ID } },
    });

    await handler(signedRequest(event), response.res);

    expect(createWebhookEvent).not.toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(400, "Webhook error");
  });

  it("records an idempotent no-op as ignored", async () => {
    serviceMocks.applyTransitions.mockResolvedValueOnce({
      appliedCount: 0,
      reconciledOrderIds: [],
    });
    const response = responseHarness();
    const event = stripeEvent({
      id: "evt_noop",
      type: "checkout.session.expired",
      object: { id: "cs_expired", metadata: { orderIds: ORDER_ID } },
    });

    await handler(signedRequest(event), response.res);

    expect(createWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: "evt_noop",
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "transition_noop_for_all_orders",
      })
    );
    expect(response.send).toHaveBeenCalledWith(200, "No transitions applied");
  });

  it("persists dispute state and ledger data before reconciliation and ops email", async () => {
    const response = responseHarness();
    const event = stripeEvent({
      id: "evt_dispute",
      type: "charge.dispute.created",
      object: {
        id: "dp_1",
        status: "needs_response",
        reason: "fraudulent",
        amount: 5000,
        metadata: { orderIds: ORDER_ID },
      },
    });

    await handler(signedRequest(event), response.res);

    expect(upsertDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ORDER_ID,
        webhookEventId: "evt_dispute",
        stripeDisputeId: "dp_1",
        disputeStatus: "needs_response",
      })
    );
    expect(createWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: "evt_dispute",
        outcome: PaymentWebhookEventOutcome.PROCESSED,
        reason: "dispute_side_state:DISPUTE_OPEN",
      })
    );
    expect(serviceMocks.upsertSnapshot).toHaveBeenCalledOnce();
    expect(opsMocks.notifyDispute).toHaveBeenCalledOnce();
    expect(upsertDispute.mock.invocationCallOrder[0]).toBeLessThan(
      createWebhookEvent.mock.invocationCallOrder[0]
    );
    expect(createWebhookEvent.mock.invocationCallOrder[0]).toBeLessThan(
      serviceMocks.upsertSnapshot.mock.invocationCallOrder[0]
    );
    expect(serviceMocks.upsertSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      opsMocks.notifyDispute.mock.invocationCallOrder[0]
    );
    expect(response.send).toHaveBeenCalledWith(200, "Dispute side-state acknowledged");
  });

  it("records supported events without order metadata as ignored", async () => {
    const response = responseHarness();
    const event = stripeEvent({
      id: "evt_missing_order",
      type: "checkout.session.completed",
      object: { id: "cs_missing", metadata: {} },
    });

    await handler(signedRequest(event), response.res);

    expect(createWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: "evt_missing_order",
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "missing_order_metadata",
      })
    );
    expect(serviceMocks.applyTransitions).not.toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(200, "No order metadata");
  });
});
