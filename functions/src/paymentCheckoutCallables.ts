import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  getBookingsForBookerAndEvent,
  getSectionByIdForCallable,
  getTicketOrdersForBookerAndEvent,
  getTicketTypeForCheckout,
  getUserForCheckout,
  getUserUserGroupsForAdmin,
  markTicketOrderFailedFromWebhook,
  updateUserStripeCustomerId,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { requireEnabled, validateUUID } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { FUNCTIONS_REGION } from "./constants";
import {
  getBookingWindowState,
  userMatchesUserGroup,
  userHasBookerPurpose,
  userHasModeratorPurpose,
} from "./bookingRules";
import {
  bookingIdsEqual,
  bookingIsFullyPaid,
  computeUnpaidBookingCheckoutItems,
  planBookingAllocationRefunds,
  planCheckoutOrderLines,
  selectLatestPaymentEligibleBooking,
  stalePendingOrderIds,
} from "./bookingCheckout";
import { hydrateBookingsWithTicketOrders } from "./bookingQueryHydration";
import { APP_BASE_URL, requireStripe, stripeSecret } from "./paymentConfig";
import { createAllocatedTicketOrder } from "./bookingPaymentPersistence";
import { confirmBookingIfFullyPaid } from "./bookingPaymentFinalization";
import { initiateBookingAllocationRefunds } from "./bookingRefundOrchestration";

const CHECKOUT_CURRENCY = "gbp";

export function bookingCheckoutIdempotencyKey(bookingId: string, orderIds: string[]): string {
  const digest = createHash("sha256")
    .update(`${bookingId}:${[...orderIds].sort().join(",")}`)
    .digest("hex");
  return `booking-checkout:${digest}`;
}

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

