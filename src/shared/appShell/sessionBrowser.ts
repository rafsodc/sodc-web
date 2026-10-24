import { accountSignInPath } from "../navigation/authReturnTo";

export function sessionRestartPath(location: Pick<Location, "pathname" | "search" | "hash">, returnTo?: string) {
  if (location.pathname === "/guest-ticket" || location.pathname === "/auth/action") {
    return `${location.pathname}${location.search}${location.hash}`;
  }
  return returnTo ? accountSignInPath(returnTo) : "/account";
}
export const LOGOUT_NOTICE = "sodc-logout-confirmation";
export function consumeLogoutConfirmation() {
  try {
    const stored = sessionStorage.getItem(LOGOUT_NOTICE);
    sessionStorage.removeItem(LOGOUT_NOTICE);
    const timestamp = Number(stored);
    return stored !== null && Number.isFinite(timestamp) && Date.now() - timestamp >= 0 && Date.now() - timestamp < 60_000;
  } catch { return false; }
}
