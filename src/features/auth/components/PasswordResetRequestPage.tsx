import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ROUTES } from "../../../constants";
import { requestPasswordResetEmail } from "../../../shared/utils/firebaseFunctions";

const NEUTRAL_CONFIRMATION =
  "If an account exists for that address, we’ll send a password reset link.";

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordResetEmail(email.trim());
      setSent(true);
    } catch (requestError: unknown) {
      const code =
        typeof requestError === "object" && requestError && "code" in requestError
          ? String(requestError.code)
          : "";
      setError(
        code.includes("resource-exhausted")
          ? "Too many reset requests. Please wait before trying again."
          : "We couldn’t request a reset link. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "640px", mx: "auto", width: "100%" }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ color: "primary.light" }}>
          Reset your password
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter the email address used for your SODC account.
        </Typography>

        {sent ? <Alert severity="success">{NEUTRAL_CONFIRMATION}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                fullWidth
                disabled={submitting}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !email.trim()}
              >
                {submitting ? <CircularProgress size={24} /> : "Send reset link"}
              </Button>
            </Stack>
          </form>
        ) : null}

        <Link component={RouterLink} to={ROUTES.ACCOUNT}>
          Back to sign in
        </Link>
      </Stack>
    </Box>
  );
}
