import { Box, Button, Stack, Typography } from "@mui/material";
import { CookieOutlined } from "@mui/icons-material";
import AppearanceMenu from "./AppearanceMenu";
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";
import { footerUtilityButtonSx } from "./footerUtilityStyles";

export default function SiteFooter() {
  const { openSettings } = useCookiePreferences();

  return (
    <Box
      component="footer"
      sx={{
        display: { xs: "none", sm: "block" },
        width: "100%",
        borderTop: 1,
        borderColor: "divider",
        backgroundColor: (theme) =>
          theme.palette.mode === "light" ? theme.palette.grey[100] : theme.palette.grey[900],
        color: "text.primary",
      }}
    >
      <Stack
        data-testid="footer-status-row"
        direction="row"
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          py: 1.25,
          alignItems: "center",
          flexWrap: "nowrap",
          columnGap: 1.5,
          rowGap: 1,
        }}
      >
        <Typography variant="body2" sx={{ mr: "auto", opacity: 0.8 }}>
          © {new Date().getFullYear()} SODC
        </Typography>
        <Box
          data-testid="footer-utilities"
          sx={{
            width: "auto",
            ml: "auto",
            display: "flex",
            flexWrap: "nowrap",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 1,
          }}
        >
          <AppearanceMenu />
          <Button
            size="small"
            color="inherit"
            startIcon={<CookieOutlined />}
            onClick={openSettings}
            sx={footerUtilityButtonSx}
          >
            Cookie settings
          </Button>
        </Box>
        {/* Terms and Privacy links belong here once approved legal copy is supplied for #359. */}
      </Stack>
    </Box>
  );
}
