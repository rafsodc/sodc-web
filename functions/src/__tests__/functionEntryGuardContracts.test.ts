import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSource(fileName: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "src", fileName), "utf8");
}

function assertOnCallGuard(source: string, functionName: string, guardCall: string, maxDistance = 400): void {
  const exportIdx = source.indexOf(`export const ${functionName} = onCall`);
  expect(exportIdx).toBeGreaterThanOrEqual(0);
  const guardIdx = source.indexOf(guardCall, exportIdx);
  expect(guardIdx).toBeGreaterThan(exportIdx);
  expect(guardIdx - exportIdx).toBeLessThan(maxDistance);
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
    assertOnCallGuard(users, "listUsersWithoutDataConnectProfile", "requireAdmin(request);");
    assertOnCallGuard(users, "listUsersPendingApproval", "requireAdmin(request);");
    assertOnCallGuard(users, "syncPendingUserClaims", "requireAuth(request);");

    const membership = readSource("membershipStatus.ts");
    assertOnCallGuard(membership, "updateMembershipStatus", "requireAuth(request);");
    assertOnCallGuard(membership, "resignMembership", "requireAuth(request);");

    const sections = readSource("sections.ts");
    assertOnCallGuard(sections, "getSectionMembersMerged", "requireAuth(request);");
    assertOnCallGuard(sections, "getSectionForUser", "requireEnabled(request);");
    assertOnCallGuard(sections, "getSectionEventsForUser", "requireEnabled(request);");
    assertOnCallGuard(sections, "getEventForUser", "requireEnabled(request);");

    const bookings = readSource("bookings.ts");
    assertOnCallGuard(bookings, "submitEventBooking", "requireEnabled(request);");

    const payments = readSource("payments.ts");
    assertOnCallGuard(payments, "createTicketCheckoutSession", "requireEnabled(request);");
    assertOnCallGuard(payments, "createEventBookingCheckoutSession", "requireEnabled(request);");
    assertOnCallGuard(payments, "getMyTicketOrderStripeArtifactsBatch", "requireEnabled(request);");
  });

  it("requires section-moderator authorization on every announcement callable", () => {
    const announcements = readSource("announcements.ts");
    for (const fn of [
      "getAnnouncementTemplates",
      "previewAnnouncementTemplate",
      "sendSectionAnnouncement",
      "getAnnouncementSendHistory",
      "getAnnouncementSendRecipients",
    ]) {
      assertOnCallGuard(announcements, fn, "requireAuth(request);");
      assertOnCallGuard(announcements, fn, "requireSectionModerator(", 600);
    }
  });

  it("applies enforceRateLimit to the high-risk callables named in #344", () => {
    const users = readSource("users.ts");
    assertOnCallGuard(users, "updateDisplayName", 'enforceRateLimit("updateDisplayName"', 200);
    assertOnCallGuard(users, "searchUsers", 'enforceRateLimit("searchUsers"', 200);

    const bookings = readSource("bookings.ts");
    assertOnCallGuard(bookings, "submitEventBooking", 'enforceRateLimit("submitEventBooking"', 200);

    const guestTicketRequests = readSource("guestTicketRequests.ts");
    assertOnCallGuard(
      guestTicketRequests,
      "submitGuestTicketRequest",
      'enforceRateLimit("submitGuestTicketRequest"',
      250
    );
  });

  it("keeps Stripe webhook signature verification in place", () => {
    const payments = readSource("payments.ts");
    expect(payments).toContain("stripe-signature");
    expect(payments).toContain("constructEvent(req.rawBody, signature,");
    expect(payments).toContain("getPaymentWebhookEventByStripeEventId");
    expect(payments).toContain("createPaymentWebhookEvent");
    expect(payments).toContain("emitPaymentLifecycleNotification");
  });
});
