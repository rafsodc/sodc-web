import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {
  createPaymentWebhookEvent,
  createTicketOrderForCheckout,
  getBookingsForBookerAndEvent,
  getPaymentWebhookEventByStripeEventId,
  getSectionByIdForCallable,
  getPaymentReconciliationExceptionByOrderAndType,
  getTicketOrderForWebhook,
  getTicketOrdersForBookerAndEvent,
  getTicketOrderStripeArtifactsForCallable,
  getTicketTypeForCheckout,
  getUserForCheckout,
  getUserUserGroupsForAdmin,
  markTicketOrderFailedFromWebhook,
  markTicketOrderPaidFromWebhook,
  markTicketOrderRefundedFromWebhook,
  upsertTicketOrderDisputeFromWebhook,
  updateUserStripeCustomerId,
  PaymentWebhookEventOutcome,
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
  TicketAudience,
  TicketOrderStatus,
  createPaymentReconciliationException,
  updatePaymentReconciliationExceptionById,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { requireEnabled, validateUUID } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { userMatchesUserGroup, userHasBookerPurpose } from "./bookingRules";
import { computeUnpaidBookingCheckoutItems, planCheckoutOrderLines, selectLatestActiveBooking, stalePendingOrderIds, bookingIdsEqual } from "./bookingCheckout";
import Stripe from "stripe";
import {
  extractOrderIdsFromStripeEvent,
  isSupportedStripeEventType,
  normalizeStripeEvent,
  type PaymentTransitionIntent,
} from "./paymentStateMachine";
import { runTicketOrderTransition, paidContextForMultiOrderWebhook } from "./paymentTransitionEngine";
import { evaluateReconciliationSignals } from "./paymentReconciliation";
import { emitPaymentLifecycleNotification } from "./paymentNotifications";
import {
  createGovNotifyTicketOrderLifecycleDispatcher,
  defaultWebhookGovNotifyTicketOrderMailer,
} from "./paymentLifecycleEmailDispatcher";
import { classifyStripeWebhookDomain } from "./stripeWebhookRouting";
import { govNotifyApiKey, GOV_NOTIFY_PROVIDER } from "./mailer";
import { sendNotificationOnce } from "./notificationDelivery";
import {
  notifyPaymentOpsDisputeSideState,
  notifyPaymentOpsReconciliationExceptionOpened,
} from "./paymentOpsInternalAlerts";

const stripeSecret = defineSecret("STRIPE_SECRET");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripeWebhookPaymentsSecret = defineSecret("STRIPE_WEBHOOK_SECRET_PAYMENTS");
const CHECKOUT_CURRENCY = "gbp";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

/** Member payments route — must match frontend `ROUTES.MY_PAYMENTS` (`/payments`). */
export const MEMBER_PAYMENTS_PATH = "/payments";

export function buildStripeCheckoutReturnUrls(
  appBaseUrl: string,
  orderId: string
): { successUrl: string; cancelUrl: string } {
  const base = appBaseUrl.replace(/\/$/, "");
  const orderQuery = encodeURIComponent(orderId);
  return {
    successUrl: `${base}${MEMBER_PAYMENTS_PATH}?checkout=success&orderId=${orderQuery}`,
    cancelUrl: `${base}${MEMBER_PAYMENTS_PATH}?checkout=cancel&orderId=${orderQuery}`,
  };
}

const govNotifyTicketOrderDispatcher = createGovNotifyTicketOrderLifecycleDispatcher({
  getMailer: defaultWebhookGovNotifyTicketOrderMailer,
  appBaseUrl: APP_BASE_URL,
});

function requireStripe(secretValue: string | undefined): InstanceType<typeof Stripe> {
  if (!secretValue) {
    throw new HttpsError("failed-precondition", "Stripe is not configured on the server");
  }
  return new Stripe(secretValue);
}

function ensureBookingWindow(start: string, end: string): void {
  const now = Date.now();
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || now < s || now > e) {
    throw new HttpsError("failed-precondition", "Ticket sales are not open for this event");
  }
}

function toMinorUnits(price: number): number {
  return Math.round(price * 100);
}

