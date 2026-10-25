import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const operations = fs.readFileSync(path.resolve(process.cwd(), "..", "dataconnect/api/admin-mutations.gql"), "utf8");
function operation(name: string): string {
  const start = operations.search(new RegExp(`(?:query|mutation) ${name}\\(`));
  expect(start).toBeGreaterThanOrEqual(0);
  return operations.slice(start, operations.indexOf("\n}", start) + 2);
}

describe("additive recovery quarantine connector contracts", () => {
  it.each([
    ["ListFailedNotificationDeliveriesForRecovery", "1aa852fff60c0468365dc4ffe521d7d5067ef1a222be4ece46ed8cc4c466882d"],
    ["ListStalePendingNotificationDeliveriesForRecovery", "2d1a759242442fa8491f6fe609a19e94da18b43bd605ced1523bf9588edf68d7"],
    ["ClaimNotificationDeliveryById", "26fa3390604ead3743c647c140dc2eb8aa0d03eb8574475e689806951e95a26b"],
    ["RecordNotificationRecoveryFailureById", "8a3f12fafd1dce81f6c52081eef27dd65c8dc5943903b1ab8b14ebbf0a39dda3"],
  ])("retains deployed operation %s unchanged", (name, hash) => {
    expect(createHash("sha256").update(operation(name)).digest("hex")).toBe(hash);
  });

  it.each(["ListFailedNotificationDeliveriesForAutomaticRecovery", "ListStalePendingNotificationDeliveriesForAutomaticRecovery"])("uses database time and excludes quarantine in %s", (name) => {
    const block = operation(name);
    for (const value of ["@auth(level: NO_ACCESS)", "recoveryDeferredAt: { isNull: true }", "le_time: { now: true", "attemptCount: { ge: 0, lt: 6 }", "orderBy: [{ lastAttemptedAt: ASC }, { id: ASC }]"]) expect(block).toContain(value);
    expect(block).not.toContain("$attemptedBefore");
  });

  it("marks quarantine without changing attempt, identity or delivery history", () => {
    const block = operation("MarkNotificationRecoveryDeferredForClaimById");
    expect(block).toContain("recoveryDeferredAt: { isNull: true }");
    expect(block).toContain("expectedRecipientUserId");
    const data = block.slice(block.indexOf("    data: {"));
    expect(data).toContain("recoveryDeferredAt_expr: \"request.time\"");
    expect(data).toContain("recoveryDeferredReason: $deferredReason");
    for (const field of ["status:", "attemptCount", "lastAttemptedAt:", "deliveryKey:", "recoveryPayload:", "deliveryMode:", "recipientUserId:"]) expect(data).not.toContain(field);
  });

  it("releases only the exact reviewed marker/subjects and fills no contradictory known mode", () => {
    const block = operation("ReleaseNotificationRecoveryDeferralForClaimById");
    for (const value of ["recoveryDeferredAt: { eq: $expectedDeferredAt }", "recoveryDeferredReason: { eq: $expectedDeferredReason }",
      "bookingId: { eq: $expectedBookingId, isNull: $expectedBookingIdIsNull }", "userId: { eq: $expectedUserId, isNull: $expectedUserIdIsNull }",
      "recipientUserId: { eq: $expectedRecipientUserId, isNull: $expectedRecipientUserIdIsNull }", "deliveryMode: { isNull: true }", "deliveryMode: { eq: $verifiedDeliveryMode }"]) expect(block).toContain(value);
    const data = block.slice(block.indexOf("    data: {"));
    expect(data).toContain("recoveryDeferredAt: null"); expect(data).toContain("deliveryMode: $verifiedDeliveryMode");
    for (const field of ["status:", "attemptCount", "lastAttemptedAt:", "deliveryKey:", "recoveryPayload:", "recipientUserId:", "recoveryDeferredReason:"]) expect(data).not.toContain(field);
  });
});


it("keeps delivery-ID lookup server-only, exact and projection-compatible with key lookup", () => {
  const byId = operation("GetNotificationDeliveryById");
  const byKey = operation("GetNotificationDeliveryByChannelAndKey");
  expect(byId).toContain("$id: UUID!");
  expect(byId).toContain("@auth(level: NO_ACCESS)");
  expect(byId).toContain("where: { id: { eq: $id } }");
  expect(byId).toContain("limit: 1");
  expect(byId.slice(byId.indexOf("  ) {"))).toBe(byKey.slice(byKey.indexOf("  ) {")));
  expect(byId).not.toContain("$channel"); expect(byId).not.toContain("$deliveryKey");
});