async function ensureTicketCheckoutEligibility(args: {
  uid: string;
  ticketType: NonNullable<Awaited<ReturnType<typeof getTicketTypeForCheckout>>["data"]["ticketType"]>;
}): Promise<{ membershipStatus: string; explicitGroupIds: Set<string> }> {
  const { uid, ticketType } = args;
  const section = await getSectionByIdForCallable({ id: ticketType.event.section.id as UUIDString });
  const sectionData = section.data?.section;
  if (!sectionData) throw new HttpsError("not-found", "Section not found");
  const userGroups = await getUserUserGroupsForAdmin({ userId: uid });
  const explicitGroupIds = new Set((userGroups.data?.user?.userGroups ?? []).map((x) => validateUUID(x.userGroup.id)));
  const dcUser = await getUserForCheckout({ userId: uid });
  const user = dcUser.data?.user;
  if (!user) throw new HttpsError("failed-precondition", "User profile is required");
  const membershipStatus = user.membershipStatus;
  const purposeLinks = (sectionData.purposeLinks ?? []).map((l) => ({
    purposes: l.purposes ?? [],
    userGroup: { id: validateUUID(l.userGroup.id), membershipStatuses: l.userGroup.membershipStatuses ?? null },
  }));
  if (
    !userHasBookerPurpose(
      purposeLinks,
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
  const bookingWindowState = getBookingWindowState(
    ticketType.event.bookingStartDateTime,
    ticketType.event.bookingEndDateTime
  );
  const moderatorEarlyCheckout =
    bookingWindowState === "BEFORE" &&
    userHasModeratorPurpose(purposeLinks, explicitGroupIds, membershipStatus);
  if (
    bookingWindowState === "INVALID" ||
    (bookingWindowState === "BEFORE" && !moderatorEarlyCheckout)
  ) {
    throw new HttpsError("failed-precondition", "Ticket sales are not open for this event");
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
  throw new HttpsError(
    "failed-precondition",
    "Direct ticket checkout is no longer supported; submit the event booking before payment"
  );
});

export const createEventBookingCheckoutSession = onCall({ region: FUNCTIONS_REGION, secrets: [stripeSecret] }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  await enforceRateLimit("createEventBookingCheckoutSession", uid);
  const eventId = validateUUID(String(request.data?.eventId), "eventId") as UUIDString;

  const bookingsResult = await getBookingsForBookerAndEvent({ bookerId: uid, eventId });
  let hydratedBookings = hydrateBookingsWithTicketOrders(bookingsResult.data);
  const initialBooking = selectLatestPaymentEligibleBooking(hydratedBookings);
  if (!initialBooking) {
    throw new HttpsError(
      "failed-precondition",
      "This booking must be approved before payment can begin"
    );
  }
  let booking = initialBooking;
  let bookingHistory = hydratedBookings.filter((row) => bookingIdsEqual(row.revisionGroupId, booking.revisionGroupId));
  let stripeClient: InstanceType<typeof Stripe> | null = null;
  const refundDue = planBookingAllocationRefunds(booking, bookingHistory);
  if (refundDue.length > 0) {
    stripeClient = requireStripe(stripeSecret.value());
    const refundResult = await initiateBookingAllocationRefunds({
      booking,
      financialHistory: bookingHistory,
      stripeClient,
    });
    if (refundResult.failedAmountMinor > 0) {
      throw new HttpsError("internal", "The refund could not be completed; it remains visible for recovery");
    }
    const refreshed = await getBookingsForBookerAndEvent({ bookerId: uid, eventId });
    hydratedBookings = hydrateBookingsWithTicketOrders(refreshed.data);
    const refreshedBooking = selectLatestPaymentEligibleBooking(hydratedBookings);
    if (!refreshedBooking) {
      throw new HttpsError("failed-precondition", "The payable booking changed while applying its refund");
    }
    booking = refreshedBooking;
    bookingHistory = hydratedBookings.filter((row) => bookingIdsEqual(row.revisionGroupId, booking.revisionGroupId));
  }

  const ordersResult = await getTicketOrdersForBookerAndEvent({ userId: uid, eventId });
  const bookingPlaceIds = new Set(
    bookingHistory.flatMap((row) =>
      row.lines.map((line) => line.bookingPlace.id.replace(/-/g, "").toLowerCase())
    )
  );
  // A member can have an older cancelled booking and a newer booking for the
  // same event. Never reuse or expire the other revision group's checkout.
  const eventTicketOrders = (ordersResult.data?.user?.ticketOrders ?? []).filter((order) =>
    order.paymentAllocations.some((allocation) =>
      bookingPlaceIds.has(allocation.bookingPlace.id.replace(/-/g, "").toLowerCase())
    )
  );
  const unpaidItems = computeUnpaidBookingCheckoutItems(booking, bookingHistory);
  if (unpaidItems.length === 0) {
    if (bookingIsFullyPaid(booking, bookingHistory)) {
      await confirmBookingIfFullyPaid({ bookerId: uid, eventId });
      return { url: null, orderIds: [], confirmed: true };
    }
    throw new HttpsError("failed-precondition", "All tickets for this booking are already paid");
  }

  const checkoutLines = planCheckoutOrderLines(unpaidItems, eventTicketOrders);
  const reusedOrderIds = checkoutLines.flatMap((line) => (line.existingOrderId ? [line.existingOrderId] : []));
  for (const staleOrderId of stalePendingOrderIds(eventTicketOrders, reusedOrderIds)) {
    const staleOrder = eventTicketOrders.find((order) => bookingIdsEqual(order.id, staleOrderId));
    if (staleOrder?.stripeCheckoutSessionId) {
      stripeClient ??= requireStripe(stripeSecret.value());
      const staleSession = await stripeClient.checkout.sessions.retrieve(staleOrder.stripeCheckoutSessionId);
      if (staleSession.status === "open") {
        await stripeClient.checkout.sessions.expire(staleSession.id);
      } else if (staleSession.status === "complete") {
        throw new HttpsError(
          "aborted",
          "A previous payment completed while this booking was changing. Refresh before paying again."
        );
      }
    }
    await markTicketOrderFailedFromWebhook({
      id: staleOrderId as UUIDString,
      webhookEventId: `checkout-supersede:${staleOrderId}`,
    });
  }

  const checkoutOrderIds: UUIDString[] = [];
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
    const payingOrganiserAmendment = (booking.adjustments ?? []).some(
      (adjustment) => adjustment.status === "PENDING_AUTO_CHARGE" && adjustment.deltaAmountMinor > 0
    );
    if (!payingOrganiserAmendment) {
      await ensureTicketCheckoutEligibility({ uid, ticketType });
    }

    if (line.unitAmountMinor === 0) {
      await createAllocatedTicketOrder({
        userId: uid,
        eventId,
        ticketTypeId,
        unitAmountMinor: 0,
        bookingPlaceIds: line.bookingPlaceIds.map((id) => validateUUID(id) as UUIDString),
        status: TicketOrderStatus.PAID,
        webhookEventId: `free-checkout:${booking.id}`,
      });
      continue;
    }

    let orderId = line.existingOrderId as UUIDString | null;
    if (!orderId) {
      orderId = await createAllocatedTicketOrder({
        userId: uid,
        eventId,
        ticketTypeId,
        unitAmountMinor: line.unitAmountMinor,
        bookingPlaceIds: line.bookingPlaceIds.map((id) => validateUUID(id) as UUIDString),
      });
    }

    checkoutOrderIds.push(orderId);
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

  if (checkoutOrderIds.length === 0) {
    const confirmation = await confirmBookingIfFullyPaid({ bookerId: uid, eventId });
    return { url: null, orderIds: [], confirmed: confirmation.confirmed };
  }

  stripeClient ??= requireStripe(stripeSecret.value());
  const customerId = await ensureStripeCustomerId({ uid, stripeClient });
  const primaryOrderId = checkoutOrderIds[0]!;
  const { successUrl, cancelUrl } = buildStripeCheckoutReturnUrls(APP_BASE_URL, primaryOrderId);
  const session = await stripeClient.checkout.sessions.create(
    {
      mode: "payment",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      metadata: {
        firebaseUid: uid,
        eventId,
        orderId: primaryOrderId,
        orderIds: checkoutOrderIds.join(","),
      },
      payment_intent_data: {
        metadata: {
          firebaseUid: uid,
          eventId,
          orderId: primaryOrderId,
          orderIds: checkoutOrderIds.join(","),
        },
      },
    },
    { idempotencyKey: bookingCheckoutIdempotencyKey(booking.id, checkoutOrderIds) }
  );

  if (!session.url) throw new HttpsError("internal", "Failed to create Stripe Checkout session");
  return { url: session.url, orderIds: checkoutOrderIds, confirmed: false };
});