async function ensureTicketCheckoutEligibility(args: {
  uid: string;
  ticketType: NonNullable<Awaited<ReturnType<typeof getTicketTypeForCheckout>>["data"]["ticketType"]>;
}): Promise<{ membershipStatus: string; explicitGroupIds: Set<string> }> {
  const { uid, ticketType } = args;
  ensureBookingWindow(ticketType.event.bookingStartDateTime, ticketType.event.bookingEndDateTime);

  const section = await getSectionByIdForCallable({ id: ticketType.event.section.id as UUIDString });
  const sectionData = section.data?.section;
  if (!sectionData) throw new HttpsError("not-found", "Section not found");
  const userGroups = await getUserUserGroupsForAdmin({ userId: uid });
  const explicitGroupIds = new Set((userGroups.data?.user?.userGroups ?? []).map((x) => validateUUID(x.userGroup.id)));
  const dcUser = await getUserForCheckout({ userId: uid });
  const user = dcUser.data?.user;
  if (!user) throw new HttpsError("failed-precondition", "User profile is required");
  const membershipStatus = user.membershipStatus;
  if (
    !userHasBookerPurpose(
      (sectionData.purposeLinks ?? []).map((l) => ({
        purposes: l.purposes ?? [],
        userGroup: { id: validateUUID(l.userGroup.id), membershipStatuses: l.userGroup.membershipStatuses ?? null },
      })),
      explicitGroupIds,
      membershipStatus
    )
  ) {
    throw new HttpsError("permission-denied", "You are not eligible to purchase this ticket");
  }
  if (
    !userMatchesUserGroup(
      membershipStatus,
      { id: validateUUID(ticketType.userGroup.id), membershipStatuses: ticketType.userGroup.membershipStatuses ?? null },
      explicitGroupIds
    )
  ) {
    throw new HttpsError("permission-denied", "You are not eligible for this ticket type");
  }
  return { membershipStatus, explicitGroupIds };
}

async function ensureStripeCustomerId(args: {
  uid: string;
  stripeClient: InstanceType<typeof Stripe>;
}): Promise<string> {
  const dcUser = await getUserForCheckout({ userId: args.uid });
  const user = dcUser.data?.user;
  if (!user) throw new HttpsError("failed-precondition", "User profile is required");
  let customerId = user.stripeCustomerId ?? null;
  if (!customerId) {
    const created = await args.stripeClient.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      metadata: { firebaseUid: args.uid },
    });
    customerId = created.id;
    await updateUserStripeCustomerId({ userId: args.uid, stripeCustomerId: customerId });
  }
  return customerId;
}

function stripeObjectIdFromEvent(event: { data: { object: unknown } }): string | null {
  const obj = event.data.object as { id?: unknown };
  return typeof obj.id === "string" ? obj.id : null;
}

