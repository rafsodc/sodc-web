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
import { dataConnect } from "../../../config/firebase";
import type { SearchUser } from "../../../types";
import { getUserById, updateUser, type UpdateUserVariables, MembershipStatus } from "../../../dataconnect-generated";
import {
  MEMBERSHIP_STATUS_OPTIONS,
  MAX_EMAIL_LENGTH,
  MAX_MOBILE_NUMBER_LENGTH,
  MAX_NAME_LENGTH,
  MAX_POST_NOMINALS_LENGTH,
  MAX_SERVICE_NUMBER_LENGTH,
} from "../../../constants";
import { parseDisplayName, validateUserForm } from "../../users/utils/userHelpers";
import { updateUserDisplayName, updateMembershipStatus } from "../../../shared/utils/firebaseFunctions";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import { canUserChangeStatus, membershipStatusSaveAction, NON_RESTRICTED_STATUSES, RESTRICTED_STATUSES } from "../../users/utils/membershipStatusValidation";
import { normalizeMobileNumber } from "../../../shared/utils/mobileNumber";
import {
  reportError,
  toProfileDomainUserFacingError,
  toProfileUserFacingError,
} from "../../../shared/errors";

interface EditUserDialogProps {
  open: boolean;
  user: SearchUser | null;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onSuccess?: (message: string) => void;
}

