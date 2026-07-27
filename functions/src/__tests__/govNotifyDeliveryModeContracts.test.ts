import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = path.resolve(process.cwd(), "src");

function source(name: string): string {
  return fs.readFileSync(path.join(sourceDirectory, name), "utf8");
}

describe("GOV.UK Notify delivery mode contracts", () => {
  it("keeps secret reads inside the central resolver", () => {
    const offenders = fs.readdirSync(sourceDirectory)
      .filter((name) => name.endsWith(".ts") && name !== "govNotifyDeliveryMode.ts")
      .filter((name) =>
        /govNotify(?:Api|Test|Team)ApiKey\.value\(\)/.test(source(name)),
      );
    expect(offenders).toEqual([]);
  });

  it("binds all mode-specific secrets to configured transactional workflows", () => {
    for (const name of [
      "announcements.ts",
      "bookings.ts",
      "emailTemplateSync.ts",
      "guestTicketRequests.ts",
      "membershipStatus.ts",
      "notificationRecovery.ts",
      "paymentWebhook.ts",
      "users.ts",
    ]) {
      expect(source(name), name).toContain("govNotifySecrets");
    }
  });

  it("persists announcement modes and scopes idempotency by effective mode", () => {
    const announcements = source("announcements.ts");
    const delivery = source("announcementDelivery.ts");
    const transactionalDelivery = source("notificationDelivery.ts");
    expect(announcements).toContain("requestedDeliveryMode");
    expect(announcements).toContain("siteDeliveryMode");
    expect(announcements).toContain("effectiveDeliveryMode");
    expect(delivery).toContain("govNotifyReferenceForMode");
    expect(transactionalDelivery).toContain(
      "deliveryKey: govNotifyReferenceForMode(request.deliveryKey, deliveryMode)",
    );
  });
});
