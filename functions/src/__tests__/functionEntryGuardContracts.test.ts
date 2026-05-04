import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSource(fileName: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "src", fileName), "utf8");
}

function assertOnCallGuard(source: string, functionName: string, guardCall: string): void {
  const exportIdx = source.indexOf(`export const ${functionName} = onCall`);
  expect(exportIdx).toBeGreaterThanOrEqual(0);
  const guardIdx = source.indexOf(guardCall, exportIdx);
  expect(guardIdx).toBeGreaterThan(exportIdx);
  expect(guardIdx - exportIdx).toBeLessThan(400);
}

describe("function entry guard contracts", () => {
  it("enforces expected auth guards on callable entry points", () => {
    const admin = readSource("admin.ts");
    assertOnCallGuard(admin, "grantAdmin", "requireAdmin(request);");
    assertOnCallGuard(admin, "revokeAdmin", "requireAdmin(request);");
    assertOnCallGuard(admin, "listAdminUsers", "requireAdmin(request);");

    const users = readSource("users.ts");
    assertOnCallGuard(users, "updateDisplayName", "requireAuth(request);");
    assertOnCallGuard(users, "updateUserDisplayName", "requireAdmin(request);");
    assertOnCallGuard(users, "searchUsers", "requireAdmin(request);");

    const membership = readSource("membershipStatus.ts");
    assertOnCallGuard(membership, "updateMembershipStatus", "requireAuth(request);");

    const sections = readSource("sections.ts");
    assertOnCallGuard(sections, "getSectionMembersMerged", "requireAuth(request);");

    const bookings = readSource("bookings.ts");
    assertOnCallGuard(bookings, "submitEventBooking", "requireEnabled(request);");

    const payments = readSource("payments.ts");
    assertOnCallGuard(payments, "createTicketCheckoutSession", "requireEnabled(request);");
    assertOnCallGuard(payments, "getMyTicketOrderStripeArtifacts", "requireEnabled(request);");
  });

  it("keeps Stripe webhook signature verification in place", () => {
    const payments = readSource("payments.ts");
    expect(payments).toContain("stripe-signature");
    expect(payments).toContain("constructEvent(req.rawBody, signature, webhookSecret)");
    expect(payments).toContain("getPaymentWebhookEventByStripeEventId");
    expect(payments).toContain("createPaymentWebhookEvent");
    expect(payments).toContain("emitPaymentLifecycleNotification");
  });
});
