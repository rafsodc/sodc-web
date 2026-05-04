import PDFDocument from "pdfkit";

export interface TicketOrderInvoiceData {
  invoiceReference: string;
  issuedAtIso: string;
  orderId: string;
  memberName: string;
  memberEmail: string;
  eventTitle: string;
  ticketTypeTitle: string;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  currency: string;
  status: string;
  paidAtIso: string | null;
  refundedAtIso: string | null;
  refundedAmountMinor: number | null;
  disputeStatus: string | null;
  disputeReason: string | null;
  sellerName: string;
  sellerAddressLines: string[];
}

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function addKeyValue(doc: PDFKit.PDFDocument, key: string, value: string): void {
  doc.font("Helvetica-Bold").text(`${key}:`, { continued: true });
  doc.font("Helvetica").text(` ${value}`);
}

export function createInvoiceReference(orderId: string, issuedAtIso: string): string {
  const compactDate = issuedAtIso.slice(0, 10).replace(/-/g, "");
  const shortOrder = orderId.replace(/-/g, "").slice(0, 12).toUpperCase();
  return `SODC-${compactDate}-${shortOrder}`;
}

export async function generateInvoicePdf(data: TicketOrderInvoiceData): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(18).font("Helvetica-Bold").text("Invoice");
    doc.moveDown(0.5);
    addKeyValue(doc, "Invoice reference", data.invoiceReference);
    addKeyValue(doc, "Issued", new Date(data.issuedAtIso).toLocaleString("en-GB"));
    addKeyValue(doc, "Order ID", data.orderId);
    doc.moveDown();

    doc.fontSize(13).font("Helvetica-Bold").text("Bill to");
    doc.fontSize(11).font("Helvetica").text(data.memberName);
    doc.text(data.memberEmail);
    doc.moveDown();

    doc.fontSize(13).font("Helvetica-Bold").text("Seller");
    doc.fontSize(11).font("Helvetica").text(data.sellerName);
    for (const line of data.sellerAddressLines) {
      doc.text(line);
    }
    doc.moveDown();

    doc.fontSize(13).font("Helvetica-Bold").text("Event and ticket");
    doc.fontSize(11).font("Helvetica");
    addKeyValue(doc, "Event", data.eventTitle);
    addKeyValue(doc, "Ticket type", data.ticketTypeTitle);
    addKeyValue(doc, "Quantity", String(data.quantity));
    addKeyValue(doc, "Unit price", money(data.unitAmountMinor, data.currency));
    addKeyValue(doc, "Total", money(data.totalAmountMinor, data.currency));
    doc.moveDown();

    doc.fontSize(13).font("Helvetica-Bold").text("Payment lifecycle");
    doc.fontSize(11).font("Helvetica");
    addKeyValue(doc, "Status", data.status);
    if (data.paidAtIso) {
      addKeyValue(doc, "Paid at", new Date(data.paidAtIso).toLocaleString("en-GB"));
    }
    if (data.refundedAtIso) {
      addKeyValue(doc, "Refunded at", new Date(data.refundedAtIso).toLocaleString("en-GB"));
    }
    if (data.refundedAmountMinor !== null) {
      addKeyValue(doc, "Refunded amount", money(data.refundedAmountMinor, data.currency));
    }
    if (data.disputeStatus) {
      addKeyValue(doc, "Dispute status", data.disputeStatus);
      if (data.disputeReason) {
        addKeyValue(doc, "Dispute reason", data.disputeReason);
      }
    }

    doc.moveDown();
    doc.fontSize(9).fillColor("gray").text("Generated on demand by SODC payments service.");
    doc.end();
  });
}
