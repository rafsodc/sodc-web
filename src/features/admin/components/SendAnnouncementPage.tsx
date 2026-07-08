import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Campaign, Refresh } from "@mui/icons-material";
import PageHeader from "../../../shared/components/PageHeader";
import {
  getAnnouncementTemplates,
  previewAnnouncementTemplate,
  sendSectionAnnouncement,
  type AnnouncementTemplate,
} from "../../../shared/utils/firebaseFunctions";
import TemplateEditor from "./TemplateEditor";
import AnnouncementSendHistory from "./AnnouncementSendHistory";

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
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sentCount: number;
    skippedCount: number;
    failureCount: number;
  } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [templatesTrigger, setTemplatesTrigger] = useState(0);

  useEffect(() => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    getAnnouncementTemplates(sectionId)
      .then(setTemplates)
      .catch(() => setTemplatesError("Failed to load templates from GOV Notify"))
      .finally(() => setLoadingTemplates(false));
  }, [sectionId, templatesTrigger]);

  const handleTemplateChange = async (e: SelectChangeEvent) => {
    const id = e.target.value;
    setSelectedId(id);
    setPreviewHtml(null);
    setPreviewSubject(null);
    setPreviewError(null);
    setSendResult(null);
    setSendError(null);
    if (!id) return;
    setLoadingPreview(true);
    try {
      const { html, subject } = await previewAnnouncementTemplate(id);
      setPreviewHtml(html);
      setPreviewSubject(subject);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load preview");
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
      const selectedTemplate = templates.find((t) => t.id === selectedId);
      const result = await sendSectionAnnouncement(sectionId, selectedId, selectedTemplate?.name);
      setSendResult(result);
      setHistoryTrigger((n) => n + 1);
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

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          {loadingTemplates ? (
            <CircularProgress size={24} />
          ) : (
            <FormControl fullWidth disabled={templates.length === 0}>
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
        </Box>
        <Tooltip title="Refresh template list from GOV Notify">
          <span>
            <IconButton
              onClick={() => setTemplatesTrigger((n) => n + 1)}
              disabled={loadingTemplates}
              aria-label="Refresh templates"
            >
              {loadingTemplates ? <CircularProgress size={20} /> : <Refresh />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {loadingPreview && <CircularProgress size={24} sx={{ mb: 2 }} />}

      {previewError && !loadingPreview && (
        <Alert severity="warning" sx={{ mb: 2 }}>Preview unavailable: {previewError}</Alert>
      )}

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
              mb: 3,
              overflow: "hidden",
            }}
          >
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              sandbox="allow-same-origin"
              style={{ width: "100%", border: "none", display: "block", minHeight: 400 }}
              onLoad={(e) => {
                const iframe = e.currentTarget;
                const height = iframe.contentDocument?.body?.scrollHeight;
                if (height) iframe.style.height = `${height + 32}px`;
              }}
            />
          </Box>
        </>
      )}

      {selectedId && (
        <>
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

      <TemplateEditor sectionName={sectionName} />

      <AnnouncementSendHistory sectionId={sectionId} refreshTrigger={historyTrigger} />
    </Box>
  );
}
