import EventAnnouncementAudience from "./EventAnnouncementAudience";
import type { EventAttendeeTicketFilters } from "../utils/bookingApprovalsAdmin";
import type { EventAnnouncementPreview } from "../../../shared/utils/firebaseFunctions/announcements";
import { useEffect, useState } from "react";
import { useSessionDraft, useDraftUnloadWarning } from "../../../shared/hooks/useSessionDraft";
import { normalizedResourceId } from "../../../shared/navigation/sectionRoutes";
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
import { extractDomainErrorCode, reportError, toAdminUserFacingError } from "../../../shared/errors";

interface SendAnnouncementPageProps {
  sectionId: string;
  sectionName: string;
  onBack: () => void;
  /** Render within the event workspace without a second page header. */
  embedded?: boolean;
  eventAudience?: { eventId: string; eventTitle?: string; filters: EventAttendeeTicketFilters; recipientTarget?: "BOOKERS" };
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AnnouncementComposer({
  sectionId,
  sectionName,
  onBack,
  eventAudience,
  embedded = false,
}: SendAnnouncementPageProps) {
  const isEventAnnouncement = !!eventAudience;
  const bookingOwners = eventAudience?.recipientTarget === "BOOKERS";
  const draftKey = announcementDraftKey({ sectionId, eventAudience });
  const [draft, setDraft, discardDraft] = useSessionDraft<{
    selectedId: string;
    audienceFilters: EventAttendeeTicketFilters | undefined;
    deliveryMode: GovNotifyDeliveryMode | null;
    replyToAddressId: string;
    sendRequestId: string | null;
    sendAudienceFingerprint: string | null;
    sendResult: SendAnnouncementResult | null;
  }>(draftKey, { selectedId: "", audienceFilters: eventAudience?.filters, deliveryMode: null, replyToAddressId: "", sendRequestId: null, sendAudienceFingerprint: null, sendResult: null });
  const { selectedId, audienceFilters, replyToAddressId, sendRequestId, sendAudienceFingerprint, sendResult } = draft;
  const setAudienceFilters = (value: EventAttendeeTicketFilters) => setDraft(current => ({ ...current, audienceFilters: value }));
  const setReplyToAddressId = (value: string) => setDraft(current => ({ ...current, replyToAddressId: value }));
  const setSendRequestId = (value: string | null) => setDraft(current => ({ ...current, sendRequestId: value, sendAudienceFingerprint: value ? current.sendAudienceFingerprint : null }));
  const setSendResult = (value: SendAnnouncementResult | null) => setDraft(current => ({ ...current, sendResult: value }));
  const setDeliveryMode = (value: GovNotifyDeliveryMode) => setDraft(current => ({ ...current, deliveryMode: value }));
  useDraftUnloadWarning(!!selectedId && !sendResult);
  const [audiencePreview, setAudiencePreview] = useState<EventAnnouncementPreview | null>(null);
  const [templates, setTemplates] = useState<AnnouncementTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [templatesTrigger, setTemplatesTrigger] = useState(0);
  const [siteDeliveryMode, setSiteDeliveryMode] = useState<GovNotifyDeliveryMode | null>(null);
  const [deliveryModeError, setDeliveryModeError] = useState<string | null>(null);
  const deliveryMode = draft.deliveryMode ?? siteDeliveryMode ?? "SIMULATION";
  const [replyToOptions, setReplyToOptions] = useState<Array<{
    id: string;
    displayLabel: string;
    emailAddress: string;
  }>>([]);
  const [replyToDefaultDescription, setReplyToDefaultDescription] = useState("Notify service default");

  useEffect(() => {
    let current = true;
    setLoadingTemplates(true);
    setTemplatesError(null);
    getAnnouncementTemplates(sectionId)
      .then((items) => { if (current) setTemplates(isEventAnnouncement ? items.filter((template) => !template.requiredPersonalisation.includes("unsubscribeUrl")) : items); })
      .catch((caught) => {
        reportError("admin.announcements.templates", caught, { sectionId });
        if (current) setTemplatesError(toAdminUserFacingError(caught, "announcements").message);
      })
      .finally(() => { if (current) setLoadingTemplates(false); });
    return () => { current = false; };
  }, [sectionId, templatesTrigger, isEventAnnouncement]);

  useEffect(() => {
    let current = true;
    setDeliveryModeError(null);
    getAnnouncementDeliveryConfiguration(sectionId)
      .then((configuration) => {
        if (!current) return;
        const configuredMode = configuration.siteDeliveryMode;
        setSiteDeliveryMode(configuredMode);
        setDraft(previous => ({ ...previous, deliveryMode: configuredMode === "SIMULATION" ? "SIMULATION" : previous.deliveryMode ?? configuredMode }));
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
        if (current) setDeliveryModeError(toAdminUserFacingError(caught, "email-configuration").message);
      });
    return () => { current = false; };
  }, [sectionId, setDraft]);

  const handleTemplateChange = (e: SelectChangeEvent) => {
    setDraft(previous => ({ ...previous, selectedId: e.target.value, sendResult: null, sendRequestId: null, sendAudienceFingerprint: null }));
    setSendError(null);
  };

  useEffect(() => {
    let current = true;
    setPreviewHtml(null);
    setPreviewSubject(null);
    setPreviewError(null);
    if (!selectedId) { setLoadingPreview(false); return; }
    setLoadingPreview(true);
    previewAnnouncementTemplate(sectionId, selectedId)
      .then(({ html, subject }) => {
        if (!current) return;
        setPreviewHtml(html);
        setPreviewSubject(subject);
      })
      .catch(error => {
        reportError("admin.announcements.preview", error, { sectionId, templateId: selectedId });
        if (current) setPreviewError(toAdminUserFacingError(error, "announcements").message);
      })
      .finally(() => { if (current) setLoadingPreview(false); });
    return () => { current = false; };
  }, [sectionId, selectedId]);

  const canResumeEventSend = !!(sendRequestId && sendAudienceFingerprint);
  const handleSend = async () => {
    if (!selectedId || (eventAudience && !canResumeEventSend && !audiencePreview?.recipients.length)) return;
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const selectedTemplate = templates.find((t) => t.id === selectedId);
      const requestId = sendRequestId ?? crypto.randomUUID();
      const audienceFingerprint = sendAudienceFingerprint ?? audiencePreview?.fingerprint;
      // Keep the reviewed audience identity with an uncertain request, without
      // retaining recipient details. The server reconciles the original request.
      setDraft(current => ({ ...current, sendRequestId: requestId, sendAudienceFingerprint: eventAudience ? audienceFingerprint ?? null : null }));
      const result = eventAudience && audienceFilters && audienceFingerprint
        ? await sendSectionAnnouncement(sectionId, selectedId, requestId, selectedTemplate?.name, deliveryMode, replyToAddressId || undefined,
          { eventAudience: { eventId: eventAudience.eventId, filters: audienceFilters, ...(eventAudience.recipientTarget ? { recipientTarget: eventAudience.recipientTarget } : {}) }, audienceFingerprint })
        : replyToAddressId
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
      if (eventAudience && (caught as { code?: string })?.code === "functions/failed-precondition") {
        setSendRequestId(null);
        const reason = extractDomainErrorCode(caught);
        if (!reason || reason === "ANNOUNCEMENT_AUDIENCE_CHANGED" || reason === "ANNOUNCEMENT_AUDIENCE_EMPTY") setAudiencePreview(null);
      }
      reportError("admin.announcements.send", caught, { sectionId, templateId: selectedId });
      setSendError(toAdminUserFacingError(caught, "announcements").message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box className={embedded ? undefined : "page-container"}>
      {embedded ? (
        <>
          <Typography component="h2" variant="h5" gutterBottom>Communications</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {bookingOwners
              ? "Send a manually reviewed message to the owners of matching bookings. Review the booking owners and email preview before sending."
              : "Send an announcement to selected attendee contacts. Review the audience and email preview before sending."}
          </Typography>
          <Typography component="h3" variant="h6" sx={{ mb: 2 }}>
            {sendResult ? "Announcement accepted" : selectedId ? "Draft announcement" : "New announcement"}
          </Typography>
          {selectedId && !sendResult && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {sendRequestId
                ? "This announcement has an existing send request. Resume the announcement send below to check its outcome."
                : "Your announcement draft is kept while you switch tabs in this signed-in session. Continue below, or discard it explicitly to start again."}
            </Alert>
          )}
        </>
      ) : (
        <PageHeader
          title={`Send announcement — ${audiencePreview?.eventTitle ?? eventAudience?.eventTitle ?? sectionName}`}
          onBack={onBack}
        />
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select a GOV Notify template named starting with <strong>BULK:</strong>. Review the preview
        carefully, choose a delivery mode, and confirm the selected audience before submitting.
      </Typography>

      {eventAudience && audienceFilters && <EventAnnouncementAudience sectionId={sectionId} eventId={eventAudience.eventId}
        filters={audienceFilters} onFilters={setAudienceFilters} preview={audiencePreview} onPreview={setAudiencePreview}
        recipientTarget={eventAudience.recipientTarget} disabled={sending || !!sendRequestId} />}

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
                    {eventAudience ? "No BULK: templates without an unsubscribe link found" : "No BULK: templates found in GOV Notify"}
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
                {sendResult.skippedCount > 0 && ` ${sendResult.skippedCount} skipped.`}
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
                disabled={sending || !siteDeliveryMode || (!!eventAudience && !canResumeEventSend && !audiencePreview?.recipients.length)}
              >
                {sending ? "Starting…"
                  : sendRequestId ? "Resume announcement send"
                  : eventAudience && !audiencePreview ? "Preview recipients before sending"
                  : bookingOwners ? `Send to ${audiencePreview!.recipients.length} booking owner${audiencePreview!.recipients.length === 1 ? "" : "s"}`
                  : eventAudience ? `Send to ${audiencePreview!.recipients.length} attendee contacts`
                  : `Send to ${sectionName} members`}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {bookingOwners
                  ? "Messages go only to booking owners, regardless of announcement preferences. Guests and organiser guests are not emailed. This send is manual; no automatic payment reminder is scheduled."
                  : eventAudience ? "Event messages go to all selected attendee contacts, regardless of announcement preferences." : "Contacts who have opted out of announcements will not receive this email."}
              </Typography>
            </>
          )}
        </>
      )}

