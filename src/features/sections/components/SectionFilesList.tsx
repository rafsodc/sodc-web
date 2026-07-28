import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import {
  listSectionFiles,
  requestSectionFileDownload,
  type SectionFile,
} from "../../../shared/utils/firebaseFunctions";

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function SectionFilesList({ sectionId }: { sectionId: string }) {
  const [files, setFiles] = useState<SectionFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setDownloadError(false);
    try {
      setFiles(await listSectionFiles(sectionId));
    } catch {
      setFiles([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (file: SectionFile) => {
    setDownloadingId(file.id);
    setDownloadError(false);
    try {
      const result = await requestSectionFileDownload(sectionId, file.id);
      window.location.assign(result.downloadUrl);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Box component="section" aria-labelledby="section-files-heading" sx={{ mt: 3, mb: 3 }}>
      <Typography id="section-files-heading" variant="h6" component="h2">
        Files
      </Typography>
      {downloadError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          This file could not be downloaded. Your access may have changed; please try again.
        </Alert>
      )}
      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={22} />
          <Typography>Loading files…</Typography>
        </Stack>
      ) : loadError ? (
        <Alert
          severity="error"
          action={<Button color="inherit" onClick={() => void load()}>Reload files</Button>}
          sx={{ mt: 1 }}
        >
          Files could not be loaded. Your access may have changed.
        </Alert>
      ) : files.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          No files are available for this section.
        </Typography>
      ) : (
        <List disablePadding>
          {files.map((file) => (
            <ListItem
              key={file.id}
              divider
              disableGutters
              secondaryAction={
                <Button
                  startIcon={downloadingId === file.id ? <CircularProgress size={16} /> : <DownloadIcon />}
                  disabled={downloadingId !== null}
                  onClick={() => void download(file)}
                  aria-label={`Download ${file.displayName}`}
                >
                  Download
                </Button>
              }
              sx={{ pr: 15 }}
            >
              <ListItemText
                primary={file.displayName}
                secondary={[
                  file.description,
                  [file.contentType, fileSize(file.sizeBytes), fileDate(file.createdAt)]
                    .filter(Boolean)
                    .join(" · "),
                ].filter(Boolean).join(" — ")}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
