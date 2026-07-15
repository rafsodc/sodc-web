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
import { FIREBASE_MIN_PASSWORD_LENGTH } from "../../../constants/auth";

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

  const { isEnabled, isEnabledClaimResolved } = useEnabledClaim(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitialising(false);
    });
    return () => unsub();
  }, []);

  async function handleSignIn() {
    setError(null);
    setSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await userCredential.user.getIdToken(true);
      setPassword("");
      if (onRegisterComplete) {
        onRegisterComplete();
      }
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (initialising) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
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

          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !email.trim() || !canAttemptSignIn(password)}
          >
            Sign in
          </Button>
        </Stack>
      </form>

      <Typography variant="caption" color="text.secondary">
        Sign-in requires at least {FIREBASE_MIN_PASSWORD_LENGTH} characters (Firebase minimum).
      </Typography>
    </Stack>
  );
}
