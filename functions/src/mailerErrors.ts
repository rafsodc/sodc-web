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

function isEmailLocalChar(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return true; // 0-9
  if (code >= 65 && code <= 90) return true; // A-Z
  if (code >= 97 && code <= 122) return true; // a-z
  return char === "." || char === "_" || char === "+" || char === "-";
}

function isEmailDomainChar(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return true;
  if (code >= 65 && code <= 90) return true;
  if (code >= 97 && code <= 122) return true;
  return char === "." || char === "-";
}

/** Linear-time redaction; avoids ReDoS-prone email regex (CodeQL js/polynomial-redos). */
export function redactEmailAddresses(value: string): string {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("@", i);
    if (at === -1) {
      out += value.slice(i);
      break;
    }

    let localStart = at;
    while (localStart > 0 && isEmailLocalChar(value[localStart - 1]!)) {
      localStart -= 1;
    }

    let domainEnd = at + 1;
    while (domainEnd < value.length && isEmailDomainChar(value[domainEnd]!)) {
      domainEnd += 1;
    }

    const dotInDomain = value.indexOf(".", at + 1);
    const looksLikeEmail =
      localStart < at && domainEnd > at + 1 && dotInDomain > at && dotInDomain < domainEnd;

    if (looksLikeEmail) {
      out += value.slice(i, localStart);
      out += "[redacted-email]";
      i = domainEnd;
    } else {
      out += value.slice(i, at + 1);
      i = at + 1;
    }
  }
  return out;
}

function sanitizedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const withoutEmailAddresses = redactEmailAddresses(value);
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

  const providerErrors: Array<{ error?: string; message?: string }> = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const sanitizedEntry = {
      error: sanitizedString(entry.error),
      message: sanitizedString(entry.message),
    };
    if (sanitizedEntry.error || sanitizedEntry.message) {
      providerErrors.push(sanitizedEntry);
    }
  }
  return providerErrors.length > 0 ? providerErrors : undefined;
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
