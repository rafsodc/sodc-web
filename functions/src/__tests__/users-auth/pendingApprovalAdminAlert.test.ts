import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRecord } from "firebase-admin/auth";
import * as dc from "@dataconnect/admin-generated";
import { MembershipStatus } from "@dataconnect/admin-generated";
import * as helpers from "../../helpers";
import * as recipientPolicy from "../../privilegedNotificationRecipient";
import * as legacyPolicy from "../../privilegedNotificationLegacy";
import * as notificationDelivery from "../../notificationDelivery";
import {
  notifyAdminsUserPendingApproval,
  pendingApprovalDeliveryKey,
  pendingApprovalUidDeliveryKey,
  summarizeServiceBackground,
} from "../../pendingApprovalAdminAlert";

const mockGetUserById = vi.spyOn(dc, "serviceGetUserById");
const mockGetAdminUsers = vi.spyOn(helpers, "getAdminUsers");
const mockSendOnce = vi.spyOn(notificationDelivery, "sendNotificationOnce");

const userId = "00000000-0000-4000-8000-000000000001";

function profile(overrides: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus: string;
  requestedMembershipStatus: string | null;
  isRegular: boolean | null;
  isReserve: boolean | null;
  isCivilServant: boolean | null;
  isIndustry: boolean | null;
}> = {}) {
  return {
    id: userId,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    serviceNumber: "S123456",
    membershipStatus: MembershipStatus.PENDING,
    requestedMembershipStatus: MembershipStatus.REGULAR,
    isRegular: true,
    isReserve: false,
    isCivilServant: false,
    isIndustry: false,
    ...overrides,
  };
}

function mockAdminUser(email: string) {
  return { uid: email.split("@")[0], email } as unknown as UserRecord & { email: string };
}

describe("summarizeServiceBackground", () => {
  it("joins the set flags", () => {
    expect(summarizeServiceBackground({ isRegular: true, isReserve: true })).toBe("Regular, Reserve");
  });

  it("returns a placeholder when nothing is set", () => {
    expect(summarizeServiceBackground({})).toBe("Not specified");
    expect(
      summarizeServiceBackground({ isRegular: false, isReserve: null, isCivilServant: undefined })
    ).toBe("Not specified");
  });
});

describe("pendingApprovalDeliveryKey", () => {
  it("builds a stable per-admin key", () => {
    expect(pendingApprovalDeliveryKey(userId, "admin@example.com")).toBe(
      `pending-approval:${userId}:admin@example.com`
    );
  });
});