function isoTimestampFromStripeEpochSeconds(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

async function appendWebhookLedgerEvent(args: {
  stripeEventId: string;
  eventType: string;
  outcome: PaymentWebhookEventOutcome;
  reason: string;
  ticketOrderId?: UUIDString;
  stripeObjectId?: string | null;
  livemode: boolean;
}): Promise<void> {
  await createPaymentWebhookEvent({
    stripeEventId: args.stripeEventId,
    eventType: args.eventType,
    outcome: args.outcome,
    reason: args.reason,
    ticketOrderId: args.ticketOrderId ?? null,
    stripeObjectId: args.stripeObjectId ?? null,
    livemode: args.livemode,
  });
}

const RECONCILIATION_EXCEPTION_TYPES = [
  PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
  PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH,
  PaymentReconciliationExceptionType.ACTIVE_DISPUTE,
] as const;

/** Whether to send the internal ops email when a reconciliation exception is open. */
export function shouldSendReconciliationExceptionOpenedAlert(args: {
  status: PaymentReconciliationExceptionStatus;
  hasSignal: boolean;
  isNewOpen: boolean;
  reopenedFromResolved: boolean;
  exceptionType: PaymentReconciliationExceptionType;
  fromDisputeWebhook: boolean;
}): boolean {
  if (args.status !== PaymentReconciliationExceptionStatus.OPEN || !args.hasSignal) {
    return false;
  }
  if (!args.isNewOpen && !args.reopenedFromResolved) {
    return false;
  }
  if (
    args.exceptionType === PaymentReconciliationExceptionType.ACTIVE_DISPUTE &&
    args.fromDisputeWebhook === true
  ) {
    return false;
  }
  return true;
}

async function upsertReconciliationSnapshot(args: {
  orderId: UUIDString;
  snapshot: {
    status: TicketOrderStatus;
    totalAmountMinor: number;
    refundedAmountMinor?: number | null;
    stripePaymentIntentId?: string | null;
    disputeStatus?: string | null;
  };
  stripeEventId: string;
  fromDisputeWebhook?: boolean;
}): Promise<void> {
  const signals = evaluateReconciliationSignals(args.snapshot);
  const signalMap = new Map(signals.map((signal) => [signal.type, signal]));
  const nowIso = new Date().toISOString();

  for (const type of RECONCILIATION_EXCEPTION_TYPES) {
    const signal = signalMap.get(type);
    const status = signal ? PaymentReconciliationExceptionStatus.OPEN : PaymentReconciliationExceptionStatus.RESOLVED;
    const note = signal?.note ?? "Auto-resolved by reconciliation snapshot";
    const existing = await getPaymentReconciliationExceptionByOrderAndType({
      ticketOrderId: args.orderId,
      exceptionType: type,
    });
    const existingRow = existing.data?.paymentReconciliationExceptions?.[0];
    const previousStatus = existingRow?.status;

    if (existingRow?.id) {
      await updatePaymentReconciliationExceptionById({
        id: existingRow.id,
        status,
        note,
        ownerUserId: null,
        lastAttemptedAt: nowIso,
        resolvedAt: signal ? null : nowIso,
      });
    } else {
      await createPaymentReconciliationException({
        ticketOrderId: args.orderId,
        exceptionType: type,
        status,
        note,
        ownerUserId: null,
        lastAttemptedAt: nowIso,
        resolvedAt: signal ? null : nowIso,
      });
    }

    const isNewOpen = !existingRow?.id;
    const reopenedFromResolved =
      !!existingRow?.id && previousStatus === PaymentReconciliationExceptionStatus.RESOLVED;
    if (
      shouldSendReconciliationExceptionOpenedAlert({
        status,
        hasSignal: !!signal,
        isNewOpen,
        reopenedFromResolved,
        exceptionType: type,
        fromDisputeWebhook: args.fromDisputeWebhook === true,
      })
    ) {
      void notifyPaymentOpsReconciliationExceptionOpened({
        orderId: args.orderId,
        exceptionType: type,
        exceptionNote: note,
        stripeEventId: args.stripeEventId,
        appBaseUrl: APP_BASE_URL,
      });
    }
  }
}

function paidContextFromCheckoutSessionObject(session: {
  id?: string;
  payment_intent?: string | { id?: string } | null;
}): {
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
} {
  return {
    stripeCheckoutSessionId: session.id ?? null,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
  };
}

async function applyPaymentTransitionToOrders(args: {
  orderIds: UUIDString[];
  intent: PaymentTransitionIntent;
  webhookEventId: string;
  paidContext?: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  };
  refundContext?: {
    stripeRefundId?: string | null;
    refundedAmountMinor?: number | null;
    refundedAt?: string | null;
  };
  recoverFailedCheckoutPayment?: boolean;
  paymentIntentIdFromEvent?: string | null;
  refundAmountFromEvent?: number | null;
}): Promise<{ appliedCount: number; reconciledOrderIds: UUIDString[] }> {
  let appliedCount = 0;
  const reconciledOrderIds: UUIDString[] = [];

  for (const [orderIndex, orderId] of args.orderIds.entries()) {
    const orderRow = await getTicketOrderForWebhook({ id: orderId });
    const currentOrder = orderRow.data?.ticketOrder;
    if (!currentOrder) {
      continue;
    }
    const transitionResult = await runTicketOrderTransition(
      {
        orderId,
        currentStatus: currentOrder.status,
        intent: args.intent,
        webhookEventId: args.webhookEventId,
        recoverFailedCheckoutPayment: args.recoverFailedCheckoutPayment,
        paidContext:
          args.intent === "MARK_PAID" && args.paidContext
            ? paidContextForMultiOrderWebhook(orderIndex, args.paidContext)
            : undefined,
        refundContext: args.refundContext,
      },
      {
        markPaid: markTicketOrderPaidFromWebhook,
        markFailed: markTicketOrderFailedFromWebhook,
        markRefunded: markTicketOrderRefundedFromWebhook,
      }
    );
    if (transitionResult.action !== "applied") {
      continue;
    }
    appliedCount += 1;
    reconciledOrderIds.push(orderId);
    const notificationType =
      args.intent === "MARK_PAID" ? "PAYMENT_PAID" : args.intent === "MARK_FAILED" ? "PAYMENT_FAILED" : "PAYMENT_REFUNDED";
    await emitPaymentLifecycleNotification(
      {
        type: notificationType,
        orderId,
        eventId: currentOrder.event.id,
        stripeEventId: args.webhookEventId,
        status: transitionResult.targetStatus,
        occurredAt: new Date().toISOString(),
      },
      govNotifyTicketOrderDispatcher,
      sendNotificationOnce,
      { userId: currentOrder.user.id, provider: GOV_NOTIFY_PROVIDER }
    );
    await upsertReconciliationSnapshot({
      orderId,
      snapshot: {
        status: transitionResult.targetStatus,
        totalAmountMinor: currentOrder.totalAmountMinor,
        refundedAmountMinor: args.refundAmountFromEvent ?? currentOrder.refundedAmountMinor ?? null,
        stripePaymentIntentId: args.paymentIntentIdFromEvent ?? currentOrder.stripePaymentIntentId ?? null,
        disputeStatus: currentOrder.disputeStatus ?? null,
      },
      stripeEventId: args.webhookEventId,
    });
  }

  return { appliedCount, reconciledOrderIds };
}

