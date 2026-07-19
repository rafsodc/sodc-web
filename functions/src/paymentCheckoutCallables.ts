import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  createTicketOrderForCheckout,
  getBookingsForBookerAndEvent,
  getSectionByIdForCallable,
  getTicketOrdersForBookerAndEvent,
  getTicketTypeForCheckout,
  getUserForCheckout,
  getUserUserGroupsForAdmin,
  markTicketOrderFailedFromWebhook,
  updateUserStripeCustomerId,
  TicketAudience,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import Stripe from "stripe";
import { requireEnabled, validateUUID } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { FUNCTIONS_REGION } from "./constants";
import { userMatchesUserGroup, userHasBookerPurpose } from "./bookingRules";
import {
  bookingIdsEqual,
  computeUnpaidBookingCheckoutItems,
  planCheckoutOrderLines,
  selectLatestActiveBooking,
  stalePendingOrderIds,
} from "./bookingCheckout";
import { APP_BASE_URL, requireStripe, stripeSecret } from "./paymentConfig";

const CHECKOUT_CURRENCY = "gbp";

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

export const createTicketCheckoutSession = onCall({ region: FUNCTIONS_REGION, secrets: [stripeSecret] }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  await enforceRateLimit("createTicketCheckoutSession", uid);
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
  await enforceRateLimit("createEventBookingCheckoutSession", uid);
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
