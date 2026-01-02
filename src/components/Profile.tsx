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
import { dataConnect } from "../config/firebase";
import { colors } from "../config/colors";
import { upsertUser, type UpsertUserVariables, MembershipStatus } from "@dataconnect/generated";
import type { UserData } from "../hooks/useUserData";
import { updateDisplayName } from "../utils/updateDisplayName";
import { MEMBERSHIP_STATUS_OPTIONS } from "../constants";
import { NON_RESTRICTED_STATUSES, isRestrictedStatus } from "../utils/membershipStatusValidation";
import { updateMembershipStatus } from "../utils/updateMembershipStatus";
import { auth } from "../config/firebase";

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
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(MembershipStatus.PENDING);
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
      setMembershipStatus(userData.membershipStatus || MembershipStatus.PENDING);
    } else {
      // New user - populate with email from Firebase Auth
      setEmail(userEmail);
      setMembershipStatus(MembershipStatus.PENDING);
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

      // Update profile fields (excluding membershipStatus)
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

      // Update membership status separately via Firebase Function (validates and enforces rules)
      // Only call if the status has actually changed
      const currentStatus = userData?.membershipStatus || null;
      if (membershipStatus && membershipStatus !== currentStatus) {
        const statusResult = await updateMembershipStatus(currentUser.uid, membershipStatus);
        if (!statusResult.success) {
          setError(statusResult.error || "Failed to update membership status");
          setSubmitting(false);
          return;
        }
      }
      
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

          <FormControl fullWidth required>
            <InputLabel>Membership Status</InputLabel>
            <Select
              value={membershipStatus}
              label="Membership Status"
              onChange={(e) => setMembershipStatus(e.target.value as MembershipStatus)}
              disabled={submitting || (userData?.membershipStatus && isRestrictedStatus(userData.membershipStatus))}
            >
              {(() => {
                // If current status is restricted, show only the current status (disabled)
                // Otherwise, show all non-restricted statuses
                const currentStatus = userData?.membershipStatus;
                if (currentStatus && isRestrictedStatus(currentStatus)) {
                  const currentOption = MEMBERSHIP_STATUS_OPTIONS.find(opt => opt.value === currentStatus);
                  return currentOption ? (
                    <MenuItem key={currentOption.value} value={currentOption.value}>
                      {currentOption.label}
                    </MenuItem>
                  ) : null;
                }
                // Show non-restricted options
                return MEMBERSHIP_STATUS_OPTIONS.filter(option => NON_RESTRICTED_STATUSES.includes(option.value)).map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ));
              })()}
            </Select>
            {userData?.membershipStatus && isRestrictedStatus(userData.membershipStatus) && (
              <Typography variant="caption" sx={{ color: colors.titleSecondary, mt: 1, ml: 1.5 }}>
                Cannot change from restricted status
              </Typography>
            )}
          </FormControl>

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

