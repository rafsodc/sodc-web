import { onCall } from "firebase-functions/v2/https";
import type { UUIDString } from "@dataconnect/admin-generated";
import { requireEnabled, validateUUID } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";
import { stripeSecret } from "./paymentConfig";
import { reconcilePaidCheckoutSessionOrders } from "./paymentReconciliationService";

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