export default function EditUserDialog({ open, user, onClose, onSave, onSuccess }: EditUserDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<MembershipStatus | null>(null);

  // Get admin status
  const isAdmin = useAdminClaim(auth.currentUser);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [postNominals, setPostNominals] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(MembershipStatus.PENDING);
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);
  const [requestedMembershipStatus, setRequestedMembershipStatus] = useState<MembershipStatus | null>(null);

  // Load user data when dialog opens
  useEffect(() => {
    if (open && user) {
      setLoading(true);
      setUpdateMessage(null);
      setSubmitting(false); // Reset submitting state when dialog opens
      loadUserData(user);
    } else if (!open) {
      // Reset all state when dialog closes
      setSubmitting(false);
      setUpdateMessage(null);
      setLoading(false);
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
        setMobileNumber(fullUser.mobileNumber || "");
        setPostNominals(fullUser.postNominals || "");
        const status = fullUser.membershipStatus || MembershipStatus.PENDING;
        setMembershipStatus(status);
        setCurrentStatus(status);
        setRequestedMembershipStatus(fullUser.requestedMembershipStatus || null);
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
        setMobileNumber("");
        setPostNominals("");
        setMembershipStatus(MembershipStatus.PENDING);
        setCurrentStatus(MembershipStatus.PENDING);
        setRequestedMembershipStatus(null);
        setIsRegular(false);
        setIsReserve(false);
        setIsCivilServant(false);
        setIsIndustry(false);
      }
    } catch (loadError) {
      reportError("profile.admin-edit.load", loadError);
      // Fallback if getUserById fails
      const parsed = parseDisplayName(userToLoad.displayName);
      setFirstName(parsed.firstName);
      setLastName(parsed.lastName);
      setEmail(userToLoad.email || "");
      setServiceNumber("");
      setMobileNumber("");
      setPostNominals("");
      setMembershipStatus(MembershipStatus.PENDING);
      setCurrentStatus(MembershipStatus.PENDING);
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
    setSubmitting(false); // Reset submitting state when closing
    onClose();
  };

  const handleSave = async () => {
    if (!user) return;

    const validation = validateUserForm(firstName, lastName, email, serviceNumber);
    if (!validation.isValid) {
      setUpdateMessage({ type: "error", text: validation.error || "Please fill in all required fields" });
      return;
    }
    const normalizedMobileNumber = mobileNumber.trim()
      ? normalizeMobileNumber(mobileNumber)
      : null;
    if (mobileNumber.trim() && !normalizedMobileNumber) {
      setUpdateMessage({
        type: "error",
        text: "Enter a valid mobile number, including the country code for non-UK numbers",
      });
      return;
    }

    // Check if target user is an admin
    const targetUserIsAdmin = user?.customClaims?.admin === true;
    const statusSaveAction = membershipStatusSaveAction(
      currentStatus,
      membershipStatus,
      isAdmin
    );
    
    // Client-side validation (for immediate UX feedback)
    if (statusSaveAction !== "reconcile") {
      const clientValidation = canUserChangeStatus(currentStatus, membershipStatus, isAdmin, targetUserIsAdmin);
      if (!clientValidation.allowed) {
        setUpdateMessage({ type: "error", text: clientValidation.error || "Invalid membership status change" });
        return;
      }
    }

    setSubmitting(true);
    setUpdateMessage(null);
    try {
      // Update profile fields (excluding membershipStatus)
      const vars: UpdateUserVariables = {
        userId: user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        serviceNumber: serviceNumber.trim(),
        mobileNumber: normalizedMobileNumber,
        postNominals: postNominals.trim() || null,
        isRegular,
        isReserve,
        isCivilServant,
        isIndustry,
      };
      await updateUser(dataConnect, vars);

      // Admin saves also invoke the status callable when the value is unchanged. The
      // server treats that as an idempotent enabled-claim reconciliation operation.
      if (statusSaveAction !== "none") {
        const statusResult = await updateMembershipStatus(user.uid, membershipStatus);
        if (!statusResult.success) {
          const statusError = new Error(statusResult.error || "Membership status update failed");
          reportError("profile.admin-edit.membership-status", statusError);
          setUpdateMessage({
            type: "error",
            text: toProfileDomainUserFacingError(statusResult.domainCode, "update").message,
          });
          setSubmitting(false);
          return; // Keep dialog open on error
        }
      }
      
      // Update displayName in Firebase Auth
      const displayName = `${lastName.trim()}, ${firstName.trim()}`.trim();
      if (displayName) {
        const displayNameResult = await updateUserDisplayName(user.uid, displayName);
        if (!displayNameResult.success) {
          reportError(
            "profile.admin-edit.display-name",
            new Error(displayNameResult.error ?? "Display name update failed"),
          );
        }
      }
      
      // Success - reset submitting, close dialog immediately and show success message via callback
      setSubmitting(false);
      await onSave();
      const successMessage = "User profile updated successfully";
      if (onSuccess) {
        onSuccess(successMessage);
      }
      handleClose();
    } catch (err: unknown) {
      reportError("profile.admin-edit", err);
      setUpdateMessage({
        type: "error",
        text: toProfileUserFacingError(err, "update").message,
      });
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit User Profile</DialogTitle>
      <DialogContent
        sx={{
          maxHeight: "70vh",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarColor: (theme) =>
            `${theme.palette.text.disabled} ${theme.palette.action.hover}`,
          pr: 1, // Padding for scrollbar
          // Ensure scrollbar is always visible when content overflows
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "action.hover",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "text.disabled",
            borderRadius: "4px",
            "&:hover": {
              backgroundColor: "text.secondary",
            },
          },
        }}
      >
        {loading ? (
          <Stack spacing={2} sx={{ mt: 2, alignItems: "center" }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            {updateMessage && updateMessage.type === "error" && (
              <Alert severity="error" sx={{ mb: 2 }}>
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
              <TextField
                label="Mobile number"
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
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
              <FormControl fullWidth required>
                <InputLabel>Membership Status</InputLabel>
                <Select
                  value={membershipStatus}
                  label="Membership Status"
                  onChange={(e) => setMembershipStatus(e.target.value as MembershipStatus)}
                  disabled={submitting}
                >
                  {(() => {
                    // Check if the user being edited is an admin
                    const targetUserIsAdmin = user?.customClaims?.admin === true;
                    
                    // If editing an admin user, filter out restricted statuses
                    // If current user is admin and editing non-admin, show all options
                    // Otherwise, filter to non-restricted
                    const availableOptions = targetUserIsAdmin
                      ? MEMBERSHIP_STATUS_OPTIONS.filter(option => !RESTRICTED_STATUSES.includes(option.value))
                      : isAdmin
                      ? MEMBERSHIP_STATUS_OPTIONS
                      : MEMBERSHIP_STATUS_OPTIONS.filter(option => NON_RESTRICTED_STATUSES.includes(option.value));
                    
                    return availableOptions.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ));
                  })()}
                </Select>
                {currentStatus === MembershipStatus.PENDING && requestedMembershipStatus && (
                  <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, ml: 1.5 }}>
                    User requested: {MEMBERSHIP_STATUS_OPTIONS.find(opt => opt.value === requestedMembershipStatus)?.label || requestedMembershipStatus}
                  </Typography>
                )}
              </FormControl>

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
            backgroundColor: "secondary.main",
            color: "secondary.contrastText",
            "&:hover": {
              backgroundColor: "secondary.main",
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
