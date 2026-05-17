import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import {
  classifyMembershipStatusEmailTransition,
  membershipStatusCustomerLabel,
  membershipStatusDeliveryKey,
  notifyMembershipStatusEmailIfNeeded,
} from "../membershipStatusEmailDispatcher";
import * as notificationDelivery from "../notificationDelivery";

const mockGetUser = vi.spyOn(admin, "getUserMembershipStatus");
const mockSendOnce = vi.spyOn(notificationDelivery, "sendNotificationOnce");

describe("classifyMembershipStatusEmailTransition", () => {
  it("returns activation when moving from restricted to non-restricted", () => {
    expect(classifyMembershipStatusEmailTransition("PENDING", "REGULAR")).toBe("activation");
    expect(classifyMembershipStatusEmailTransition(null, "RESERVE")).toBe("activation");
  });

  it("returns restricted when moving from non-restricted to restricted", () => {
    expect(classifyMembershipStatusEmailTransition("REGULAR", "RESIGNED")).toBe("restricted");
    expect(classifyMembershipStatusEmailTransition("RETIRED", "DECEASED")).toBe("restricted");
  });

  it("returns null for no-op or non-access-changing transitions", () => {
    expect(classifyMembershipStatusEmailTransition("REGULAR", "REGULAR")).toBeNull();
    expect(classifyMembershipStatusEmailTransition("REGULAR", "RETIRED")).toBeNull();
    expect(classifyMembershipStatusEmailTransition("PENDING", "RESIGNED")).toBeNull();
  });
});

describe("membershipStatusDeliveryKey", () => {
  it("is stable per user and transition", () => {
    expect(
      membershipStatusDeliveryKey({
        userId: "uid-1",
        kind: "activation",
        previousStatus: "PENDING",
        newStatus: "REGULAR",
      })
    ).toBe("membership-activation:uid-1:PENDING:REGULAR");
  });
});

describe("membershipStatusCustomerLabel", () => {
  it("maps known statuses", () => {
    expect(membershipStatusCustomerLabel("CIVIL_SERVICE")).toBe("Civil Service");
  });
});

describe("notifyMembershipStatusEmailIfNeeded", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockSendOnce.mockReset();
    mockSendOnce.mockResolvedValue({ outcome: "sent" });
  });

  it("sends activation email via sendNotificationOnce", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          membershipStatus: "REGULAR",
          firstName: "Alex",
          lastName: "Member",
          email: "Alex@Example.COM",
        },
      },
    } as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "govuk_notify",
      providerNotificationId: "notify-1",
    });
    const getMailer = () => ({ sendEmail });

    await notifyMembershipStatusEmailIfNeeded({
      userId: "uid-1",
      previousStatus: "PENDING",
      newStatus: "REGULAR",
      appBaseUrl: "https://app.example/",
      getMailer,
    });

    expect(mockSendOnce).toHaveBeenCalledTimes(1);
    expect(mockSendOnce.mock.calls[0][0].notificationType).toBe("MEMBERSHIP_ACTIVATED");
    expect(mockSendOnce.mock.calls[0][0].deliveryKey).toBe("membership-activation:uid-1:PENDING:REGULAR");

    await mockSendOnce.mock.calls[0][0].send();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "membershipActivated",
        to: "alex@example.com",
        personalisation: expect.objectContaining({
          customerFirstName: "Alex",
          membershipStatusLabel: "Regular",
          appUrl: "https://app.example",
          profileUrl: "https://app.example/profile",
        }),
      })
    );
  });

  it("skips when transition does not warrant email", async () => {
    await notifyMembershipStatusEmailIfNeeded({
      userId: "uid-1",
      previousStatus: "REGULAR",
      newStatus: "RETIRED",
      appBaseUrl: "https://app.example",
      getMailer: () => ({ sendEmail: vi.fn() }),
    });
    expect(mockSendOnce).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
