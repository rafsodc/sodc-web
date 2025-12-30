import { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { dataConnect } from "../config/firebase";
import { colors } from "../config/colors";
import { upsertUser, type UpsertUserVariables } from "@dataconnect/generated";
import type { UserData } from "../hooks/useUserData";
import { updateDisplayName } from "../utils/updateDisplayName";

interface ProfileProps {
  userData: UserData | null;
  userEmail: string;
  onBack?: () => void;
  onUpdate?: () => void;
}

export default function Profile({ userData, userEmail, onBack, onUpdate }: ProfileProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (userData) {
      setFirstName(userData.firstName || "");
      setLastName(userData.lastName || "");
      setEmail(userData.email || userEmail);
      setServiceNumber(userData.serviceNumber || "");
    } else {
      // New user - populate with email from Firebase Auth
      setEmail(userEmail);
    }
  }, [userData, userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const vars: UpsertUserVariables = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        serviceNumber: serviceNumber.trim(),
      };
      await upsertUser(dataConnect, vars);
      
      // Update displayName in Firebase Auth
      const displayName = `${lastName.trim()}, ${firstName.trim()}`.trim();
      if (displayName) {
        const displayNameResult = await updateDisplayName(displayName);
        if (!displayNameResult.success) {
          // Log error but don't fail the whole operation
          console.warn("Failed to update display name:", displayNameResult.error);
        }
      }
      
      setSuccess(true);
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto" }}>
      <Typography variant="h4" gutterBottom sx={{ color: colors.titlePrimary, mb: 3 }}>
        Profile
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Profile updated successfully!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <TextField
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            fullWidth
            disabled={submitting}
          />

          <TextField
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            fullWidth
            disabled={submitting}
          />

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            disabled={submitting}
          />

          <TextField
            label="Service Number"
            value={serviceNumber}
            onChange={(e) => setServiceNumber(e.target.value)}
            required
            fullWidth
            disabled={submitting}
          />

          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || !firstName.trim() || !lastName.trim() || !email.trim() || !serviceNumber.trim()}
              sx={{
                backgroundColor: colors.callToAction,
                "&:hover": {
                  backgroundColor: colors.callToAction,
                  opacity: 0.9,
                },
              }}
            >
              {submitting ? <CircularProgress size={24} /> : "Save Changes"}
            </Button>

            {onBack && (
              <Button variant="outlined" onClick={onBack} disabled={submitting}>
                Back
              </Button>
            )}
          </Box>
        </Stack>
      </form>
    </Box>
  );
}

