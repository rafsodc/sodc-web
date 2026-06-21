/**
 * Normalizes a UUID string to lowercase hyphenated form.
 * Accepts RFC-4122 strings with hyphens or a 32-character hex string (no hyphens), as some
 * serializers omit hyphens.
 */
export function toCanonicalUuid(value: string): string {
  const compact = String(value).trim().replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(compact)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`.toLowerCase();
}

export function uuidsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  try {
    return toCanonicalUuid(a) === toCanonicalUuid(b);
  } catch {
    return false;
  }
}

/** UUID-aware id comparison with a plain-string fallback for non-UUID test fixtures. */
export function idsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  if (uuidsEqual(a, b)) {
    return true;
  }
  return a.trim() === b.trim();
}
