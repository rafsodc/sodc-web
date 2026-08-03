import {
  classifyError,
  extractDomainErrorCode,
  type UserFacingError,
} from "./errorHandling";

export type ProfileErrorContext = "completion" | "update" | "review" | "privacy" | "resignation";

const COPY: Record<ProfileErrorContext, { title: string; message: string }> = {
  completion: { title: "Profile not saved", message: "We couldn’t complete your profile. Check your connection and try again." },
  update: { title: "Profile not saved", message: "We couldn’t save your profile. Check your connection and try again." },
  review: { title: "Review not saved", message: "We couldn’t save your profile review. Check your connection and try again." },
  privacy: { title: "Privacy setting not saved", message: "We couldn’t update your privacy setting. Check your connection and try again." },
  resignation: { title: "Membership not changed", message: "We couldn’t resign your membership. Please try again or contact an administrator." },
};

const MEMBERSHIP_DOMAIN_ERRORS: Record<string, UserFacingError> = {
  ADMIN_RESTRICTED_STATUS: {
    category: "validation",
    title: "Status not changed",
    message: "Admin accounts cannot be assigned a restricted membership status.",
    retryable: false,
  },
  ACCOUNT_NOT_ENABLED: {
    category: "authorization",
    title: "Account not enabled",
    message: "This account must be enabled before its membership status can be changed.",
    retryable: false,
  },
  CURRENT_STATUS_RESTRICTED: {
    category: "precondition",
    title: "Status not changed",
    message: "Membership status cannot be changed from its current restricted status.",
    retryable: false,
  },
  TARGET_STATUS_RESTRICTED: {
    category: "validation",
    title: "Status not changed",
    message: "You cannot change your membership to a restricted status.",
    retryable: false,
  },
  MEMBERSHIP_STATUS_CHANGE_NOT_ALLOWED: {
    category: "precondition",
    title: "Status not changed",
    message: "Membership status cannot be changed from its current state.",
    retryable: false,
  },
  ADMIN_RESIGNATION_NOT_ALLOWED: {
    category: "precondition",
    title: "Membership not changed",
    message: "Admin accounts cannot resign through this flow. Contact another administrator for help.",
    retryable: false,
  },
  MEMBERSHIP_RESIGNATION_NOT_ALLOWED: {
    category: "precondition",
    title: "Membership not changed",
    message: "You cannot resign while your membership has its current status. Contact an administrator for help.",
    retryable: false,
  },
};

/** Maps profile service failures without exposing provider or backend messages. */
export function toProfileUserFacingError(error: unknown, context: ProfileErrorContext): UserFacingError {
  const domainCode = extractDomainErrorCode(error);
  const domainError = domainCode ? MEMBERSHIP_DOMAIN_ERRORS[domainCode] : undefined;
  if (domainError) return { ...domainError };

  const category = classifyError(error);
  if (category === "authentication" || category === "authorization") {
    return {
      category,
      title: "Sign in again",
      message: "Please sign in again before retrying this change.",
      retryable: false,
    };
  }
  const copy = COPY[context];
  return { category, ...copy, retryable: true };
}

/** Maps a validated domain outcome returned by a non-throwing client helper. */
export function toProfileDomainUserFacingError(
  domainCode: string | undefined,
  context: ProfileErrorContext,
): UserFacingError {
  return toProfileUserFacingError(
    domainCode ? { details: { code: domainCode } } : undefined,
    context,
  );
}
