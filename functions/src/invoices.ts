import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import type { UUIDString } from "@dataconnect/admin-generated";
import { getTicketOrderInvoiceForCallable } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, validateUUID } from "./helpers";
import { createInvoiceReference, generateInvoicePdf } from "./invoicePdf";

const SELLER_NAME = "SODC";
const SELLER_ADDRESS_LINES = [
  "Service Operations Department Club",
  "United Kingdom",
];

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
