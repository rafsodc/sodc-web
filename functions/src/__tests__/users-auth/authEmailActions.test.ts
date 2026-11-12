import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionalMailer } from "../../mailer";
import { NotificationDeliveryStatus, type UUIDString } from "@dataconnect/admin-generated";
import type { NotificationDeliveryRepository } from "../../notificationDelivery";
import { isUserErasing } from "../../communicationErasureGuard";
import { resolveRuntimeGovNotifyDeliveryMode } from "../../govNotifyDeliveryConfiguration";
import {
  applicationEmailChangeLink,
  applicationEmailVerificationLink,
  applicationPasswordResetLink,
  passwordResetRateLimitKey,
  requestPasswordResetForEmail,
  requestEmailVerificationForUser,
  requestEmailChangeForUser,
  requireRecentAuthentication,
  type AuthEmailTemplates,
} from "../../authEmailActions";

vi.mock("../../govNotifyDeliveryConfiguration", () => ({
  resolveRuntimeGovNotifyDeliveryMode: vi.fn(async (requestedMode: string) => ({requestedMode, siteMode: "LIVE", effectiveMode: requestedMode})),
}));

function mailer(): TransactionalMailer<AuthEmailTemplates> {
  return {
    sendEmail: vi.fn(async () => ({
      provider: "govuk_notify" as const,
      providerNotificationId: "auth-provider-message",
      deliveryMode: {
        requestedMode: "LIVE" as const,
        siteMode: "LIVE" as const,
        effectiveMode: "LIVE" as const,
      },
    })),
  };
}

