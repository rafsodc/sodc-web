import { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Alert,
  FormControlLabel,
  Checkbox,
  Divider,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { dataConnect } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import { upsertUser, type UpsertUserVariables, MembershipStatus } from "@dataconnect/generated";
import type { UserData } from "../../../types";
import { updateDisplayName } from "../../../shared/utils/firebaseFunctions";
import { MEMBERSHIP_STATUS_OPTIONS, MAX_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_SERVICE_NUMBER_LENGTH, ROUTES } from "../../../constants";
import { auth } from "../../../config/firebase";

interface ProfileProps {
  userData: UserData | null;
  userEmail: string;
  onBack?: () => void;
  onUpdate?: () => void;
}

function getMembershipStatusLabel(status: MembershipStatus | null | undefined): string {
  if (!status) {
    return "Unknown";
  }
  const option = MEMBERSHIP_STATUS_OPTIONS.find((entry) => entry.value === status);
  return option?.label ?? status;
}

export default function Profile({ userData, userEmail, onBack, onUpdate }: ProfileProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (userData) {
      setFirstName(userData.firstName || "");
      setLastName(userData.lastName || "");
      setEmail(userData.email || userEmail);
      setServiceNumber(userData.serviceNumber || "");
      setIsRegular(userData.isRegular ?? false);
      setIsReserve(userData.isReserve ?? false);
      setIsCivilServant(userData.isCivilServant ?? false);
      setIsIndustry(userData.isIndustry ?? false);
    } else {
      setEmail(userEmail);
    }
  }, [userData, userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("You must be logged in to update your profile");
        setSubmitting(false);
        return;
      }

      const vars: UpsertUserVariables = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        serviceNumber: serviceNumber.trim(),
        isRegular,
        isReserve,
        isCivilServant,
        isIndustry,
      };
      await upsertUser(dataConnect, vars);

      const displayName = `${lastName.trim()}, ${firstName.trim()}`.trim();
      if (displayName) {
        const displayNameResult = await updateDisplayName(displayName);
        if (!displayNameResult.success) {
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

  const membershipLabel = getMembershipStatusLabel(userData?.membershipStatus);

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

      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ mb: 0.5 }}>
          Membership status: <strong>{membershipLabel}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Password, resignation, and other account actions are managed in Account settings.
        </Typography>
        <Button component={RouterLink} to={ROUTES.ACCOUNT_SETTINGS} variant="outlined" size="small">
          Account settings
        </Button>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <TextField
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            fullWidth
            disabled={submitting}
            inputProps={{ maxLength: MAX_NAME_LENGTH }}
            helperText={`${firstName.length}/${MAX_NAME_LENGTH} characters`}
          />

          <TextField
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            fullWidth
            disabled={submitting}
            inputProps={{ maxLength: MAX_NAME_LENGTH }}
            helperText={`${lastName.length}/${MAX_NAME_LENGTH} characters`}
          />

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            disabled={submitting}
            inputProps={{ maxLength: MAX_EMAIL_LENGTH }}
            helperText={`${email.length}/${MAX_EMAIL_LENGTH} characters`}
          />

          <TextField
            label="Service Number"
            value={serviceNumber}
            onChange={(e) => setServiceNumber(e.target.value)}
            required
            fullWidth
            disabled={submitting}
            inputProps={{ maxLength: MAX_SERVICE_NUMBER_LENGTH }}
            helperText={`${serviceNumber.length}/${MAX_SERVICE_NUMBER_LENGTH} characters`}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ color: colors.titlePrimary, mb: 1 }}>
            Service Background
          </Typography>

          <Typography variant="body2" sx={{ color: colors.titleSecondary, mb: 2 }}>
            Please indicate whether you are or have been a regular, reserve, civil servant, or worked in industry.
          </Typography>

          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isRegular}
                  onChange={(e) => setIsRegular(e.target.checked)}
                  disabled={submitting}
                />
              }
              label="Regular"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isReserve}
                  onChange={(e) => setIsReserve(e.target.checked)}
                  disabled={submitting}
                />
              }
              label="Reserve"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isCivilServant}
                  onChange={(e) => setIsCivilServant(e.target.checked)}
                  disabled={submitting}
                />
              }
              label="Civil Servant"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isIndustry}
                  onChange={(e) => setIsIndustry(e.target.checked)}
                  disabled={submitting}
                />
              }
              label="Industry"
            />
          </Stack>

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
