import { securityMutationError } from "../../../shared/utils/securityMutation";
import { captureSession, isSessionCurrent, runSessionOperation } from "../../../shared/appShell/sessionLifecycle";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { User } from "firebase/auth";
import { requestEmailVerification } from "../../../shared/utils/firebaseFunctions";
import { auth } from "../../../config/firebase";
import { reconcileVerifiedIdentity, reloadOwnIdentity } from "../utils/reconcileVerifiedIdentity";
import { reportError, toAuthUserFacingError } from "../../../shared/errors";

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

  const checks = useLatestRequestGuard();
  const resends = useLatestRequestGuard();
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setChecking(false);
    setSending(false);
    setSent(false);
    setError(null);
    return () => {
      checks.invalidate();
      resends.invalidate();
      if (sentTimer.current) clearTimeout(sentTimer.current);
    };
  }, [user.uid, checks, resends]);

  const handleResend = async () => {
    const request = resends.start();
    const session = captureSession(user.uid);
    const current = () => resends.isCurrent(request) && isSessionCurrent(session);
    setError(null);
    setSending(true);
    try {
      await runSessionOperation(() => requestEmailVerification(), session);
      if (!current()) return;
      setSent(true);
      sentTimer.current = setTimeout(() => { if (current()) setSent(false); }, 60_000);
    } catch (error) {
      if (!current()) return;
      reportError("auth.email-verification.resend", error);
      setError(securityMutationError(error, toAuthUserFacingError(error, "email-verification").message));
    } finally {
      if (current()) setSending(false);
    }
  };

  const checkVerification = async () => {
    const request = checks.start();
    const session = captureSession(user.uid);
    const current = () => checks.isCurrent(request) && isSessionCurrent(session) && auth.currentUser?.uid === user.uid;
    setChecking(true);
    setError(null);
    try {
      await reloadOwnIdentity(user, session, current);
      if (!current()) return;
      if (!user.emailVerified) { setError("Email not yet verified. Please check your inbox and click the verification link."); return; }
      await reconcileVerifiedIdentity(user, session, current);
      if (!current()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (!current()) return;
      await onVerified?.();
    } catch (error) {
      if (!current()) return;
      reportError("auth.email-verification.check", error);
      setError(securityMutationError(error, toAuthUserFacingError(error, "email-verification").message));
    } finally {
      if (current()) setChecking(false);
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
