import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  type User,
} from "firebase/auth";
import { MembershipStatus } from "@dataconnect/generated";
import { auth } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import { MEMBERSHIP_STATUS_OPTIONS, ROUTES, SUCCESS_MESSAGE_TIMEOUT } from "../../../constants";
import type { UserData } from "../../../types";
import { resignMembership } from "../../../shared/utils/firebaseFunctions";
import { canUserResignMembership } from "../../users/utils/membershipStatusValidation";

export interface AccountSettingsPageProps {
  user: User;
  userData: UserData | null;
  isAdmin: boolean;
  onBack?: () => void;
}

function getMembershipStatusLabel(status: MembershipStatus | null | undefined): string {
  if (!status) {
    return "Unknown";
  }
  const option = MEMBERSHIP_STATUS_OPTIONS.find((entry) => entry.value === status);
  return option?.label ?? status;
}

function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect";
    case "auth/weak-password":
      return "New password is too weak";
    case "auth/requires-recent-login":
      return "Please sign out and sign in again, then try changing your password";
    default:
      return (error as Error)?.message ?? "Something went wrong";
  }
}

function usesEmailPassword(user: User): boolean {
  return user.providerData.some((provider) => provider.providerId === "password");
}

export default function AccountSettingsPage({
  user,
  userData,
  isAdmin,
  onBack,
}: AccountSettingsPageProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [resignDialogOpen, setResignDialogOpen] = useState(false);
  const [resignSubmitting, setResignSubmitting] = useState(false);
  const [resignError, setResignError] = useState<string | null>(null);

  const canChangePassword = usesEmailPassword(user);
  const membershipStatus = userData?.membershipStatus ?? null;
  const membershipLabel = getMembershipStatusLabel(membershipStatus);

  const canResign = useMemo(
    () => canUserResignMembership(membershipStatus, isAdmin).allowed,
    [membershipStatus, isAdmin]
  );

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (!user.email) {
      setPasswordError("Your account does not have an email address for re-authentication");
      return;
    }

    setPasswordSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      window.setTimeout(() => setPasswordSuccess(false), SUCCESS_MESSAGE_TIMEOUT);
    } catch (error) {
      setPasswordError(getAuthErrorMessage(error));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleResignConfirm = async () => {
    setResignError(null);
    setResignSubmitting(true);
    try {
      const result = await resignMembership();
      if (!result.success) {
        setResignError(result.error ?? "Failed to resign membership");
        return;
      }
      setResignDialogOpen(false);
      await signOut(auth);
    } catch (error) {
      setResignError(getAuthErrorMessage(error));
    } finally {
      setResignSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto", py: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ color: colors.titlePrimary, mb: 3 }}>
        Account
      </Typography>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Membership
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Status: <strong>{membershipLabel}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Contact an administrator if your status needs to be updated.
          </Typography>
          <Button component={RouterLink} to={ROUTES.PROFILE} variant="outlined">
            Edit profile details
          </Button>
        </Box>

        <Divider />

        <Box component="section" aria-labelledby="change-password-heading">
          <Typography id="change-password-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
            Change password
          </Typography>
          {!canChangePassword ? (
            <Alert severity="info">
              Password changes are only available for email and password sign-in.
            </Alert>
          ) : (
            <>
              {passwordSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Password updated successfully.
                </Alert>
              )}
              {passwordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {passwordError}
                </Alert>
              )}
              <Box component="form" onSubmit={handlePasswordSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Current password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    fullWidth
                    disabled={passwordSubmitting}
                  />
                  <TextField
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    fullWidth
                    disabled={passwordSubmitting}
                    helperText="At least 6 characters"
                  />
                  <TextField
                    label="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    fullWidth
                    disabled={passwordSubmitting}
                  />
                  <Box>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={
                        passwordSubmitting ||
                        !currentPassword ||
                        newPassword.length < 6 ||
                        newPassword !== confirmPassword
                      }
                      sx={{
                        backgroundColor: colors.callToAction,
                        "&:hover": {
                          backgroundColor: colors.callToAction,
                          opacity: 0.9,
                        },
                      }}
                    >
                      {passwordSubmitting ? <CircularProgress size={24} color="inherit" /> : "Update password"}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </>
          )}
        </Box>

        {canResign && (
          <>
            <Divider />
            <Box component="section" aria-labelledby="resign-heading">
              <Typography id="resign-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
                Resign membership
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Resigning deactivates your account. You will be signed out and will need to contact an
                administrator to rejoin.
              </Typography>
              {resignError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {resignError}
                </Alert>
              )}
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  setResignError(null);
                  setResignDialogOpen(true);
                }}
              >
                Resign membership
              </Button>
            </Box>
          </>
        )}
      </Stack>

      {onBack && (
        <Button variant="text" onClick={onBack} sx={{ mt: 3 }}>
          Back
        </Button>
      )}

      <Dialog open={resignDialogOpen} onClose={() => !resignSubmitting && setResignDialogOpen(false)}>
        <DialogTitle>Resign membership?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will set your membership status to Resigned and sign you out. You can contact an
            administrator if you wish to return later.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResignDialogOpen(false)} disabled={resignSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleResignConfirm} color="error" disabled={resignSubmitting}>
            {resignSubmitting ? <CircularProgress size={22} color="inherit" /> : "Confirm resign"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
