import type { SxProps, Theme } from "@mui/material/styles";

/** Quiet utility pill for the theme-aware footer status bar. */
export const footerUtilityButtonSx: SxProps<Theme> = {
  minHeight: 36,
  px: 1.25,
  py: 0.5,
  color: "text.primary",
  textTransform: "none",
  borderRadius: "9999px",
  backgroundColor: "action.hover",
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "none",
  "&:hover": {
    backgroundColor: "action.selected",
    borderColor: "text.disabled",
    boxShadow: "none",
  },
};
