import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ContentCopy, Delete, Edit, UploadFile } from "@mui/icons-material";
import {
  deleteSectionFile,
  listSectionFiles,
  replaceSectionFile,
  updateSectionFileMetadata,
  uploadSectionFile,
  type SectionFile,
} from "../../../shared/utils/firebaseFunctions";
import PageHeader from "../../../shared/components/PageHeader";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "text/csv",
  "application/json",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function validateFile(file: File): string | null {
  if (file.size <= 0) return "Choose a non-empty file.";
  if (file.size > MAX_BYTES) return "Files must be 25 MB or smaller.";
  if (!ALLOWED_TYPES.includes(file.type)) return "This file type is not supported.";
  return null;
}

export default function ManageSectionFiles({
  sectionId,
  sectionName,
  onBack,
}: {
  sectionId: string;
  sectionName: string;
  onBack: () => void;
}) {
  const [files, setFiles] = useState<SectionFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<SectionFile | null>(null);
  const [deleting, setDeleting] = useState<SectionFile | null>(null);
  const replacementInput = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<SectionFile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await listSectionFiles(sectionId));
    } catch (error) {
      reportError("admin.section-files.load", error, { sectionId });
      setFiles([]);
      setNotice({ severity: "error", text: toAdminUserFacingError(error, "files").message });
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (operation: () => Promise<void>, success: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await operation();
      setNotice({ severity: "success", text: success });
      await load();
    } catch (error) {
      reportError("admin.section-files.operation", error, { sectionId });
      setNotice({ severity: "error", text: toAdminUserFacingError(error, "files").message });
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  const submitUpload = async () => {
    if (!selectedFile) return;
    const validation = validateFile(selectedFile);
    if (validation) {
      setNotice({ severity: "error", text: validation });
      return;
    }
    if (!displayName.trim()) {
      setNotice({ severity: "error", text: "Enter a display name." });
      return;
    }
    await run(async () => {
      await uploadSectionFile(
        sectionId,
        selectedFile,
        { displayName: displayName.trim(), description: description.trim() || null },
        (value) => setStage(value === "uploading" ? "Uploading file…" : "Verifying and scanning file…"),
      );
      setSelectedFile(null);
      setDisplayName("");
      setDescription("");
    }, "File uploaded.");
  };

  const chooseReplacement = (file: SectionFile) => {
    setReplacing(file);
    replacementInput.current?.click();
  };

  const handleReplacement = async (file: File | undefined) => {
    const target = replacing;
    setReplacing(null);
    if (!target || !file) return;
    const validation = validateFile(file);
    if (validation) {
      setNotice({ severity: "error", text: validation });
      return;
    }
    await run(
      () => replaceSectionFile(
        sectionId,
        target.id,
        file,
        (value) => setStage(value === "uploading"
          ? "Uploading replacement…"
          : "Verifying and scanning replacement…"),
      ),
      "File replaced.",
    );
  };

  const copyLink = async (file: SectionFile) => {
    try {
      await navigator.clipboard.writeText(file.canonicalUrl);
      setNotice({ severity: "success", text: "Stable file link copied." });
    } catch (error) {
      reportError("admin.section-files.copy-link", error, { sectionId, fileId: file.id });
      setNotice({ severity: "error", text: "The link could not be copied. Try again." });
    }
  };

  return (
    <Box className="page-container">
      <PageHeader title={`Manage files — ${sectionName}`} onBack={onBack} />
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Upload files for members with access to this section. Stable links re-check access whenever opened.
      </Typography>

      {notice ? <Alert severity={notice.severity} sx={{ mb: 2 }}>{notice.text}</Alert> : null}
      {busy ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} role="status">
          <CircularProgress size={20} />
          <Typography>{stage ?? "Saving changes…"}</Typography>
        </Stack>
      ) : null}

      <Stack component="section" spacing={2} aria-labelledby="upload-file-heading">
        <Typography id="upload-file-heading" variant="h6" component="h2">Upload a file</Typography>
        <Button component="label" variant="outlined" startIcon={<UploadFile />} disabled={busy}>
          Choose file
          <input
            hidden
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              if (file && !displayName) setDisplayName(file.name.replace(/\.[^.]+$/, ""));
              event.target.value = "";
            }}
          />
        </Button>
        {selectedFile ? <Typography variant="body2">Selected: {selectedFile.name}</Typography> : null}
        <TextField
          label="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          inputProps={{ maxLength: 160 }}
          required
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          inputProps={{ maxLength: 1000 }}
          multiline
          minRows={2}
        />
        <Button
          variant="contained"
          onClick={() => void submitUpload()}
          disabled={busy || !selectedFile || !displayName.trim()}
          sx={{ alignSelf: "flex-start" }}
        >
          Upload and verify
        </Button>
      </Stack>

      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" component="h2">Existing files</Typography>
      {loading ? <CircularProgress sx={{ mt: 2 }} /> : files.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>No files have been uploaded.</Typography>
      ) : (
        <List>
          {files.map((file) => (
            <ListItem
              key={file.id}
              divider
              disableGutters
              sx={{
                display: "flex",
                alignItems: { xs: "flex-start", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                gap: 1,
              }}
            >
              <ListItemText
                primary={file.displayName}
                secondary={file.description || file.originalFilename}
                sx={{ flex: 1 }}
              />
              <Stack direction="row" flexWrap="wrap" justifyContent="flex-end">
                  <Tooltip title="Copy stable link">
                    <IconButton aria-label={`Copy link for ${file.displayName}`} onClick={() => void copyLink(file)}>
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit details">
                    <IconButton aria-label={`Edit ${file.displayName}`} onClick={() => setEditing(file)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Button disabled={busy} onClick={() => chooseReplacement(file)}>Replace</Button>
                  <Tooltip title="Delete file">
                    <IconButton aria-label={`Delete ${file.displayName}`} color="error" onClick={() => setDeleting(file)}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}

      <input
        ref={replacementInput}
        hidden
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={(event) => {
          void handleReplacement(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <Dialog open={Boolean(editing)} onClose={() => !busy && setEditing(null)} fullWidth>
        <DialogTitle>Edit file details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Display name"
              value={editing?.displayName ?? ""}
              onChange={(event) => setEditing((value) => value ? { ...value, displayName: event.target.value } : value)}
              inputProps={{ maxLength: 160 }}
            />
            <TextField
              label="Description (optional)"
              value={editing?.description ?? ""}
              onChange={(event) => setEditing((value) => value ? { ...value, description: event.target.value } : value)}
              inputProps={{ maxLength: 1000 }}
              multiline
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || !editing?.displayName.trim()}
            onClick={() => {
              if (!editing) return;
              const value = editing;
              void run(
                () => updateSectionFileMetadata(sectionId, value.id, {
                  displayName: value.displayName.trim(),
                  description: value.description?.trim() || null,
                }),
                "File details updated.",
              ).then(() => setEditing(null));
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)}>
        <DialogTitle>Delete file?</DialogTitle>
        <DialogContent>
          <Typography>
            {deleting ? `“${deleting.displayName}” will immediately stop appearing to members and its emailed link will no longer work.` : ""}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={busy}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={() => {
              if (!deleting) return;
              const value = deleting;
              void run(() => deleteSectionFile(sectionId, value.id), "File deleted.")
                .then(() => setDeleting(null));
            }}
          >
            Delete file
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
