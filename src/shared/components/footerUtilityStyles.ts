import type { SxProps, Theme } from "@mui/material/styles";

/** Compact counterpart to the translucent account pill used in the main navigation. */
export const footerUtilityButtonSx: SxProps<Theme> = {
  minHeight: 36,
  px: 1.25,
  py: 0.5,
  color: "common.white",
  textTransform: "none",
  borderRadius: "9999px",
  backgroundColor: "rgba(255, 255, 255, 0.12)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)",
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.38)",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.22)",
  },
};
