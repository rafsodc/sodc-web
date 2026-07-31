import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const { decision, acceptPreferenceCookies } = useCookiePreferences();
  const [preference, setPreferenceState] = useState<ColorModePreference>(readStoredPreference);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const resolvedMode: AppColorMode = preference === "system" ? (prefersDark ? "dark" : "light") : preference;

  useEffect(() => {
    if (decision === "rejected") {
      setPreferenceState("system");
      writeStoredPreference("system");
    }
  }, [decision]);

  const setPreference = useCallback(
    (next: ColorModePreference) => {
      if (next !== "system") {
        // Choosing a persistent appearance is an explicit request to remember
        // that preference, so enable only this optional storage purpose.
        acceptPreferenceCookies();
      }
      setPreferenceState(next);
      writeStoredPreference(next);
    },
    [acceptPreferenceCookies]
  );

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

  const contextValue = useMemo(
    () => ({ preference, resolvedMode, setPreference }),
    [preference, resolvedMode, setPreference]
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
