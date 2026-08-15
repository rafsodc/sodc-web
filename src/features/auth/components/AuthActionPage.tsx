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
  PASSWORD_POLICY_HELPER_TEXT,
  validateNewPassword,
} from "../utils/passwordValidation";
import { reconcileMyEmail } from "../../../shared/utils/firebaseFunctions";
import { reportError, toAuthUserFacingError } from "../../../shared/errors";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";

type ActionState = "checking" | "ready" | "invalid" | "complete";

function actionHeading(mode: string | null): string {
  if (mode === "verifyEmail") return "Verify your email";
  if (mode === "verifyAndChangeEmail") return "Confirm your new email";
  return "Reset your password";
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
  const actionRequestGuard = useLatestRequestGuard();

  useEffect(() => {
    const requestToken = actionRequestGuard.start();
    if (
      !["resetPassword", "verifyEmail", "verifyAndChangeEmail"].includes(mode ?? "") ||
      !oobCode
    ) {
      setState("invalid");
      setError("This email action link is invalid.");
      return () => {
        if (actionRequestGuard.isCurrent(requestToken)) actionRequestGuard.invalidate();
      };
    }

    const completeAction = async () => {
      if (mode === "resetPassword") {
        await verifyPasswordResetCode(auth, oobCode);
        if (actionRequestGuard.isCurrent(requestToken)) setState("ready");
        return;
      }

      await checkActionCode(auth, oobCode);
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await reload(auth.currentUser);
        await auth.currentUser.getIdToken(true);
        if (mode === "verifyAndChangeEmail") {
          try {
            await reconcileMyEmail();
          } catch (reconciliationError) {
            reportError("auth.action.reconcile-email", reconciliationError);
            // Sign-in also retries reconciliation; do not turn a successfully
            // applied one-time action into a misleading invalid-link state.
          }
        }
      }
      if (actionRequestGuard.isCurrent(requestToken)) setState("complete");
    };

    void completeAction().catch((actionError: unknown) => {
      reportError("auth.action.apply", actionError, { mode: mode ?? "missing" });
      if (actionRequestGuard.isCurrent(requestToken)) {
        const context = mode === "resetPassword" ? "password-reset" : "email-action";
        setError(toAuthUserFacingError(actionError, context).message);
        setState("invalid");
      }
    });

    return () => {
      if (actionRequestGuard.isCurrent(requestToken)) actionRequestGuard.invalidate();
    };
  }, [mode, oobCode, actionRequestGuard]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const validation = await validateNewPassword(auth, password);
      if (!validation.isValid) {
        setError(validation.error ?? "Choose a stronger password.");
        return;
      }
      await confirmPasswordReset(auth, oobCode, password);
      setPassword("");
      setConfirmation("");
      setState("complete");
    } catch (completionError: unknown) {
      reportError("auth.password-reset.complete", completionError);
      setError(toAuthUserFacingError(completionError, "password-reset").message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "640px", mx: "auto", width: "100%" }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ color: "primary.light" }}>
          {actionHeading(mode)}
        </Typography>

        {state === "checking" ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} />
            <Typography>Checking your secure link…</Typography>
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
                helperText={PASSWORD_POLICY_HELPER_TEXT}
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

        {state === "invalid" && ["verifyEmail", "verifyAndChangeEmail"].includes(mode ?? "") ? (
          <Button component={RouterLink} to={ROUTES.ACCOUNT} variant="contained">
            Sign in to request a new link
          </Button>
        ) : null}

        {state === "complete" ? (
          <>
            <Alert severity="success">
              {mode === "verifyEmail"
                ? "Your email address has been verified."
                : mode === "verifyAndChangeEmail"
                  ? "Your email address has been changed."
                : "Your password has been reset."}
            </Alert>
            <Button component={RouterLink} to={ROUTES.ACCOUNT} variant="contained">
              {mode !== "resetPassword" && auth.currentUser ? "Continue" : "Sign in"}
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
