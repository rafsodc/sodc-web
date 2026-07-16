import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";
import { createAppTheme, type AppColorMode } from "../../config/theme";
import {
  ColorModeContext,
  readStoredPreference,
  writeStoredPreference,
  type ColorModePreference,
} from "./ColorModeContext";

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ColorModePreference>(readStoredPreference);
  // Session-only override from the Header's quick toggle — never persisted, always starts null
  // (i.e. "no override") on a fresh page load, so the effective mode falls back to `preference`.
  const [sessionOverride, setSessionOverride] = useState<AppColorMode | null>(null);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const persistedResolvedMode: AppColorMode = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
  const resolvedMode: AppColorMode = sessionOverride ?? persistedResolvedMode;

  const setPreference = useCallback((next: ColorModePreference) => {
    setPreferenceState(next);
    writeStoredPreference(next);
    // A deliberate persistent choice should take effect immediately, not be masked by a
    // leftover session-only override from the Header toggle.
    setSessionOverride(null);
  }, []);

  const toggleSessionMode = useCallback(() => {
    setSessionOverride((current) => (current ?? persistedResolvedMode) === "dark" ? "light" : "dark");
  }, [persistedResolvedMode]);

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

  const contextValue = useMemo(
    () => ({ preference, resolvedMode, setPreference, toggleSessionMode }),
    [preference, resolvedMode, setPreference, toggleSessionMode]
  );

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
