import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onCall } from "firebase-functions/v2/https";
import { createHash, randomUUID } from "node:crypto";
import { FUNCTIONS_REGION } from "./constants";
import { validateEmail } from "./helpers";
import {
  createConfiguredGovNotifyMailer,
  govNotifySecrets,
  type TransactionalMailer,
} from "./mailer";
import { enforceRateLimit } from "./rateLimiter";

export const AUTH_EMAIL_TEMPLATE_KEYS = ["passwordReset"] as const;

export type AuthEmailTemplates = {
  passwordReset: {
    resetLink: string;
  };
};

export interface PasswordResetDependencies {
  generatePasswordResetLink(
    email: string,
    settings: admin.auth.ActionCodeSettings,
  ): Promise<string>;
  mailer: TransactionalMailer<AuthEmailTemplates>;
}

const APP_BASE_URL = (() => {
  const value = process.env.APP_BASE_URL || "http://localhost:5173";
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`APP_BASE_URL is not a valid HTTP(S) URL: "${value}"`);
  }
})();

function createAuthEmailMailer(): TransactionalMailer<AuthEmailTemplates> {
  return createConfiguredGovNotifyMailer<AuthEmailTemplates>([...AUTH_EMAIL_TEMPLATE_KEYS]);
}

function neutralResponse(): { success: true } {
  return { success: true };
}

export function passwordResetRateLimitKey(email: string, ipAddress: string): string {
  return `password-reset:${createHash("sha256")
    .update(`${email}\n${ipAddress}`)
    .digest("hex")}`;
}

/**
 * Firebase Admin returns a Firebase-hosted handler URL. The one-time code is
 * portable to the documented custom-handler route, so expose only the
 * parameters the application needs and keep onward navigation server-owned.
 */
export function applicationPasswordResetLink(firebaseLink: string, appBaseUrl: string): string {
  const generated = new URL(firebaseLink);
  const mode = generated.searchParams.get("mode");
  const oobCode = generated.searchParams.get("oobCode");
  if (mode !== "resetPassword" || !oobCode) {
    throw new Error("Firebase generated an invalid password-reset action link");
  }

  const target = new URL("/auth/action", `${appBaseUrl.replace(/\/$/, "")}/`);
  target.searchParams.set("mode", "resetPassword");
  target.searchParams.set("oobCode", oobCode);
  const lang = generated.searchParams.get("lang");
  if (lang) {
    target.searchParams.set("lang", lang);
  }
  return target.toString();
}

export async function requestPasswordResetForEmail(
  email: string,
  dependencies: PasswordResetDependencies,
): Promise<void> {
  const firebaseLink = await dependencies.generatePasswordResetLink(email, {
    url: `${APP_BASE_URL}/account`,
    handleCodeInApp: false,
  });
  const resetLink = applicationPasswordResetLink(firebaseLink, APP_BASE_URL);

  await dependencies.mailer.sendEmail({
    templateName: "passwordReset",
    to: email,
    personalisation: { resetLink },
    reference: `PASSWORD_RESET:${randomUUID()}`,
    requestedDeliveryMode: "LIVE",
  });
}

/**
 * Public and deliberately enumeration-safe. Valid email addresses receive the
 * same response whether the account exists, uses another provider, or delivery
 * fails. Operational failures are logged without the address or action link.
 */
export const requestPasswordReset = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ success: true }> => {
    const email = validateEmail(
      typeof request.data?.email === "string" ? request.data.email : "",
    );
    const rateLimitKey = passwordResetRateLimitKey(
      email,
      request.rawRequest.ip || "unknown",
    );
    await enforceRateLimit("requestPasswordReset", rateLimitKey);

    try {
      await requestPasswordResetForEmail(email, {
        generatePasswordResetLink: (address, settings) =>
          admin.auth().generatePasswordResetLink(address, settings),
        mailer: createAuthEmailMailer(),
      });
    } catch (error: unknown) {
      logger.warn("password-reset request could not be delivered", {
        errorCode:
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : "unknown",
      });
    }

    return neutralResponse();
  },
);
