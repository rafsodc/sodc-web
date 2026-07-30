import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { confirmProfileReview } from "@dataconnect/generated";
import { dataConnect } from "../../../config/firebase";
import {
  MAX_MOBILE_NUMBER_LENGTH,
  MAX_NAME_LENGTH,
  MAX_POST_NOMINALS_LENGTH,
  MAX_SERVICE_NUMBER_LENGTH,
} from "../../../constants";
import RankSelect from "../../../shared/components/RankSelect";
import { updateDisplayName } from "../../../shared/utils/firebaseFunctions";
import { normalizeMobileNumber } from "../../../shared/utils/mobileNumber";
import type { UserData } from "../../../types";

interface ProfileReviewDialogProps {
  userData: UserData;
  userEmail: string;
  onReviewed: () => void | Promise<void>;
}

export default function ProfileReviewDialog({
  userData,
  userEmail,
  onReviewed,
}: ProfileReviewDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [postNominals, setPostNominals] = useState("");
  const [rank, setRank] = useState("");
  const [shareContactInfo, setShareContactInfo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankError, setRankError] = useState(false);

  useEffect(() => {
    setFirstName(userData.firstName || "");
    setLastName(userData.lastName || "");
    setServiceNumber(userData.serviceNumber || "");
    setMobileNumber(userData.mobileNumber || "");
    setPostNominals(userData.postNominals || "");
    setRank(userData.rank || "");
    setShareContactInfo(userData.shareContactInfo ?? true);
  }, [userData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);
    if (!normalizedMobileNumber) {
      setError("Enter a valid mobile number, including the country code for non-UK numbers");
      return;
    }
    if (!rank) {
      setRankError(true);
      setError("Select a rank or title. Choose Not specified if none applies.");
      return;
    }

    setRankError(false);
    setSubmitting(true);
    try {
      await confirmProfileReview(dataConnect, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        serviceNumber: serviceNumber.trim(),
        mobileNumber: normalizedMobileNumber,
        postNominals: postNominals.trim() || null,
        rank,
        shareContactInfo,
      });

      const displayName = `${lastName.trim()}, ${firstName.trim()}`;
      try {
        const displayNameResult = await updateDisplayName(displayName);
        if (!displayNameResult.success) {
          console.warn("Profile review saved, but display name sync failed:", displayNameResult.error);
        }
      } catch (displayNameError) {
        console.warn("Profile review saved, but display name sync failed:", displayNameError);
      }

      await onReviewed();
    } catch (caught) {
      setError(
        (caught as Error)?.message ||
          "We could not save your profile review. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const missingRequiredField =
    !firstName.trim() ||
    !lastName.trim() ||
    !serviceNumber.trim() ||
    !mobileNumber.trim() ||
    !rank;

  return (
    <Dialog
      open
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      disableEscapeKeyDown
      aria-labelledby="profile-review-title"
      aria-describedby="profile-review-description"
    >
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle id="profile-review-title">Please review your profile</DialogTitle>
        <DialogContent dividers>
          <Typography id="profile-review-description" variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please check these details are still correct. We ask every six months so membership and
            contact information stays current.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2.5}>
            <TextField
              label="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
              fullWidth
              disabled={submitting}
              inputProps={{ maxLength: MAX_NAME_LENGTH }}
            />
            <TextField
              label="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
              fullWidth
              disabled={submitting}
              inputProps={{ maxLength: MAX_NAME_LENGTH }}
            />
            <TextField
              label="Email"
              type="email"
              value={userEmail}
              fullWidth
              inputProps={{ readOnly: true }}
              helperText="This verified sign-in address can be changed later in Account settings."
            />
            <TextField
              label="Service number"
              value={serviceNumber}
              onChange={(event) => setServiceNumber(event.target.value)}
              required
              fullWidth
              disabled={submitting}
              inputProps={{ maxLength: MAX_SERVICE_NUMBER_LENGTH }}
            />
            <TextField
              label="Mobile number"
              type="tel"
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
              required
              fullWidth
              disabled={submitting}
              inputProps={{ maxLength: MAX_MOBILE_NUMBER_LENGTH }}
              helperText="UK numbers may start with 07; international numbers must include their country code."
            />
            <TextField
              label="Post-nominals"
              value={postNominals}
              onChange={(event) => setPostNominals(event.target.value)}
              fullWidth
              disabled={submitting}
              inputProps={{ maxLength: MAX_POST_NOMINALS_LENGTH }}
            />
            <RankSelect
              value={rank}
              onChange={(value) => {
                setRank(value);
                if (value) setRankError(false);
              }}
              disabled={submitting}
              required
              error={rankError}
              helperText="Choose Not specified if no rank or title applies."
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={shareContactInfo}
                  onChange={(event) => setShareContactInfo(event.target.checked)}
                  disabled={submitting}
                />
              }
              label="Share my email address and mobile number with members in my sections"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button type="submit" variant="contained" disabled={submitting || missingRequiredField}>
            {submitting ? <CircularProgress size={24} /> : "Confirm profile"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
