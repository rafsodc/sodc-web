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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DarkMode, LightMode, SettingsBrightness } from "@mui/icons-material";
import {
  useGetMyAnnouncementPreferences,
  useOptOutSectionAnnouncement,
  useOptInSectionAnnouncement,
  useUpdateAnnouncementOptOutAll,
} from "@dataconnect/generated/react";
import { upsertUser, type UpsertUserVariables } from "@dataconnect/generated";
import { useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  type User,
} from "firebase/auth";
import { auth, dataConnect } from "../../../config/firebase";
import { ROUTES } from "../../../constants";
import type { UserData } from "../../../types";
import {
  requestEmailChange,
  resignMembership,
} from "../../../shared/utils/firebaseFunctions";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import { canUserResignMembership } from "../../users/utils/membershipStatusValidation";
import { useColorMode, type ColorModePreference } from "../../../shared/appShell/ColorModeContext";
import {
  PASSWORD_POLICY_HELPER_TEXT,
  validateNewPassword,
} from "../../auth/utils/passwordValidation";
import { getAnnouncementSections } from "../utils/announcementPreferences";
import {
  reportError,
  toAuthUserFacingError,
  toProfileDomainUserFacingError,
  toProfileUserFacingError,
} from "../../../shared/errors";

export interface AccountSettingsPageProps {
  user: User;
  userData: UserData | null;
  userDataLoading?: boolean;
  isAdmin: boolean;
  onBack?: () => void;
}

function usesEmailPassword(user: User): boolean {
  return user.providerData.some((provider) => provider.providerId === "password");
}

