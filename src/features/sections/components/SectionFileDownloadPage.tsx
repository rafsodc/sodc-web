import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { requestSectionFileDownload } from "../../../shared/utils/firebaseFunctions";

export default function SectionFileDownloadPage({
  sectionId,
  fileId,
}: {
  sectionId: string;
  fileId: string;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    void requestSectionFileDownload(sectionId, fileId)
      .then(({ downloadUrl }) => {
        if (active) window.location.assign(downloadUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [sectionId, fileId, attempt]);

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: 6 }}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h4" component="h1">Section file</Typography>
        {failed ? (
          <>
            <Alert severity="error">
              This file is unavailable, or you no longer have access to it.
            </Alert>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </Button>
              <Button component={RouterLink} to={`/sections/${sectionId}`}>
                Back to section
              </Button>
            </Stack>
          </>
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={24} />
            <Typography>Checking access and preparing your download…</Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
