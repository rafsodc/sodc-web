import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { applyActionCode, checkActionCode, reload, type User } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { ROUTES } from "../../../constants";
import { isEmailVerificationAction, parseEmailActionParameters } from "../utils/emailAction";
import {
  getEmailVerificationActionError,
  isInvalidEmailVerificationCode,
} from "../utils/emailVerificationErrors";
import { normalizeEmailAddress } from "../utils/emailAddress";

type VerificationState = "verifying" | "complete" | "invalid" | "error";

interface VerificationCompletion {
  continueToProfile: boolean;
}

const inFlightCompletions = new Map<string, Promise<VerificationCompletion>>();

function completeEmailVerification(oobCode: string): Promise<VerificationCompletion> {
  const existing = inFlightCompletions.get(oobCode);
  if (existing) return existing;

  const completion = checkActionCode(auth, oobCode)
    .then(async (actionInfo) => {
      await applyActionCode(auth, oobCode);
      const verifiedEmail = typeof actionInfo.data.email === "string" ? actionInfo.data.email : null;
      const refreshedUser = await refreshSignedInUser(verifiedEmail);
      return { continueToProfile: Boolean(refreshedUser?.emailVerified) };
    })
    .finally(() => {
      // Keep only concurrent StrictMode/equivalent callers deduplicated; action
      // codes are never persisted after this operation settles.
      inFlightCompletions.delete(oobCode);
    });
  inFlightCompletions.set(oobCode, completion);
  return completion;
}

async function refreshSignedInUser(verifiedEmail: string | null): Promise<User | null> {
  const currentUser = auth.currentUser;
  if (
    !currentUser?.email ||
    !verifiedEmail ||
    normalizeEmailAddress(currentUser.email) !== normalizeEmailAddress(verifiedEmail)
  ) {
    return null;
  }

  try {
    await reload(currentUser);
    await currentUser.getIdToken(true);
    return currentUser;
  } catch {
    // Verification has completed even if this browser cannot refresh its
    // existing session. Signing in again will load the authoritative state.
    return null;
  }
}

export default function EmailVerificationActionPage() {
  const [searchParams] = useSearchParams();
  const parameters = useMemo(() => parseEmailActionParameters(searchParams), [searchParams]);
  const [state, setState] = useState<VerificationState>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [continueToProfile, setContinueToProfile] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    setContinueToProfile(false);

    if (!isEmailVerificationAction(parameters)) {
      setState("invalid");
      return () => { active = false; };
    }

    setState("verifying");
    void completeEmailVerification(parameters.oobCode)
      .then(({ continueToProfile: canContinueToProfile }) => {
        if (!active) return;
        setContinueToProfile(canContinueToProfile);
        setState("complete");
      })
      .catch((verificationError) => {
        if (!active) return;
        if (isInvalidEmailVerificationCode(verificationError)) {
          setState("invalid");
        } else {
          setError(getEmailVerificationActionError(verificationError));
          setState("error");
        }
      });

    return () => { active = false; };
  }, [attempt, parameters]);

  const destination = continueToProfile ? ROUTES.PROFILE_COMPLETION : ROUTES.ACCOUNT;
  const destinationLabel = continueToProfile ? "Continue account setup" : "Continue to sign in";

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto", px: { xs: 3, sm: 4 } }}>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Typography variant="h4" component="h1" sx={{ color: "primary.light" }}>
          Verify your email
        </Typography>

        {state === "verifying" && (
          <Box role="status" aria-label="Verifying email address" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={24} />
            <Typography>Checking your verification link…</Typography>
          </Box>
        )}

        {state === "complete" && (
          <>
            <Alert severity="success">Your email address has been verified.</Alert>
            {!continueToProfile && (
              <Typography variant="body2" color="text.secondary">
                Sign in with the verified account to continue setting up your membership.
              </Typography>
            )}
            <Button component={RouterLink} to={destination} variant="contained">
              {destinationLabel}
            </Button>
          </>
        )}

        {state === "invalid" && (
          <>
            <Alert severity="error">
              This email verification link is invalid, has expired, or has already been used.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Sign in to request a new verification email.
            </Typography>
            <Button component={RouterLink} to={ROUTES.ACCOUNT} variant="contained">
              Continue to sign in
            </Button>
          </>
        )}

        {state === "error" && (
          <>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" onClick={() => setAttempt((current) => current + 1)}>
              Try verifying again
            </Button>
            <Link component={RouterLink} to={ROUTES.ACCOUNT}>Continue to sign in</Link>
          </>
        )}
      </Stack>
    </Box>
  );
}
