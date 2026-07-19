import { describe, expect, it, vi } from "vitest";
import {
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
  TicketOrderStatus,
  type UUIDString,
} from "@dataconnect/admin-generated";
import {
  applyPaymentTransitionToOrders,
  PaymentTransitionBatchError,
  paymentReconciliationExceptionId,
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
  webhookEventId: string | null;
  user: { id: string };
  event: { id: string };
}

function order(
  id: UUIDString,
  userId = "user-1",
  status = TicketOrderStatus.PENDING,
  webhookEventId: string | null = null
): TestOrder {
  return {
    id,
    status,
    totalAmountMinor: 5000,
    refundedAmountMinor: null,
    stripeCheckoutSessionId: "cs_test_1",
    stripePaymentIntentId: null,
    disputeStatus: null,
    webhookEventId,
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
  const emitNotification = vi.fn<
    PaymentTransitionOrchestrationDependencies["emitNotification"]
  >(async () => undefined);
  const upsertSnapshot = vi.fn<
    PaymentTransitionOrchestrationDependencies["upsertSnapshot"]
  >(async () => undefined);
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

  it("skips missing and idempotent orders when side-effect recovery is not requested", async () => {
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

  it("reconciles post-transition side effects for an exact event replay", async () => {
    const harness = transitionDependencies();
    harness.getOrder.mockResolvedValueOnce({
      data: {
        ticketOrder: order(
          ORDER_1,
          "user-1",
          TicketOrderStatus.PAID,
          "evt_replay"
        ),
      },
    });
    harness.runTransition.mockResolvedValueOnce({
      action: "noop_replay",
      reason: "already_in_target_state",
      orderId: ORDER_1,
      fromStatus: TicketOrderStatus.PAID,
      targetStatus: TicketOrderStatus.PAID,
      intent: "MARK_PAID",
    });

    const result = await applyPaymentTransitionToOrders(
      {
        orderIds: [ORDER_1],
        intent: "MARK_PAID",
        webhookEventId: "evt_replay",
        recoverPostTransitionSideEffects: true,
      },
      harness.dependencies
    );

    expect(result).toEqual({
      appliedCount: 0,
      reconciledOrderIds: [ORDER_1],
    });
    expect(harness.emitNotification).toHaveBeenCalledOnce();
    expect(harness.upsertSnapshot).toHaveBeenCalledOnce();
  });

  it("does not emit replay side effects for a different event", async () => {
    const harness = transitionDependencies();
    harness.getOrder.mockResolvedValueOnce({
      data: {
        ticketOrder: order(
          ORDER_1,
          "user-1",
          TicketOrderStatus.PAID,
          "evt_original"
        ),
      },
    });
    harness.runTransition.mockResolvedValueOnce({
      action: "noop_replay",
      reason: "already_in_target_state",
      orderId: ORDER_1,
      fromStatus: TicketOrderStatus.PAID,
      targetStatus: TicketOrderStatus.PAID,
      intent: "MARK_PAID",
    });

    const result = await applyPaymentTransitionToOrders(
      {
        orderIds: [ORDER_1],
        intent: "MARK_PAID",
        webhookEventId: "evt_distinct",
        recoverPostTransitionSideEffects: true,
      },
      harness.dependencies
    );

    expect(result).toEqual({ appliedCount: 0, reconciledOrderIds: [] });
    expect(harness.emitNotification).not.toHaveBeenCalled();
    expect(harness.upsertSnapshot).not.toHaveBeenCalled();
  });

  it("recovers one order and continues applying later orders in the same event", async () => {
    const harness = transitionDependencies();
    harness.getOrder.mockImplementation(async ({ id }: { id: UUIDString }) => ({
      data: {
        ticketOrder:
          id === ORDER_1
            ? order(
                ORDER_1,
                "user-1",
                TicketOrderStatus.PAID,
                "evt_multi"
              )
            : order(ORDER_2),
      },
    }) as never);
    harness.runTransition
      .mockResolvedValueOnce({
        action: "noop_replay",
        reason: "already_in_target_state",
        orderId: ORDER_1,
        fromStatus: TicketOrderStatus.PAID,
        targetStatus: TicketOrderStatus.PAID,
        intent: "MARK_PAID",
      })
      .mockResolvedValueOnce({
        action: "applied",
        reason: "legal_transition",
        orderId: ORDER_2,
        fromStatus: TicketOrderStatus.PENDING,
        targetStatus: TicketOrderStatus.PAID,
        intent: "MARK_PAID",
      });

    const result = await applyPaymentTransitionToOrders(
      {
        orderIds: [ORDER_1, ORDER_2],
        intent: "MARK_PAID",
        webhookEventId: "evt_multi",
        recoverPostTransitionSideEffects: true,
      },
      harness.dependencies
    );

    expect(result).toEqual({
      appliedCount: 1,
      reconciledOrderIds: [ORDER_1, ORDER_2],
    });
    expect(harness.emitNotification).toHaveBeenCalledTimes(2);
    expect(harness.upsertSnapshot).toHaveBeenCalledTimes(2);
  });

  it("continues processing sibling orders before reporting a per-order failure", async () => {
    const failure = new Error("delivery ledger permanently unavailable for order 1");
    const harness = transitionDependencies();
    harness.getOrder.mockImplementation(async ({ id }: { id: UUIDString }) => ({
      data: { ticketOrder: order(id) },
    }) as never);
    harness.runTransition.mockImplementation(async ({ orderId }) => ({
      action: "applied" as const,
      reason: "legal_transition",
      orderId,
      fromStatus: TicketOrderStatus.PENDING,
      targetStatus: TicketOrderStatus.PAID,
      intent: "MARK_PAID" as const,
    }));
    harness.emitNotification.mockImplementation(async ({ orderId }) => {
      if (orderId === ORDER_1) {
        throw failure;
      }
    });

    const result = applyPaymentTransitionToOrders(
      {
        orderIds: [ORDER_1, ORDER_2],
        intent: "MARK_PAID",
        webhookEventId: "evt_partial_failure",
      },
      harness.dependencies
    );

    await expect(result).rejects.toBeInstanceOf(PaymentTransitionBatchError);
    await expect(result).rejects.toMatchObject({
      failures: [{ orderId: ORDER_1, error: failure }],
    });
    expect(harness.runTransition).toHaveBeenCalledTimes(2);
    expect(harness.emitNotification).toHaveBeenCalledTimes(2);
    expect(harness.upsertSnapshot).toHaveBeenCalledOnce();
    expect(harness.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_2 })
    );
  });

  it("retries notification setup and snapshot work after the transition committed", async () => {
    let storedOrder = order(ORDER_1);
    const harness = transitionDependencies();
    harness.getOrder.mockImplementation(async () => ({
      data: { ticketOrder: storedOrder },
    }) as never);
    harness.runTransition
      .mockImplementationOnce(async () => {
        storedOrder = order(
          ORDER_1,
          "user-1",
          TicketOrderStatus.PAID,
          "evt_retry"
        );
        return {
          action: "applied" as const,
          reason: "legal_transition",
          orderId: ORDER_1,
          fromStatus: TicketOrderStatus.PENDING,
          targetStatus: TicketOrderStatus.PAID,
          intent: "MARK_PAID" as const,
        };
      })
      .mockResolvedValueOnce({
        action: "noop_replay",
        reason: "already_in_target_state",
        orderId: ORDER_1,
        fromStatus: TicketOrderStatus.PAID,
        targetStatus: TicketOrderStatus.PAID,
        intent: "MARK_PAID",
      });
    harness.emitNotification
      .mockRejectedValueOnce(new Error("delivery ledger unavailable"))
      .mockResolvedValueOnce(undefined);

    const request = {
      orderIds: [ORDER_1],
      intent: "MARK_PAID" as const,
      webhookEventId: "evt_retry",
      recoverPostTransitionSideEffects: true,
    };
    await expect(
      applyPaymentTransitionToOrders(request, harness.dependencies)
    ).rejects.toThrow("delivery ledger unavailable");
    expect(harness.upsertSnapshot).not.toHaveBeenCalled();

    await expect(
      applyPaymentTransitionToOrders(request, harness.dependencies)
    ).resolves.toEqual({
      appliedCount: 0,
      reconciledOrderIds: [ORDER_1],
    });
    expect(harness.emitNotification).toHaveBeenCalledTimes(2);
    expect(harness.upsertSnapshot).toHaveBeenCalledOnce();
  });

  it("retries a failed snapshot without changing the notification delivery key", async () => {
    let storedOrder = order(ORDER_1);
    const harness = transitionDependencies();
    harness.getOrder.mockImplementation(async () => ({
      data: { ticketOrder: storedOrder },
    }) as never);
    harness.runTransition
      .mockImplementationOnce(async () => {
        storedOrder = order(
          ORDER_1,
          "user-1",
          TicketOrderStatus.PAID,
          "evt_snapshot_retry"
        );
        return {
          action: "applied" as const,
          reason: "legal_transition",
          orderId: ORDER_1,
          fromStatus: TicketOrderStatus.PENDING,
          targetStatus: TicketOrderStatus.PAID,
          intent: "MARK_PAID" as const,
        };
      })
      .mockResolvedValueOnce({
        action: "noop_replay",
        reason: "already_in_target_state",
        orderId: ORDER_1,
        fromStatus: TicketOrderStatus.PAID,
        targetStatus: TicketOrderStatus.PAID,
        intent: "MARK_PAID",
      });
    harness.upsertSnapshot
      .mockRejectedValueOnce(new Error("snapshot unavailable"))
      .mockResolvedValueOnce(undefined);

    const request = {
      orderIds: [ORDER_1],
      intent: "MARK_PAID" as const,
      webhookEventId: "evt_snapshot_retry",
      recoverPostTransitionSideEffects: true,
    };
    await expect(
      applyPaymentTransitionToOrders(request, harness.dependencies)
    ).rejects.toThrow("snapshot unavailable");
    await expect(
      applyPaymentTransitionToOrders(request, harness.dependencies)
    ).resolves.toEqual({
      appliedCount: 0,
      reconciledOrderIds: [ORDER_1],
    });

    expect(harness.emitNotification).toHaveBeenCalledTimes(2);
    expect(harness.emitNotification.mock.calls[0][0].stripeEventId).toBe(
      "evt_snapshot_retry"
    );
    expect(harness.emitNotification.mock.calls[1][0].stripeEventId).toBe(
      "evt_snapshot_retry"
    );
    expect(harness.upsertSnapshot).toHaveBeenCalledTimes(2);
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
  const upsertException = vi.fn<
    ReconciliationSnapshotDependencies["upsertException"]
  >(async () => ({ data: {} } as never));
  const notifyExceptionOpened = vi.fn(async () => undefined);
  const dependencies = {
    getException,
    upsertException,
    notifyExceptionOpened,
    now: () => NOW,
  } as unknown as ReconciliationSnapshotDependencies;
  return {
    dependencies,
    getException,
    upsertException,
    notifyExceptionOpened,
  };
}

describe("upsertReconciliationSnapshot", () => {
  it("derives stable, type-specific UUIDs for new exception rows", () => {
    const missingId = paymentReconciliationExceptionId(
      ORDER_1,
      PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT
    );

    expect(missingId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(
      paymentReconciliationExceptionId(
        ORDER_1,
        PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT
      )
    ).toBe(missingId);
    expect(
      paymentReconciliationExceptionId(
        ORDER_1,
        PaymentReconciliationExceptionType.ACTIVE_DISPUTE
      )
    ).not.toBe(missingId);
  });

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

    expect(harness.upsertException).toHaveBeenCalledTimes(3);
    expect(harness.notifyExceptionOpened).toHaveBeenCalledOnce();
    expect(harness.notifyExceptionOpened).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_1,
        exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
        stripeEventId: "evt_missing_pi",
      })
    );
    const latestUpsert = Math.max(
      ...harness.upsertException.mock.invocationCallOrder
    );
    expect(latestUpsert).toBeLessThan(
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

    expect(harness.upsertException).toHaveBeenCalledTimes(3);
    expect(harness.upsertException).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `exception-${PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT}`,
        exceptionType:
          PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
      })
    );
    expect(harness.notifyExceptionOpened).not.toHaveBeenCalled();
  });

  it("uses the same primary IDs across concurrent snapshot retries", async () => {
    const harness = snapshotDependencies();
    const request = {
      orderId: ORDER_1,
      snapshot: {
        status: TicketOrderStatus.PAID,
        totalAmountMinor: 5000,
        stripePaymentIntentId: null,
      },
      stripeEventId: "evt_concurrent",
    };

    await Promise.all([
      upsertReconciliationSnapshot(request, harness.dependencies),
      upsertReconciliationSnapshot(request, harness.dependencies),
    ]);

    for (const exceptionType of Object.values(
      PaymentReconciliationExceptionType
    )) {
      const ids = harness.upsertException.mock.calls
        .map(([variables]) => variables)
        .filter((variables) => variables.exceptionType === exceptionType)
        .map((variables) => variables.id);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(1);
    }
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

    expect(harness.upsertException).toHaveBeenCalledTimes(3);
    expect(harness.notifyExceptionOpened).not.toHaveBeenCalled();
  });

  it("does not alert when exception persistence fails", async () => {
    const harness = snapshotDependencies();
    harness.upsertException.mockRejectedValueOnce(new Error("write failed"));

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
