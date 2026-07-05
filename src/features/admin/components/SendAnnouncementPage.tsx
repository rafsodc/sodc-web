import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Typography,
} from "@mui/material";
import { Campaign } from "@mui/icons-material";
import PageHeader from "../../../shared/components/PageHeader";
import {
  getAnnouncementTemplates,
  previewAnnouncementTemplate,
  sendSectionAnnouncement,
  type AnnouncementTemplate,
} from "../../../shared/utils/firebaseFunctions";

interface SendAnnouncementPageProps {
  sectionId: string;
  sectionName: string;
  onBack: () => void;
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SendAnnouncementPage({
  sectionId,
  sectionName,
  onBack,
}: SendAnnouncementPageProps) {
  const [templates, setTemplates] = useState<AnnouncementTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sentCount: number;
    skippedCount: number;
    failureCount: number;
  } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingTemplates(true);
    getAnnouncementTemplates(sectionId)
      .then(setTemplates)
      .catch(() => setTemplatesError("Failed to load templates from GOV Notify"))
      .finally(() => setLoadingTemplates(false));
  }, [sectionId]);

  const handleTemplateChange = async (e: SelectChangeEvent) => {
    const id = e.target.value;
    setSelectedId(id);
    setPreviewHtml(null);
    setPreviewSubject(null);
    setSendResult(null);
    setSendError(null);
    if (!id) return;
    setLoadingPreview(true);
    try {
      const { html, subject } = await previewAnnouncementTemplate(id);
      setPreviewHtml(html);
      setPreviewSubject(subject);
    } catch {
      setPreviewHtml(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSend = async () => {
    if (!selectedId) return;
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const result = await sendSectionAnnouncement(sectionId, selectedId);
      setSendResult(result);
    } catch {
      setSendError("Failed to send announcement. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Box className="page-container">
      <PageHeader
        title={`Send announcement — ${sectionName}`}
        onBack={onBack}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select a GOV Notify template named starting with <strong>BULK:</strong>. Review the preview
        carefully before sending — this will email all active members of this section who have not
        opted out.
      </Typography>

      {templatesError && (
        <Alert severity="error" sx={{ mb: 2 }}>{templatesError}</Alert>
      )}

      {loadingTemplates ? (
        <CircularProgress size={24} />
      ) : (
        <FormControl fullWidth sx={{ mb: 3 }} disabled={templates.length === 0}>
          <InputLabel id="template-select-label">Template</InputLabel>
          <Select
            labelId="template-select-label"
            label="Template"
            value={selectedId}
            onChange={(e) => void handleTemplateChange(e)}
          >
            {templates.length === 0 && (
              <MenuItem value="" disabled>
                No BULK: templates found in GOV Notify
              </MenuItem>
            )}
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                  <Typography variant="body2">{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, whiteSpace: "nowrap" }}>
                    Updated {formatUpdatedAt(t.updatedAt)}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {loadingPreview && <CircularProgress size={24} sx={{ mb: 2 }} />}

      {previewHtml && !loadingPreview && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" gutterBottom>Preview</Typography>
          {previewSubject && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Subject: <strong>{previewSubject}</strong>
            </Typography>
          )}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 2,
              mb: 3,
              bgcolor: "background.paper",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              "& a": { color: "primary.main" },
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />

          {sendResult ? (
            <Alert severity={sendResult.failureCount > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
              Sent to {sendResult.sentCount} member{sendResult.sentCount !== 1 ? "s" : ""}.
              {sendResult.skippedCount > 0 && ` ${sendResult.skippedCount} skipped (opted out).`}
              {sendResult.failureCount > 0 && ` ${sendResult.failureCount} failed — check function logs.`}
            </Alert>
          ) : (
            <>
              {sendError && <Alert severity="error" sx={{ mb: 2 }}>{sendError}</Alert>}
              <Button
                variant="contained"
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <Campaign />}
                onClick={() => void handleSend()}
                disabled={sending}
              >
                {sending ? "Sending…" : `Send to ${sectionName} members`}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Members who have opted out of announcements will not receive this email.
              </Typography>
            </>
          )}
        </>
      )}
    </Box>
  );
}
