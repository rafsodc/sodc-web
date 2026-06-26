import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import { signOut } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import type { UserData } from "../../../types";

interface AccountStatusMessageProps {
  userData: UserData | null;
}

export default function AccountStatusMessage({ userData }: AccountStatusMessageProps) {
  const [submitting, setSubmitting] = useState(false);

  const getStatusMessage = () => {
    const status = userData?.membershipStatus;
    
    switch (status) {
      case "PENDING":
        return {
          severity: "info" as const,
          title: "Account pending activation",
          message:
            "Your profile is under review. Administrators typically respond within a few business days. You'll get access once your account is activated.",
        };
      case "RESIGNED":
        return {
          severity: "warning" as const,
          title: "Account Deactivated",
          message: "Your account has been deactivated.",
        };
      case "LOST":
        return {
          severity: "warning" as const,
          title: "Account Deactivated",
          message: "Your account has been deactivated.",
        };
      case "DECEASED":
        return {
          severity: "warning" as const,
          title: "Account Deactivated",
          message: "Your account has been deactivated.",
        };
      default:
        return {
          severity: "warning" as const,
          title: "Account Not Active",
          message: "Your account is not currently active. Please contact an administrator for assistance.",
        };
    }
  };

  const statusInfo = getStatusMessage();

  async function handleSignOut() {
    setSubmitting(true);
    try {
      await signOut(auth);
    } catch (e: any) {
      console.error("Sign-out failed:", e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        maxWidth: { sm: "600px" },
        mx: "auto",
        px: { xs: 3, sm: 4 },
        py: 4,
      }}
    >
      <Stack spacing={3}>
        <Alert severity={statusInfo.severity}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            {statusInfo.title}
          </Typography>
          <Typography variant="body1">
            {statusInfo.message}
          </Typography>
        </Alert>

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={handleSignOut}
            disabled={submitting}
            sx={{ backgroundColor: colors.callToAction }}
          >
            Sign out
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