async function reconcilePaidCheckoutSessionOrders(args: {
  uid: string;
  anchorOrderId: UUIDString;
  webhookEventId: string;
}): Promise<{ appliedCount: number; reconciledOrderIds: UUIDString[]; orderIds: UUIDString[] }> {
  const orderRow = await getTicketOrderForWebhook({ id: args.anchorOrderId });
  const anchorOrder = orderRow.data?.ticketOrder;
  if (!anchorOrder || anchorOrder.user.id !== args.uid) {
    throw new HttpsError("not-found", "Order not found");
  }

  const stripeClient = requireStripe(stripeSecret.value());
  let session: Awaited<ReturnType<typeof stripeClient.checkout.sessions.retrieve>> | null = null;

  if (anchorOrder.stripeCheckoutSessionId) {
    session = await stripeClient.checkout.sessions.retrieve(anchorOrder.stripeCheckoutSessionId);
  } else if (anchorOrder.stripePaymentIntentId) {
    const paymentIntent = await stripeClient.paymentIntents.retrieve(anchorOrder.stripePaymentIntentId);
    const sessionId =
      typeof paymentIntent.metadata?.checkoutSessionId === "string"
        ? paymentIntent.metadata.checkoutSessionId
        : null;
    if (sessionId) {
      session = await stripeClient.checkout.sessions.retrieve(sessionId);
    }
  }

  if (!session?.id) {
    throw new HttpsError("failed-precondition", "Unable to resolve checkout session for this order");
  }
  if (session.payment_status !== "paid") {
    throw new HttpsError("failed-precondition", "Checkout session is not paid");
  }

  const orderIds = extractOrderIdsFromStripeEvent({
    type: "checkout.session.completed",
    data: { object: session },
  }).map((id) => validateUUID(id, "orderId") as UUIDString);
  if (orderIds.length === 0) {
    throw new HttpsError("failed-precondition", "Checkout session is missing order metadata");
  }

  for (const orderId of orderIds) {
    const sibling = await getTicketOrderForWebhook({ id: orderId });
    const siblingOrder = sibling.data?.ticketOrder;
    if (!siblingOrder || siblingOrder.user.id !== args.uid) {
      throw new HttpsError("permission-denied", "Checkout session includes an order you do not own");
    }
  }

  const paidContext = paidContextFromCheckoutSessionObject(session);
  const { appliedCount, reconciledOrderIds } = await applyPaymentTransitionToOrders({
    orderIds,
    intent: "MARK_PAID",
    webhookEventId: args.webhookEventId,
    paidContext,
    recoverFailedCheckoutPayment: true,
    paymentIntentIdFromEvent: paidContext.stripePaymentIntentId,
  });

  return { appliedCount, reconciledOrderIds, orderIds };
}

export const createTicketCheckoutSession = onCall({ region: FUNCTIONS_REGION, secrets: [stripeSecret] }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  const quantity = Number(request.data?.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new HttpsError("invalid-argument", "quantity must be an integer between 1 and 10");
  }
  const ticketTypeId = validateUUID(String(request.data?.ticketTypeId), "ticketTypeId") as UUIDString;

  const dcUser = await getUserForCheckout({ userId: uid });
  const user = dcUser.data?.user;
  if (!user) throw new HttpsError("failed-precondition", "User profile is required");

  const ttResult = await getTicketTypeForCheckout({ ticketTypeId });
  const ticketType = ttResult.data?.ticketType;
  if (!ticketType) throw new HttpsError("not-found", "Ticket type not found");
  if (ticketType.audience !== TicketAudience.MEMBER && ticketType.audience !== TicketAudience.GUEST) {
    throw new HttpsError("failed-precondition", "Unsupported ticket audience for checkout");
  }
  await ensureTicketCheckoutEligibility({ uid, ticketType });

  const stripeClient = requireStripe(stripeSecret.value());
  const customerId = await ensureStripeCustomerId({ uid, stripeClient });

  const unitAmountMinor = toMinorUnits(ticketType.price);
  const totalAmountMinor = unitAmountMinor * quantity;
  const order = await createTicketOrderForCheckout({
    userId: uid,
    eventId: ticketType.event.id as UUIDString,
    ticketTypeId: ticketType.id as UUIDString,
    quantity,
    unitAmountMinor,
    totalAmountMinor,
    currency: CHECKOUT_CURRENCY,
  });
  const orderId = order.data?.ticketOrder_insert?.id;
  if (!orderId) throw new HttpsError("internal", "Failed to create ticket order");

  const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(APP_BASE_URL, orderId);
  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        quantity,
        price_data: {
          currency: CHECKOUT_CURRENCY,
          unit_amount: unitAmountMinor,
          product_data: {
            name: ticketType.title,
            description: `Event: ${ticketType.event.title}`,
          },
        },
      },
    ],
    metadata: {
      firebaseUid: uid,
      ticketTypeId: ticketType.id,
      eventId: ticketType.event.id,
      orderId,
      orderIds: orderId,
    },
  });

  if (!session.url) throw new HttpsError("internal", "Failed to create Stripe Checkout session");
  return { url: session.url, orderId };
});

