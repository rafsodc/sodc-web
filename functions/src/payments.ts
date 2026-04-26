import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {
  createTicketOrderForCheckout,
  getSectionByIdForCallable,
  getTicketOrderForWebhook,
  getTicketTypeForCheckout,
  getUserForCheckout,
  getUserUserGroupsForAdmin,
  markTicketOrderFailedFromWebhook,
  markTicketOrderPaidFromWebhook,
  markTicketOrderRefundedFromWebhook,
  updateUserStripeCustomerId,
  TicketAudience,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { requireEnabled, validateUUID } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { userMatchesUserGroup, userHasBookerPurpose } from "./bookingRules";
import Stripe from "stripe";
import {
  evaluateTransition,
  isSupportedStripeEventType,
  mapIntentToTargetStatus,
  normalizeStripeEvent,
} from "./paymentStateMachine";

const stripeSecret = defineSecret("STRIPE_SECRET");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const CHECKOUT_CURRENCY = "gbp";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

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
  if (ticketType.audience !== TicketAudience.MEMBER) {
    throw new HttpsError("failed-precondition", "Only member tickets are supported in Checkout v1");
  }
  ensureBookingWindow(ticketType.event.bookingStartDateTime, ticketType.event.bookingEndDateTime);

  const section = await getSectionByIdForCallable({ id: ticketType.event.section.id as UUIDString });
  const sectionData = section.data?.section;
  if (!sectionData) throw new HttpsError("not-found", "Section not found");
  const userGroups = await getUserUserGroupsForAdmin({ userId: uid });
  const explicitGroupIds = new Set((userGroups.data?.user?.userGroups ?? []).map((x) => validateUUID(x.userGroup.id)));
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

  const stripeClient = requireStripe(stripeSecret.value());
  let customerId = user.stripeCustomerId ?? null;
  if (!customerId) {
    const created = await stripeClient.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      metadata: { firebaseUid: uid },
    });
    customerId = created.id;
    await updateUserStripeCustomerId({ userId: uid, stripeCustomerId: customerId });
  }

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

  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer: customerId ?? undefined,
    success_url: `${APP_BASE_URL}/?checkout=success&orderId=${orderId}`,
    cancel_url: `${APP_BASE_URL}/?checkout=cancel&orderId=${orderId}`,
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
    },
  });

  if (!session.url) throw new HttpsError("internal", "Failed to create Stripe Checkout session");
  return { url: session.url, orderId };
});

export const stripeWebhook = onRequest({ region: FUNCTIONS_REGION, secrets: [stripeSecret, stripeWebhookSecret] }, async (req, res) => {
  try {
    const stripeClient = requireStripe(stripeSecret.value());
    const webhookSecret = stripeWebhookSecret.value();
    if (!webhookSecret) {
      logger.error("Missing STRIPE_WEBHOOK_SECRET");
      res.status(500).send("Webhook secret not configured");
      return;
    }
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      res.status(400).send("Missing stripe-signature");
      return;
    }

    const event = stripeClient.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    const supportedEventType = isSupportedStripeEventType(event.type);
    const normalized = normalizeStripeEvent(event);
    if (normalized.kind === "ignore") {
      logger.info("stripeWebhook ignored event", {
        eventType: event.type,
        eventId: event.id,
        supportedEventType,
        reason: normalized.reason,
      });
      res.status(200).send("Ignored event");
      return;
    }
    if (!normalized.orderId) {
      logger.info("stripeWebhook missing order metadata", { eventType: event.type, reason: normalized.reason, eventId: event.id });
      res.status(200).send("No order metadata");
      return;
    }

    const canonicalOrderId = validateUUID(normalized.orderId, "orderId") as UUIDString;
    const existing = await getTicketOrderForWebhook({ id: canonicalOrderId });
    const order = existing.data?.ticketOrder;
    if (!order) {
      logger.info("stripeWebhook order not found", { eventType: event.type, eventId: event.id, orderId: canonicalOrderId });
      res.status(200).send("Order not found");
      return;
    }

    if (normalized.kind === "dispute_side_state") {
      logger.info("stripeWebhook dispute side-state (no order status change)", {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
        disputeState: normalized.disputeState,
      });
      res.status(200).send("Dispute side-state acknowledged");
      return;
    }

    const intent = normalized.intent;
    if (!intent) {
      logger.error("stripeWebhook payment transition without intent", {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
      });
      res.status(200).send("Missing transition intent");
      return;
    }
    const targetStatus = mapIntentToTargetStatus(intent);
    const decision = evaluateTransition(order.status, intent);
    if (decision.action !== "apply") {
      logger.info("stripeWebhook transition skipped", {
        eventType: event.type,
        eventId: event.id,
        orderId: canonicalOrderId,
        fromStatus: order.status,
        targetStatus,
        decision: decision.action,
        reason: decision.reason,
      });
      res.status(200).send(decision.action === "noop_replay" ? "Already processed" : "Illegal transition skipped");
      return;
    }

    if (intent === "MARK_PAID") {
      const session = event.data.object as {
        id?: string;
        payment_intent?: string | { id?: string };
      };
      await markTicketOrderPaidFromWebhook({
        id: canonicalOrderId,
        stripeCheckoutSessionId: session.id ?? null,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
        webhookEventId: event.id,
      });
    } else if (intent === "MARK_FAILED") {
      await markTicketOrderFailedFromWebhook({
        id: canonicalOrderId,
        webhookEventId: event.id,
      });
    } else if (intent === "MARK_REFUNDED") {
      await markTicketOrderRefundedFromWebhook({
        id: canonicalOrderId,
        webhookEventId: event.id,
      });
    }
    res.status(200).send("ok");
  } catch (err) {
    logger.error("stripeWebhook error", err);
    res.status(400).send("Webhook error");
  }
});
