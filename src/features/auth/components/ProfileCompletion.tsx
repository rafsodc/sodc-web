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
import { dataConnect } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import { executeMutation, mutationRef } from "firebase/data-connect";
import { MembershipStatus } from "@dataconnect/generated";
import { validateUserForm } from "../../users/utils/userHelpers";
import { MAX_NAME_LENGTH, MAX_SERVICE_NUMBER_LENGTH } from "../../../constants";
import { auth } from "../../../config/firebase";
import { syncPendingUserClaims, updateDisplayName } from "../../../shared/utils/firebaseFunctions";

interface ProfileCompletionProps {
  userEmail: string;
  onComplete?: () => void;
}

export default function ProfileCompletion({
  userEmail,
  onComplete,
}: ProfileCompletionProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [serviceNumber, setServiceNumber] = useState("");
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setEmail(userEmail);
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validation = validateUserForm(firstName, lastName, email, serviceNumber);
    if (!validation.isValid) {
      setError(validation.error || "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("You must be logged in to complete your profile");
        setSubmitting(false);
        return;
      }

      // Use CreateUserProfile mutation which doesn't require enabled claim
      // Note: This mutation will be available in generated SDK after schema deployment
      // For now, using mutationRef directly
      const mutation = mutationRef(dataConnect, "CreateUserProfile", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        serviceNumber: serviceNumber.trim(),
        requestedMembershipStatus: MembershipStatus.REGULAR,
        isRegular,
        isReserve,
        isCivilServant,
        isIndustry,
      });

      const result = await executeMutation(mutation);

      if (!result.data) {
        throw new Error("Failed to save profile");
      }

      // Best-effort update of displayName in Firebase Auth
      const displayName = `${lastName.trim()}, ${firstName.trim()}`.trim();
      if (displayName) {
        const displayNameResult = await updateDisplayName(displayName);
        if (!displayNameResult.success) {
          // Log but do not block completion
          console.warn("Failed to update display name:", displayNameResult.error);
        }
      }

      const claimsResult = await syncPendingUserClaims();
      if (!claimsResult.success) {
        throw new Error(
          claimsResult.error ||
            "Profile saved but account status could not be updated. Please try again or contact support."
        );
      }
      await currentUser.getIdToken(true);

      setSuccess(true);
      if (onComplete) {
        // Wait a moment to show success message, then call onComplete
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ maxWidth: "600px", mx: "auto" }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Profile submitted successfully!
        </Alert>
        <Typography variant="body1" sx={{ color: colors.titlePrimary, mb: 2 }}>
          Your profile has been submitted and is pending admin approval.
        </Typography>
        <Typography variant="body2" sx={{ color: colors.titleSecondary }}>
          Step 4 begins next: an administrator will review your profile and activate your account,
          usually within a few business days. You can sign out and return later to check status.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: colors.titlePrimary, mb: 1 }}>
        Complete your profile
      </Typography>

      <Typography variant="body2" sx={{ color: colors.titleSecondary, mb: 3 }}>
        Step 3 of 4 — tell us about your service background. An administrator will assign your
        membership status during approval.
      </Typography>

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
            disabled={true}
            helperText="Email cannot be changed"
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

          <Alert severity="info">
            An administrator will review your service background and assign your membership status during
            approval.
          </Alert>

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
              {submitting ? <CircularProgress size={24} /> : "Submit profile"}
            </Button>
          </Box>
        </Stack>
      </form>
    </Box>
  );
}