describe("auth email actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isUserErasing).mockResolvedValue(false);
    vi.mocked(resolveRuntimeGovNotifyDeliveryMode).mockImplementation(async (requestedMode) => ({requestedMode, siteMode: "LIVE", effectiveMode: requestedMode}));
  });
  it("rewrites Firebase's generated reset link to the application handler", () => {
    const result = applicationPasswordResetLink(
      "https://example.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=secret-code&apiKey=public-key&continueUrl=https%3A%2F%2Fevil.example&lang=en",
      "https://members.example.org",
    );

    expect(result).toBe(
      "https://members.example.org/auth/action?mode=resetPassword&oobCode=secret-code&lang=en",
    );
    expect(result).not.toContain("continueUrl");
    expect(result).not.toContain("apiKey");
  });

  it("rejects an unexpected generated action mode", () => {
    expect(() =>
      applicationPasswordResetLink(
        "https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=secret-code",
        "https://members.example.org",
      ),
    ).toThrow("invalid password-reset action link");
  });

  it("uses a pseudonymous combined email and IP rate-limit key", () => {
    const key = passwordResetRateLimitKey("member@example.org", "203.0.113.1");
    expect(key).toMatch(/^password-reset:[a-f0-9]{64}$/);
    expect(key).not.toContain("member@example.org");
    expect(key).not.toContain("203.0.113.1");
    expect(key).not.toBe(
      passwordResetRateLimitKey("member@example.org", "203.0.113.2"),
    );
  });

  it("generates a Firebase action and sends an ephemeral Notify link", async () => {
    const sendMailer = mailer();
    const generatePasswordResetLink = vi.fn(async () =>
      "https://example.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=secret-code"
    );

    await requestPasswordResetForEmail("member@example.org", {
      generatePasswordResetLink,
      mailer: sendMailer,
    });

    expect(generatePasswordResetLink).toHaveBeenCalledWith(
      "member@example.org",
      expect.objectContaining({ handleCodeInApp: false }),
    );
    expect(sendMailer.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "passwordReset",
        to: "member@example.org",
        personalisation: {
          resetLink:
            "http://localhost:5173/auth/action?mode=resetPassword&oobCode=secret-code",
        },
        requestedDeliveryMode: "LIVE",
      }),
    );
    const request = vi.mocked(sendMailer.sendEmail).mock.calls[0][0];
    expect(request.reference).toMatch(/^AUTH_EMAIL:[0-9a-f-]{36}$/);
  });

  it("generates and sends an application-owned email verification link", async () => {
    const sendMailer = mailer();
    const generateEmailVerificationLink = vi.fn(async () =>
      "https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=verify-code&apiKey=public"
    );

    await requestEmailVerificationForUser("member@example.org", {
      generateEmailVerificationLink,
      mailer: sendMailer,
    });

    expect(generateEmailVerificationLink).toHaveBeenCalledWith(
      "member@example.org",
      expect.objectContaining({ handleCodeInApp: false }),
    );
    expect(sendMailer.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "emailVerification",
        to: "member@example.org",
        personalisation: {
          verificationLink:
            "http://localhost:5173/auth/action?mode=verifyEmail&oobCode=verify-code",
        },
      }),
    );
  });

  it("rewrites only valid Firebase verification links", () => {
    expect(
      applicationEmailVerificationLink(
        "https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=verify-code&continueUrl=https%3A%2F%2Fevil.example",
        "https://members.example.org",
      ),
    ).toBe(
      "https://members.example.org/auth/action?mode=verifyEmail&oobCode=verify-code",
    );
  });

  it("generates and sends a verify-and-change-email link to the new address", async () => {
    const sendMailer = mailer();
    const generateVerifyAndChangeEmailLink = vi.fn(async () =>
      "https://example.firebaseapp.com/__/auth/action?mode=verifyAndChangeEmail&oobCode=change-code&apiKey=public"
    );

    await requestEmailChangeForUser("old@example.org", "new@example.org", {
      generateVerifyAndChangeEmailLink,
      mailer: sendMailer,
    });

    expect(generateVerifyAndChangeEmailLink).toHaveBeenCalledWith(
      "old@example.org",
      "new@example.org",
      expect.objectContaining({ handleCodeInApp: false }),
    );
    expect(sendMailer.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "emailChangeVerification",
        to: "new@example.org",
        personalisation: {
          verificationLink:
            "http://localhost:5173/auth/action?mode=verifyAndChangeEmail&oobCode=change-code",
        },
      }),
    );
  });

  it("rewrites verify-and-change links without untrusted redirects", () => {
    expect(
      applicationEmailChangeLink(
        "https://example.firebaseapp.com/__/auth/action?mode=verifyAndChangeEmail&oobCode=change-code&continueUrl=https%3A%2F%2Fevil.example",
        "https://members.example.org",
      ),
    ).toBe(
      "https://members.example.org/auth/action?mode=verifyAndChangeEmail&oobCode=change-code",
    );
  });

  it("requires authentication within five minutes for email changes", () => {
    expect(() => requireRecentAuthentication(900, 1_000)).not.toThrow();
    expect(() => requireRecentAuthentication(600, 1_000)).toThrow(
      "Please confirm your password again",
    );
    expect(() => requireRecentAuthentication(undefined, 1_000)).toThrow();
  });

  function trackedDelivery() {
    type Pending = Parameters<NotificationDeliveryRepository["createPending"]>[0];
    let row: (Pending & {id: UUIDString; status: NotificationDeliveryStatus; providerMessageId?: string | null}) | null = null;
    const repository: NotificationDeliveryRepository = {
      getByChannelAndKey: vi.fn(async () => row),
      createPending: vi.fn(async args => {
        row = {...args, id: "10000000-0000-4000-8000-000000000001" as UUIDString, status: NotificationDeliveryStatus.PENDING};
        return row;
      }),
      tryMarkPending: vi.fn(async () => false),
      tryMarkPendingForRecovery: vi.fn(async () => false),
      markSent: vi.fn(async args => {
        if (!row) return false;
        row = {...row, status: NotificationDeliveryStatus.SENT, providerMessageId: args.providerMessageId};
        return true;
      }),
      markSkipped: vi.fn(async () => false),
      markFailed: vi.fn(async () => {
        if (!row) return false;
        row = {...row, status: NotificationDeliveryStatus.FAILED};
        return true;
      }),
    };
    return {repository, current: () => row};
  }

  const authKinds = [
    ["passwordReset", "AUTH_PASSWORD_RESET"],
    ["emailVerification", "AUTH_EMAIL_VERIFICATION"],
    ["emailChangeVerification", "AUTH_EMAIL_CHANGE_VERIFICATION"],
  ] as const;
  async function sendTracked(kind: typeof authKinds[number][0], repository: NotificationDeliveryRepository, sendMailer = mailer(), profile: {id: string; email: string} | null = {id: "auth-user", email: "member@example.org"}) {
    const dependencies = {
      userId: "auth-user", getProfile: vi.fn(async () => profile), mailer: sendMailer, delivery: {repository},
      generatePasswordResetLink: vi.fn(async () => "https://example.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=secret-code"),
      generateEmailVerificationLink: vi.fn(async () => "https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=secret-code"),
      generateVerifyAndChangeEmailLink: vi.fn(async () => "https://example.firebaseapp.com/__/auth/action?mode=verifyAndChangeEmail&oobCode=secret-code"),
    };
    if (kind === "passwordReset") return requestPasswordResetForEmail("member@example.org", dependencies);
    if (kind === "emailVerification") return requestEmailVerificationForUser("member@example.org", dependencies);
    return requestEmailChangeForUser("member@example.org", "replacement@example.org", dependencies);
  }

  it.each(authKinds)("binds %s to its immutable UID before submitting to Notify", async (kind, notificationType) => {
    const delivery = trackedDelivery();
    const sendMailer = mailer();
    vi.mocked(sendMailer.sendEmail).mockImplementation(async request => {
      expect(delivery.current()).toMatchObject({userId: "auth-user", recipientUserId: "auth-user", notificationType, status: "PENDING", deliveryKey: `${request.reference}:notify-live`});
      expect(delivery.current()).not.toHaveProperty("providerMessageId");
      return {provider: "govuk_notify", providerNotificationId: "auth-provider-message", deliveryMode: {requestedMode: "LIVE", siteMode: "LIVE", effectiveMode: "LIVE"}};
    });
    await sendTracked(kind, delivery.repository, sendMailer);
    expect(delivery.current()).toMatchObject({status: "SENT", providerMessageId: "auth-provider-message"});
    const persisted = JSON.stringify(vi.mocked(delivery.repository.createPending).mock.calls);
    expect(persisted).not.toContain("secret-code");
    expect(persisted).not.toContain("@example.org");
    expect(persisted).not.toContain("resetLink");
    expect(persisted).not.toContain("verificationLink");
    expect(delivery.current()?.recoveryPayload).toBeNull();
  });

  it.each(["LIVE", "TEAM_TEST", "SIMULATION"] as const)("uses the same opaque delivery key and provider reference in %s mode", async mode => {
    vi.mocked(resolveRuntimeGovNotifyDeliveryMode).mockResolvedValue({requestedMode: "LIVE", siteMode: mode, effectiveMode: mode});
    const delivery = trackedDelivery();
    const sendMailer = mailer();
    await sendTracked("emailVerification", delivery.repository, sendMailer);
    const sent = vi.mocked(sendMailer.sendEmail).mock.calls[0][0];
    expect(sent.requestedDeliveryMode).toBe(mode);
    expect(delivery.current()?.deliveryKey).toBe(`${sent.reference}:notify-${mode.toLowerCase()}`);
  });

  it("keeps Auth-only onboarding verification available without creating a member delivery", async () => {
    const delivery = trackedDelivery();
    const sendMailer = mailer();
    await sendTracked("emailVerification", delivery.repository, sendMailer, null);
    expect(sendMailer.sendEmail).toHaveBeenCalledOnce();
    expect(delivery.repository.createPending).not.toHaveBeenCalled();
  });

  it("refuses a substituted profile owner before sending", async () => {
    const delivery = trackedDelivery();
    const sendMailer = mailer();
    await expect(sendTracked("passwordReset", delivery.repository, sendMailer, {id: "reused-identity", email: "member@example.org"})).rejects.toThrow("AUTH_EMAIL_OWNER_CHANGED");
    expect(sendMailer.sendEmail).not.toHaveBeenCalled();
    expect(delivery.repository.createPending).not.toHaveBeenCalled();
  });

  it("preserves Auth-owned delivery when the same UID's profile address has not caught up", async () => {
    const delivery = trackedDelivery();
    const sendMailer = mailer();
    await sendTracked("passwordReset", delivery.repository, sendMailer, {id: "auth-user", email: "previous@example.org"});
    expect(sendMailer.sendEmail).toHaveBeenCalledWith(expect.objectContaining({to: "member@example.org"}));
    expect(delivery.current()).toMatchObject({userId: "auth-user", recipientUserId: "auth-user", status: "SENT"});
  });

  it("retains its pre-send binding and redacts a lost provider response containing an action link", async () => {
    const delivery = trackedDelivery();
    const sendMailer = mailer();
    vi.mocked(sendMailer.sendEmail).mockRejectedValue(new Error("https://example.org/auth/action?oobCode=secret-code member@example.org"));
    await expect(sendTracked("passwordReset", delivery.repository, sendMailer)).rejects.toThrow("AUTH_EMAIL_DELIVERY_NOT_SENT");
    expect(delivery.current()).toMatchObject({status: "FAILED", userId: "auth-user", recipientUserId: "auth-user", notificationType: "AUTH_PASSWORD_RESET"});
    expect(delivery.current()?.providerMessageId).toBeUndefined();
    const failed = JSON.stringify(vi.mocked(delivery.repository.markFailed).mock.calls);
    expect(failed).not.toContain("secret-code");
    expect(failed).not.toContain("member@example.org");
  });

  it("stops an erasing identity and a deleted-profile race before invoking Notify", async () => {
    const delivery = trackedDelivery();
    const sendMailer = mailer();
    vi.mocked(isUserErasing).mockResolvedValueOnce(true);
    await expect(sendTracked("passwordReset", delivery.repository, sendMailer)).rejects.toThrow("ACCOUNT_ERASURE_IN_PROGRESS");
    expect(sendMailer.sendEmail).not.toHaveBeenCalled();
    vi.mocked(delivery.repository.createPending).mockRejectedValueOnce(new Error("NOTIFICATION_SUBJECT_MISSING"));
    await expect(sendTracked("passwordReset", delivery.repository, sendMailer)).rejects.toThrow("AUTH_EMAIL_DELIVERY_NOT_SENT");
    expect(sendMailer.sendEmail).not.toHaveBeenCalled();
  });
});
