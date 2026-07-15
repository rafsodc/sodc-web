import { alpha, createTheme } from "@mui/material/styles";

const PRIMARY = "#1A2F5A";
const SECONDARY = "#770800";
const BACKGROUND_DEFAULT = "#F9FAFB";

export const theme = createTheme({
  palette: {
    primary: { main: PRIMARY },
    secondary: { main: SECONDARY },
    background: { default: BACKGROUND_DEFAULT },
    text: { secondary: alpha(PRIMARY, 0.75) },
  },
});
