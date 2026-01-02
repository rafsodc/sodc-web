import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "../config/firebase";
import { useEnabledClaim } from "../hooks/useEnabledClaim";
import { useUserData } from "../hooks/useUserData";
import AccountStatusMessage from "./AccountStatusMessage";

interface AuthGateProps {
  onBack?: () => void;
}

export default function AuthGate({ onBack }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = useEnabledClaim(user);
  const { userData } = useUserData(user);

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

  async function handleSignOut() {
    setError(null);
    setSubmitting(true);
    try {
      await signOut(auth);
    } catch (e: any) {
      setError(e?.message ?? "Sign-out failed");
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
    // If user is signed in but not enabled, show account status message
    if (!isEnabled) {
      return <AccountStatusMessage userData={userData} onBack={onBack} />;
    }

    // User is signed in and enabled
    return (
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Alert severity="success">Signed in</Alert>
        <Typography>
          <strong>UID:</strong> {user.uid}
        </Typography>
        {user.email ? (
          <Typography>
            <strong>Email:</strong> {user.email}
          </Typography>
        ) : null}

        <Button variant="contained" onClick={handleSignOut} disabled={submitting}>
          Sign out
        </Button>
        {onBack && (
          <Button variant="outlined" onClick={onBack}>
            Back to Home
          </Button>
        )}
      </Stack>
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

      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        Tip: create a test user in Firebase Console → Authentication → Users, then sign in here.
      </Typography>
    </Stack>
  );
}

