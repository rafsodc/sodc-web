import { useState } from "react";
import { Button, Snackbar } from "@mui/material";
import { NotificationsActive, NotificationsOff } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSectionAnnouncementOptOut,
  useOptOutSectionAnnouncement,
  useOptInSectionAnnouncement,
} from "@dataconnect/generated/react";
import { invalidateAnnouncementPreferences } from "../../../shared/query/invalidation";

interface AnnouncementOptOutToggleProps {
  sectionId: string;
}

export default function AnnouncementOptOutToggle({ sectionId }: AnnouncementOptOutToggleProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetSectionAnnouncementOptOut(
    { sectionId },
    { staleTime: Infinity }
  );
  const optOut = useOptOutSectionAnnouncement();
  const optIn = useOptInSectionAnnouncement();
  const [busy, setBusy] = useState(false);
  const [localOptedOut, setLocalOptedOut] = useState<boolean | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const isOptedOut = localOptedOut !== null ? localOptedOut : !!data?.sectionAnnouncementOptOut;

  const handleChange = async () => {
    const newOptedOut = !isOptedOut;
    setLocalOptedOut(newOptedOut);
    setBusy(true);
    try {
      if (isOptedOut) {
        await optIn.mutateAsync({ sectionId });
      } else {
        await optOut.mutateAsync({ sectionId });
      }
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
      setLocalOptedOut(null);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return null;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={isOptedOut ? <NotificationsOff /> : <NotificationsActive />}
        onClick={() => void handleChange()}
        disabled={busy}
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
