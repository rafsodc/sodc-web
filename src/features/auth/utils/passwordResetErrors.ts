const INVALID_ACTION_CODES = new Set([
  "auth/expired-action-code",
  "auth/invalid-action-code",
  "auth/user-disabled",
  "auth/user-not-found",
]);

function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isEnumerationSafeResetRequestSuccess(error: unknown): boolean {
  return authErrorCode(error) === "auth/user-not-found";
}

export function getPasswordResetRequestError(error: unknown): string {
  switch (authErrorCode(error)) {
    case "auth/too-many-requests":
      return "Too many reset requests have been made. Please wait a while before trying again.";
    case "auth/network-request-failed":
      return "We could not connect to the password reset service. Check your connection and try again.";
    case "auth/unauthorized-continue-uri":
      return "Password reset is not configured for this site. Please contact support.";
    default:
      return "We could not send a password reset email. Please try again later.";
  }
}

export function isInvalidPasswordResetCode(error: unknown): boolean {
  return INVALID_ACTION_CODES.has(authErrorCode(error) ?? "");
}

export function getPasswordResetCompletionError(error: unknown): string {
  switch (authErrorCode(error)) {
    case "auth/weak-password":
      return "That password does not meet the required password policy.";
    case "auth/too-many-requests":
      return "Too many attempts have been made. Please wait a while before trying again.";
    case "auth/network-request-failed":
      return "We could not connect to the password reset service. Check your connection and try again.";
    default:
      return "We could not reset your password. Please try again.";
  }
}
