import { useCallback, useMemo, useState, type ReactNode } from "react";
import { getCookie, removeCookie, setCookie } from "../utils/cookies";
import {
  COLOR_MODE_COOKIE,
  COOKIE_DECISION_COOKIE,
  COOKIE_DECISION_MAX_AGE_SECONDS,
  type CookieDecision,
} from "./cookieCatalog";
import {
  CookiePreferencesContext,
  type CookiePreferencesContextValue,
} from "./CookiePreferencesContext";

function readDecision(): CookieDecision | null {
  try {
    const stored = getCookie(COOKIE_DECISION_COOKIE);
    return stored === "accepted" || stored === "rejected" ? stored : null;
  } catch {
    return null;
  }
}

export function CookiePreferencesProvider({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<CookieDecision | null>(readDecision);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const persistDecision = useCallback((next: CookieDecision) => {
    setDecision(next);
    try {
      setCookie(COOKIE_DECISION_COOKIE, next, {
        maxAgeSeconds: COOKIE_DECISION_MAX_AGE_SECONDS,
      });
    } catch {
      // The choice still applies to this page even if browser storage is blocked.
    }
  }, []);

  const acceptPreferenceCookies = useCallback(() => {
    persistDecision("accepted");
  }, [persistDecision]);

  const rejectPreferenceCookies = useCallback(() => {
    persistDecision("rejected");
    try {
      removeCookie(COLOR_MODE_COOKIE);
    } catch {
      // ColorModeProvider also resets its in-memory preference.
    }
  }, [persistDecision]);

  const contextValue = useMemo<CookiePreferencesContextValue>(
    () => ({
      decision,
      settingsOpen,
      acceptPreferenceCookies,
      rejectPreferenceCookies,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [
      acceptPreferenceCookies,
      decision,
      rejectPreferenceCookies,
      settingsOpen,
    ]
  );

  return (
    <CookiePreferencesContext.Provider value={contextValue}>
      {children}
    </CookiePreferencesContext.Provider>
  );
}
