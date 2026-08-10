import { alpha, createTheme, lighten, type Theme } from "@mui/material/styles";

export const BRAND_PRIMARY = "#1A2F5A";
export const BRAND_SECONDARY = "#770800";
const LIGHT_BACKGROUND_DEFAULT = "#F9FAFB";

export type AppColorMode = "light" | "dark";

export function createAppTheme(mode: AppColorMode): Theme {
  const primaryMain = mode === "dark" ? lighten(BRAND_PRIMARY, 0.55) : BRAND_PRIMARY;
  const secondaryMain = mode === "dark" ? lighten(BRAND_SECONDARY, 0.35) : BRAND_SECONDARY;

  return createTheme({
    palette: {
      mode,
      contrastThreshold: 4.5,
      primary: {
        main: primaryMain,
        light: mode === "dark" ? lighten(BRAND_PRIMARY, 0.7) : BRAND_PRIMARY,
        dark: mode === "dark" ? lighten(BRAND_PRIMARY, 0.45) : undefined,
      },
      secondary: {
        main: secondaryMain,
        dark: mode === "dark" ? lighten(BRAND_SECONDARY, 0.3) : undefined,
        contrastText: "#FFFFFF",
      },
      ...(mode === "light"
        ? {
            background: { default: LIGHT_BACKGROUND_DEFAULT },
            text: { secondary: alpha(BRAND_PRIMARY, 0.75) },
          }
        : {}),
    },
    components: {
      MuiButtonBase: {
        styleOverrides: {
          root: {
            "&.Mui-focusVisible": {
              outline: `3px solid ${primaryMain}`,
              outlineOffset: 2,
            },
          },
        },
      },
    },
  });
}
