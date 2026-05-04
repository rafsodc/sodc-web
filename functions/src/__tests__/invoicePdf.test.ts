import { describe, expect, it } from "vitest";
import { createInvoiceReference, generateInvoicePdf } from "../invoicePdf";

describe("invoicePdf", () => {
  it("creates deterministic invoice references", () => {
    const ref = createInvoiceReference("11111111-2222-3333-4444-555555555555", "2026-05-04T10:00:00.000Z");
    expect(ref).toBe("SODC-20260504-111111112222");
  });

  it("generates a non-empty pdf buffer", async () => {
    const buffer = await generateInvoicePdf({
      invoiceReference: "SODC-20260504-ABCDEF123456",
      issuedAtIso: "2026-05-04T10:00:00.000Z",
      orderId: "11111111-2222-3333-4444-555555555555",
      memberName: "Ada Lovelace",
      memberEmail: "ada@example.com",
      eventTitle: "Annual Dinner",
      ticketTypeTitle: "Member ticket",
      quantity: 2,
      unitAmountMinor: 2500,
      totalAmountMinor: 5000,
      currency: "gbp",
      status: "PAID",
      paidAtIso: "2026-05-04T10:00:00.000Z",
      refundedAtIso: null,
      refundedAmountMinor: null,
      disputeStatus: null,
      disputeReason: null,
      sellerName: "SODC",
      sellerAddressLines: ["Service Operations Department Club", "United Kingdom"],
    });
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
