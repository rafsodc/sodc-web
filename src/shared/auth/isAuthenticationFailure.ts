import { extractErrorCode } from "../errors/errorHandling";

export function isAuthenticationFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; status?: unknown };
  const structuredCode = extractErrorCode(error);
  const numericStatus =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.code === "number"
        ? candidate.code
        : null;
  const code = structuredCode ?? "";

  return (
    numericStatus === 401 ||
    numericStatus === 403 ||
    code.includes("unauthenticated") ||
    code.includes("unauthorized") ||
    code.includes("permission-denied")
  );
}
