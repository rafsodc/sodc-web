import { createContext, useContext } from "react";
import type { AppColorMode } from "../../config/theme";
import { getCookie, removeCookie, setCookie } from "../utils/cookies";
import { COLOR_MODE_COOKIE } from "../cookies/cookieCatalog";

export type ColorModePreference = "system" | AppColorMode;

export const PREFERENCE_COOKIE = COLOR_MODE_COOKIE;

export function readStoredPreference(): ColorModePreference {
  try {
    const stored = getCookie(PREFERENCE_COOKIE);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Cookie access can throw in some environments — fall back to following the system preference.
    return "system";
  }
}

export function writeStoredPreference(preference: ColorModePreference): void {
  try {
    if (preference === "system") {
      removeCookie(PREFERENCE_COOKIE);
    } else {
      setCookie(PREFERENCE_COOKIE, preference);
    }
  } catch {
    // Ignore — the preference just won't persist across sessions.
  }
}

export interface ColorModeContextValue {
  /** The persisted System/Light/Dark choice. Defaults to "system". */
  preference: ColorModePreference;
  /** The mode actually applied to the app right now. */
  resolvedMode: AppColorMode;
  /** Persists an explicit System/Light/Dark choice. */
  setPreference: (preference: ColorModePreference) => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function useColorMode(): ColorModeContextValue {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error("useColorMode must be used within a ColorModeProvider");
  }
  return context;
}
