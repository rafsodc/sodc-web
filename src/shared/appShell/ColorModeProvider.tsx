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
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const setPreference = useCallback((next: ColorModePreference) => {
    setPreferenceState(next);
    writeStoredPreference(next);
  }, []);

  const resolvedMode: AppColorMode = preference === "system" ? (prefersDark ? "dark" : "light") : preference;

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