function AnnouncementPreferencesList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMyAnnouncementPreferences({ staleTime: Infinity });
  const optOut = useOptOutSectionAnnouncement();
  const optIn = useOptInSectionAnnouncement();
  const updateGlobalOptOut = useUpdateAnnouncementOptOutAll();
  const [busy, setBusy] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [globalOverride, setGlobalOverride] = useState<boolean | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Map<string, boolean>>(new Map());
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const sections = useMemo(() => {
    return getAnnouncementSections(data);
  }, [data]);

  const optOutIds = useMemo(
    () => new Set((data?.user?.optOuts ?? []).map((o) => o.section.id)),
    [data]
  );
  const announcementOptOutAll =
    globalOverride ?? data?.user?.announcementOptOutAll ?? false;

  const handleGlobalToggle = async () => {
    const newOptOut = !announcementOptOutAll;
    setGlobalOverride(newOptOut);
    setGlobalBusy(true);
    try {
      await updateGlobalOptOut.mutateAsync({ announcementOptOutAll: newOptOut });
      queryClient.setQueryData(
        ["GetMyAnnouncementPreferences", null],
        (old: typeof data) =>
          old?.user
            ? { ...old, user: { ...old.user, announcementOptOutAll: newOptOut } }
            : old,
      );
      setSnackbar(
        newOptOut
          ? "Opted out of all announcement emails"
          : "Announcement emails enabled",
      );
    } catch (error) {
      reportError("account.announcement-preferences.global", error);
      setGlobalOverride(null);
    } finally {
      setGlobalBusy(false);
    }
  };

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
    } catch (error) {
      reportError("account.announcement-preferences.section", error);
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
        Choose whether you receive optional announcements. Account-security, booking, and payment
        messages are always sent when required.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={!announcementOptOutAll}
            onChange={() => void handleGlobalToggle()}
            disabled={isLoading || globalBusy}
          />
        }
        label="Receive announcement emails"
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Turning this off also applies to sections added in the future. Your individual section
        choices are preserved.
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
                    disabled={isBusy || announcementOptOutAll}
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
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const [resignDialogOpen, setResignDialogOpen] = useState(false);
  const [resignSubmitting, setResignSubmitting] = useState(false);
  const [resignError, setResignError] = useState<string | null>(null);

  const [shareContactInfoSubmitting, setShareContactInfoSubmitting] = useState(false);
  const [shareContactInfoError, setShareContactInfoError] = useState<string | null>(null);
  const [shareContactInfoOverride, setShareContactInfoOverride] = useState<boolean | null>(null);

  const { preference: colorModePreference, setPreference: setColorModePreference } = useColorMode();

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
      const passwordValidation = await validateNewPassword(auth, newPassword);
      if (!passwordValidation.isValid) {
        setPasswordError(
          passwordValidation.error ?? "Password does not meet the current requirements",
        );
        return;
      }
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
    } catch (error) {
      reportError("account.password-change", error);
      setPasswordError(toAuthUserFacingError(error, "password-change").message);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailError(null);
    setEmailSuccess(false);
    const normalized = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (!user.email) {
      setEmailError("Your account does not have an email address for re-authentication");
      return;
    }
    if (normalized === user.email.trim().toLowerCase()) {
      setEmailError("Enter a different email address");
      return;
    }

    setEmailSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, emailCurrentPassword);
      await reauthenticateWithCredential(user, credential);
      await user.getIdToken(true);
      await requestEmailChange(normalized);
      setNewEmail("");
      setEmailCurrentPassword("");
      setEmailSuccess(true);
    } catch (error: unknown) {
      reportError("account.email-change", error);
      setEmailError(toAuthUserFacingError(error, "email-change").message);
    } finally {
      setEmailSubmitting(false);
    }
  };

  const shareContactInfo = shareContactInfoOverride ?? userData?.shareContactInfo ?? true;

  const handleShareContactInfoToggle = async () => {
    if (!userData) return;
    const newValue = !shareContactInfo;
    setShareContactInfoError(null);
    setShareContactInfoOverride(newValue);
    setShareContactInfoSubmitting(true);
    try {
      const vars: UpsertUserVariables = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        serviceNumber: userData.serviceNumber,
        mobileNumber: userData.mobileNumber,
        postNominals: userData.postNominals,
        isRegular: userData.isRegular,
        isReserve: userData.isReserve,
        isCivilServant: userData.isCivilServant,
        isIndustry: userData.isIndustry,
        rank: userData.rank,
        shareContactInfo: newValue,
      };
      await upsertUser(dataConnect, vars);
    } catch (error) {
      reportError("account.privacy-setting", error);
      setShareContactInfoOverride(null);
      setShareContactInfoError(toProfileUserFacingError(error, "privacy").message);
    } finally {
      setShareContactInfoSubmitting(false);
    }
  };

  const handleResignConfirm = async () => {
    setResignError(null);
    setResignSubmitting(true);
    try {
      const result = await resignMembership();
      if (!result.success) {
        const error = new Error(result.error ?? "Membership resignation failed");
        reportError("account.membership-resignation", error);
        setResignError(
          toProfileDomainUserFacingError(result.domainCode, "resignation").message,
        );
        return;
      }
      setResignDialogOpen(false);
      await signOut(auth);
    } catch (error) {
      reportError("account.membership-resignation", error);
      setResignError(toProfileUserFacingError(error, "resignation").message);
    } finally {
      setResignSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: "600px", mx: "auto", py: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ color: "primary.light", mb: 3 }}>
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

        <Box component="section" aria-labelledby="appearance-heading">
          <Typography id="appearance-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
            Appearance
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose whether the site follows your device's light/dark setting, or always uses a
            specific one. Choosing Light or Dark stores one appearance cookie so the site can
            remember your choice.
          </Typography>
          <ToggleButtonGroup
            value={colorModePreference}
            exclusive
            onChange={(_, value: ColorModePreference | null) => {
              if (value) setColorModePreference(value);
            }}
            aria-label="Appearance"
          >
            <ToggleButton value="system" aria-label="System">
              <SettingsBrightness fontSize="small" sx={{ mr: 1 }} />
              System
            </ToggleButton>
            <ToggleButton value="light" aria-label="Light">
              <LightMode fontSize="small" sx={{ mr: 1 }} />
              Light
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Dark">
              <DarkMode fontSize="small" sx={{ mr: 1 }} />
              Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider />

        <Box component="section" aria-labelledby="privacy-heading">
          <Typography id="privacy-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
            Privacy
          </Typography>
          {shareContactInfoError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {shareContactInfoError}
            </Alert>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={shareContactInfo}
                onChange={() => void handleShareContactInfoToggle()}
                disabled={!userData || shareContactInfoSubmitting}
              />
            }
            label="Share my contact details with other section members"
          />
          <Typography variant="body2" color="text.secondary">
            When off, other members will see you listed but won't be able to view your contact
            details.
          </Typography>
        </Box>

        <Divider />

        <Box component="section" aria-labelledby="change-email-heading">
          <Typography id="change-email-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
            Change email address
          </Typography>
          {!canChangePassword ? (
            <Alert severity="info">
              Email changes are only available for email and password sign-in.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current address: <strong>{user.email}</strong>. The new address will not take
                effect until you confirm the link sent to it.
              </Typography>
              {emailError ? <Alert severity="error" sx={{ mb: 2 }}>{emailError}</Alert> : null}
              {emailSuccess ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Check the new address for a confirmation link.
                </Alert>
              ) : null}
              <Box component="form" onSubmit={handleEmailSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="New email address"
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    autoComplete="email"
                    required
                    fullWidth
                    disabled={emailSubmitting}
                  />
                  <TextField
                    label="Current password for email change"
                    type="password"
                    value={emailCurrentPassword}
                    onChange={(event) => setEmailCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    fullWidth
                    disabled={emailSubmitting}
                  />
                  <Box>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={emailSubmitting || !newEmail.trim() || !emailCurrentPassword}
                    >
                      {emailSubmitting
                        ? <CircularProgress size={24} color="inherit" />
                        : "Send confirmation link"}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </>
          )}
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
                    helperText={PASSWORD_POLICY_HELPER_TEXT}
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
                        !newPassword ||
                        newPassword !== confirmPassword
                      }
                      sx={{
                        backgroundColor: "secondary.main",
                        "&:hover": {
                          backgroundColor: "secondary.main",
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
