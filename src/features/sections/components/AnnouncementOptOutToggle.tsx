import { useState } from "react";
import { FormControlLabel, Switch, Typography, CircularProgress, Box } from "@mui/material";
import {
  useGetSectionAnnouncementOptOut,
  useOptOutSectionAnnouncement,
  useOptInSectionAnnouncement,
} from "@dataconnect/generated/react";

interface AnnouncementOptOutToggleProps {
  sectionId: string;
}

export default function AnnouncementOptOutToggle({ sectionId }: AnnouncementOptOutToggleProps) {
  const { data, loading, refetch } = useGetSectionAnnouncementOptOut({ sectionId });
  const [optOut] = useOptOutSectionAnnouncement();
  const [optIn] = useOptInSectionAnnouncement();
  const [busy, setBusy] = useState(false);

  const isOptedOut = !!data?.sectionAnnouncementOptOut;
  const checked = !isOptedOut;

  const handleChange = async () => {
    setBusy(true);
    try {
      if (isOptedOut) {
        await optIn({ sectionId });
      } else {
        await optOut({ sectionId });
      }
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <FormControlLabel
        control={
          busy ? (
            <CircularProgress size={20} sx={{ mx: 1.5 }} />
          ) : (
            <Switch checked={checked} onChange={handleChange} size="small" />
          )
        }
        label={
          <Typography variant="body2" color="text.secondary">
            Receive announcements from this section
          </Typography>
        }
      />
    </Box>
  );
}
