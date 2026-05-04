import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import type { UUIDString } from "@dataconnect/admin-generated";
import { getTicketOrderInvoiceForCallable } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, validateUUID } from "./helpers";
import { createInvoiceReference, generateInvoicePdf } from "./invoicePdf";
import Stripe from "stripe";

const SELLER_NAME = "SODC";
const SELLER_ADDRESS_LINES = [
  "Service Operations Department Club",
  "United Kingdom",
];
const stripeSecret = defineSecret("STRIPE_SECRET");

function requireStripe(secretValue: string | undefined): InstanceType<typeof Stripe> {
  if (!secretValue) {
    throw new HttpsError("failed-precondition", "Stripe is not configured on the server");
  }
  return new Stripe(secretValue);
}

export const getMyTicketOrderInvoice = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  const orderId = validateUUID(String(request.data?.orderId ?? ""), "orderId") as UUIDString;

  const result = await getTicketOrderInvoiceForCallable({ id: orderId });
  const order = result.data?.ticketOrder;
  if (!order) {
    throw new HttpsError("not-found", "Ticket order not found");
  }
  if (order.user.id !== uid) {
    logger.warn("invoice download denied: order ownership mismatch", {
      orderId,
      uid,
      orderUserId: order.user.id,
    });
    throw new HttpsError("permission-denied", "You can only download invoices for your own orders");
  }

  const issuedAtIso = new Date().toISOString();
  const invoiceReference = createInvoiceReference(order.id, issuedAtIso);
  const paidAtIso = order.status === "PAID" ? order.updatedAt : null;
  try {
    const pdfBuffer = await generateInvoicePdf({
      invoiceReference,
      issuedAtIso,
      orderId: order.id,
      memberName: `${order.user.firstName} ${order.user.lastName}`.trim(),
      memberEmail: order.user.email,
      eventTitle: order.event.title,
      ticketTypeTitle: order.ticketType.title,
      quantity: order.quantity,
      unitAmountMinor: order.unitAmountMinor,
      totalAmountMinor: order.totalAmountMinor,
      currency: order.currency,
      status: order.status,
      paidAtIso,
      refundedAtIso: order.refundedAt ?? null,
      refundedAmountMinor: order.refundedAmountMinor ?? null,
      disputeStatus: order.disputeStatus ?? null,
      disputeReason: order.disputeReason ?? null,
      sellerName: SELLER_NAME,
      sellerAddressLines: SELLER_ADDRESS_LINES,
    });

    const fileName = `${invoiceReference}.pdf`;
    logger.info("invoice generated", {
      orderId,
      uid,
      invoiceReference,
      byteLength: pdfBuffer.length,
    });
    return {
      invoiceReference,
      fileName,
      mimeType: "application/pdf",
      contentBase64: pdfBuffer.toString("base64"),
      generatedAt: issuedAtIso,
    };
  } catch (error) {
    logger.error("invoice generation failed", {
      orderId,
      uid,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new HttpsError("internal", "Failed to generate invoice");
  }
});

export const getMyTicketOrderStripeArtifacts = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret] },
  async (request) => {
    requireEnabled(request);
    const uid = request.auth!.uid;
    const orderId = validateUUID(String(request.data?.orderId ?? ""), "orderId") as UUIDString;
    const result = await getTicketOrderInvoiceForCallable({ id: orderId });
    const order = result.data?.ticketOrder;
    if (!order) {
      throw new HttpsError("not-found", "Ticket order not found");
    }
    if (order.user.id !== uid) {
      logger.warn("stripe artifact access denied: order ownership mismatch", {
        orderId,
        uid,
        orderUserId: order.user.id,
      });
      throw new HttpsError("permission-denied", "You can only view Stripe artifacts for your own orders");
    }
    if (!order.stripePaymentIntentId) {
      return {
        receiptUrl: null,
        hostedInvoiceUrl: null,
        invoicePdfUrl: null,
      };
    }

    const stripeClient = requireStripe(stripeSecret.value());
    let receiptUrl: string | null = null;
    let hostedInvoiceUrl: string | null = null;
    let invoicePdfUrl: string | null = null;

    if (order.stripeCheckoutSessionId) {
      const session = (await stripeClient.checkout.sessions.retrieve(order.stripeCheckoutSessionId, {
        expand: ["invoice", "payment_intent.latest_charge"],
      })) as {
        invoice?: string | { hosted_invoice_url?: string | null; invoice_pdf?: string | null };
        payment_intent?: string | { latest_charge?: string | { receipt_url?: string | null } };
      };
      const invoice = session.invoice && typeof session.invoice !== "string" ? session.invoice : null;
      hostedInvoiceUrl = invoice?.hosted_invoice_url ?? null;
      invoicePdfUrl = invoice?.invoice_pdf ?? null;
      const paymentIntent =
        session.payment_intent && typeof session.payment_intent !== "string" ? session.payment_intent : null;
      const latestCharge =
        paymentIntent?.latest_charge && typeof paymentIntent.latest_charge !== "string"
          ? paymentIntent.latest_charge
          : null;
      receiptUrl = latestCharge?.receipt_url ?? null;
    }

    if (!receiptUrl) {
      const paymentIntent = (await stripeClient.paymentIntents.retrieve(order.stripePaymentIntentId, {
        expand: ["latest_charge"],
      })) as { latest_charge?: string | { receipt_url?: string | null } };
      const latestCharge =
        paymentIntent.latest_charge && typeof paymentIntent.latest_charge !== "string"
          ? paymentIntent.latest_charge
          : null;
      receiptUrl = latestCharge?.receipt_url ?? null;
    }

    logger.info("stripe artifacts fetched", {
      orderId,
      uid,
      hasReceiptUrl: Boolean(receiptUrl),
      hasHostedInvoiceUrl: Boolean(hostedInvoiceUrl),
      hasInvoicePdfUrl: Boolean(invoicePdfUrl),
    });
    return {
      receiptUrl,
      hostedInvoiceUrl,
      invoicePdfUrl,
    };
  }
);
