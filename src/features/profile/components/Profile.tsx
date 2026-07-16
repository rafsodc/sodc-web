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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { dataConnect } from "../../../config/firebase";
import { upsertUser, type UpsertUserVariables, MembershipStatus } from "@dataconnect/generated";
import type { UserData } from "../../../types";
import { updateDisplayName, updateMembershipStatus } from "../../../shared/utils/firebaseFunctions";
import { MAX_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_SERVICE_NUMBER_LENGTH, ROUTES, MEMBERSHIP_STATUS_OPTIONS } from "../../../constants";
import RankSelect from "../../../shared/components/RankSelect";
import { NON_RESTRICTED_STATUSES, isRestrictedStatus } from "../../users/utils/membershipStatusValidation";
import { auth } from "../../../config/firebase";

interface ProfileProps {
  userData: UserData | null;
  userDataLoading?: boolean;
  userEmail: string;
  onBack?: () => void;
  onUpdate?: () => void;
}

export default function Profile({ userData, userDataLoading = false, userEmail, onBack, onUpdate }: ProfileProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);
  const [rank, setRank] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | "">(
    () => userData?.membershipStatus ?? ""
  );
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
      setRank(userData.rank || "");
      setMembershipStatus(userData.membershipStatus || "");
    } else {
      setEmail(userEmail);
      setRank("");
      setMembershipStatus("");
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
        serviceNumber: serviceNumber.trim(),
        isRegular,
        isReserve,
        isCivilServant,
        isIndustry,
        rank: rank || null,
      };
      await upsertUser(dataConnect, vars);

      const currentStatus = userData?.membershipStatus || null;
      if (membershipStatus && membershipStatus !== currentStatus) {
        const statusResult = await updateMembershipStatus(
          currentUser.uid,
          membershipStatus as MembershipStatus
        );
        if (!statusResult.success) {
          setError(statusResult.error || "Failed to update membership status");
          setSubmitting(false);
          return;
        }
      }

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

  const statusLocked =
    userData?.membershipStatus != null && isRestrictedStatus(userData.membershipStatus);

  if (userDataLoading && !userData) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto" }}>
      <Typography variant="h4" gutterBottom sx={{ color: "primary.light", mb: 3 }}>
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

          <FormControl fullWidth required>
            <InputLabel>Membership Status</InputLabel>
            <Select
              value={membershipStatus}
              label="Membership Status"
              onChange={(e) => setMembershipStatus(e.target.value as MembershipStatus)}
              disabled={submitting || statusLocked}
              data-testid="membership-status-select"
            >
              {statusLocked ? (
                MEMBERSHIP_STATUS_OPTIONS.filter((option) => option.value === userData?.membershipStatus).map(
                  (status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  )
                )
              ) : (
                MEMBERSHIP_STATUS_OPTIONS.filter((option) =>
                  NON_RESTRICTED_STATUSES.includes(option.value)
                ).map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))
              )}
            </Select>
            {statusLocked && (
              <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, ml: 1.5 }}>
                Cannot change from restricted status
              </Typography>
            )}
          </FormControl>

          <RankSelect value={rank} onChange={setRank} disabled={submitting} />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ color: "primary.light", mb: 1 }}>
            Service Background
          </Typography>

          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
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
                backgroundColor: "secondary.main",
                "&:hover": {
                  backgroundColor: "secondary.main",
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
