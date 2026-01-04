import { useState, FormEvent } from "react";
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
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "../config/firebase";
import { colors } from "../config/colors";

interface RegisterProps {
  onSuccess?: () => void;
  onBack?: () => void;
  onSignInClick?: () => void;
}

export default function Register({ onSuccess, onBack, onSignInClick }: RegisterProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateForm = (): { isValid: boolean; error?: string } => {
    if (!email.trim()) {
      return { isValid: false, error: "Email is required" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return { isValid: false, error: "Invalid email format" };
    }
    if (password.length < 6) {
      return { isValid: false, error: "Password must be at least 6 characters" };
    }
    if (password !== confirmPassword) {
      return { isValid: false, error: "Passwords do not match" };
    }
    return { isValid: true };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validation = validateForm();
    if (!validation.isValid) {
      setError(validation.error || "Please check your input");
      return;
    }

    setSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Send email verification
      await sendEmailVerification(userCredential.user);

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      let errorMessage = "Registration failed";
      if (e?.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please sign in instead.";
      } else if (e?.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (e?.code === "auth/weak-password") {
        errorMessage = "Password is too weak";
      } else if (e?.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Alert severity="success">
          Registration successful! Please check your email to verify your account.
        </Alert>
        <Typography variant="body2" sx={{ color: colors.titleSecondary }}>
          We've sent a verification email to <strong>{email}</strong>. Please click the link in the email to verify your account, then sign in to complete your profile.
        </Typography>
        {onSignInClick && (
          <Button variant="contained" onClick={onSignInClick}>
            Sign In
          </Button>
        )}
        {onBack && (
          <Button variant="outlined" onClick={onBack}>
            Back to Home
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant="h5" sx={{ color: colors.titlePrimary, mb: 1 }}>
        Create Account
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
            required
            disabled={submitting}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            required
            disabled={submitting}
            helperText="Must be at least 6 characters"
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            required
            disabled={submitting}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !email.trim() || password.length < 6 || password !== confirmPassword}
            sx={{
              backgroundColor: colors.callToAction,
              color: "white",
              "&:hover": {
                backgroundColor: colors.callToAction,
                opacity: 0.9,
              },
            }}
          >
            {submitting ? <CircularProgress size={24} /> : "Register"}
          </Button>
        </Stack>
      </form>

      {onSignInClick && (
        <Typography variant="body2" sx={{ textAlign: "center", color: colors.titleSecondary }}>
          Already have an account?{" "}
          <Link
            component="button"
            variant="body2"
            onClick={onSignInClick}
            sx={{ cursor: "pointer" }}
          >
            Sign in
          </Link>
        </Typography>
      )}

      {onBack && (
        <Button variant="outlined" onClick={onBack}>
          Back to Home
        </Button>
      )}
    </Stack>
  );
}

