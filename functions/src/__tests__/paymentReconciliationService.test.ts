import { describe, expect, it, vi } from "vitest";
import {
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
  TicketOrderStatus,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  applyPaymentTransitionToOrders,
  reconcilePaidCheckoutSessionOrders,
  upsertReconciliationSnapshot,
  type PaidCheckoutReconciliationDependencies,
  type PaymentTransitionOrchestrationDependencies,
  type ReconciliationSnapshotDependencies,
} from "../paymentReconciliationService";

const ORDER_1 = "11111111-1111-4111-8111-111111111111" as UUIDString;
const ORDER_2 = "22222222-2222-4222-8222-222222222222" as UUIDString;
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-07-17T20:00:00.000Z";

interface TestOrder {
  id: UUIDString;
  status: TicketOrderStatus;
  totalAmountMinor: number;
  refundedAmountMinor: number | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  disputeStatus: string | null;
  user: { id: string };
  event: { id: string };
}

function order(
  id: UUIDString,
  userId = "user-1",
  status = TicketOrderStatus.PENDING
): TestOrder {
  return {
    id,
    status,
    totalAmountMinor: 5000,
    refundedAmountMinor: null,
    stripeCheckoutSessionId: "cs_test_1",
    stripePaymentIntentId: null,
    disputeStatus: null,
    user: { id: userId },
    event: { id: EVENT_ID },
  };
}

function transitionDependencies(overrides: Partial<PaymentTransitionOrchestrationDependencies> = {}) {
  const getOrder = vi.fn();
  getOrder.mockResolvedValue({ data: { ticketOrder: order(ORDER_1) } });
  const runTransition = vi.fn();
  runTransition.mockResolvedValue({
    action: "applied" as const,
    reason: "legal_transition",
    orderId: ORDER_1,
    fromStatus: TicketOrderStatus.PENDING,
    targetStatus: TicketOrderStatus.PAID,
    intent: "MARK_PAID" as const,
  });
  const emitNotification = vi.fn(async () => ({ outcome: "sent" as const }));
  const upsertSnapshot = vi.fn(async () => undefined);
  const dependencies = {
    getOrder,
    runTransition,
    emitNotification,
    upsertSnapshot,
    now: () => NOW,
    ...overrides,
  } as unknown as PaymentTransitionOrchestrationDependencies;
  return { dependencies, getOrder, runTransition, emitNotification, upsertSnapshot };
}

describe("applyPaymentTransitionToOrders", () => {
  it("mutates before notifying and reconciling each applied order", async () => {
    const harness = transitionDependencies();

    const result = await applyPaymentTransitionToOrders(
      {
        orderIds: [ORDER_1],
        intent: "MARK_PAID",
        webhookEventId: "evt_paid",
        paidContext: {
          stripeCheckoutSessionId: "cs_test_1",
          stripePaymentIntentId: "pi_test_1",
        },
        paymentIntentIdFromEvent: "pi_test_1",
      },
      harness.dependencies
    );

    expect(result).toEqual({ appliedCount: 1, reconciledOrderIds: [ORDER_1] });
    expect(harness.runTransition).toHaveBeenCalledOnce();
    expect(harness.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_PAID",
        orderId: ORDER_1,
        stripeEventId: "evt_paid",
        occurredAt: NOW,
      }),
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ userId: "user-1" })
    );
    expect(harness.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_1,
        snapshot: expect.objectContaining({
          status: TicketOrderStatus.PAID,
          stripePaymentIntentId: "pi_test_1",
        }),
      })
    );
    expect(harness.runTransition.mock.invocationCallOrder[0]).toBeLessThan(
      harness.emitNotification.mock.invocationCallOrder[0]
    );
    expect(harness.emitNotification.mock.invocationCallOrder[0]).toBeLessThan(
      harness.upsertSnapshot.mock.invocationCallOrder[0]
    );
  });

  it("skips missing and idempotent orders without external side effects", async () => {
    const harness = transitionDependencies();
    harness.getOrder
      .mockResolvedValueOnce({ data: { ticketOrder: null } })
      .mockResolvedValueOnce({ data: { ticketOrder: order(ORDER_2, "user-1", TicketOrderStatus.PAID) } });
    harness.runTransition.mockResolvedValueOnce({
      action: "noop_replay",
      reason: "already_in_target_state",
      orderId: ORDER_2,
      fromStatus: TicketOrderStatus.PAID,
      targetStatus: TicketOrderStatus.PAID,
      intent: "MARK_PAID",
    });

    const result = await applyPaymentTransitionToOrders(
      {
        orderIds: [ORDER_1, ORDER_2],
        intent: "MARK_PAID",
        webhookEventId: "evt_replay",
      },
      harness.dependencies
    );

    expect(result).toEqual({ appliedCount: 0, reconciledOrderIds: [] });
    expect(harness.runTransition).toHaveBeenCalledOnce();
    expect(harness.emitNotification).not.toHaveBeenCalled();
    expect(harness.upsertSnapshot).not.toHaveBeenCalled();
  });

  it("does not notify or reconcile when the state mutation fails", async () => {
    const harness = transitionDependencies();
    harness.runTransition.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      applyPaymentTransitionToOrders(
        {
          orderIds: [ORDER_1],
          intent: "MARK_PAID",
          webhookEventId: "evt_retry",
        },
        harness.dependencies
      )
    ).rejects.toThrow("database unavailable");

    expect(harness.emitNotification).not.toHaveBeenCalled();
    expect(harness.upsertSnapshot).not.toHaveBeenCalled();
  });
});

