import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
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
import Register from "./Register";
import EmailVerificationMessage from "./EmailVerificationMessage";
import { colors } from "../../../config/colors";
import { ROUTES } from "../../../constants";

interface AuthGateProps {
  userData?: UserData | null;
  onBack?: () => void;
  onRegisterComplete?: () => void;
  onProfileComplete?: () => void;
}

export default function AuthGate({ userData, onBack, onRegisterComplete, onProfileComplete }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = useEnabledClaim(user);

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
      // Force token refresh to ensure claims are up-to-date
      await userCredential.user.getIdToken(true);
      setPassword("");
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
    // Check if email is verified
    if (!user.emailVerified) {
      return (
        <EmailVerificationMessage
          user={user}
          onVerified={() => {
            // After verification, check if profile needs completion
            if (onProfileComplete) {
              onProfileComplete();
            }
          }}
          onBack={onBack}
        />
      );
    }

    // If user is signed in but not enabled, show account status message
    if (!isEnabled) {
      return <AccountStatusMessage userData={userData ?? null} onBack={onBack} />;
    }

    // Enabled members use the welcome dashboard at home, not this sign-in surface.
    return <Navigate to={ROUTES.HOME} replace />;
  }

  if (showRegister) {
    return (
      <Register
        onSuccess={() => {
          setShowRegister(false);
          if (onRegisterComplete) {
            onRegisterComplete();
          }
        }}
        onBack={() => setShowRegister(false)}
        onSignInClick={() => setShowRegister(false)}
      />
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitting && email.trim() && password.length >= 6) {
      handleSignIn();
    }
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Alert severity="info">Not signed in</Alert>

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
            disabled={submitting || !email.trim() || password.length < 6}
          >
            Sign in
          </Button>
        </Stack>
      </form>

      {onBack && (
        <Button variant="outlined" onClick={onBack}>
          Back to Home
        </Button>
      )}

      <Typography variant="body2" sx={{ textAlign: "center", color: colors.titleSecondary, mt: 2 }}>
        Don't have an account?{" "}
        <Link
          component="button"
          variant="body2"
          onClick={() => setShowRegister(true)}
          sx={{ cursor: "pointer" }}
        >
          Register
        </Link>
      </Typography>
    </Stack>
  );
}

