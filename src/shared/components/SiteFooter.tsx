import { Box, Button, Stack, Typography } from "@mui/material";
import AppearanceMenu from "./AppearanceMenu";
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";

export default function SiteFooter() {
  const { openSettings } = useCookiePreferences();

  return (
    <Box
      component="footer"
      sx={{
        width: "100%",
        borderTop: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        color: "text.secondary",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 1, sm: 1.5 }}
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: 1.25,
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Typography variant="body2" sx={{ mr: { sm: "auto" } }}>
          © {new Date().getFullYear()} SODC
        </Typography>
        <AppearanceMenu />
        <Button size="small" color="inherit" onClick={openSettings}>
          Cookie settings
        </Button>
        {/* Terms and Privacy links belong here once approved legal copy is supplied for #359. */}
      </Stack>
    </Box>
  );
}
