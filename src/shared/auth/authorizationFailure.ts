/** Stable server markers, including nested Firebase Data Connect GraphQL errors. */
export type AuthorizationFailure = "stale-version" | "revoked";
export function classifyAuthorizationFailure(error: unknown): AuthorizationFailure | null {
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number): AuthorizationFailure | null => {
    if (depth > 8) return null;
    if (typeof value === "string") {
      if (value.includes("ACCESS_REVOKED")) return "revoked";
      if (value.includes("SESSION_VERSION_STALE")) return "stale-version";
      return null;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);
    const children: unknown[] = [];
    if (Array.isArray(value)) children.push(...value);
    else for (const key of ["code", "message", "details", "errors", "error", "data", "response", "cause", "extensions"]) {
      // Error.message/cause are non-enumerable; Firebase wrappers can inherit accessors.
      // Only inspect known error fields, and tolerate throwing accessors.
      try { children.push(Reflect.get(value, key)); } catch { /* Unreadable error metadata. */ }
    }
    let result: AuthorizationFailure | null = null;
    for (const child of children) {
      const classification = visit(child, depth + 1);
      if (classification === "revoked") return classification;
      result ??= classification;
    }
    return result;
  };
  return visit(error, 0);
}
