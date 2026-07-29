import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createHash, randomUUID } from "node:crypto";
import { updateUserEmailFromAuth } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireAuth, requireEnabled, validateEmail } from "./helpers";
import {
  createConfiguredGovNotifyMailer,
  govNotifySecrets,
  type TransactionalMailer,
} from "./mailer";
import { enforceRateLimit } from "./rateLimiter";

export const AUTH_EMAIL_TEMPLATE_KEYS = [
  "passwordReset",
  "emailVerification",
  "emailChangeVerification",
] as const;

export type AuthEmailTemplates = {
  passwordReset: {
    resetLink: string;
  };
  emailVerification: {
    verificationLink: string;
  };
  emailChangeVerification: {
    verificationLink: string;
  };
};

export interface PasswordResetDependencies {
  generatePasswordResetLink(
    email: string,
    settings: admin.auth.ActionCodeSettings,
  ): Promise<string>;
  mailer: TransactionalMailer<AuthEmailTemplates>;
}

export interface EmailVerificationDependencies {
  generateEmailVerificationLink(
    email: string,
    settings: admin.auth.ActionCodeSettings,
  ): Promise<string>;
  mailer: TransactionalMailer<AuthEmailTemplates>;
}

export interface EmailChangeDependencies {
  generateVerifyAndChangeEmailLink(
    email: string,
    newEmail: string,
    settings: admin.auth.ActionCodeSettings,
  ): Promise<string>;
  mailer: TransactionalMailer<AuthEmailTemplates>;
}

const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

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

export function applicationEmailVerificationLink(
  firebaseLink: string,
  appBaseUrl: string,
): string {
  const generated = new URL(firebaseLink);
  const mode = generated.searchParams.get("mode");
  const oobCode = generated.searchParams.get("oobCode");
  if (mode !== "verifyEmail" || !oobCode) {
    throw new Error("Firebase generated an invalid email-verification action link");
  }

  const target = new URL("/auth/action", `${appBaseUrl.replace(/\/$/, "")}/`);
  target.searchParams.set("mode", "verifyEmail");
  target.searchParams.set("oobCode", oobCode);
  const lang = generated.searchParams.get("lang");
  if (lang) target.searchParams.set("lang", lang);
  return target.toString();
}

export function applicationEmailChangeLink(firebaseLink: string, appBaseUrl: string): string {
  const generated = new URL(firebaseLink);
  const mode = generated.searchParams.get("mode");
  const oobCode = generated.searchParams.get("oobCode");
  if (mode !== "verifyAndChangeEmail" || !oobCode) {
    throw new Error("Firebase generated an invalid email-change action link");
  }

  const target = new URL("/auth/action", `${appBaseUrl.replace(/\/$/, "")}/`);
  target.searchParams.set("mode", "verifyAndChangeEmail");
  target.searchParams.set("oobCode", oobCode);
  const lang = generated.searchParams.get("lang");
  if (lang) target.searchParams.set("lang", lang);
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

export async function requestEmailVerificationForUser(
  email: string,
  dependencies: EmailVerificationDependencies,
): Promise<void> {
  const firebaseLink = await dependencies.generateEmailVerificationLink(email, {
    url: `${APP_BASE_URL}/account`,
    handleCodeInApp: false,
  });
  const verificationLink = applicationEmailVerificationLink(firebaseLink, APP_BASE_URL);

  await dependencies.mailer.sendEmail({
    templateName: "emailVerification",
    to: email,
    personalisation: { verificationLink },
    reference: `EMAIL_VERIFICATION:${randomUUID()}`,
    requestedDeliveryMode: "LIVE",
  });
}

export async function requestEmailChangeForUser(
  currentEmail: string,
  newEmail: string,
  dependencies: EmailChangeDependencies,
): Promise<void> {
  const firebaseLink = await dependencies.generateVerifyAndChangeEmailLink(
    currentEmail,
    newEmail,
    { url: `${APP_BASE_URL}/account`, handleCodeInApp: false },
  );
  const verificationLink = applicationEmailChangeLink(firebaseLink, APP_BASE_URL);

  await dependencies.mailer.sendEmail({
    templateName: "emailChangeVerification",
    to: newEmail,
    personalisation: { verificationLink },
    reference: `EMAIL_CHANGE:${randomUUID()}`,
    requestedDeliveryMode: "LIVE",
  });
}

export function requireRecentAuthentication(authTime: unknown, nowSeconds = Date.now() / 1000): void {
  if (
    typeof authTime !== "number" ||
    !Number.isFinite(authTime) ||
    authTime > nowSeconds ||
    nowSeconds - authTime > RECENT_AUTH_MAX_AGE_SECONDS
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Please confirm your password again before changing your email address.",
      { code: "RECENT_LOGIN_REQUIRED" },
    );
  }
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

/**
 * Available to signed-in onboarding users before email verification or account
 * enablement. The recipient is always derived from Firebase Auth, never input.
 */
export const requestEmailVerification = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ success: true }> => {
    requireAuth(request);
    await enforceRateLimit("requestEmailVerification", request.auth!.uid);
    const user = await admin.auth().getUser(request.auth!.uid);
    if (!user.email) {
      throw new Error("Authenticated user has no email address");
    }
    if (user.emailVerified) {
      return neutralResponse();
    }

    await requestEmailVerificationForUser(user.email, {
      generateEmailVerificationLink: (address, settings) =>
        admin.auth().generateEmailVerificationLink(address, settings),
      mailer: createAuthEmailMailer(),
    });
    return neutralResponse();
  },
);

export const requestEmailChange = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ success: true }> => {
    requireEnabled(request);
    requireRecentAuthentication(request.auth!.token.auth_time);
    await enforceRateLimit("requestEmailChange", request.auth!.uid);
    const newEmail = validateEmail(
      typeof request.data?.newEmail === "string" ? request.data.newEmail : "",
    );
    const user = await admin.auth().getUser(request.auth!.uid);
    const currentEmail = user.email?.trim().toLowerCase();
    if (!currentEmail) {
      throw new HttpsError("failed-precondition", "This account has no email address.");
    }
    if (currentEmail === newEmail) {
      throw new HttpsError("invalid-argument", "Enter a different email address.");
    }

    try {
      await requestEmailChangeForUser(currentEmail, newEmail, {
        generateVerifyAndChangeEmailLink: (email, replacement, settings) =>
          admin.auth().generateVerifyAndChangeEmailLink(email, replacement, settings),
        mailer: createAuthEmailMailer(),
      });
      return neutralResponse();
    } catch (error: unknown) {
      const errorCode =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "unknown";
      logger.warn("email-change request could not be delivered", {
        callerUid: request.auth!.uid,
        errorCode,
      });
      if (errorCode === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          "This email address cannot be used. It may already be linked to another account.",
          { code: "EMAIL_ALREADY_IN_USE" },
        );
      }
      throw new HttpsError(
        "failed-precondition",
        "The email change could not be started. Check the address and try again.",
      );
    }
  },
);

export const reconcileMyEmail = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<{ success: true; email: string }> => {
    requireAuth(request);
    await enforceRateLimit("reconcileMyEmail", request.auth!.uid);
    const user = await admin.auth().getUser(request.auth!.uid);
    if (!user.email || !user.emailVerified) {
      throw new HttpsError("failed-precondition", "A verified email address is required.");
    }
    const email = validateEmail(user.email);
    await updateUserEmailFromAuth({ userId: user.uid, email });
    return { success: true, email };
  },
);
