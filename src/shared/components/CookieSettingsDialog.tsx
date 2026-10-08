import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useCookiePreferences } from "../cookies/CookiePreferencesContext";

export default function CookieSettingsDialog() {
  const {
    decision,
    settingsOpen,
    acceptPreferenceCookies,
    rejectPreferenceCookies,
    closeSettings,
  } = useCookiePreferences();
  const [allowPreferences, setAllowPreferences] = useState(false);

  useEffect(() => {
    if (settingsOpen) setAllowPreferences(decision === "accepted");
  }, [decision, settingsOpen]);

  const save = () => {
    if (allowPreferences) acceptPreferenceCookies();
    else rejectPreferenceCookies();
    closeSettings();
  };

  return (
    <Dialog
      open={settingsOpen}
      onClose={closeSettings}
      fullWidth
      maxWidth="sm"
      aria-labelledby="cookie-settings-title"
    >
      <DialogTitle id="cookie-settings-title">Cookie settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} divider={<Divider flexItem />}>
          <Box>
            <Typography variant="subtitle1" component="h3" fontWeight={600}>
              Essential account storage — always active
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Firebase Authentication uses browser storage to maintain your
              secure sign-in. We also remember this cookie-settings decision
              for six months. These are not used for advertising or analytics.
            </Typography>
          </Box>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={allowPreferences}
                  onChange={(_, checked) => setAllowPreferences(checked)}
                />
              }
              label="Remember my preferences"
            />
            <Typography variant="body2" color="text.secondary">
              When disabled, the site follows your device appearance and
              removes optional preferences, including organiser email
              formatting. Choosing a preference later enables storage again.
              Preference cookies last up to one year.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={closeSettings}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save}>
          Save cookie settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}
