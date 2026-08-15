import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { NotifyClient } from "notifications-node-client";
import { sendNotifyReplyToVerificationTest } from "../../notifyReplyToAdmin";

const ADDRESS_ID = "11111111-1111-4111-8111-111111111111";
const REPLY_TO_ID = "22222222-2222-4222-8222-222222222222";

const configuration = {
  notifyEmailConfiguration: {
    version: 1,
    updatedAt: "2026-08-10T05:00:00.000Z",
    updatedBy: "admin-1",
    defaultReplyToAddress: null,
  },
  notifyReplyToAddresses: [{
    id: ADDRESS_ID,
    displayLabel: "Membership",
    emailAddress: "membership@example.org",
    notifyUuid: REPLY_TO_ID,
    enabled: false,
    announcementSelectable: false,
    verificationStatus: "UNVERIFIED",
    providerAcceptedAt: null,
    providerNotificationId: null,
    verificationMode: null,
    verifiedAt: null,
    verifiedBy: null,
    version: 3,
    createdAt: "2026-08-10T05:00:00.000Z",
    updatedAt: "2026-08-10T05:00:00.000Z",
    createdBy: "admin-1",
    updatedBy: "admin-1",
  }],
  notifyTemplateReplyToOverrides: [],
};

function runVerificationTest() {
  return sendNotifyReplyToVerificationTest.run({
    auth: {
      uid: "admin-1",
      token: {
        admin: true,
        enabled: true,
        email: "admin@example.org",
        email_verified: true,
      },
    },
    data: { addressId: ADDRESS_ID, expectedVersion: 3 },
  } as unknown as Parameters<typeof sendNotifyReplyToVerificationTest.run>[0]);
}

describe("reply-to verification template resolution", () => {
  beforeEach(() => {
    vi.stubEnv("GOV_NOTIFY_DELIVERY_MODE", "LIVE");
    vi.stubEnv("GOV_NOTIFY_TEAM_API_KEY", "team-api-key");
    vi.stubEnv("GOV_NOTIFY_TEMPLATE_EMAIL_VERIFICATION", "environment-template-id");

    vi.spyOn(admin, "ensureCallableRateLimitBucket").mockResolvedValue({ data: {} } as never);
    vi.spyOn(admin, "consumeCallableRateLimit").mockResolvedValue({ data: {} } as never);
    vi.spyOn(admin, "getNotifyReplyToConfiguration").mockResolvedValue({ data: configuration } as never);
    vi.spyOn(admin, "getGovNotifyDeliveryConfiguration").mockResolvedValue({
      data: {
        govNotifyDeliveryConfiguration: {
          mode: "LIVE",
          version: 1,
          updatedAt: "2026-08-10T05:00:00.000Z",
          updatedBy: "admin-1",
        },
      },
    } as never);
    vi.spyOn(admin, "listNotifyReplyToAudits").mockResolvedValue({
      data: { notifyReplyToAudits: [] },
    } as never);
    vi.spyOn(admin, "recordNotifyReplyToProviderAcceptance").mockResolvedValue({
      data: { changed: 1 },
    } as never);
    vi.spyOn(NotifyClient.prototype, "sendEmail").mockResolvedValue({
      data: { id: "provider-notification-id" },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends with the synced database binding ahead of the environment fallback", async () => {
    vi.spyOn(admin, "getNotifyTemplateBindings").mockResolvedValue({
      data: {
        notifyTemplateBindings: [{
          templateKey: "emailVerification",
          notifyTemplateId: "database-template-id",
        }],
      },
    } as never);

    await runVerificationTest();

    expect(NotifyClient.prototype.sendEmail).toHaveBeenCalledWith(
      "database-template-id",
      "admin@example.org",
      expect.objectContaining({ emailReplyToId: REPLY_TO_ID }),
    );
  });

  it("uses the environment template when no database binding exists", async () => {
    vi.spyOn(admin, "getNotifyTemplateBindings").mockResolvedValue({
      data: { notifyTemplateBindings: [] },
    } as never);

    await runVerificationTest();

    expect(NotifyClient.prototype.sendEmail).toHaveBeenCalledWith(
      "environment-template-id",
      "admin@example.org",
      expect.objectContaining({ emailReplyToId: REPLY_TO_ID }),
    );
  });
});
