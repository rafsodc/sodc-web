import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "..", relativePath), "utf8");
}

describe("Notify callback persistence contracts", () => {
  it("uses the provider receipt ID as the durable ledger key with recoverable processing state", () => {
    const schema = read("dataconnect/schema/schema.gql");
    const receiptTable = schema.slice(
      schema.indexOf("type NotifyDeliveryReceipt @table"),
      schema.indexOf("type BookingPaymentAdjustment @table")
    );

    expect(receiptTable).toContain("id: String!");
    expect(receiptTable).toContain("processingStatus: NotifyDeliveryReceiptProcessingStatus!");
    expect(receiptTable).toContain("attemptCount: Int!");
    expect(receiptTable).toContain("lastAttemptedAt: Timestamp!");
    expect(receiptTable).toContain("eventOrderingKey: String!");
  });

  it("claims and finalizes receipts with compare-and-swap predicates", () => {
    const operations = read("dataconnect/api/admin-mutations.gql");
    for (const operationName of [
      "ClaimNotifyDeliveryReceipt",
      "MarkNotifyDeliveryReceiptProcessed",
      "MarkNotifyDeliveryReceiptFailed",
    ]) {
      const start = operations.indexOf(`mutation ${operationName}`);
      expect(start, `${operationName} must exist`).toBeGreaterThanOrEqual(0);
      const nextOperation = operations.indexOf("\nmutation ", start + 1);
      const block = operations.slice(start, nextOperation >= 0 ? nextOperation : operations.length);
      expect(block).toContain("notifyDeliveryReceipt_updateMany");
      expect(block).toContain("attemptCount: { eq:");
      expect(block).toContain("processingStatus: { eq:");
    }
  });

  it("protects user and announcement state with versioned compare-and-swap updates", () => {
    const schema = read("dataconnect/schema/schema.gql");
    const operations = read("dataconnect/api/admin-mutations.gql");

    expect(schema).toContain("emailDeliveryVersion: Int! @default(value: 0)");
    expect(schema).toContain("deliveryVersion: Int! @default(value: 0)");
    expect(operations).toContain("emailDeliveryVersion: { eq: $expectedEmailDeliveryVersion }");
    expect(operations).toContain("deliveryVersion: { eq: $expectedDeliveryVersion }");
    expect(operations).toContain("orderBy: { eventOrderingKey: DESC }");
  });
});
