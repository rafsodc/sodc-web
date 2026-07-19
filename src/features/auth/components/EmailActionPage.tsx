import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { ROUTES } from "../../../constants";
import EmailVerificationActionPage from "./EmailVerificationActionPage";
import PasswordResetActionPage from "./PasswordResetActionPage";

export default function EmailActionPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");

  if (mode === "resetPassword") return <PasswordResetActionPage />;
  if (mode === "verifyEmail") return <EmailVerificationActionPage />;

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto", px: { xs: 3, sm: 4 } }}>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Typography variant="h4" component="h1" sx={{ color: "primary.light" }}>
          Email action unavailable
        </Typography>
        <Alert severity="error">This email action link is invalid or is not supported.</Alert>
        <Button component={RouterLink} to={ROUTES.ACCOUNT} variant="contained">
          Continue to sign in
        </Button>
      </Stack>
    </Box>
  );
}
