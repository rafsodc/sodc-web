import { dataConnect } from "../../../config/firebase";
import { useGetSectionAnnouncementOptOut } from "../../../shared/query/authoritativeHooks";
import { captureSession, runSessionOperation } from "../../../shared/appShell/sessionLifecycle";
import { useState } from "react";
import { Alert, Button, Snackbar } from "@mui/material";
import { NotificationsActive, NotificationsOff } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOptOutSectionAnnouncement,
  useOptInSectionAnnouncement,
} from "@dataconnect/generated/react";
import { invalidateAnnouncementPreferences, retireAnnouncementPreferences } from "../../../shared/query/invalidation";
import { usePreferenceSaveGuard } from "../../account/hooks/usePreferenceSaveGuard";
import { reportError } from "../../../shared/errors";

interface AnnouncementOptOutToggleProps {
  sectionId: string;
}

export default function AnnouncementOptOutToggle({ sectionId }: AnnouncementOptOutToggleProps) {
  const session = captureSession();
  return <SectionAnnouncementOptOutToggle key={`${session.uid}:${session.generation}:${sectionId}`} sectionId={sectionId} />;
}

function SectionAnnouncementOptOutToggle({ sectionId }: AnnouncementOptOutToggleProps) {
  const { begin: beginPreferenceSave, available: preferenceAvailable } = usePreferenceSaveGuard(sectionId);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetSectionAnnouncementOptOut(
    dataConnect,
    { sectionId },
    { staleTime: 30_000 }
  );
  const optOut = useOptOutSectionAnnouncement();
  const optIn = useOptInSectionAnnouncement();
  const [busy, setBusy] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localOptedOut, setLocalOptedOut] = useState<boolean | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [preferenceInterrupted, setPreferenceInterrupted] = useState(false);
  const [interruptedReloadFailed, setInterruptedReloadFailed] = useState(false);

  const finishPreferenceSave = async (operation: NonNullable<ReturnType<typeof beginPreferenceSave>>) => {
    if (operation.hasSessionOwner() && !operation.hasCurrentSession()) {
      try { await retireAnnouncementPreferences(queryClient); }
      catch (error) { if (operation.ownsView()) reportError("section.announcement-preferences.retire", error); }
    }
    if (operation.ownsView()) {
      if (!operation.isCurrent()) {
        setLocalOptedOut(null);
        setPreferenceInterrupted(true);
        setInterruptedReloadFailed(false);
        setRefreshFailed(false);
        setSaveError(null);
        setSnackbar(null);
      }
      setBusy(false);
    }
    operation.finish();
  };

  const isOptedOut = localOptedOut !== null ? localOptedOut : !!data?.sectionAnnouncementOptOut;

  const retryRefresh = async () => {
    const operation = beginPreferenceSave();
    if (!operation) return;
    setBusy(true);
    setInterruptedReloadFailed(false);
    try {
      await invalidateAnnouncementPreferences(queryClient);
      if (!operation.isCurrent()) return;
      setRefreshFailed(false);
      setPreferenceInterrupted(false);
      setLocalOptedOut(null);
    } catch {
      if (operation.isCurrent()) {
        if (preferenceInterrupted) setInterruptedReloadFailed(true);
        else setRefreshFailed(true);
      }
    }
    finally { await finishPreferenceSave(operation); }
  };
  const handleChange = async () => {
    const operation = beginPreferenceSave();
    if (!operation) return;
    const newOptedOut = !isOptedOut;
    setLocalOptedOut(newOptedOut);
    setBusy(true);
    setSaveError(null);
    setSnackbar(null);
    let saved = false;
    try {
      if (isOptedOut) {
        await runSessionOperation(() => optIn.mutateAsync({ sectionId }));
      } else {
        await runSessionOperation(() => optOut.mutateAsync({ sectionId }));
      }
      if (!operation.hasCurrentSession()) return;
      saved = true;
      queryClient.setQueryData(
        ["GetSectionAnnouncementOptOut", { sectionId }],
        newOptedOut
          ? { sectionAnnouncementOptOut: { createdAt: new Date().toISOString() } }
          : { sectionAnnouncementOptOut: null }
      );
      if (!operation.hasCurrentSession()) return;
      await invalidateAnnouncementPreferences(queryClient);
      if (!operation.isCurrent()) return;
      setLocalOptedOut(null);
      setSnackbar(
        newOptedOut
          ? "You will no longer receive announcements from this section"
          : "You will now receive announcements from this section"
      );
    } catch {
      if (!operation.isCurrent()) return;
      if (saved) setRefreshFailed(true);
      else { setLocalOptedOut(null); setSaveError("We couldn’t save your email preference. Check your connection and try again."); }
    } finally {
      await finishPreferenceSave(operation);
    }
  };

  if (isLoading) return null;

  return (
    <>
      {refreshFailed ? <Alert severity="warning" action={<Button onClick={() => void retryRefresh()} disabled={busy || !preferenceAvailable}>Retry refresh</Button>}>Your email preference was saved, but the latest preferences could not be loaded.</Alert> : null}
      {preferenceInterrupted ? <Alert severity="warning" action={<Button onClick={() => void retryRefresh()} disabled={busy || !preferenceAvailable}>Reload preferences</Button>}>Your account changed while updating email preferences. {interruptedReloadFailed ? "We couldn’t reload your email preferences. Check your connection and try again." : "Reload them before making another change."}</Alert> : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {isError && !refreshFailed ? <Alert severity="error" action={<Button onClick={() => void refetch({throwOnError: true}).catch(() => undefined)}>Retry loading</Button>}>Email preferences could not be loaded.</Alert> : null}
      <Button
        variant="outlined"
        size="small"
        startIcon={isOptedOut ? <NotificationsOff /> : <NotificationsActive />}
        onClick={() => void handleChange()}
        disabled={busy || refreshFailed || preferenceInterrupted || isError || !preferenceAvailable}
      >
        {isOptedOut ? "Turn On Emails" : "Turn Off Emails"}
      </Button>
      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
