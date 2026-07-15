import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Link,
} from "@mui/material";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { syncPendingUserClaims } from "../../../shared/utils/firebaseFunctions";
import {
  getRegistrationPasswordHelperText,
  validateRegistrationPassword,
} from "../utils/passwordValidation";
import { REGISTRATION_MIN_PASSWORD_LENGTH } from "../../../constants/auth";

interface RegisterProps {
  onSuccess?: () => void;
  onSignInClick?: () => void;
}

export default function Register({ onSuccess, onSignInClick }: RegisterProps) {
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
    const passwordValidation = validateRegistrationPassword(password);
    if (!passwordValidation.isValid) {
      return { isValid: false, error: passwordValidation.error };
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

      const claimsResult = await syncPendingUserClaims();
      if (!claimsResult.success) {
        throw new Error(
          claimsResult.error ||
            "Account created but status could not be initialized. Please sign in and try again or contact support."
        );
      }
      await userCredential.user.getIdToken(true);

      await sendEmailVerification(userCredential.user);

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

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
      <Stack spacing={2}>
        <Alert severity="success">
          You&apos;re in — now check your inbox.
        </Alert>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          We sent a verification link to <strong>{email}</strong>. Click the link in that email,
          then come back here to complete your profile. We look forward to welcoming you to SODC.
        </Typography>
        {onSignInClick && (
          <Button variant="contained" onClick={onSignInClick}>
            Continue
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ color: "primary.light", mb: 1 }}>
        Create account
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Register with your email address to get started.
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
            helperText={getRegistrationPasswordHelperText()}
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
            disabled={
              submitting ||
              !email.trim() ||
              password.length < REGISTRATION_MIN_PASSWORD_LENGTH ||
              password !== confirmPassword
            }
            sx={{
              backgroundColor: "secondary.main",
              color: "white",
              "&:hover": {
                backgroundColor: "secondary.main",
                opacity: 0.9,
              },
            }}
          >
            {submitting ? <CircularProgress size={24} /> : "Create account"}
          </Button>
        </Stack>
      </form>

      {onSignInClick && (
        <Typography variant="body2" sx={{ textAlign: "center", color: "text.secondary" }}>
          Already a member?{" "}
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
    </Stack>
  );
}
