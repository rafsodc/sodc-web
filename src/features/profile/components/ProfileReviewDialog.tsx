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
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { confirmProfileReview, MembershipStatus } from "@dataconnect/generated";
import {
  useGetMyAnnouncementPreferences,
  useOptInSectionAnnouncement,
  useOptOutSectionAnnouncement,
} from "@dataconnect/generated/react";
import { dataConnect, auth } from "../../../config/firebase";
import {
  MAX_MOBILE_NUMBER_LENGTH,
  MAX_NAME_LENGTH,
  MAX_POST_NOMINALS_LENGTH,
  MAX_SERVICE_NUMBER_LENGTH,
  MEMBERSHIP_STATUS_OPTIONS,
} from "../../../constants";
import RankSelect from "../../../shared/components/RankSelect";
import { updateDisplayName, updateMembershipStatus } from "../../../shared/utils/firebaseFunctions";
import { normalizeMobileNumber } from "../../../shared/utils/mobileNumber";
import type { UserData } from "../../../types";
import { getAnnouncementSections } from "../../account/utils/announcementPreferences";
import { NON_RESTRICTED_STATUSES, isRestrictedStatus } from "../../users/utils/membershipStatusValidation";
import {
  reportError,
  toProfileDomainUserFacingError,
  toProfileUserFacingError,
} from "../../../shared/errors";
import FailureState from "../../../shared/components/FailureState";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAnnouncementPreferences } from "../../../shared/query/invalidation";

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
  const queryClient = useQueryClient();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [postNominals, setPostNominals] = useState("");
  const [rank, setRank] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | "">("");
  const [shareContactInfo, setShareContactInfo] = useState(true);
  const [isRegular, setIsRegular] = useState(false);
  const [isReserve, setIsReserve] = useState(false);
  const [isCivilServant, setIsCivilServant] = useState(false);
  const [isIndustry, setIsIndustry] = useState(false);
  const [announcementOptOutAll, setAnnouncementOptOutAll] = useState(false);
  const [sectionOptOutIds, setSectionOptOutIds] = useState<Set<string>>(new Set());
  const [preferencesInitialised, setPreferencesInitialised] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankError, setRankError] = useState(false);
  const preferences = useGetMyAnnouncementPreferences({ staleTime: 0 });
  const optOutSection = useOptOutSectionAnnouncement();
  const optInSection = useOptInSectionAnnouncement();
  const announcementSections = getAnnouncementSections(preferences.data);

  useEffect(() => {
    setFirstName(userData.firstName || "");
    setLastName(userData.lastName || "");
    setServiceNumber(userData.serviceNumber || "");
    setMobileNumber(userData.mobileNumber || "");
    setPostNominals(userData.postNominals || "");
    setRank(userData.rank || "");
    setMembershipStatus(userData.membershipStatus || "");
    setShareContactInfo(userData.shareContactInfo ?? true);
    setIsRegular(userData.isRegular ?? false);
    setIsReserve(userData.isReserve ?? false);
    setIsCivilServant(userData.isCivilServant ?? false);
    setIsIndustry(userData.isIndustry ?? false);
  }, [userData]);

  useEffect(() => {
    if (!preferences.data?.user || preferencesInitialised) return;
    setAnnouncementOptOutAll(preferences.data.user.announcementOptOutAll ?? false);
    setSectionOptOutIds(
      new Set((preferences.data.user.optOuts ?? []).map((optOut) => optOut.section.id)),
    );
    setPreferencesInitialised(true);
  }, [preferences.data, preferencesInitialised]);

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
      if (!preferences.data?.user || !preferencesInitialised) {
        throw new Error("Communication preferences are still loading. Please try again.");
      }
      const storedOptOutIds = new Set(
        (preferences.data.user.optOuts ?? []).map((optOut) => optOut.section.id),
      );
      for (const section of announcementSections) {
        const stored = storedOptOutIds.has(section.id);
        const requested = sectionOptOutIds.has(section.id);
        if (stored === requested) continue;
        if (requested) await optOutSection.mutateAsync({ sectionId: section.id });
        else await optInSection.mutateAsync({ sectionId: section.id });
      }

      const currentStatus = userData.membershipStatus || null;
      if (membershipStatus && membershipStatus !== currentStatus) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error("You must be logged in to update your membership status");
        }
        const statusResult = await updateMembershipStatus(
          currentUser.uid,
          membershipStatus as MembershipStatus,
        );
        if (!statusResult.success) {
          const statusError = new Error(statusResult.error || "Membership status update failed");
          reportError("profile.review.membership-status", statusError);
          setError(toProfileDomainUserFacingError(statusResult.domainCode, "update").message);
          setSubmitting(false);
          return;
        }
      }

      await confirmProfileReview(dataConnect, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        serviceNumber: serviceNumber.trim(),
        mobileNumber: normalizedMobileNumber,
        postNominals: postNominals.trim() || null,
        rank,
        shareContactInfo,
        announcementOptOutAll,
        isRegular,
        isReserve,
        isCivilServant,
        isIndustry,
      });

      const displayName = `${lastName.trim()}, ${firstName.trim()}`;
      try {
        const displayNameResult = await updateDisplayName(displayName);
        if (!displayNameResult.success) {
          reportError(
            "profile.review.display-name",
            new Error(displayNameResult.error ?? "Display name update failed"),
          );
        }
      } catch (displayNameError) {
        reportError("profile.review.display-name", displayNameError);
      }

      await invalidateAnnouncementPreferences(queryClient);
      await onReviewed();
    } catch (caught) {
      reportError("profile.review", caught);
      setError(toProfileUserFacingError(caught, "review").message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusLocked =
    userData.membershipStatus != null && isRestrictedStatus(userData.membershipStatus);

  const missingRequiredField =
    !firstName.trim() ||
    !lastName.trim() ||
    !serviceNumber.trim() ||
    !mobileNumber.trim() ||
    !rank ||
    !membershipStatus;

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
            Please check these details and communication choices are still correct. We ask every six
            months so membership and contact information stays current.
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
            <FormControl fullWidth required>
              <InputLabel>Membership status</InputLabel>
              <Select
                value={membershipStatus}
                label="Membership status"
                onChange={(event) => setMembershipStatus(event.target.value as MembershipStatus)}
                disabled={submitting || statusLocked}
                data-testid="review-membership-status-select"
              >
                {statusLocked ? (
                  MEMBERSHIP_STATUS_OPTIONS.filter(
                    (option) => option.value === userData.membershipStatus,
                  ).map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))
                ) : (
                  MEMBERSHIP_STATUS_OPTIONS.filter((option) =>
                    NON_RESTRICTED_STATUSES.includes(option.value),
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
            <Box component="section" aria-labelledby="review-service-background-heading">
              <Typography id="review-service-background-heading" variant="h6" component="h2">
                Service background
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isRegular}
                      onChange={(event) => setIsRegular(event.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="Regular"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isReserve}
                      onChange={(event) => setIsReserve(event.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="Reserve"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isCivilServant}
                      onChange={(event) => setIsCivilServant(event.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="Civil Servant"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isIndustry}
                      onChange={(event) => setIsIndustry(event.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="Industry"
                />
              </FormGroup>
            </Box>
            <Box component="section" aria-labelledby="review-announcements-heading">
              <Typography id="review-announcements-heading" variant="h6" component="h2">
                Announcement emails
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Account-security, booking and payment messages are always sent when required.
              </Typography>
              {preferences.isLoading ? (
                <CircularProgress size={20} aria-label="Loading communication preferences" />
              ) : null}
              {preferences.isError ? (
                <FailureState
                  title="Communication preferences are unavailable"
                  message="We could not load your communication preferences. Please try again."
                  onRetry={() => void preferences.refetch()}
                />
              ) : null}
              {preferencesInitialised ? (
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!announcementOptOutAll}
                        onChange={(event) => setAnnouncementOptOutAll(!event.target.checked)}
                        disabled={submitting}
                      />
                    }
                    label="Receive announcement emails"
                  />
                  {announcementSections.map((section) => (
                    <FormControlLabel
                      key={section.id}
                      control={
                        <Checkbox
                          checked={!sectionOptOutIds.has(section.id)}
                          onChange={(event) => {
                            setSectionOptOutIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.delete(section.id);
                              else next.add(section.id);
                              return next;
                            });
                          }}
                          disabled={submitting || announcementOptOutAll}
                        />
                      }
                      label={section.name}
                    />
                  ))}
                </FormGroup>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={
              submitting || missingRequiredField || !preferencesInitialised || preferences.isError
            }
          >
            {submitting ? <CircularProgress size={24} /> : "Confirm profile"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
