export interface SanitizedMailerError {
  name?: string;
  message?: string;
  code?: string | number;
  status?: number;
  statusText?: string;
  providerErrors?: Array<{
    error?: string;
    message?: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const withoutEmailAddresses = value.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[redacted-email]"
  );
  return withoutEmailAddresses.length > 240 ? `${withoutEmailAddresses.slice(0, 237)}...` : withoutEmailAddresses;
}

function sanitizedStatus(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function sanitizedCode(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function sanitizeProviderErrors(value: unknown): SanitizedMailerError["providerErrors"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return undefined;
      }
      return {
        error: sanitizedString(entry.error),
        message: sanitizedString(entry.message),
      };
    })
    .filter((entry): entry is { error?: string; message?: string } => Boolean(entry?.error || entry?.message));
}

export function sanitizeMailerError(error: unknown): SanitizedMailerError {
  if (!isRecord(error)) {
    return {message: sanitizedString(String(error))};
  }

  const response = isRecord(error.response) ? error.response : undefined;
  const responseData = response && isRecord(response.data) ? response.data : undefined;

  return {
    name: sanitizedString(error.name),
    message: sanitizedString(error.message),
    code: sanitizedCode(error.code),
    status: sanitizedStatus(response?.status) ?? sanitizedStatus(error.status) ?? sanitizedStatus(error.statusCode),
    statusText: sanitizedString(response?.statusText),
    providerErrors: sanitizeProviderErrors(responseData?.errors),
  };
}
