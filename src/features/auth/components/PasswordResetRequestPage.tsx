import { useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Link, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { MAX_EMAIL_LENGTH, ROUTES } from "../../../constants";
import { buildPasswordResetActionCodeSettings } from "../utils/emailAction";
import { isValidEmailAddress, normalizeEmailAddress } from "../utils/emailAddress";
import {
  getPasswordResetRequestError,
  isEnumerationSafeResetRequestSuccess,
} from "../utils/passwordResetErrors";

const NEUTRAL_CONFIRMATION =
  "If an account exists for that email address, we’ve sent a password reset link. Check your inbox and spam folder.";

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isValidEmailAddress(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(
        auth,
        normalizeEmailAddress(email),
        buildPasswordResetActionCodeSettings(window.location.origin),
      );
      setSubmitted(true);
    } catch (requestError) {
      // Firebase projects with email-enumeration protection may resolve unknown
      // users neutrally; older configurations can still return user-not-found.
      if (isEnumerationSafeResetRequestSuccess(requestError)) {
        setSubmitted(true);
      } else {
        setError(getPasswordResetRequestError(requestError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto", px: { xs: 3, sm: 4 } }}>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Typography variant="h4" component="h1" sx={{ color: "primary.light" }}>
          Reset your password
        </Typography>

        {submitted ? (
          <>
            <Alert severity="success">{NEUTRAL_CONFIRMATION}</Alert>
            <Typography variant="body2" color="text.secondary">
              The link will expire. If it no longer works, request another one from this page.
            </Typography>
            <Button variant="outlined" onClick={() => setSubmitted(false)}>
              Send another reset link
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Enter the email address you use to sign in. We’ll send instructions if it belongs to an account.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputProps={{ maxLength: MAX_EMAIL_LENGTH }}
                  disabled={submitting}
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting || !email.trim()}
                  aria-label={submitting ? "Sending reset link" : undefined}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" aria-label="Sending reset link" /> : "Send reset link"}
                </Button>
              </Stack>
            </Box>
          </>
        )}

        <Link component={RouterLink} to={ROUTES.ACCOUNT}>
          Back to sign in
        </Link>
      </Stack>
    </Box>
  );
}
