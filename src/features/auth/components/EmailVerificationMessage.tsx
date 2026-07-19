import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { sendEmailVerification, type User } from "firebase/auth";
import { buildEmailVerificationActionCodeSettings } from "../utils/emailAction";
import { getEmailVerificationSendError } from "../utils/emailVerificationErrors";

const RESEND_COOLDOWN_SECONDS = 60;

interface EmailVerificationMessageProps {
  user: User;
}

export default function EmailVerificationMessage({ user }: EmailVerificationMessageProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownActive = cooldownSeconds > 0;

  useEffect(() => {
    if (!cooldownActive) return;
    const interval = window.setInterval(() => {
      setCooldownSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldownActive]);

  const handleResend = async () => {
    if (sending || cooldownActive) return;
    setError(null);
    setSending(true);
    try {
      await sendEmailVerification(
        user,
        buildEmailVerificationActionCodeSettings(window.location.origin),
      );
      setSent(true);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (sendError) {
      setError(getEmailVerificationSendError(sendError));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ textAlign: "left" }}>
      <Typography variant="h5" sx={{ color: "primary.light", mb: 1 }}>
        Verify your email
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        We sent a link to <strong>{user.email}</strong>. Open it to verify your address and continue
        account setup in the app.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Check your spam folder if the message does not arrive within a few minutes.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {sent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Verification email sent. The link will open this application.
        </Alert>
      )}

      <Stack spacing={1}>
        <Button variant="outlined" onClick={handleResend} disabled={sending || cooldownActive}>
          {sending ? (
            <CircularProgress size={24} color="inherit" aria-label="Sending verification email" />
          ) : cooldownActive ? (
            `Resend available in ${cooldownSeconds}s`
          ) : (
            "Resend verification email"
          )}
        </Button>
        <Typography variant="caption" color="text.secondary">
          You can safely close this page after opening the verification link.
        </Typography>
      </Stack>
    </Box>
  );
}
