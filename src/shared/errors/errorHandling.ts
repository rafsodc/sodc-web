export type ErrorCategory =
  | "authentication"
  | "authorization"
  | "validation"
  | "conflict"
  | "not-found"
  | "rate-limit"
  | "network"
  | "configuration"
  | "unknown";

export interface ErrorAction {
  label: string;
  href?: string;
}

export interface UserFacingError {
  category: ErrorCategory;
  title: string;
  message: string;
  retryable: boolean;
  action?: ErrorAction;
}

export type UserFacingErrorInput = Omit<UserFacingError, "category"> & {
  category?: ErrorCategory;
};

export interface UserFacingErrorOptions {
  domainErrors?: Readonly<Record<string, UserFacingErrorInput>>;
  fallback?: UserFacingErrorInput;
}

type ErrorRecord = Record<string, unknown>;

const DEFAULT_ERRORS: Record<ErrorCategory, UserFacingError> = {
  authentication: {
    category: "authentication",
    title: "Sign in required",
    message: "Please sign in again and retry the operation.",
    retryable: false,
  },
  authorization: {
    category: "authorization",
    title: "Access denied",
    message: "You do not have permission to complete this operation.",
    retryable: false,
  },
  validation: {
    category: "validation",
    title: "Check the information",
    message: "Check the information you entered and try again.",
    retryable: false,
  },
  conflict: {
    category: "conflict",
    title: "The information has changed",
    message: "Refresh the page, check the latest information, and try again.",
    retryable: true,
  },
  "not-found": {
    category: "not-found",
    title: "Not found",
    message: "The requested information could not be found.",
    retryable: false,
  },
  "rate-limit": {
    category: "rate-limit",
    title: "Try again later",
    message: "Too many requests have been made. Please wait before trying again.",
    retryable: true,
  },
  network: {
    category: "network",
    title: "Connection problem",
    message: "Check your connection and try again.",
    retryable: true,
  },
  configuration: {
    category: "configuration",
    title: "Service unavailable",
    message: "This service is not available at the moment. Please contact an administrator.",
    retryable: false,
  },
  unknown: {
    category: "unknown",
    title: "Something went wrong",
    message: "The operation could not be completed. Please try again.",
    retryable: true,
  },
};

function asRecord(value: unknown): ErrorRecord | undefined {
  return typeof value === "object" && value !== null
    ? (value as ErrorRecord)
    : undefined;
}

function stringProperty(value: unknown, property: string): string | undefined {
  const candidate = asRecord(value)?.[property];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function normaliseProviderCode(code: string): string {
  return code.trim().toLowerCase();
}

/** Extracts a provider error code without consulting its untrusted message. */
export function extractErrorCode(error: unknown): string | undefined {
  const code = stringProperty(error, "code");
  return code ? normaliseProviderCode(code) : undefined;
}

/**
 * Extracts an application-owned code returned in callable error details.
 * Only a restricted code shape is accepted so arbitrary detail is never treated
 * as display content.
 */
export function extractDomainErrorCode(error: unknown): string | undefined {
  const record = asRecord(error);
  const detailsCode = stringProperty(record?.details, "code");
  const customDataCode = stringProperty(record?.customData, "code");
  const code = detailsCode ?? customDataCode;
  if (!code || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(code)) return undefined;
  return code.toUpperCase();
}

export function classifyError(error: unknown): ErrorCategory {
  const code = extractErrorCode(error) ?? "";

  if (
    code.includes("network-request-failed") ||
    code.endsWith("/unavailable") ||
    code === "unavailable" ||
    code.endsWith("/deadline-exceeded") ||
    code === "deadline-exceeded" ||
    code.endsWith("/aborted") ||
    code === "aborted"
  ) {
    return "network";
  }
  if (code.includes("too-many-requests") || code.includes("resource-exhausted")) {
    return "rate-limit";
  }
  if (code.includes("permission-denied")) return "authorization";
  if (
    code.includes("unauthenticated") ||
    code.includes("requires-recent-login") ||
    code.includes("user-token-expired") ||
    code.includes("invalid-user-token")
  ) {
    return "authentication";
  }
  if (code.includes("not-found") || code.includes("user-not-found")) return "not-found";
  if (
    code.includes("already-exists") ||
    code.includes("email-already-in-use") ||
    code.includes("operation-not-allowed")
  ) {
    return "conflict";
  }
  if (
    code.includes("invalid-argument") ||
    code.includes("invalid-email") ||
    code.includes("weak-password") ||
    code.includes("password-does-not-meet-requirements")
  ) {
    return "validation";
  }
  if (code.includes("failed-precondition")) return "configuration";
  if (code.startsWith("auth/")) return "authentication";
  return "unknown";
}

function withCategory(
  input: UserFacingErrorInput,
  category: ErrorCategory,
): UserFacingError {
  return { ...input, category: input.category ?? category };
}

/** Maps an unknown technical failure to safe, deterministic display content. */
export function toUserFacingError(
  error: unknown,
  options: UserFacingErrorOptions = {},
): UserFacingError {
  const category = classifyError(error);
  const domainCode = extractDomainErrorCode(error);
  const domainError = domainCode ? options.domainErrors?.[domainCode] : undefined;
  if (domainError) return withCategory(domainError, category);
  if (options.fallback) return withCategory(options.fallback, category);
  return { ...DEFAULT_ERRORS[category] };
}

/**
 * Reports the original failure separately from user-facing mapping. Do not put
 * secrets or personal data in the context string or metadata.
 */
export function reportError(
  context: string,
  error: unknown,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  console.error(`[${context}]`, error, metadata ?? {});
}