export const createEventBookingCheckoutSession = onCall({ region: FUNCTIONS_REGION, secrets: [stripeSecret] }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  const eventId = validateUUID(String(request.data?.eventId), "eventId") as UUIDString;

  const bookingsResult = await getBookingsForBookerAndEvent({ bookerId: uid, eventId });
  const booking = selectLatestActiveBooking(bookingsResult.data?.user?.bookings ?? []);
  if (!booking) {
    throw new HttpsError("failed-precondition", "No active booking found for this event");
  }

  const ordersResult = await getTicketOrdersForBookerAndEvent({ userId: uid, eventId });
  const eventTicketOrders = ordersResult.data?.user?.ticketOrders ?? [];
  const unpaidItems = computeUnpaidBookingCheckoutItems({
    booking,
    ticketOrders: eventTicketOrders,
  });
  if (unpaidItems.length === 0) {
    throw new HttpsError("failed-precondition", "All tickets for this booking are already paid");
  }

  const checkoutLines = planCheckoutOrderLines(unpaidItems, eventTicketOrders);
  const reusedOrderIds = checkoutLines.flatMap((line) => (line.existingOrderId ? [line.existingOrderId] : []));
  for (const staleOrderId of stalePendingOrderIds(eventTicketOrders, reusedOrderIds)) {
    await markTicketOrderFailedFromWebhook({
      id: staleOrderId as UUIDString,
      webhookEventId: `checkout-supersede:${staleOrderId}`,
    });
  }

  const stripeClient = requireStripe(stripeSecret.value());
  const customerId = await ensureStripeCustomerId({ uid, stripeClient });
  const createdOrderIds: UUIDString[] = [];
  const lineItems = [];

  for (const line of checkoutLines) {
    const ticketTypeId = validateUUID(line.ticketTypeId, "ticketTypeId") as UUIDString;
    const ttResult = await getTicketTypeForCheckout({ ticketTypeId });
    const ticketType = ttResult.data?.ticketType;
    if (!ticketType) {
      throw new HttpsError("not-found", `Ticket type not found: ${ticketTypeId}`);
    }
    if (!bookingIdsEqual(ticketType.event.id, eventId)) {
      throw new HttpsError("failed-precondition", "Ticket type does not belong to this event");
    }
    if (ticketType.audience !== TicketAudience.MEMBER && ticketType.audience !== TicketAudience.GUEST) {
      throw new HttpsError("failed-precondition", "Unsupported ticket audience for checkout");
    }
    await ensureTicketCheckoutEligibility({ uid, ticketType });

    let orderId = line.existingOrderId as UUIDString | null;
    if (!orderId) {
      const order = await createTicketOrderForCheckout({
        userId: uid,
        eventId,
        ticketTypeId,
        quantity: line.quantity,
        unitAmountMinor: line.unitAmountMinor,
        totalAmountMinor: line.unitAmountMinor * line.quantity,
        currency: CHECKOUT_CURRENCY,
      });
      orderId = (order.data?.ticketOrder_insert?.id as UUIDString | undefined) ?? null;
      if (!orderId) {
        throw new HttpsError("internal", "Failed to create ticket order");
      }
    }

    createdOrderIds.push(orderId);
    lineItems.push({
      quantity: line.quantity,
      price_data: {
        currency: CHECKOUT_CURRENCY,
        unit_amount: line.unitAmountMinor,
        product_data: {
          name: line.title,
          description: `Event: ${ticketType.event.title}`,
        },
      },
    });
  }

  const primaryOrderId = createdOrderIds[0]!;
  const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(APP_BASE_URL, primaryOrderId);
  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: lineItems,
    metadata: {
      firebaseUid: uid,
      eventId,
      orderId: primaryOrderId,
      orderIds: createdOrderIds.join(","),
    },
  });

  if (!session.url) throw new HttpsError("internal", "Failed to create Stripe Checkout session");
  return { url: session.url, orderIds: createdOrderIds };
});

async function fetchStripeArtifactsForOrder(args: {
  stripeClient: InstanceType<typeof Stripe>;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}): Promise<{ receiptUrl: string | null }> {
  let receiptUrl: string | null = null;
  let resolvedPaymentIntentId = args.stripePaymentIntentId ?? null;

  if (args.stripeCheckoutSessionId) {
    const session = (await args.stripeClient.checkout.sessions.retrieve(args.stripeCheckoutSessionId, {
      expand: ["invoice", "payment_intent.latest_charge"],
    })) as {
      payment_intent?: string | { id?: string; latest_charge?: string | { id?: string; receipt_url?: string | null } };
    };
    resolvedPaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? resolvedPaymentIntentId;
    const paymentIntent = session.payment_intent && typeof session.payment_intent !== "string" ? session.payment_intent : null;
    const latestCharge =
      paymentIntent?.latest_charge && typeof paymentIntent.latest_charge !== "string"
        ? paymentIntent.latest_charge
        : null;
    receiptUrl = latestCharge?.receipt_url ?? null;
  }

  if (!receiptUrl && resolvedPaymentIntentId) {
    const paymentIntent = (await args.stripeClient.paymentIntents.retrieve(resolvedPaymentIntentId, {
      expand: ["latest_charge"],
    })) as { latest_charge?: string | { id?: string; receipt_url?: string | null } };
    const latestCharge = paymentIntent.latest_charge;
    if (latestCharge && typeof latestCharge !== "string") {
      receiptUrl = latestCharge.receipt_url ?? null;
    } else if (typeof latestCharge === "string") {
      const charge = await args.stripeClient.charges.retrieve(latestCharge);
      receiptUrl = charge.receipt_url ?? null;
    }
  }

  // Fallback for older/edge payments where latest_charge is missing on PI.
  if (!receiptUrl && resolvedPaymentIntentId) {
    const charges = await args.stripeClient.charges.list({
      payment_intent: resolvedPaymentIntentId,
      limit: 1,
    });
    receiptUrl = charges.data[0]?.receipt_url ?? null;
  }

  return {
    receiptUrl,
  };
}

