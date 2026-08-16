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
  getAnnouncementDeliveryConfiguration,
  previewAnnouncementTemplate,
  sendSectionAnnouncement,
  type AnnouncementTemplate,
  type SendAnnouncementResult,
  type GovNotifyDeliveryMode,
} from "../../../shared/utils/firebaseFunctions";
import TemplateEditor from "./TemplateEditor";
import AnnouncementSendHistory from "./AnnouncementSendHistory";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";

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
  const [sendResult, setSendResult] = useState<SendAnnouncementResult | null>(null);
  const [sendRequestId, setSendRequestId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [templatesTrigger, setTemplatesTrigger] = useState(0);
  const [deliveryMode, setDeliveryMode] = useState<GovNotifyDeliveryMode>("SIMULATION");
  const [siteDeliveryMode, setSiteDeliveryMode] = useState<GovNotifyDeliveryMode | null>(null);
  const [deliveryModeError, setDeliveryModeError] = useState<string | null>(null);
  const [replyToOptions, setReplyToOptions] = useState<Array<{
    id: string;
    displayLabel: string;
    emailAddress: string;
  }>>([]);
  const [replyToAddressId, setReplyToAddressId] = useState("");
  const [replyToDefaultDescription, setReplyToDefaultDescription] = useState("Notify service default");

  useEffect(() => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    getAnnouncementTemplates(sectionId)
      .then(setTemplates)
      .catch((caught) => {
        reportError("admin.announcements.templates", caught, { sectionId });
        setTemplatesError(toAdminUserFacingError(caught, "announcements").message);
      })
      .finally(() => setLoadingTemplates(false));
  }, [sectionId, templatesTrigger]);

  useEffect(() => {
    setDeliveryModeError(null);
    getAnnouncementDeliveryConfiguration(sectionId)
      .then((configuration) => {
        const configuredMode = configuration.siteDeliveryMode;
        setSiteDeliveryMode(configuredMode);
        setDeliveryMode(configuredMode === "SIMULATION" ? "SIMULATION" : configuredMode);
        const options = configuration.replyToOptions ?? [];
        setReplyToOptions(options);
        const defaultAddress = options.find(
          (option) => option.id === configuration.defaultReplyToAddressId,
        );
        setReplyToDefaultDescription(defaultAddress
          ? `${defaultAddress.displayLabel} (${defaultAddress.emailAddress})`
          : configuration.replyToFallbackSource === "environment_fallback"
            ? "Configured system fallback"
            : "Notify service default");
      })
      .catch((caught) => {
        reportError("admin.announcements.delivery-mode", caught, { sectionId });
        setDeliveryModeError(toAdminUserFacingError(caught, "email-configuration").message);
      });
  }, [sectionId]);

  const handleTemplateChange = async (e: SelectChangeEvent) => {
    const id = e.target.value;
    setSelectedId(id);
    setPreviewHtml(null);
    setPreviewSubject(null);
    setPreviewError(null);
    setSendResult(null);
    setSendError(null);
    setSendRequestId(null);
    if (!id) return;
    setLoadingPreview(true);
    try {
      const { html, subject } = await previewAnnouncementTemplate(sectionId, id);
      setPreviewHtml(html);
      setPreviewSubject(subject);
    } catch (err) {
      reportError("admin.announcements.preview", err, { sectionId, templateId: id });
      setPreviewError(toAdminUserFacingError(err, "announcements").message);
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
      const requestId = sendRequestId ?? crypto.randomUUID();
      setSendRequestId(requestId);
      const result = replyToAddressId
        ? await sendSectionAnnouncement(
          sectionId,
          selectedId,
          requestId,
          selectedTemplate?.name,
          deliveryMode,
          replyToAddressId,
        )
        : await sendSectionAnnouncement(
          sectionId,
          selectedId,
          requestId,
          selectedTemplate?.name,
          deliveryMode,
        );
      setSendResult(result);
      setHistoryTrigger((n) => n + 1);
    } catch (caught) {
      reportError("admin.announcements.send", caught, { sectionId, templateId: selectedId });
      setSendError(toAdminUserFacingError(caught, "announcements").message);
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
        carefully, choose a delivery mode, and confirm the selected audience before submitting.
      </Typography>

      {templatesError && (
        <Alert severity="error" sx={{ mb: 2 }}>{templatesError}</Alert>
      )}
      {deliveryModeError && (
        <Alert severity="error" sx={{ mb: 2 }}>{deliveryModeError}</Alert>
      )}
      {siteDeliveryMode && siteDeliveryMode !== "LIVE" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Site-wide email mode is <strong>{siteDeliveryMode.replace("_", " ")}</strong>.
          No announcement can use a more permissive delivery mode.
        </Alert>
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
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="delivery-mode-select-label">Delivery mode</InputLabel>
            <Select
              labelId="delivery-mode-select-label"
              label="Delivery mode"
              value={deliveryMode}
              onChange={(event) => {
                setDeliveryMode(event.target.value as GovNotifyDeliveryMode);
                setSendRequestId(null);
                setSendResult(null);
              }}
            >
              <MenuItem value="LIVE">Live — deliver to the full selected audience</MenuItem>
              <MenuItem value="TEAM_TEST">
                Team test — deliver only to Notify team and guest-list recipients
              </MenuItem>
              <MenuItem value="SIMULATION">
                Simulation — submit every recipient using the Notify test key; deliver none
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="reply-to-select-label">Replies go to</InputLabel>
            <Select
              labelId="reply-to-select-label"
              label="Replies go to"
              value={replyToAddressId}
              onChange={(event) => {
                setReplyToAddressId(event.target.value);
                setSendRequestId(null);
                setSendResult(null);
              }}
            >
              <MenuItem value="">System default — {replyToDefaultDescription}</MenuItem>
              {replyToOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.displayLabel} — {option.emailAddress}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {sendResult ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Announcement accepted. Preparing {sendResult.recipientCount} email
                {sendResult.recipientCount !== 1 ? "s" : ""} in the background
                {sendResult.effectiveDeliveryMode === "SIMULATION"
                  ? " for simulated provider acceptance; no email will be delivered."
                  : "."}
                {sendResult.skippedCount > 0 && ` ${sendResult.skippedCount} skipped (opted out).`}
                {sendResult.resumed && " This send was resumed from its original recipient list."}
                {` Effective mode: ${sendResult.effectiveDeliveryMode.replace("_", " ")}.`}
                {" "}Check send history below to track progress.
              </Alert>
            </>
          ) : (
            <>
              {sendError && <Alert severity="error" sx={{ mb: 2 }}>{sendError}</Alert>}
              <Button
                variant="contained"
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <Campaign />}
                onClick={() => void handleSend()}
                disabled={sending || !siteDeliveryMode}
              >
                {sending ? "Starting…" : sendRequestId ? "Resume announcement send" : `Send to ${sectionName} members`}
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
