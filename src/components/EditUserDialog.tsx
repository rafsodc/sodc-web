import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Divider,
  Typography,
} from "@mui/material";
import { dataConnect } from "../config/firebase";
import { type SearchUser } from "../utils/searchUsers";
import { getUserById, updateUser, type UpdateUserVariables, MembershipStatus } from "../dataconnect-generated";
import { colors } from "../config/colors";
import { MEMBERSHIP_STATUS_OPTIONS, SUCCESS_MESSAGE_TIMEOUT } from "../constants";
import { parseDisplayName, validateUserForm } from "../utils/userHelpers";
import { updateUserDisplayName } from "../utils/updateUserDisplayName";

interface EditUserDialogProps {
  open: boolean;
  user: SearchUser | null;
  onClose: () => void;
  onSave: () => void;
}

export default function EditUserDialog({ open, user, onClose, onSave }: EditUserDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(MembershipStatus.PENDING);
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);

  // Load user data when dialog opens
  useEffect(() => {
    if (open && user) {
      setLoading(true);
      setUpdateMessage(null);
      loadUserData(user);
    }
  }, [open, user]);

  const loadUserData = async (userToLoad: SearchUser) => {
    try {
      const userResult = await getUserById(dataConnect, { id: userToLoad.uid });
      if (userResult.data?.user) {
        const fullUser = userResult.data.user;
        setFirstName(fullUser.firstName || "");
        setLastName(fullUser.lastName || "");
        setEmail(fullUser.email || userToLoad.email || "");
        setServiceNumber(fullUser.serviceNumber || "");
        setMembershipStatus(fullUser.membershipStatus || MembershipStatus.PENDING);
        setIsRegular(fullUser.isRegular ?? false);
        setIsReserve(fullUser.isReserve ?? false);
        setIsCivilServant(fullUser.isCivilServant ?? false);
        setIsIndustry(fullUser.isIndustry ?? false);
      } else {
        // Fallback if user doesn't exist in Data Connect yet
        const parsed = parseDisplayName(userToLoad.displayName);
        setFirstName(parsed.firstName);
        setLastName(parsed.lastName);
        setEmail(userToLoad.email || "");
        setServiceNumber("");
        setMembershipStatus(MembershipStatus.PENDING);
        setIsRegular(false);
        setIsReserve(false);
        setIsCivilServant(false);
        setIsIndustry(false);
      }
    } catch (err) {
      // Fallback if getUserById fails
      const parsed = parseDisplayName(userToLoad.displayName);
      setFirstName(parsed.firstName);
      setLastName(parsed.lastName);
      setEmail(userToLoad.email || "");
      setServiceNumber("");
      setMembershipStatus(MembershipStatus.PENDING);
      setIsRegular(false);
      setIsReserve(false);
      setIsCivilServant(false);
      setIsIndustry(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUpdateMessage(null);
    onClose();
  };

  const handleSave = async () => {
    if (!user) return;

    const validation = validateUserForm(firstName, lastName, email, serviceNumber);
    if (!validation.isValid) {
      setUpdateMessage({ type: "error", text: validation.error || "Please fill in all required fields" });
      return;
    }

    setSubmitting(true);
    setUpdateMessage(null);
    try {
      const vars: UpdateUserVariables = {
        userId: user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        serviceNumber: serviceNumber.trim(),
        membershipStatus: membershipStatus,
        isRegular,
        isReserve,
        isCivilServant,
        isIndustry,
      };
      await updateUser(dataConnect, vars);
      
      // Update displayName in Firebase Auth
      const displayName = `${lastName.trim()}, ${firstName.trim()}`.trim();
      if (displayName) {
        const displayNameResult = await updateUserDisplayName(user.uid, displayName);
        if (!displayNameResult.success) {
          // Log error but don't fail the whole operation
          console.warn("Failed to update display name:", displayNameResult.error);
        }
      }
      
      setUpdateMessage({ type: "success", text: "User profile updated successfully" });
      onSave();
      setTimeout(() => {
        handleClose();
      }, SUCCESS_MESSAGE_TIMEOUT);
    } catch (err: any) {
      setUpdateMessage({ type: "error", text: err?.message || "Failed to update user profile" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit User Profile</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack spacing={2} sx={{ mt: 2, alignItems: "center" }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            {updateMessage && (
              <Alert severity={updateMessage.type} sx={{ mb: 2 }}>
                {updateMessage.text}
              </Alert>
            )}
            <Stack spacing={3} sx={{ mt: 1 }}>
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
                  disabled={submitting}
                >
                  {MEMBERSHIP_STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
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
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting || loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={submitting || loading || !firstName.trim() || !lastName.trim() || !email.trim() || !serviceNumber.trim()}
          sx={{
            backgroundColor: colors.callToAction,
            "&:hover": {
              backgroundColor: colors.callToAction,
              opacity: 0.9,
            },
          }}
        >
          {submitting ? <CircularProgress size={24} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

