import {
  classifyError,
  extractDomainErrorCode,
  extractErrorCode,
  toUserFacingError,
  type UserFacingError,
} from "./errorHandling";

export type AuthErrorContext =
  | "register"
  | "sign-in"
  | "password-change"
  | "email-change"
  | "password-reset-request"
  | "email-verification"
  | "password-reset"
  | "email-action";

const INVALID_CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/user-not-found",
  "auth/wrong-password",
]);

function authError(
  category: UserFacingError["category"],
  title: string,
  message: string,
  retryable = false,
): UserFacingError {
  return { category, title, message, retryable };
}

/** Central, context-aware Firebase Auth mapping. */
export function toAuthUserFacingError(
  error: unknown,
  context: AuthErrorContext,
): UserFacingError {
  const code = extractErrorCode(error) ?? "";
  const domainCode = extractDomainErrorCode(error);
  const category = classifyError(error);

  if (context === "sign-in" && INVALID_CREDENTIAL_CODES.has(code)) {
    return authError(
      "authentication",
      "Sign-in failed",
      "Email or password is incorrect.",
    );
  }
  if (code === "auth/user-disabled") {
    return authError(
      "authorization",
      "Account unavailable",
      "This account is disabled. Contact an administrator if you need help.",
    );
  }
  if (
    (context === "password-change" || context === "email-change") &&
    INVALID_CREDENTIAL_CODES.has(code)
  ) {
    return authError("authentication", "Password incorrect", "Current password is incorrect.");
  }
  if (
    context === "sign-in" &&
    (code === "auth/password-does-not-meet-requirements" || code === "auth/weak-password")
  ) {
    return authError(
      "validation",
      "Password update required",
      "This password no longer meets the account security policy. Reset your password to continue.",
    );
  }
  if (context === "register" && code === "auth/email-already-in-use") {
    return authError(
      "conflict",
      "Account already exists",
      "This email is already registered. Please sign in instead.",
    );
  }
  if (code === "auth/invalid-email") {
    return authError("validation", "Invalid email", "Enter a valid email address.");
  }
  if (
    code === "auth/weak-password" ||
    code === "auth/password-does-not-meet-requirements"
  ) {
    return authError(
      "validation",
      "Password requirements not met",
      "Password does not meet the current account security policy.",
    );
  }
  if (code === "auth/requires-recent-login" || domainCode === "RECENT_LOGIN_REQUIRED") {
    return authError(
      "authentication",
      "Sign in again",
      "Please sign out and sign in again before retrying this change.",
    );
  }
  if (context === "email-change" && (code.includes("already-exists") || domainCode === "EMAIL_ALREADY_IN_USE")) {
    return authError(
      "conflict",
      "Email already in use",
      "That email address is already used by another account.",
    );
  }
  if (code === "auth/expired-action-code") {
    return authError(
      "validation",
      "Link expired",
      context === "email-action"
        ? "This verification link has expired. Sign in to request a new one."
        : "This reset link has expired. Request a new one to continue.",
    );
  }
  if (code === "auth/invalid-action-code") {
    return authError(
      "validation",
      "Link invalid",
      context === "email-action"
        ? "This verification link is invalid or has already been used."
        : "This reset link is invalid or has already been used. Request a new one to continue.",
    );
  }
  if (context === "register" && code.startsWith("functions/")) {
    return authError(
      classifyError(error),
      "Verification email not sent",
      "Your account was created, but we couldn’t send the verification email. Sign in to request another.",
      true,
    );
  }

  if (category === "rate-limit") {
    if (context === "password-reset-request") {
      return authError(category, "Try again later", "Too many reset requests. Please wait before trying again.", true);
    }
    if (context === "email-verification") {
      return authError(category, "Try again later", "Too many verification emails requested. Please wait before trying again.", true);
    }
    if (context === "email-change") {
      return authError(category, "Try again later", "Too many email-change requests. Please wait before trying again.", true);
    }
  }

  const fallbackByContext: Record<AuthErrorContext, { title: string; message: string }> = {
    register: { title: "Account request failed", message: "The account request could not be completed. Please try again." },
    "sign-in": { title: "Sign-in failed", message: "We couldn’t sign you in. Please try again." },
    "password-change": { title: "Password not changed", message: "We couldn’t change your password. Please try again." },
    "email-change": { title: "Email not changed", message: "We couldn’t request this email change. Please try again." },
    "password-reset-request": { title: "Reset link not sent", message: "We couldn’t request a reset link. Check your connection and try again." },
    "email-verification": { title: "Verification email not sent", message: "We couldn’t resend the verification email. Check your connection and try again." },
    "password-reset": { title: "Password not reset", message: "The reset could not be completed. Please request a new link." },
    "email-action": { title: "Email not verified", message: "We couldn’t verify this email address. Sign in to request a new link." },
  };
  const fallback = fallbackByContext[context];

  return toUserFacingError(error, {
    fallback: {
      ...fallback,
      retryable: true,
    },
  });
}
