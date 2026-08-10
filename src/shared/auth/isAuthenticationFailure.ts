export function isAuthenticationFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = String(candidate.code ?? candidate.status ?? "").toLowerCase();
  const message = String(candidate.message ?? "").toLowerCase();

  return (
    code === "401" ||
    code === "403" ||
    code.includes("unauthenticated") ||
    code.includes("unauthorized") ||
    code.includes("permission-denied") ||
    message.includes("unauthenticated") ||
    message.includes("unauthorized") ||
    message.includes("permission denied")
  );
}