function snapshotDependencies() {
  const getException = vi.fn();
  getException.mockResolvedValue({
    data: { paymentReconciliationExceptions: [] },
  });
  const createException = vi.fn(async () => ({ data: {} }));
  const updateException = vi.fn(async () => ({ data: {} }));
  const notifyExceptionOpened = vi.fn(async () => undefined);
  const dependencies = {
    getException,
    createException,
    updateException,
    notifyExceptionOpened,
    now: () => NOW,
  } as unknown as ReconciliationSnapshotDependencies;
  return {
    dependencies,
    getException,
    createException,
    updateException,
    notifyExceptionOpened,
  };
}

describe("upsertReconciliationSnapshot", () => {
  it("persists all exception states before alerting on a newly opened signal", async () => {
    const harness = snapshotDependencies();

    await upsertReconciliationSnapshot(
      {
        orderId: ORDER_1,
        snapshot: {
          status: TicketOrderStatus.PAID,
          totalAmountMinor: 5000,
          stripePaymentIntentId: null,
        },
        stripeEventId: "evt_missing_pi",
      },
      harness.dependencies
    );

    expect(harness.createException).toHaveBeenCalledTimes(3);
    expect(harness.updateException).not.toHaveBeenCalled();
    expect(harness.notifyExceptionOpened).toHaveBeenCalledOnce();
    expect(harness.notifyExceptionOpened).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_1,
        exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
        stripeEventId: "evt_missing_pi",
      })
    );
    const latestCreate = Math.max(
      ...harness.createException.mock.invocationCallOrder
    );
    expect(latestCreate).toBeLessThan(
      harness.notifyExceptionOpened.mock.invocationCallOrder[0]
    );
  });

  it("does not duplicate alerts for an exception that is already open", async () => {
    const harness = snapshotDependencies();
    harness.getException.mockImplementation(async ({ exceptionType }: {
      exceptionType: PaymentReconciliationExceptionType;
    }) => ({
      data: {
        paymentReconciliationExceptions: [
          {
            id: `exception-${exceptionType}`,
            status:
              exceptionType === PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT
                ? PaymentReconciliationExceptionStatus.OPEN
                : PaymentReconciliationExceptionStatus.RESOLVED,
          },
        ],
      },
    } as never));

    await upsertReconciliationSnapshot(
      {
        orderId: ORDER_1,
        snapshot: {
          status: TicketOrderStatus.PAID,
          totalAmountMinor: 5000,
          stripePaymentIntentId: null,
        },
        stripeEventId: "evt_existing",
      },
      harness.dependencies
    );

    expect(harness.updateException).toHaveBeenCalledTimes(3);
    expect(harness.notifyExceptionOpened).not.toHaveBeenCalled();
  });

  it("suppresses the duplicate active-dispute alert on the dispute webhook path", async () => {
    const harness = snapshotDependencies();

    await upsertReconciliationSnapshot(
      {
        orderId: ORDER_1,
        snapshot: {
          status: TicketOrderStatus.PENDING,
          totalAmountMinor: 5000,
          disputeStatus: "needs_response",
        },
        stripeEventId: "evt_dispute",
        fromDisputeWebhook: true,
      },
      harness.dependencies
    );

    expect(harness.createException).toHaveBeenCalledTimes(3);
    expect(harness.notifyExceptionOpened).not.toHaveBeenCalled();
  });

  it("does not alert when exception persistence fails", async () => {
    const harness = snapshotDependencies();
    harness.createException.mockRejectedValueOnce(new Error("write failed"));

    await expect(
      upsertReconciliationSnapshot(
        {
          orderId: ORDER_1,
          snapshot: {
            status: TicketOrderStatus.PAID,
            totalAmountMinor: 5000,
            stripePaymentIntentId: null,
          },
          stripeEventId: "evt_retry",
        },
        harness.dependencies
      )
    ).rejects.toThrow("write failed");

    expect(harness.notifyExceptionOpened).not.toHaveBeenCalled();
  });
});

