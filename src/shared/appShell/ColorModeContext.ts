import { createContext, useContext } from "react";
import type { AppColorMode } from "../../config/theme";

export type ColorModePreference = "system" | AppColorMode;

export const STORAGE_KEY = "sodc-color-mode-preference";

export function readStoredPreference(): ColorModePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // localStorage can throw (e.g. private browsing, or unavailable in some environments) —
    // fall back to following the system preference.
    return "system";
  }
}

export function writeStoredPreference(preference: ColorModePreference): void {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    // Ignore — the preference just won't persist across sessions.
  }
}

export interface ColorModeContextValue {
  preference: ColorModePreference;
  resolvedMode: AppColorMode;
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