export const getMyTicketOrderStripeArtifactsBatch = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret] },
  async (request) => {
    requireEnabled(request);
    const uid = request.auth!.uid;
    const orderIds = Array.isArray(request.data?.orderIds)
      ? request.data.orderIds.map((id: unknown) => validateUUID(String(id), "orderId") as UUIDString)
      : [];
    if (orderIds.length === 0 || orderIds.length > 50) {
      throw new HttpsError("invalid-argument", "orderIds must contain between 1 and 50 ids");
    }
    const ordersById = new Map<
      UUIDString,
      Awaited<ReturnType<typeof getTicketOrderStripeArtifactsForCallable>>["data"]["ticketOrder"] | null
    >();
    for (const requestedOrderId of orderIds) {
      const one = await getTicketOrderStripeArtifactsForCallable({ id: requestedOrderId });
      const order = one.data?.ticketOrder ?? null;
      ordersById.set(requestedOrderId, order);
      if (!order) {
        continue;
      }
      if (order.user.id !== uid) {
        logger.warn("stripe artifact batch access denied: order ownership mismatch", {
          orderId: requestedOrderId,
          uid,
          orderUserId: order.user.id,
        });
        throw new HttpsError("permission-denied", "You can only view Stripe artifacts for your own orders");
      }
    }

    const stripeClient = requireStripe(stripeSecret.value());
    return {
      artifactsByOrderId: Object.fromEntries(
        await Promise.all(
          orderIds.map(async (orderId: UUIDString) => {
            const order = ordersById.get(orderId) ?? null;
            if (!order) {
              logger.info("stripe artifacts skipped: order missing from batch result", {
                orderId,
                uid,
              });
              return [
                orderId,
                {
                  receiptUrl: null,
                  hostedInvoiceUrl: null,
                  invoicePdfUrl: null,
                },
              ];
            }
            if (!order.stripePaymentIntentId && !order.stripeCheckoutSessionId) {
              return [
                orderId,
                {
                  receiptUrl: null,
                },
              ];
            }
            const artifacts = await fetchStripeArtifactsForOrder({
              stripeClient,
              stripeCheckoutSessionId: order.stripeCheckoutSessionId ?? null,
              stripePaymentIntentId: order.stripePaymentIntentId ?? null,
            });
            logger.info("stripe artifacts fetched", {
              orderId,
              uid,
              hasReceiptUrl: Boolean(artifacts.receiptUrl),
            });
            return [orderId, artifacts];
          })
        )
      ),
    };
  }
);

export const reconcileMyCheckoutSessionOrders = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret] },
  async (request) => {
    requireEnabled(request);
    const uid = request.auth!.uid;
    const orderId = validateUUID(String(request.data?.orderId), "orderId") as UUIDString;
    const result = await reconcilePaidCheckoutSessionOrders({
      uid,
      anchorOrderId: orderId,
      webhookEventId: `member-reconcile:${orderId}`,
    });
    return {
      appliedCount: result.appliedCount,
      reconciledOrderIds: result.reconciledOrderIds,
      orderIds: result.orderIds,
    };
  }
);

function webhookSecretCandidates(endpointName: "stripeWebhookPayments" | "stripeWebhook"): string[] {
  const payments = stripeWebhookPaymentsSecret.value();
  const legacy = stripeWebhookSecret.value();
  const candidates = endpointName === "stripeWebhookPayments" ? [payments, legacy] : [legacy, payments];
  return candidates.filter((value): value is string => Boolean(value));
}