      {selectedId && <Button sx={{ mt: 2 }} disabled={sending} onClick={() => { discardDraft(); setAudiencePreview(null); setSendError(null); }}>
        {sendResult ? "New announcement" : "Discard announcement draft"}
      </Button>}

      <TemplateEditor sectionName={sectionName} draftKey={draftKey} />

      <AnnouncementSendHistory sectionId={sectionId} refreshTrigger={historyTrigger} sectionScopeNotice={isEventAnnouncement} />
    </Box>
  );
}

function announcementDraftKey({ sectionId, eventAudience }: Pick<SendAnnouncementPageProps, "sectionId" | "eventAudience">): string {
  const audience = eventAudience
    ? JSON.stringify(Object.entries(eventAudience.filters).sort(([a], [b]) => a.localeCompare(b)))
    : "members";
  return `announcement:${normalizedResourceId(sectionId)}:${eventAudience ? normalizedResourceId(eventAudience.eventId) : "section"}:${audience}${eventAudience?.recipientTarget === "BOOKERS" ? ":BOOKERS" : ""}`;
}

export default function SendAnnouncementPage(props: SendAnnouncementPageProps) {
  // An explicit audience URL is a distinct composition; private previews and
  // uncertain send IDs cannot migrate into a different requested audience.
  return <AnnouncementComposer key={announcementDraftKey(props)} {...props} />;
}
