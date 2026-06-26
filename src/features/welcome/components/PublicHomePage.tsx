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
        SODC brings together serving and retired RAF signal officers for dinners, events, and
        section-based membership. Members can browse upcoming events, book places, manage guest
        tickets, and pay securely online.
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        New members create an account, verify their email, complete a short profile, and wait for
        admin approval before accessing member areas.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={onJoinClick}
          sx={{ backgroundColor: colors.callToAction, "&:hover": { backgroundColor: colors.callToAction } }}
        >
          Join
        </Button>
        <Button variant="outlined" size="large" onClick={onLogInClick}>
          Log in
        </Button>
      </Stack>
    </Box>
  );
}
