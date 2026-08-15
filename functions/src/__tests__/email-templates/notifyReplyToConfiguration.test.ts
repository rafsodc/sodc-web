import { describe, expect, it } from "vitest";
import { resolveNotifyReplyToFromConfiguration } from "../../notifyReplyToConfiguration";
import type { GetNotifyReplyToConfigurationData } from "@dataconnect/admin-generated";

const ENV_ID = "11111111-1111-4111-8111-111111111111";

function address(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    displayLabel: "Membership",
    emailAddress: "membership@example.org",
    notifyUuid: "33333333-3333-4333-8333-333333333333",
    enabled: true,
    announcementSelectable: true,
    verificationStatus: "VERIFIED",
    providerAcceptedAt: null,
    providerNotificationId: null,
    verificationMode: null,
    verifiedAt: "2026-08-03T10:00:00.000Z",
    verifiedBy: "admin-1",
    version: 3,
    createdAt: "2026-08-03T09:00:00.000Z",
    updatedAt: "2026-08-03T10:00:00.000Z",
    createdBy: "admin-1",
    updatedBy: "admin-1",
    ...overrides,
  };
}

function configuration(overrides: Partial<GetNotifyReplyToConfigurationData> = {}) {
  const defaultAddress = address();
  return {
    notifyEmailConfiguration: {
      version: 1,
      updatedAt: "2026-08-03T10:00:00.000Z",
      updatedBy: "admin-1",
      defaultReplyToAddress: defaultAddress,
    },
    notifyReplyToAddresses: [defaultAddress],
    notifyTemplateReplyToOverrides: [],
    ...overrides,
  } as GetNotifyReplyToConfigurationData;
}

describe("reply-to resolution", () => {
  it("uses a verified enabled template override ahead of the system default", () => {
    const override = address({
      id: "44444444-4444-4444-8444-444444444444",
      notifyUuid: "55555555-5555-4555-8555-555555555555",
    });
    const data = configuration({
      notifyReplyToAddresses: [address(), override] as never,
      notifyTemplateReplyToOverrides: [{
        templateKey: "passwordReset",
        replyToAddress: override,
        updatedAt: "2026-08-03T10:00:00.000Z",
        updatedBy: "admin-1",
      }] as never,
    });

    expect(resolveNotifyReplyToFromConfiguration(data, "passwordReset", {})).toMatchObject({
      source: "template_override",
      addressId: override.id,
      notifyUuid: override.notifyUuid,
    });
  });

  it("ignores a stale disabled override and uses the verified system default", () => {
    const stale = address({
      id: "44444444-4444-4444-8444-444444444444",
      enabled: false,
      verificationStatus: "UNVERIFIED",
    });
    const data = configuration({
      notifyReplyToAddresses: [address(), stale] as never,
      notifyTemplateReplyToOverrides: [{
        templateKey: "passwordReset",
        replyToAddress: stale,
        updatedAt: "2026-08-03T10:00:00.000Z",
        updatedBy: "admin-1",
      }] as never,
    });

    expect(resolveNotifyReplyToFromConfiguration(data, "passwordReset", {})).toMatchObject({
      source: "system_default",
      addressId: address().id,
    });
  });

  it("falls through to a valid environment migration value, then Notify default", () => {
    const data = configuration({
      notifyEmailConfiguration: {
        version: 1,
        updatedAt: "2026-08-03T10:00:00.000Z",
        updatedBy: "admin-1",
        defaultReplyToAddress: null,
      },
      notifyReplyToAddresses: [],
    } as never);
    expect(resolveNotifyReplyToFromConfiguration(data, undefined, {
      GOV_NOTIFY_EMAIL_REPLY_TO_ID: ENV_ID,
    })).toEqual({ source: "environment_fallback", notifyUuid: ENV_ID });
    expect(resolveNotifyReplyToFromConfiguration(data, undefined, {
      GOV_NOTIFY_EMAIL_REPLY_TO_ID: "invalid",
    })).toEqual({ source: "notify_default" });
  });
});
