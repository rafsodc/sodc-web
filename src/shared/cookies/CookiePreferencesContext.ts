import { createContext, useContext } from "react";
import type { CookieDecision } from "./cookieCatalog";

export interface CookiePreferencesContextValue {
  decision: CookieDecision | null;
  settingsOpen: boolean;
  acceptPreferenceCookies: () => void;
  rejectPreferenceCookies: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const CookiePreferencesContext =
  createContext<CookiePreferencesContextValue | null>(null);

export function useCookiePreferences(): CookiePreferencesContextValue {
  const context = useContext(CookiePreferencesContext);
  if (!context) {
    throw new Error(
      "useCookiePreferences must be used within a CookiePreferencesProvider"
    );
  }
  return context;
}
