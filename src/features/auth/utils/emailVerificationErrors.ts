const INVALID_VERIFICATION_CODES = new Set([
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

export function isInvalidEmailVerificationCode(error: unknown): boolean {
  return INVALID_VERIFICATION_CODES.has(authErrorCode(error) ?? "");
}

export function getEmailVerificationActionError(error: unknown): string {
  switch (authErrorCode(error)) {
    case "auth/network-request-failed":
      return "We could not connect to the email verification service. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many verification attempts have been made. Please wait a while before trying again.";
    default:
      return "We could not verify your email address. Please try again.";
  }
}

export function getEmailVerificationSendError(error: unknown): string {
  switch (authErrorCode(error)) {
    case "auth/too-many-requests":
      return "Too many verification emails have been requested. Please wait before trying again.";
    case "auth/network-request-failed":
      return "We could not connect to the email service. Check your connection and try again.";
    case "auth/unauthorized-continue-uri":
    case "auth/invalid-continue-uri":
      return "Email verification is not configured for this site. Please contact support.";
    default:
      return "We could not send a verification email. Please try again later.";
  }
}
