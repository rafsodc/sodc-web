import { alpha, createTheme, lighten, type Theme } from "@mui/material/styles";

const PRIMARY = "#1A2F5A";
const SECONDARY = "#770800";
const LIGHT_BACKGROUND_DEFAULT = "#F9FAFB";

export type AppColorMode = "light" | "dark";

/**
 * primary.main stays the fixed brand navy in both modes — across the app it's only ever used as
 * a background (AppBar, avatars) or paired with an explicit white foreground, so it never needs
 * to contrast against the page's own background. primary.light is used for heading/link text
 * color rendered directly on the page background, which must lighten in dark mode to stay legible
 * against a dark background.
 */
export function createAppTheme(mode: AppColorMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: PRIMARY,
        light: mode === "dark" ? lighten(PRIMARY, 0.55) : PRIMARY,
      },
      secondary: { main: SECONDARY },
      ...(mode === "light"
        ? {
            background: { default: LIGHT_BACKGROUND_DEFAULT },
            text: { secondary: alpha(PRIMARY, 0.75) },
          }
        : {}),
    },
  });
}
