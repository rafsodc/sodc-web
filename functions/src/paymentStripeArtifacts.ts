import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getTicketOrderStripeArtifactsForCallable } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { requireEnabled, validateUUID } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { requireStripe, stripeSecret, type StripeClient } from "./paymentConfig";
import { enforceRateLimit } from "./rateLimiter";

export async function fetchStripeArtifactsForOrder(args: {
  stripeClient: StripeClient;
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
    await enforceRateLimit("getMyTicketOrderStripeArtifactsBatch", uid);
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
