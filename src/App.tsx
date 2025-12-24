import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  CssBaseline,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "./config/firebase";

function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await signInWithEmailAndPassword(auth, email.trim(), password);
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
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Alert severity="info">Not signed in</Alert>

      {error ? <Alert severity="error">{error}</Alert> : null}

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
        variant="contained"
        onClick={handleSignIn}
        disabled={submitting || !email.trim() || password.length < 6}
      >
        Sign in
      </Button>

      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        Tip: create a test user in Firebase Console → Authentication → Users, then sign in here.
      </Typography>
    </Stack>
  );
}

export default function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Typography variant="h4" gutterBottom>
          SODC
        </Typography>
        <Typography sx={{ mb: 2 }}>
          Firebase is wired — let’s prove Auth end-to-end.
        </Typography>
        <AuthGate />
      </Container>
    </>
  );
}