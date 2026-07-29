import { useEffect, useState, type FormEvent } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
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
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  reload,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "../../../config/firebase";
import { ROUTES } from "../../../constants";
import {
  getRegistrationPasswordHelperText,
  validateRegistrationPassword,
} from "../utils/passwordValidation";

type ActionState = "checking" | "ready" | "invalid" | "complete";

function resetErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("expired-action-code")) {
    return "This reset link has expired. Request a new one to continue.";
  }
  if (code.includes("invalid-action-code")) {
    return "This reset link is invalid or has already been used. Request a new one to continue.";
  }
  if (code.includes("weak-password")) {
    return getRegistrationPasswordHelperText();
  }
  return "The reset could not be completed. Please request a new link.";
}

function verificationErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("expired-action-code")) {
    return "This verification link has expired. Sign in to request a new one.";
  }
  if (code.includes("invalid-action-code")) {
    return "This verification link is invalid or has already been used.";
  }
  return "We couldn’t verify this email address. Sign in to request a new link.";
}

export default function AuthActionPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode") ?? "";
  const [state, setState] = useState<ActionState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!["resetPassword", "verifyEmail"].includes(mode ?? "") || !oobCode) {
      setState("invalid");
      setError("This email action link is invalid.");
      return () => {
        active = false;
      };
    }

    const completeAction = async () => {
      if (mode === "resetPassword") {
        await verifyPasswordResetCode(auth, oobCode);
        if (active) setState("ready");
        return;
      }

      await checkActionCode(auth, oobCode);
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await reload(auth.currentUser);
        await auth.currentUser.getIdToken(true);
      }
      if (active) setState("complete");
    };

    void completeAction().catch((actionError: unknown) => {
      if (active) {
        setError(
          mode === "verifyEmail"
            ? verificationErrorMessage(actionError)
            : resetErrorMessage(actionError),
        );
        setState("invalid");
      }
    });

    return () => {
      active = false;
    };
  }, [mode, oobCode]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const validation = validateRegistrationPassword(password);
    if (!validation.isValid) {
      setError(validation.error ?? "Choose a stronger password.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPassword("");
      setConfirmation("");
      setState("complete");
    } catch (completionError: unknown) {
      setError(resetErrorMessage(completionError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "640px", mx: "auto", width: "100%" }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ color: "primary.light" }}>
          {mode === "verifyEmail" ? "Verify your email" : "Reset your password"}
        </Typography>

        {state === "checking" ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} />
            <Typography>Checking your reset link…</Typography>
          </Stack>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        {state === "ready" && mode === "resetPassword" ? (
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="New password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                helperText={getRegistrationPasswordHelperText()}
                disabled={submitting}
                required
                fullWidth
              />
              <TextField
                label="Confirm new password"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                disabled={submitting}
                required
                fullWidth
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? <CircularProgress size={24} /> : "Set new password"}
              </Button>
            </Stack>
          </form>
        ) : null}

        {state === "invalid" && mode === "resetPassword" ? (
          <Button component={RouterLink} to={ROUTES.PASSWORD_RESET_REQUEST} variant="contained">
            Request a new link
          </Button>
        ) : null}

        {state === "invalid" && mode === "verifyEmail" ? (
          <Button component={RouterLink} to={ROUTES.ACCOUNT} variant="contained">
            Sign in to request a new link
          </Button>
        ) : null}

        {state === "complete" ? (
          <>
            <Alert severity="success">
              {mode === "verifyEmail"
                ? "Your email address has been verified."
                : "Your password has been reset."}
            </Alert>
            <Button component={RouterLink} to={ROUTES.ACCOUNT} variant="contained">
              {mode === "verifyEmail" && auth.currentUser ? "Continue" : "Sign in"}
            </Button>
          </>
        ) : null}

        {state !== "complete" ? (
          <Link component={RouterLink} to={ROUTES.ACCOUNT}>
            Back to sign in
          </Link>
        ) : null}
      </Stack>
    </Box>
  );
}
