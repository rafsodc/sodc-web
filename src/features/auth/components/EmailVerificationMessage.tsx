import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { reload, type User } from "firebase/auth";
import { requestEmailVerification } from "../../../shared/utils/firebaseFunctions";

interface EmailVerificationMessageProps {
  user: User;
  onVerified?: () => void;
}

export default function EmailVerificationMessage({
  user,
  onVerified,
}: EmailVerificationMessageProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleResend = async () => {
    setError(null);
    setSending(true);
    try {
      await requestEmailVerification();
      setSent(true);
      setTimeout(() => setSent(false), 60_000);
    } catch (e: unknown) {
      const code = typeof e === "object" && e && "code" in e ? String(e.code) : "";
      setError(
        code.includes("resource-exhausted")
          ? "Too many verification emails requested. Please wait before trying again."
          : "We couldn’t resend the verification email. Check your connection and try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const checkVerification = async () => {
    setChecking(true);
    setError(null);
    try {
      await reload(user);
      await user.getIdToken(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (user.emailVerified) {
        if (onVerified) {
          await onVerified();
        }
      } else {
        setError("Email not yet verified. Please check your inbox and click the verification link.");
      }
    } catch {
      setError("We couldn’t check your verification status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Box sx={{ textAlign: "left" }}>
      <Typography variant="h5" sx={{ color: "primary.light", mb: 1 }}>
        Verify your email
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        We sent a link to <strong>{user.email}</strong>. Open it to verify your address
        securely on this site.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Check your spam folder if the message does not arrive within a few minutes.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {sent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Verification email sent!
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          variant="contained"
          onClick={checkVerification}
          disabled={checking}
          sx={{
            backgroundColor: "secondary.main",
            color: "white",
            "&:hover": {
              backgroundColor: "secondary.main",
              opacity: 0.9,
            },
          }}
        >
          {checking ? <CircularProgress size={24} /> : "I've clicked the link"}
        </Button>
        <Button variant="outlined" onClick={handleResend} disabled={sending || sent}>
          {sending ? <CircularProgress size={24} /> : "Resend email"}
        </Button>
      </Stack>
    </Box>
  );
}
