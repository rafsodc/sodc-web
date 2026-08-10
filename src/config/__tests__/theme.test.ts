import { getContrastRatio } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import {
  BRAND_PRIMARY,
  BRAND_SECONDARY,
  createAppTheme,
} from "../theme";

describe("createAppTheme", () => {
  it("retains the established brand palette in light mode", () => {
    const theme = createAppTheme("light");

    expect(theme.palette.primary.main).toBe(BRAND_PRIMARY);
    expect(theme.palette.secondary.main).toBe(BRAND_SECONDARY);
    expect(theme.palette.background.default).toBe("#F9FAFB");
  });

  it("gives dark-mode primary actions and links accessible contrast", () => {
    const theme = createAppTheme("dark");

    expect(
      getContrastRatio(theme.palette.primary.main, theme.palette.background.default)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      getContrastRatio(theme.palette.primary.main, theme.palette.background.paper)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      getContrastRatio(theme.palette.primary.contrastText, theme.palette.primary.main)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("gives dark-mode secondary actions a visible boundary and readable label", () => {
    const theme = createAppTheme("dark");

    expect(
      getContrastRatio(theme.palette.secondary.main, theme.palette.background.default)
    ).toBeGreaterThanOrEqual(3);
    expect(
      getContrastRatio(theme.palette.secondary.contrastText, theme.palette.secondary.main)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("provides a visible keyboard focus indicator for button-based controls", () => {
    const root = themeButtonBaseRoot(createAppTheme("dark"));
    const focusVisible = root["&.Mui-focusVisible"] as Record<string, unknown>;

    expect(focusVisible.outline).toMatch(/^3px solid /);
    expect(focusVisible.outlineOffset).toBe(2);
  });
});

function themeButtonBaseRoot(theme: ReturnType<typeof createAppTheme>) {
  return theme.components?.MuiButtonBase?.styleOverrides?.root as Record<
    string,
    unknown
  >;
}
