import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { sendEmailVerification, reload, type User } from "firebase/auth";
import { colors } from "../config/colors";

interface EmailVerificationMessageProps {
  user: User;
  onVerified?: () => void;
  onBack?: () => void;
}

export default function EmailVerificationMessage({
  user,
  onVerified,
  onBack,
}: EmailVerificationMessageProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleResend = async () => {
    setError(null);
    setSending(true);
    try {
      await sendEmailVerification(user);
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (e: any) {
      setError(e?.message || "Failed to resend verification email");
    } finally {
      setSending(false);
    }
  };

  const checkVerification = async () => {
    setChecking(true);
    setError(null);
    try {
      // Reload the user to get the latest email verification status
      await reload(user);
      // Force a token refresh to ensure we have the latest claims
      await user.getIdToken(true);
      
      // Small delay to ensure the user object is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check the emailVerified status after reload
      // The reload should have updated the user object
      if (user.emailVerified) {
        if (onVerified) {
          // Call the callback which should trigger parent to re-check
          await onVerified();
        }
      } else {
        setError("Email not yet verified. Please check your email and click the verification link.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to check verification status");
    } finally {
      setChecking(false);
    }
  };

  // Auto-check verification status periodically
  useEffect(() => {
    // Don't set up auto-check if already verified
    if (user?.emailVerified) {
      return;
    }

    const interval = setInterval(async () => {
      if (user && !user.emailVerified) {
        try {
          await reload(user);
          // After reload, check if email is now verified
          if (user.emailVerified && onVerified) {
            onVerified();
          }
        } catch {
          // Silently fail auto-checks
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [user, onVerified]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        textAlign: "center",
        p: 3,
      }}
    >
      <Alert severity="info" sx={{ mb: 3, maxWidth: "600px" }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Verify Your Email Address
        </Typography>
        <Typography variant="body2" sx={{ color: colors.titleSecondary, mb: 2 }}>
          We've sent a verification email to <strong>{user.email}</strong>. Please check your inbox and click the verification link to continue.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {sent && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Verification email sent!
          </Alert>
        )}
      </Alert>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={checkVerification}
          disabled={checking}
          sx={{
            backgroundColor: colors.callToAction,
            color: "white",
            "&:hover": {
              backgroundColor: colors.callToAction,
              opacity: 0.9,
            },
          }}
        >
          {checking ? <CircularProgress size={24} /> : "I've Verified My Email"}
        </Button>
        <Button
          variant="outlined"
          onClick={handleResend}
          disabled={sending || sent}
        >
          {sending ? <CircularProgress size={24} /> : "Resend Email"}
        </Button>
      </Stack>

      {onBack && (
        <Button variant="outlined" onClick={onBack} sx={{ mt: 2 }}>
          Back to Home
        </Button>
      )}
    </Box>
  );
}

