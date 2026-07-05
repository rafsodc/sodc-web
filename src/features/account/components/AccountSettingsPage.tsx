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
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  useGetMyAnnouncementPreferences,
  useOptOutSectionAnnouncement,
  useOptInSectionAnnouncement,
} from "@dataconnect/generated/react";
import { SectionUserGroupPurpose } from "@dataconnect/generated";
import { useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  type User,
} from "firebase/auth";
import { auth } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import { ROUTES } from "../../../constants";
import type { UserData } from "../../../types";
import { resignMembership } from "../../../shared/utils/firebaseFunctions";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import { canUserResignMembership } from "../../users/utils/membershipStatusValidation";

export interface AccountSettingsPageProps {
  user: User;
  userData: UserData | null;
  userDataLoading?: boolean;
  isAdmin: boolean;
  onBack?: () => void;
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

function AnnouncementPreferencesList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMyAnnouncementPreferences({ staleTime: Infinity });
  const optOut = useOptOutSectionAnnouncement();
  const optIn = useOptInSectionAnnouncement();
  const [busy, setBusy] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Map<string, boolean>>(new Map());
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const sections = useMemo(() => {
    const grantsAccess = (purposes?: string[] | null) =>
      purposes?.includes(SectionUserGroupPurpose.ACCESS) ||
      purposes?.includes(SectionUserGroupPurpose.MODERATOR);

    const sectionMap = new Map<string, { id: string; name: string }>();
    const addSection = (s: { id: string; name: string }) => {
      if (!sectionMap.has(s.id)) sectionMap.set(s.id, s);
    };

    // Explicit group memberships
    for (const ug of data?.user?.userGroups ?? []) {
      for (const pl of ug.userGroup.purposeLinks) {
        if (grantsAccess(pl.purposes) && pl.section) addSection(pl.section);
      }
    }

    // Status-based group memberships
    const userStatus = data?.user?.membershipStatus;
    for (const ug of data?.allUserGroups ?? []) {
      if (!ug.membershipStatuses?.includes(userStatus as string)) continue;
      for (const pl of ug.purposeLinks) {
        if (grantsAccess(pl.purposes) && pl.section) addSection(pl.section);
      }
    }

    return Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const optOutIds = useMemo(
    () => new Set((data?.user?.optOuts ?? []).map((o) => o.section.id)),
    [data]
  );

  const handleToggle = async (sectionId: string, currentlyOptedOut: boolean) => {
    const newOptedOut = !currentlyOptedOut;
    setLocalOverrides(prev => new Map(prev).set(sectionId, newOptedOut));
    setBusy(sectionId);
    try {
      if (currentlyOptedOut) {
        await optIn.mutateAsync({ sectionId });
      } else {
        await optOut.mutateAsync({ sectionId });
      }
      queryClient.setQueryData(
        ["GetMyAnnouncementPreferences", null],
        (old: typeof data) => {
          if (!old?.user) return old;
          const newOptOuts = newOptedOut
            ? [...(old.user.optOuts ?? []), { section: { id: sectionId } }]
            : (old.user.optOuts ?? []).filter((o) => o.section.id !== sectionId);
          return { ...old, user: { ...old.user, optOuts: newOptOuts } };
        }
      );
      setLocalOverrides(prev => { const m = new Map(prev); m.delete(sectionId); return m; });
      setSnackbar(newOptedOut ? "Opted out of announcements" : "Opted in to announcements");
    } catch {
      setLocalOverrides(prev => { const m = new Map(prev); m.delete(sectionId); return m; });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box component="section" aria-labelledby="email-preferences-heading">
      <Typography id="email-preferences-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
        Announcement emails
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which sections you receive announcement emails from. You can also change this on each
        section's page.
      </Typography>
      {isLoading ? (
        <CircularProgress size={20} />
      ) : sections.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          You are not a member of any sections.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {sections.map((section) => {
            const isOptedOut = localOverrides.has(section.id) ? localOverrides.get(section.id)! : optOutIds.has(section.id);
            const isBusy = busy === section.id;
            return (
              <FormControlLabel
                key={section.id}
                control={
                  <Switch
                    checked={!isOptedOut}
                    onChange={() => void handleToggle(section.id, isOptedOut)}
                    size="small"
                    disabled={isBusy}
                  />
                }
                label={<Typography variant="body2">{section.name}</Typography>}
              />
            );
          })}
        </Stack>
      )}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

export default function AccountSettingsPage({
  user,
  userData,
  userDataLoading = false,
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
  const membershipLabel = userDataLoading && !userData
    ? "Loading…"
    : getMembershipStatusLabel(membershipStatus);

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
            You can update your membership status on your profile page.
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

        <Divider />
        <AnnouncementPreferencesList />

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

      <Snackbar
        open={passwordSuccess}
        autoHideDuration={4000}
        onClose={() => setPasswordSuccess(false)}
        message="Password updated successfully"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

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