describe("notifyAdminsUserPendingApproval", () => {
  beforeEach(() => {
    mockGetUserById.mockReset();
    mockGetAdminUsers.mockReset();
    mockSendOnce.mockReset();
    mockSendOnce.mockResolvedValue({ outcome: "sent" });
    vi.spyOn(recipientPolicy, "selectPrivilegedNotificationRecipientIds").mockImplementation(async (uids) => [...uids]);
    vi.spyOn(recipientPolicy, "authorizePrivilegedNotificationRecipient").mockImplementation(async (uid) => ({
      eligible: true, recipientUserId: uid, email: `${uid}@example.com`,
    }));
    vi.spyOn(legacyPolicy, "hasLegacyPrivilegedNotificationEvent").mockResolvedValue(false);
  });

  it("does nothing when the user has no Data Connect profile yet", async () => {
    mockGetUserById.mockResolvedValue({ data: { user: undefined } } as unknown as Awaited<
      ReturnType<typeof dc.getUserById>
    >);

    await notifyAdminsUserPendingApproval({ userId, emailVerified: true, appBaseUrl: "https://app.example" });

    expect(mockGetAdminUsers).not.toHaveBeenCalled();
    expect(mockSendOnce).not.toHaveBeenCalled();
  });

  it("does nothing when the email isn't verified yet", async () => {
    mockGetUserById.mockResolvedValue({ data: { user: profile() } } as unknown as Awaited<
      ReturnType<typeof dc.getUserById>
    >);

    await notifyAdminsUserPendingApproval({ userId, emailVerified: false, appBaseUrl: "https://app.example" });

    expect(mockSendOnce).not.toHaveBeenCalled();
  });

  it("does nothing when membership status is not awaiting approval", async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: profile({ membershipStatus: MembershipStatus.REGULAR }) },
    } as unknown as Awaited<ReturnType<typeof dc.getUserById>>);

    await notifyAdminsUserPendingApproval({ userId, emailVerified: true, appBaseUrl: "https://app.example" });

    expect(mockSendOnce).not.toHaveBeenCalled();
  });

  it("sends one deduped email per admin when the user is pending approval", async () => {
    mockGetUserById.mockResolvedValue({ data: { user: profile() } } as unknown as Awaited<
      ReturnType<typeof dc.getUserById>
    >);
    mockGetAdminUsers.mockResolvedValue([
      mockAdminUser("admin1@example.com"),
      mockAdminUser("admin2@example.com"),
    ] as unknown as UserRecord[]);

    const sendEmail = vi.fn().mockResolvedValue({ provider: "govuk_notify", providerNotificationId: "n-1" });

    await notifyAdminsUserPendingApproval({
      userId,
      emailVerified: true,
      appBaseUrl: "https://app.example/",
      getMailer: () => ({ sendEmail }),
    });

    expect(mockSendOnce).toHaveBeenCalledTimes(2);
    expect(mockSendOnce.mock.calls.map((c) => c[0].deliveryKey)).toEqual([
      pendingApprovalUidDeliveryKey(userId, "admin1"),
      pendingApprovalUidDeliveryKey(userId, "admin2"),
    ]);
    expect(mockSendOnce.mock.calls[0][0].notificationType).toBe("USER_PENDING_APPROVAL");
    expect(mockSendOnce.mock.calls[0][0]).toMatchObject({ userId, recipientUserId: "admin1",
      recoveryPayload: { version: 2, userId, recipientUserId: "admin1" } });

    await mockSendOnce.mock.calls[0][0].send("LIVE");
    await mockSendOnce.mock.calls[1][0].send("LIVE");
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "newUserPendingApprovalAlert",
        to: "admin1@example.com",
        personalisation: expect.objectContaining({
          firstName: "Ada",
          lastName: "Lovelace",
          serviceBackgroundSummary: "Regular",
          approveUsersUrl: "https://app.example/admin/users/approvals",
        }),
      })
    );
    const references = sendEmail.mock.calls.map(([request]) => request.reference);
    expect(new Set(references)).toHaveLength(2);
    for (const reference of references) {
      expect(reference).toMatch(/^pending-approval-v2:[0-9a-f-]+:admin[12]$/);
    }
  });

  it("skips sending (without throwing) when there are no admin recipients", async () => {
    mockGetUserById.mockResolvedValue({ data: { user: profile() } } as unknown as Awaited<
      ReturnType<typeof dc.getUserById>
    >);
    mockGetAdminUsers.mockResolvedValue([] as unknown as UserRecord[]);

    await notifyAdminsUserPendingApproval({ userId, emailVerified: true, appBaseUrl: "https://app.example" });

    expect(mockSendOnce).not.toHaveBeenCalled();
  });
});

describe("applicant alert final authorization", () => {
  it("rechecks an explicit recovered UID and does not call the provider after admin revocation", async () => {
    mockGetUserById.mockResolvedValue({ data: { user: profile() } } as never);
    mockSendOnce.mockReset().mockResolvedValue({ outcome: "sent" });
    vi.mocked(legacyPolicy.hasLegacyPrivilegedNotificationEvent).mockResolvedValue(false);
    vi.mocked(recipientPolicy.authorizePrivilegedNotificationRecipient).mockResolvedValue({ eligible: false, reason: "RECIPIENT_AUTHORITY_REVOKED" });
    const sendEmail = vi.fn();
    await notifyAdminsUserPendingApproval({ userId, emailVerified: true, appBaseUrl: "https://app.example",
      recipientUserIds: ["former-admin"], getMailer: () => ({ sendEmail }) });
    expect(await mockSendOnce.mock.calls[0][0].send("LIVE")).toEqual({ outcome: "skipped", reason: "RECIPIENT_AUTHORITY_REVOKED" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

it("UID delivery keys keep subject/recipient boundaries and case distinct", () => {
  expect(pendingApprovalUidDeliveryKey("a:b", "c")).not.toBe(pendingApprovalUidDeliveryKey("a", "b:c"));
  expect(pendingApprovalUidDeliveryKey("applicant", "Staff")).not.toBe(pendingApprovalUidDeliveryKey("applicant", "staff"));
});
