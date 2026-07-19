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
    assertOnCallGuard(membership, "updateMembershipStatus", "requireEnabled(request);");
    assertOnCallGuard(membership, "resignMembership", "requireEnabled(request);");

    const sections = readSource("sections.ts");
    assertOnCallGuard(sections, "getSectionMembersMerged", "requireEnabled(request);");
    assertOnCallGuard(sections, "getSectionForUser", "requireEnabled(request);");
    assertOnCallGuard(sections, "getSectionEventsForUser", "requireEnabled(request);");
    assertOnCallGuard(sections, "getEventForUser", "requireEnabled(request);");

    const bookings = readSource("bookings.ts");
    assertOnCallGuard(bookings, "submitEventBooking", "requireEnabled(request);");

    const paymentCheckout = readSource("paymentCheckoutCallables.ts");
    assertOnCallGuard(paymentCheckout, "createTicketCheckoutSession", "requireEnabled(request);");
    assertOnCallGuard(paymentCheckout, "createEventBookingCheckoutSession", "requireEnabled(request);");

    const paymentArtifacts = readSource("paymentStripeArtifacts.ts");
    assertOnCallGuard(paymentArtifacts, "getMyTicketOrderStripeArtifactsBatch", "requireEnabled(request);");

    const paymentReconciliation = readSource("paymentReconciliationCallable.ts");
    assertOnCallGuard(paymentReconciliation, "reconcileMyCheckoutSessionOrders", "requireEnabled(request);");
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
      assertOnCallGuard(announcements, fn, "requireEnabled(request);");
      assertOnCallGuard(announcements, fn, "requireSectionModerator(", 700);
    }
  });

  it("keeps only intentional pre-approval entry points authentication-only", () => {
    const users = readSource("users.ts");
    for (const fn of ["updateDisplayName", "syncPendingUserClaims"]) {
      assertOnCallGuard(users, fn, "requireAuth(request);");
    }

    const guardedSources = [
      readSource("sections.ts"),
      readSource("announcements.ts"),
      readSource("membershipStatus.ts"),
    ].join("\n");
    expect(guardedSources).not.toContain("requireAuth(request);");
  });

  it("applies centralized rate limits to the high-risk callables named in #344 and #369", () => {
    const admin = readSource("admin.ts");
    for (const fn of ["grantAdmin", "revokeAdmin", "listAdminUsers"]) {
      assertOnCallGuard(admin, fn, `enforceRateLimit("${fn}"`, 300);
    }

    const users = readSource("users.ts");
    for (const fn of [
      "updateDisplayName",
      "updateUserDisplayName",
      "searchUsers",
      "listUsersWithoutDataConnectProfile",
      "listUsersPendingApproval",
      "syncPendingUserClaims",
    ]) {
      assertOnCallGuard(users, fn, `enforceRateLimit("${fn}"`, 300);
    }

    const bookings = readSource("bookings.ts");
    assertOnCallGuard(bookings, "submitEventBooking", "enforceRateLimit(\"submitEventBooking\"", 200);

    const guestTicketRequests = readSource("guestTicketRequests.ts");
    for (const fn of ["submitGuestTicketRequest", "reviewGuestTicketRequest"]) {
      assertOnCallGuard(guestTicketRequests, fn, `enforceRateLimit("${fn}"`, 300);
    }

    const membership = readSource("membershipStatus.ts");
    assertOnCallGuard(
      membership,
      "updateMembershipStatus",
      "enforceRateLimit(\"updateMembershipStatus\"",
      250
    );
    assertOnCallGuard(
      membership,
      "resignMembership",
      "enforceRateLimit(\"resignMembership\"",
      250
    );

    const sections = readSource("sections.ts");
    assertOnCallGuard(
      sections,
      "getSectionMembersMerged",
      "enforceRateLimit(\"getSectionMembersMerged\"",
      250
    );

    const checkout = readSource("paymentCheckoutCallables.ts");
    for (const fn of ["createTicketCheckoutSession", "createEventBookingCheckoutSession"]) {
      assertOnCallGuard(checkout, fn, `enforceRateLimit("${fn}"`, 300);
    }

    const reconciliation = readSource("paymentReconciliationCallable.ts");
    assertOnCallGuard(
      reconciliation,
      "reconcileMyCheckoutSessionOrders",
      "enforceRateLimit(\"reconcileMyCheckoutSessionOrders\"",
      300
    );

    const artifacts = readSource("paymentStripeArtifacts.ts");
    assertOnCallGuard(
      artifacts,
      "getMyTicketOrderStripeArtifactsBatch",
      "enforceRateLimit(\"getMyTicketOrderStripeArtifactsBatch\"",
      300
    );

    const templateSync = readSource("emailTemplateSync.ts");
    assertOnCallGuard(templateSync, "getTemplateSyncStatus", "enforceRateLimit(\"getTemplateSyncStatus\"", 300);

    const announcements = readSource("announcements.ts");
    for (const fn of [
      "getAnnouncementTemplates",
      "previewAnnouncementTemplate",
      "sendSectionAnnouncement",
      "getAnnouncementSendRecipients",
    ]) {
      assertOnCallGuard(announcements, fn, `enforceRateLimit("${fn}"`, 350);
    }
  });

  it("keeps Stripe webhook signature verification in place", () => {
    const webhook = readSource("paymentWebhook.ts");
    expect(webhook).toContain("stripe-signature");
    expect(webhook).toContain("constructEvent(req.rawBody, signature,");
    expect(webhook).toContain("getPaymentWebhookEventByStripeEventId");
    expect(webhook).toContain("createPaymentWebhookEvent");

    const reconciliation = readSource("paymentReconciliationService.ts");
    expect(reconciliation).toContain("emitPaymentLifecycleNotification");
  });
});
