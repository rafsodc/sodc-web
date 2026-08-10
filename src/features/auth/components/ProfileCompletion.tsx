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
import { mutationRef } from "firebase/data-connect";
import { MembershipStatus } from "@dataconnect/generated";
import { validateUserForm } from "../../users/utils/userHelpers";
import {
  MAX_MOBILE_NUMBER_LENGTH,
  MAX_NAME_LENGTH,
  MAX_POST_NOMINALS_LENGTH,
  MAX_SERVICE_NUMBER_LENGTH,
} from "../../../constants";
import { auth } from "../../../config/firebase";
import { syncPendingUserClaims, updateDisplayName } from "../../../shared/utils/firebaseFunctions";
import RankSelect from "../../../shared/components/RankSelect";
import { normalizeMobileNumber } from "../../../shared/utils/mobileNumber";
import { reportError, toProfileUserFacingError } from "../../../shared/errors";
import { executeDataConnectMutation } from "../../../shared/query/dataConnectExecution";

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
  const [mobileNumber, setMobileNumber] = useState("");
  const [postNominals, setPostNominals] = useState("");
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);
  const [rank, setRank] = useState("");
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
    const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);
    if (!normalizedMobileNumber) {
      setError("Enter a valid mobile number, including the country code for non-UK numbers");
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
        mobileNumber: normalizedMobileNumber,
        postNominals: postNominals.trim() || null,
        requestedMembershipStatus: MembershipStatus.REGULAR,
        isRegular,
        isReserve,
        isCivilServant,
        isIndustry,
        rank: rank || null,
      });

      const result = await executeDataConnectMutation(mutation);

      if (!result.data) {
        throw new Error("Failed to save profile");
      }

      // Best-effort update of displayName in Firebase Auth
      const displayName = `${lastName.trim()}, ${firstName.trim()}`.trim();
      if (displayName) {
        const displayNameResult = await updateDisplayName(displayName);
        if (!displayNameResult.success) {
          reportError(
            "profile.completion.display-name",
            new Error(displayNameResult.error ?? "Display name update failed"),
          );
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
    } catch (err: unknown) {
      reportError("profile.completion", err);
      setError(toProfileUserFacingError(err, "completion").message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ maxWidth: "600px", mx: "auto" }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Welcome to SODC — your profile has been submitted.
        </Alert>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Your profile is with us and we&apos;ll be in touch once your membership has been
          activated. You can sign out and return here to check your status.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: "primary.light", mb: 1 }}>
        Complete your profile
      </Typography>

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Tell us about yourself so we can set up your membership correctly.
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

          <TextField
            label="Mobile number"
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            required
            fullWidth
            disabled={submitting}
            inputProps={{ maxLength: MAX_MOBILE_NUMBER_LENGTH }}
            helperText="UK numbers may start with 07; international numbers must include their country code"
          />

          <TextField
            label="Post-nominals"
            value={postNominals}
            onChange={(e) => setPostNominals(e.target.value)}
            fullWidth
            disabled={submitting}
            inputProps={{ maxLength: MAX_POST_NOMINALS_LENGTH }}
            helperText={`${postNominals.length}/${MAX_POST_NOMINALS_LENGTH} characters`}
          />

          <RankSelect value={rank} onChange={setRank} disabled={submitting} />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ color: "primary.light", mb: 1 }}>
            Service background
          </Typography>

          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Tick all that apply — past or present. This helps us assign the right membership
            category when we activate your account.
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
              disabled={
                submitting ||
                !firstName.trim() ||
                !lastName.trim() ||
                !email.trim() ||
                !serviceNumber.trim() ||
                !mobileNumber.trim()
              }
              sx={{
                backgroundColor: "secondary.main",
                color: "secondary.contrastText",
                "&:hover": {
                  backgroundColor: "secondary.main",
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
