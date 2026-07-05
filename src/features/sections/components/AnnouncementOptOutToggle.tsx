import { useState } from "react";
import { FormControlLabel, Switch, Typography, Box, Snackbar } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSectionAnnouncementOptOut,
  useOptOutSectionAnnouncement,
  useOptInSectionAnnouncement,
} from "@dataconnect/generated/react";

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
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={!isOptedOut}
            onChange={() => void handleChange()}
            size="small"
            disabled={busy}
          />
        }
        label={
          <Typography variant="body2" color="text.secondary">
            Receive announcements from this section
          </Typography>
        }
      />
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
