import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";

export default function CookieBanner() {
  const {
    decision,
    acceptPreferenceCookies,
    rejectPreferenceCookies,
    openSettings,
  } = useCookiePreferences();

  if (decision !== null) return null;

  return (
    <Paper
      component="section"
      role="region"
      aria-labelledby="cookie-banner-heading"
      square
      elevation={12}
      sx={{
        position: "fixed",
        zIndex: (theme) => theme.zIndex.snackbar,
        inset: "auto 0 0",
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3 }, py: 2 }}>
        <Typography id="cookie-banner-heading" variant="h6" component="h2">
          Cookies and browser storage
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 850 }}>
          We use essential browser storage to keep accounts secure. With your
          permission, we also use one cookie to remember your Light or Dark
          appearance choice. We do not use analytics or advertising cookies.
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ mt: 2, alignItems: { xs: "stretch", sm: "center" } }}
        >
          <Button variant="contained" onClick={acceptPreferenceCookies}>
            Allow appearance cookie
          </Button>
          <Button variant="outlined" onClick={rejectPreferenceCookies}>
            Decline appearance cookie
          </Button>
          <Button color="inherit" onClick={openSettings}>
            View cookie settings
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