async function handleStripeWebhookRequest(args: {
  domain: "payments";
  endpointName: "stripeWebhookPayments" | "stripeWebhook";
  req: { headers: Record<string, unknown>; rawBody: Buffer };
  res: { status: (code: number) => { send: (body: string) => void } };
}): Promise<void> {
  const { req, res, domain, endpointName } = args;
  try {
    const stripeClient = requireStripe(stripeSecret.value());
    const candidates = webhookSecretCandidates(endpointName);
    if (candidates.length === 0) {
      logger.error(`${endpointName} missing webhook secret`, {
        domain,
        expectedSecret: "STRIPE_WEBHOOK_SECRET_PAYMENTS or STRIPE_WEBHOOK_SECRET",
      });
      res.status(500).send("Webhook secret not configured");
      return;
    }
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      res.status(400).send("Missing stripe-signature");
      return;
    }

    let event: ReturnType<InstanceType<typeof Stripe>["webhooks"]["constructEvent"]> | null = null;
    let matchedSecretIndex = -1;
    let constructEventError: unknown = null;
    for (let i = 0; i < candidates.length; i += 1) {
      try {
        event = stripeClient.webhooks.constructEvent(req.rawBody, signature, candidates[i]);
        matchedSecretIndex = i;
        break;
      } catch (err) {
        constructEventError = err;
      }
    }
    if (!event) {
      throw constructEventError ?? new Error("Unable to verify webhook signature");
    }
    if (matchedSecretIndex > 0) {
      logger.warn(`${endpointName} verified with fallback webhook secret`, {
        domain,
        fallbackIndex: matchedSecretIndex,
      });
    }
    const supportedEventType = isSupportedStripeEventType(event.type);
    const routedDomain = classifyStripeWebhookDomain(event.type);
    if (routedDomain !== domain) {
      logger.info(`${endpointName} ignored out-of-domain event`, {
        eventType: event.type,
        eventId: event.id,
        domain,
        routedDomain,
      });
      res.status(200).send("Ignored out-of-domain event");
      return;
    }
    const stripeObjectId = stripeObjectIdFromEvent(event);
    const normalized = normalizeStripeEvent(event);
    const existingWebhookEvent = await getPaymentWebhookEventByStripeEventId({ stripeEventId: event.id });
    if ((existingWebhookEvent.data?.paymentWebhookEvents?.length ?? 0) > 0) {
      if (event.type === "checkout.session.completed" && normalized.orderIds?.length) {
        const paidContext = paidContextFromCheckoutSessionObject(
          event.data.object as { id?: string; payment_intent?: string | { id?: string } }
        );
        const duplicateOrderIds = normalized.orderIds.map((id) => validateUUID(id, "orderId") as UUIDString);
        const { appliedCount: duplicateAppliedCount } = await applyPaymentTransitionToOrders({
          orderIds: duplicateOrderIds,
          intent: "MARK_PAID",
          webhookEventId: `${event.id}:reconcile`,
          paidContext,
          recoverFailedCheckoutPayment: true,
          paymentIntentIdFromEvent: paidContext.stripePaymentIntentId,
        });
        logger.info(`${endpointName} duplicate delivery reconciliation`, {
          eventType: event.type,
          eventId: event.id,
          stripeObjectId,
          duplicateAppliedCount,
        });
      } else {
        logger.info(`${endpointName} duplicate delivery`, {
          eventType: event.type,
          eventId: event.id,
          stripeObjectId,
        });
      }
      res.status(200).send("Duplicate event");
      return;
    }

    if (normalized.kind === "ignore") {
      logger.info(`${endpointName} ignored event`, {
        eventType: event.type,
        eventId: event.id,
        supportedEventType,
        reason: normalized.reason,
      });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: normalized.reason,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("Ignored event");
      return;
    }
    if (!normalized.orderIds?.length) {
      logger.info(`${endpointName} missing order metadata`, { eventType: event.type, reason: normalized.reason, eventId: event.id });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "missing_order_metadata",
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("No order metadata");
      return;
    }

    const orderIds = (normalized.orderIds ?? []).map((id) => validateUUID(id, "orderId") as UUIDString);
    const canonicalOrderId = orderIds[0];
    const existing = await getTicketOrderForWebhook({ id: canonicalOrderId });
    const order = existing.data?.ticketOrder;
    if (!order) {
      logger.info(`${endpointName} order not found`, { eventType: event.type, eventId: event.id, orderId: canonicalOrderId });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "order_not_found",
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("Order not found");
      return;
    }

    if (normalized.kind === "dispute_side_state") {
      const dispute = event.data.object as {
        id?: string;
        status?: string;
        reason?: string;
        amount?: number;
      };
      const eventTimestamp = isoTimestampFromStripeEpochSeconds((event as { created?: unknown }).created);
      await upsertTicketOrderDisputeFromWebhook({
        id: canonicalOrderId,
        webhookEventId: event.id,
        stripeDisputeId: dispute.id ?? null,
        disputeStatus: dispute.status ?? normalized.disputeState ?? null,
        disputeReason: dispute.reason ?? null,
        disputeAmountMinor: typeof dispute.amount === "number" ? dispute.amount : null,
        disputeOpenedAt: normalized.disputeState === "DISPUTE_OPEN" ? eventTimestamp : null,
        disputeUpdatedAt: eventTimestamp,
        disputeClosedAt: normalized.disputeState === "DISPUTE_CLOSED" ? eventTimestamp : null,
      });
      logger.info(`${endpointName} dispute side-state (no order status change)`, {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
        disputeState: normalized.disputeState,
        disputeStripeStatus: dispute.status ?? null,
        disputeReason: dispute.reason ?? null,
      });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.PROCESSED,
        reason: `dispute_side_state:${normalized.disputeState ?? "UNKNOWN"}`,
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      await upsertReconciliationSnapshot({
        orderId: canonicalOrderId,
        snapshot: {
          status: order.status,
          totalAmountMinor: order.totalAmountMinor,
          refundedAmountMinor: order.refundedAmountMinor ?? null,
          stripePaymentIntentId: order.stripePaymentIntentId ?? null,
          disputeStatus: dispute.status ?? normalized.disputeState ?? null,
        },
        stripeEventId: event.id,
        fromDisputeWebhook: true,
      });
      void notifyPaymentOpsDisputeSideState({
        orderId: canonicalOrderId,
        stripeEventId: event.id,
        stripeEventType: event.type,
        disputeStripeStatus: dispute.status ?? "",
        disputeReason: dispute.reason ?? "",
        disputeLocalState: normalized.disputeState ?? "",
        stripeDisputeId: dispute.id ?? "",
        appBaseUrl: APP_BASE_URL,
      });
      res.status(200).send("Dispute side-state acknowledged");
      return;
    }

    const intent = normalized.intent;
    if (!intent) {
      logger.error(`${endpointName} payment transition without intent`, {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
      });
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.FAILED,
        reason: "missing_transition_intent",
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("Missing transition intent");
      return;
    }

    const paidContext =
      intent === "MARK_PAID"
        ? paidContextFromCheckoutSessionObject(
            event.data.object as { id?: string; payment_intent?: string | { id?: string } }
          )
        : undefined;
    const refundContext =
      intent === "MARK_REFUNDED"
        ? (() => {
            const charge = event.data.object as {
              id?: string;
              amount_refunded?: number;
              refunds?: { data?: Array<{ id?: string }> };
            };
            const latestRefundId = charge.refunds?.data?.[0]?.id ?? null;
            return {
              stripeRefundId: latestRefundId,
              refundedAmountMinor: typeof charge.amount_refunded === "number" ? charge.amount_refunded : null,
              refundedAt: isoTimestampFromStripeEpochSeconds((event as { created?: unknown }).created),
            };
          })()
        : undefined;

    const paymentIntentIdFromEvent =
      intent === "MARK_PAID"
        ? paidContext?.stripePaymentIntentId ?? null
        : null;
    const refundAmountFromEvent =
      intent === "MARK_REFUNDED"
        ? (() => {
            const charge = event.data.object as { amount_refunded?: number };
            return typeof charge.amount_refunded === "number" ? charge.amount_refunded : null;
          })()
        : null;

    const { appliedCount } = await applyPaymentTransitionToOrders({
      orderIds,
      intent,
      webhookEventId: event.id,
      paidContext,
      refundContext,
      recoverFailedCheckoutPayment: intent === "MARK_PAID" && event.type === "checkout.session.completed",
      paymentIntentIdFromEvent,
      refundAmountFromEvent,
    });

    if (appliedCount === 0) {
      await appendWebhookLedgerEvent({
        stripeEventId: event.id,
        eventType: event.type,
        outcome: PaymentWebhookEventOutcome.IGNORED,
        reason: "transition_noop_for_all_orders",
        ticketOrderId: canonicalOrderId,
        stripeObjectId,
        livemode: event.livemode,
      });
      res.status(200).send("No transitions applied");
      return;
    }

    await appendWebhookLedgerEvent({
      stripeEventId: event.id,
      eventType: event.type,
      outcome: PaymentWebhookEventOutcome.PROCESSED,
      reason: `transition_applied:${intent}:${appliedCount}_orders`,
      ticketOrderId: canonicalOrderId,
      stripeObjectId,
      livemode: event.livemode,
    });
    res.status(200).send("ok");
  } catch (err) {
    logger.error(`${endpointName} error`, err);
    res.status(400).send("Webhook error");
  }
}

export const stripeWebhookPayments = onRequest(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret, stripeWebhookPaymentsSecret, govNotifyApiKey] },
  async (req, res) => {
    await handleStripeWebhookRequest({ domain: "payments", endpointName: "stripeWebhookPayments", req, res });
  }
);

export const stripeWebhook = onRequest(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret, stripeWebhookPaymentsSecret, govNotifyApiKey] },
  async (req, res) => {
    logger.warn("stripeWebhook legacy endpoint invoked", {
      migrationTarget: "stripeWebhookPayments",
    });
    await handleStripeWebhookRequest({ domain: "payments", endpointName: "stripeWebhook", req, res });
  }
);
