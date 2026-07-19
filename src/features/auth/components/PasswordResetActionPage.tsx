import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Link, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { ROUTES } from "../../../constants";
import {
  getRegistrationPasswordHelperText,
  validateRegistrationPassword,
} from "../utils/passwordValidation";
import { isPasswordResetAction, parseEmailActionParameters } from "../utils/emailAction";
import {
  getPasswordResetCompletionError,
  isInvalidPasswordResetCode,
} from "../utils/passwordResetErrors";

type VerificationState = "verifying" | "ready" | "invalid" | "error";

export default function PasswordResetActionPage() {
  const [searchParams] = useSearchParams();
  const parameters = useMemo(() => parseEmailActionParameters(searchParams), [searchParams]);
  const [verificationState, setVerificationState] = useState<VerificationState>("verifying");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setComplete(false);
    setNewPassword("");
    setConfirmPassword("");
    setSubmitting(false);
    setError(null);

    if (!isPasswordResetAction(parameters)) {
      setVerificationState("invalid");
      return () => { active = false; };
    }

    setVerificationState("verifying");
    void verifyPasswordResetCode(auth, parameters.oobCode)
      .then(() => {
        if (active) setVerificationState("ready");
      })
      .catch((verificationError) => {
        if (!active) return;
        if (isInvalidPasswordResetCode(verificationError)) {
          setVerificationState("invalid");
        } else {
          setError(getPasswordResetCompletionError(verificationError));
          setVerificationState("error");
        }
      });

    return () => { active = false; };
  }, [parameters, verificationAttempt]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isPasswordResetAction(parameters) || verificationState !== "ready") return;

    const validation = validateRegistrationPassword(newPassword);
    if (!validation.isValid) {
      setError(validation.error ?? "Password does not meet the minimum requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, parameters.oobCode, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setComplete(true);
    } catch (completionError) {
      if (isInvalidPasswordResetCode(completionError)) {
        setVerificationState("invalid");
      } else {
        setError(getPasswordResetCompletionError(completionError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto", px: { xs: 3, sm: 4 } }}>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Typography variant="h4" component="h1" sx={{ color: "primary.light" }}>
          Choose a new password
        </Typography>

        {verificationState === "verifying" && (
          <Box role="status" aria-label="Checking password reset link" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={24} />
            <Typography>Checking your reset link…</Typography>
          </Box>
        )}

        {verificationState === "invalid" && (
          <>
            <Alert severity="error">
              This password reset link is invalid, has expired, or has already been used.
            </Alert>
            <Button component={RouterLink} to={ROUTES.PASSWORD_RESET_REQUEST} variant="contained">
              Request a new reset link
            </Button>
            <Link component={RouterLink} to={ROUTES.ACCOUNT}>Back to sign in</Link>
          </>
        )}

        {verificationState === "error" && (
          <>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" onClick={() => setVerificationAttempt((attempt) => attempt + 1)}>
              Try checking the link again
            </Button>
            <Link component={RouterLink} to={ROUTES.PASSWORD_RESET_REQUEST}>Request a new reset link</Link>
            <Link component={RouterLink} to={ROUTES.ACCOUNT}>Back to sign in</Link>
          </>
        )}

        {verificationState === "ready" && complete && (
          <>
            <Alert severity="success">
              Your password has been reset. For your security, sign in again with your new password.
            </Alert>
            <Button component={RouterLink} to={ROUTES.ACCOUNT} variant="contained">
              Continue to sign in
            </Button>
          </>
        )}

        {verificationState === "ready" && !complete && (
          <>
            <Typography variant="body2" color="text.secondary">
              {getRegistrationPasswordHelperText()}.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                  required
                  fullWidth
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting || !newPassword || !confirmPassword}
                  aria-label={submitting ? "Resetting password" : undefined}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" aria-label="Resetting password" /> : "Reset password"}
                </Button>
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
}
