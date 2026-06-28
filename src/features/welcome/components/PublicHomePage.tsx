import { Box, Button, Stack, Typography } from "@mui/material";
import { colors } from "../../../config/colors";

export interface PublicHomePageProps {
  onJoinClick: () => void;
  onLogInClick: () => void;
}

export default function PublicHomePage({ onJoinClick, onLogInClick }: PublicHomePageProps) {
  return (
    <Box sx={{ maxWidth: "720px", mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 } }}>
      <Typography
        variant="h3"
        component="h1"
        sx={{
          color: colors.titlePrimary,
          fontWeight: 400,
          fontSize: { xs: "2rem", sm: "2.75rem" },
          mb: 1,
        }}
      >
        Royal Air Force | <strong>SODC</strong>
      </Typography>
      <Typography
        variant="h5"
        component="p"
        sx={{
          color: colors.titleSecondary,
          fontWeight: 400,
          fontSize: { xs: "1.25rem", sm: "1.5rem" },
          mb: 3,
        }}
      >
        Signal Officers&apos; Dinner Club
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        A place for serving and retired RAF Signal Officers to come together — for dinners, events,
        and the company of fellow members.
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Membership is open to those with a connection to RAF Signals. If you&apos;d like to join,
        create an account and we&apos;ll be in touch.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={onJoinClick}
          sx={{ backgroundColor: colors.callToAction, "&:hover": { backgroundColor: colors.callToAction } }}
        >
          Join SODC
        </Button>
        <Button variant="outlined" size="large" onClick={onLogInClick}>
          Sign in
        </Button>
      </Stack>
    </Box>
  );
}
