import { dataConnect } from "../../../config/firebase";
import { useGetSectionAnnouncementOptOut } from "../../../shared/query/authoritativeHooks";
import { runSessionOperation } from "../../../shared/appShell/sessionLifecycle";
import { useState } from "react";
import { Alert, Button, Snackbar } from "@mui/material";
import { NotificationsActive, NotificationsOff } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOptOutSectionAnnouncement,
  useOptInSectionAnnouncement,
} from "@dataconnect/generated/react";
import { invalidateAnnouncementPreferences } from "../../../shared/query/invalidation";

interface AnnouncementOptOutToggleProps {
  sectionId: string;
}

export default function AnnouncementOptOutToggle({ sectionId }: AnnouncementOptOutToggleProps) {
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

  const isOptedOut = localOptedOut !== null ? localOptedOut : !!data?.sectionAnnouncementOptOut;

  const retryRefresh = async () => {
    setBusy(true);
    try {
      await invalidateAnnouncementPreferences(queryClient);
      setRefreshFailed(false);
      setLocalOptedOut(null);
    } catch { setRefreshFailed(true); }
    finally { setBusy(false); }
  };
  const handleChange = async () => {
    const newOptedOut = !isOptedOut;
    setLocalOptedOut(newOptedOut);
    setBusy(true);
    setSaveError(null);
    let saved = false;
    try {
      if (isOptedOut) {
        await runSessionOperation(() => optIn.mutateAsync({ sectionId }));
      } else {
        await runSessionOperation(() => optOut.mutateAsync({ sectionId }));
      }
      saved = true;
      queryClient.setQueryData(
        ["GetSectionAnnouncementOptOut", { sectionId }],
        newOptedOut
          ? { sectionAnnouncementOptOut: { createdAt: new Date().toISOString() } }
          : { sectionAnnouncementOptOut: null }
      );
      await invalidateAnnouncementPreferences(queryClient);
      setLocalOptedOut(null);
      setSnackbar(
        newOptedOut
          ? "You will no longer receive announcements from this section"
          : "You will now receive announcements from this section"
      );
    } catch {
      if (saved) setRefreshFailed(true);
      else { setLocalOptedOut(null); setSaveError("We couldn’t save your email preference. Check your connection and try again."); }
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return null;

  return (
    <>
      {refreshFailed ? <Alert severity="warning" action={<Button onClick={() => void retryRefresh()} disabled={busy}>Retry refresh</Button>}>Your email preference was saved, but the latest preferences could not be loaded.</Alert> : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {isError && !refreshFailed ? <Alert severity="error" action={<Button onClick={() => void refetch({throwOnError: true}).catch(() => undefined)}>Retry loading</Button>}>Email preferences could not be loaded.</Alert> : null}
      <Button
        variant="outlined"
        size="small"
        startIcon={isOptedOut ? <NotificationsOff /> : <NotificationsActive />}
        onClick={() => void handleChange()}
        disabled={busy || refreshFailed || isError}
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
