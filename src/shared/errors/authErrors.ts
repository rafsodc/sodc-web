import {
  classifyError,
  extractErrorCode,
  toUserFacingError,
  type UserFacingError,
} from "./errorHandling";

export type AuthErrorContext =
  | "register"
  | "sign-in"
  | "password-change"
  | "email-change"
  | "action-link";

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
  if (code === "auth/requires-recent-login") {
    return authError(
      "authentication",
      "Sign in again",
      "Please sign out and sign in again before retrying this change.",
    );
  }
  if (code === "auth/expired-action-code") {
    return authError(
      "validation",
      "Link expired",
      "This secure link has expired. Request a new one to continue.",
    );
  }
  if (code === "auth/invalid-action-code") {
    return authError(
      "validation",
      "Link invalid",
      "This secure link is invalid or has already been used.",
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

  return toUserFacingError(error, {
    fallback: {
      title: context === "sign-in" ? "Sign-in failed" : "Account request failed",
      message:
        context === "sign-in"
          ? "We couldn’t sign you in. Please try again."
          : "The account request could not be completed. Please try again.",
      retryable: true,
    },
  });
}
