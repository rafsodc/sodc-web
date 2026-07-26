import { ROUTES } from "../../constants";

export function safeReturnTo(search: string): string | null {
  const value = new URLSearchParams(search).get("returnTo");
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  try {
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || url.pathname === ROUTES.ACCOUNT) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function accountSignInPath(returnTo: string): string {
  const safe = safeReturnTo(`?returnTo=${encodeURIComponent(returnTo)}`);
  return safe
    ? `${ROUTES.ACCOUNT}?returnTo=${encodeURIComponent(safe)}`
    : ROUTES.ACCOUNT;
}
