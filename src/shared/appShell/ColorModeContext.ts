import { createContext, useContext } from "react";
import type { AppColorMode } from "../../config/theme";
import { getCookie, removeCookie, setCookie } from "../utils/cookies";

export type ColorModePreference = "system" | AppColorMode;

export const PREFERENCE_COOKIE = "sodc-color-mode-preference";

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
  /** The persisted System/Light/Dark choice, set from Account Settings. Defaults to "system". */
  preference: ColorModePreference;
  /**
   * The mode actually applied to the app right now. Starts each page load from `preference`
   * (system preference, or the persisted explicit choice) — toggleSessionMode can flip it for
   * the current session only, without touching the persisted preference.
   */
  resolvedMode: AppColorMode;
  /** Persists an explicit System/Light/Dark choice (Account Settings). Clears any session override. */
  setPreference: (preference: ColorModePreference) => void;
  /** Flips resolvedMode for the current session only (Header toggle) — never persisted. */
  toggleSessionMode: () => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function useColorMode(): ColorModeContextValue {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error("useColorMode must be used within a ColorModeProvider");
  }
  return context;
}
