import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readFunctionSource(fileName: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "src", fileName), "utf8");
}

describe("notification lifecycle contracts", () => {
  it("awaits every notification launched from a server entry path", () => {
    const sourceByFile = new Map(
      [
        "bookings.ts",
        "guestTicketRequests.ts",
        "membershipStatus.ts",
        "paymentReconciliationService.ts",
        "paymentWebhook.ts",
        "users.ts",
      ].map((fileName) => [fileName, readFunctionSource(fileName)])
    );

    for (const [fileName, source] of sourceByFile) {
      expect(source, fileName).not.toMatch(/\bvoid\s+(?:notify|emit|send|dispatch)/);
    }

    expect(sourceByFile.get("bookings.ts")).toContain("await sendBookingSubmitNotificationEmails(");
    expect(sourceByFile.get("guestTicketRequests.ts")).toContain("await sendGuestTicketRequestSubmittedEmails(");
    expect(sourceByFile.get("guestTicketRequests.ts")).toContain("await sendGuestTicketRequestReviewedEmails(");
    expect(sourceByFile.get("membershipStatus.ts")).toContain("await sendMembershipStatusEmailIfChanged(");
    expect(sourceByFile.get("paymentReconciliationService.ts")).toContain(
      "await dependencies.notifyExceptionOpened(alert)"
    );
    expect(sourceByFile.get("paymentWebhook.ts")).toContain("await notifyPaymentOpsDisputeSideState(");
    expect(sourceByFile.get("users.ts")).toContain("await notifyAdminsUserPendingApproval(");
  });

  it("uses compare-and-swap mutations for claim and completion ownership", () => {
    const operations = fs.readFileSync(
      path.resolve(process.cwd(), "..", "dataconnect", "api", "admin-mutations.gql"),
      "utf8"
    );
    const claimStart = operations.indexOf("mutation ClaimNotificationDeliveryById");
    const sentStart = operations.indexOf("mutation MarkNotificationDeliverySentById");
    const failedStart = operations.indexOf("mutation MarkNotificationDeliveryFailedById");

    expect(claimStart).toBeGreaterThanOrEqual(0);
    expect(operations.slice(claimStart, sentStart)).toContain("notificationDelivery_updateMany");
    expect(operations.slice(claimStart, sentStart)).toContain("status: { eq: $expectedStatus }");
    expect(operations.slice(claimStart, sentStart)).toContain("attemptCount: { eq: $expectedAttemptCount }");

    for (const operation of [
      operations.slice(sentStart, failedStart),
      operations.slice(failedStart, operations.indexOf("mutation MarkTicketOrderPaidFromWebhook")),
    ]) {
      expect(operation).toContain("notificationDelivery_updateMany");
      expect(operation).toContain("status: { eq: PENDING }");
      expect(operation).toContain("attemptCount: { eq: $attemptCount }");
    }
  });

  it("persists recovery context for every transactional notification sender", () => {
    for (const fileName of [
      "bookingEmailDispatcher.ts",
      "guestTicketRequestEmails.ts",
      "membershipStatusEmailDispatcher.ts",
      "paymentNotifications.ts",
      "paymentOpsInternalAlerts.ts",
      "pendingApprovalAdminAlert.ts",
    ]) {
      const source = readFunctionSource(fileName);
      const requests = [
        ...source.matchAll(
          /(?:sendNotificationOnce|notificationSender)\(\{([\s\S]*?)\bsend:\s*async/g
        ),
      ];
      expect(requests.length, `${fileName} must send at least one notification`).toBeGreaterThan(0);
      for (const request of requests) {
        expect(request[1], `${fileName} notification missing recoveryPayload`).toContain(
          "recoveryPayload:"
        );
      }
    }
  });
});