function reconcileDependencies(args: {
  anchor?: ReturnType<typeof order> | null;
  siblings?: Record<string, ReturnType<typeof order> | null>;
  session?: Record<string, unknown>;
}) {
  const anchor = args.anchor === undefined ? order(ORDER_1) : args.anchor;
  const siblings = args.siblings ?? {
    [ORDER_1]: order(ORDER_1),
    [ORDER_2]: order(ORDER_2),
  };
  const getOrder = vi.fn(async ({ id }: { id: UUIDString }) => ({
    data: {
      ticketOrder:
        getOrder.mock.calls.length === 1 ? anchor : siblings[id] ?? null,
    },
  }));
  const retrieveSession = vi.fn(async () => ({
    id: "cs_test_1",
    payment_status: "paid",
    payment_intent: "pi_test_1",
    metadata: { orderIds: `${ORDER_1},${ORDER_2}` },
    ...args.session,
  }));
  const retrievePaymentIntent = vi.fn(async () => ({ metadata: {} }));
  const getStripe = vi.fn(() => ({
    checkout: { sessions: { retrieve: retrieveSession } },
    paymentIntents: { retrieve: retrievePaymentIntent },
  }));
  const applyTransitions = vi.fn(async () => ({
    appliedCount: 2,
    reconciledOrderIds: [ORDER_1, ORDER_2],
  }));
  const dependencies = {
    getOrder,
    getStripe,
    applyTransitions,
  } as unknown as PaidCheckoutReconciliationDependencies;
  return {
    dependencies,
    getOrder,
    getStripe,
    retrieveSession,
    retrievePaymentIntent,
    applyTransitions,
  };
}

describe("reconcilePaidCheckoutSessionOrders", () => {
  it("retrieves a paid session, verifies every sibling, and applies the transition", async () => {
    const harness = reconcileDependencies({});

    const result = await reconcilePaidCheckoutSessionOrders(
      {
        uid: "user-1",
        anchorOrderId: ORDER_1,
        webhookEventId: "member-reconcile",
      },
      harness.dependencies
    );

    expect(result).toEqual({
      appliedCount: 2,
      reconciledOrderIds: [ORDER_1, ORDER_2],
      orderIds: [ORDER_1, ORDER_2],
    });
    expect(harness.retrieveSession).toHaveBeenCalledWith("cs_test_1");
    expect(harness.getOrder).toHaveBeenCalledTimes(3);
    expect(harness.applyTransitions).toHaveBeenCalledWith(
      expect.objectContaining({
        orderIds: [ORDER_1, ORDER_2],
        intent: "MARK_PAID",
        recoverFailedCheckoutPayment: true,
        paymentIntentIdFromEvent: "pi_test_1",
      })
    );
  });

  it("rejects an anchor order that is missing or belongs to another user", async () => {
    const harness = reconcileDependencies({ anchor: order(ORDER_1, "other-user") });

    await expect(
      reconcilePaidCheckoutSessionOrders(
        {
          uid: "user-1",
          anchorOrderId: ORDER_1,
          webhookEventId: "member-reconcile",
        },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "not-found" });

    expect(harness.getStripe).not.toHaveBeenCalled();
  });

  it("rejects unpaid sessions without applying transitions", async () => {
    const harness = reconcileDependencies({ session: { payment_status: "unpaid" } });

    await expect(
      reconcilePaidCheckoutSessionOrders(
        {
          uid: "user-1",
          anchorOrderId: ORDER_1,
          webhookEventId: "member-reconcile",
        },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(harness.applyTransitions).not.toHaveBeenCalled();
  });

  it("resolves the checkout session through payment-intent metadata", async () => {
    const harness = reconcileDependencies({
      anchor: {
        ...order(ORDER_1),
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: "pi_anchor",
      },
    });
    harness.retrievePaymentIntent.mockResolvedValueOnce({
      metadata: { checkoutSessionId: "cs_from_pi" },
    });

    await reconcilePaidCheckoutSessionOrders(
      {
        uid: "user-1",
        anchorOrderId: ORDER_1,
        webhookEventId: "member-reconcile",
      },
      harness.dependencies
    );

    expect(harness.retrievePaymentIntent).toHaveBeenCalledWith("pi_anchor");
    expect(harness.retrieveSession).toHaveBeenCalledWith("cs_from_pi");
    expect(harness.applyTransitions).toHaveBeenCalledOnce();
  });

  it("rejects paid sessions without order metadata", async () => {
    const harness = reconcileDependencies({ session: { metadata: {} } });

    await expect(
      reconcilePaidCheckoutSessionOrders(
        {
          uid: "user-1",
          anchorOrderId: ORDER_1,
          webhookEventId: "member-reconcile",
        },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(harness.applyTransitions).not.toHaveBeenCalled();
  });

  it("rejects a session containing an order owned by another user", async () => {
    const harness = reconcileDependencies({
      siblings: {
        [ORDER_1]: order(ORDER_1),
        [ORDER_2]: order(ORDER_2, "other-user"),
      },
    });

    await expect(
      reconcilePaidCheckoutSessionOrders(
        {
          uid: "user-1",
          anchorOrderId: ORDER_1,
          webhookEventId: "member-reconcile",
        },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(harness.applyTransitions).not.toHaveBeenCalled();
  });
});
