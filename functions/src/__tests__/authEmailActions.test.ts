import { describe, expect, it, vi } from "vitest";
import type { TransactionalMailer } from "../mailer";
import {
  applicationPasswordResetLink,
  passwordResetRateLimitKey,
  requestPasswordResetForEmail,
  type AuthEmailTemplates,
} from "../authEmailActions";

function mailer(): TransactionalMailer<AuthEmailTemplates> {
  return {
    sendEmail: vi.fn(async () => ({
      provider: "govuk_notify" as const,
      deliveryMode: {
        requestedMode: "LIVE" as const,
        siteMode: "LIVE" as const,
        effectiveMode: "LIVE" as const,
      },
    })),
  };
}

describe("auth email actions", () => {
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
    expect(request.reference).toMatch(/^PASSWORD_RESET:[0-9a-f-]{36}$/);
  });
});
