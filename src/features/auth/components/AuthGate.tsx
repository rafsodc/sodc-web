import { securityMutationError } from "../../../shared/utils/securityMutation";
import { acceptAuthenticatedIdentity, assertSessionAvailable, captureSession, isSessionCurrent, runSessionOperation, type SessionToken } from "../../../shared/appShell/sessionLifecycle";
import { useEffect, useState } from "react";
import { Link as RouterLink, Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Link,
} from "@mui/material";
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { useEnabledClaim } from "../../users/hooks/useEnabledClaim";
import AccountStatusMessage from "../../users/components/AccountStatusMessage";
import type { UserData } from "../../../types";
import EmailVerificationMessage from "./EmailVerificationMessage";
import OnboardingShell from "./OnboardingShell";
import { ROUTES } from "../../../constants";
import { canAttemptSignIn } from "../utils/passwordValidation";
import { assertVerifiedIdentityOwner, reconcileVerifiedIdentity, VERIFIED_IDENTITY_TIMEOUT_MS } from "../utils/reconcileVerifiedIdentity";
import { withTimeout } from "../../../shared/utils/withTimeout";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";
import { reportError, toAuthUserFacingError } from "../../../shared/errors";

interface AuthGateProps {
  userData?: UserData | null;
  onRegisterComplete?: () => void;
  onProfileComplete?: () => void;
}

export default function AuthGate({ userData, onRegisterComplete, onProfileComplete }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signInRequests = useLatestRequestGuard();

  const { isEnabled, isEnabledClaimResolved } = useEnabledClaim(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitialising(false);
    });
    return () => unsub();
  }, []);

  async function completeVerifiedSignIn(owner: User, session: SessionToken, request: number) {
    const current = () => signInRequests.isCurrent(request);
    await reconcileVerifiedIdentity(owner, session, current);
    assertVerifiedIdentityOwner(owner, session, current);
    setPassword("");
    setError(null);
    onRegisterComplete?.();
  }

  async function retryVerifiedAccount() {
    if (!user) return;
    const owner = user;
    const request = signInRequests.start();
    const session = captureSession(owner.uid);
    const current = () => signInRequests.isCurrent(request) && isSessionCurrent(session) && auth.currentUser?.uid === owner.uid;
    setSubmitting(true);
    try { await completeVerifiedSignIn(owner, session, request); }
    catch (caught) {
      if (!current()) return;
      reportError("auth.sign-in.reconcile-email", caught);
      setError(securityMutationError(caught, "Your verified account could not be updated. Try the account check again."));
    } finally { if (current()) setSubmitting(false); }
  }

  async function handleSignIn() {
    const request = signInRequests.start();
    const initialSession = captureSession();
    let owner: User | null = null;
    let session: SessionToken | null = null;
    const current = () => signInRequests.isCurrent(request) && (owner && session
      ? isSessionCurrent(session) && auth.currentUser?.uid === owner.uid
      : isSessionCurrent(initialSession));
    setError(null);
    setSubmitting(true);
    try {
      assertSessionAvailable();
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!signInRequests.isCurrent(request) || auth.currentUser?.uid !== userCredential.user.uid) return;
      owner = userCredential.user;
      session = acceptAuthenticatedIdentity(owner.uid);
      if (owner.emailVerified) {
        await completeVerifiedSignIn(owner, session, request);
      } else {
        await withTimeout(runSessionOperation(() => owner!.getIdToken(true), session), VERIFIED_IDENTITY_TIMEOUT_MS, "Refreshing sign-in timed out");
        assertVerifiedIdentityOwner(owner, session, () => signInRequests.isCurrent(request));
        setPassword("");
        onRegisterComplete?.();
      }
    } catch (caught: unknown) {
      if (!current()) return;
      reportError("auth.sign-in", caught);
      setError(owner?.emailVerified ? securityMutationError(caught, "Your verified account could not be updated. Try the account check again.") : toAuthUserFacingError(caught, "sign-in").message);
    } finally { if (current()) setSubmitting(false); }
  }

  if (initialising) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    if (user.emailVerified && (error || submitting)) {
      return <Stack spacing={2}>
        {error ? <Alert severity="warning">{error}</Alert> : <CircularProgress aria-label="Checking verified account" />}
        {error ? <Button variant="contained" disabled={submitting} onClick={() => void retryVerifiedAccount()}>Retry account check</Button> : null}
      </Stack>;
    }
    if (!user.emailVerified) {
      return (
        <OnboardingShell activeStep="verify">
          <EmailVerificationMessage
            user={user}
            onVerified={() => {
              if (onProfileComplete) {
                onProfileComplete();
              }
            }}
          />
        </OnboardingShell>
      );
    }

    if (!isEnabledClaimResolved) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!isEnabled) {
      return <AccountStatusMessage userData={userData ?? null} />;
    }

    return <Navigate to={ROUTES.HOME} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitting && email.trim() && canAttemptSignIn(password)) {
      handleSignIn();
    }
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant="h5" sx={{ color: "primary.light" }}>
        Sign in
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        New to SODC?{" "}
        <Link component={RouterLink} to={ROUTES.REGISTER}>
          Create an account
        </Link>{" "}
        — verify your email, complete your profile, then wait for admin approval.
      </Typography>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
          />
          <Link component={RouterLink} to={ROUTES.PASSWORD_RESET_REQUEST}>
            Forgot password?
          </Link>

          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !email.trim() || !canAttemptSignIn(password)}
          >
            Sign in
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
