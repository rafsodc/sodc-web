import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export type TemplateSyncStatus = "in_sync" | "drift" | "not_configured" | "fetch_error";

export interface NotifyTemplateCandidate {
  id: string;
  name: string;
  version: number;
  subjectMatch: boolean;
  bodyMatch: boolean;
  contentMatches: boolean;
}

export interface TemplateSyncResult {
  templateKey: string;
  candidates: NotifyTemplateCandidate[];
  boundTemplateId?: string;
  boundTemplateName?: string;
  reviewedVersion?: number;
  currentLiveVersion?: number;
  versionDrift?: boolean;
  bindingUpdatedAt?: string;
  bindingUpdatedBy?: string;
  notifyEditUrl?: string;
  status: TemplateSyncStatus;
  liveSubject?: string;
  liveBody?: string;
  expectedSubject: string;
  expectedBody: string;
  subjectMatch?: boolean;
  bodyMatch?: boolean;
  errorMessage?: string;
}

export async function getTemplateSyncStatus(): Promise<{ results: TemplateSyncResult[] }> {
  const callable = httpsCallable<void, { results: TemplateSyncResult[] }>(
    functions,
    "getTemplateSyncStatus"
  );
  const result = await callable();
  return result.data;
}

export async function setNotifyTemplateBinding(data: {
  templateKey: string;
  notifyTemplateId: string;
  reviewedVersion: number;
}): Promise<{ results: TemplateSyncResult[] }> {
  const callable = httpsCallable<typeof data, { results: TemplateSyncResult[] }>(
    functions,
    "setNotifyTemplateBinding"
  );
  const result = await callable(data);
  return result.data;
}

export async function moveAllNotifyTemplateBindingsToLatestVersion(): Promise<{ results: TemplateSyncResult[] }> {
  const callable = httpsCallable<void, { results: TemplateSyncResult[] }>(
    functions,
    "moveAllNotifyTemplateBindingsToLatestVersion"
  );
  const result = await callable();
  return result.data;
}

// ============================================================================
// Announcements
// ============================================================================

export interface AnnouncementTemplate {
  id: string;
  name: string;
  updatedAt: string;
  requiredPersonalisation: string[];
}

export type GovNotifyDeliveryMode = "SIMULATION" | "TEAM_TEST" | "LIVE";

export async function getAnnouncementDeliveryConfiguration(
  sectionId: string
): Promise<{
  siteDeliveryMode: GovNotifyDeliveryMode;
  replyToOptions?: Array<{ id: string; displayLabel: string; emailAddress: string }>;
  defaultReplyToAddressId?: string | null;
  replyToFallbackSource?: string;
}> {
  const callable = httpsCallable<
    { sectionId: string },
    {
      siteDeliveryMode: GovNotifyDeliveryMode;
      replyToOptions?: Array<{ id: string; displayLabel: string; emailAddress: string }>;
      defaultReplyToAddressId?: string | null;
      replyToFallbackSource?: string;
    }
  >(functions, "getAnnouncementDeliveryConfiguration");
  return (await callable({ sectionId })).data;
}

export async function getAnnouncementTemplates(
  sectionId: string
): Promise<AnnouncementTemplate[]> {
  const callable = httpsCallable<{ sectionId: string }, { templates: AnnouncementTemplate[] }>(
    functions,
    "getAnnouncementTemplates"
  );
  const result = await callable({ sectionId });
  return result.data.templates;
}

export async function previewAnnouncementTemplate(
  sectionId: string,
  templateUuid: string
): Promise<{ html: string; subject: string }> {
  const callable = httpsCallable<
    { sectionId: string; templateUuid: string },
    { html: string; subject: string }
  >(functions, "previewAnnouncementTemplate");
  const result = await callable({ sectionId, templateUuid });
  return result.data;
}

export interface SendAnnouncementResult {
  sendId: string;
  recipientCount: number;
  skippedCount: number;
  preparationQueued: true;
  resumed: boolean;
  requestedDeliveryMode: GovNotifyDeliveryMode;
  siteDeliveryMode: GovNotifyDeliveryMode;
  effectiveDeliveryMode: GovNotifyDeliveryMode;
}

export async function sendSectionAnnouncement(
  sectionId: string,
  templateUuid: string,
  requestId: string,
  templateName: string | undefined,
  deliveryMode: GovNotifyDeliveryMode,
  replyToAddressId?: string,
): Promise<SendAnnouncementResult> {
  const callable = httpsCallable<
    {
      sectionId: string;
      templateUuid: string;
      requestId: string;
      templateName?: string;
      deliveryMode: GovNotifyDeliveryMode;
      replyToAddressId?: string;
    },
    SendAnnouncementResult
  >(functions, "sendSectionAnnouncement");
  const result = await callable({
    sectionId,
    templateUuid,
    requestId,
    templateName,
    deliveryMode,
    replyToAddressId,
  });
  return result.data;
}

export interface AnnouncementSend {
  id: string;
  templateUuid: string;
  templateName: string | null;
  sectionId: string;
  sentBy: string;
  sentAt: string;
  recipientCount: number;
  skippedCount: number;
  processedCount: number;
  failureCount: number;
  requestedDeliveryMode: GovNotifyDeliveryMode;
  siteDeliveryMode: GovNotifyDeliveryMode;
  effectiveDeliveryMode: GovNotifyDeliveryMode;
  replyToAddressId?: string | null;
  replyToDisplayLabel?: string | null;
  replyToEmailAddress?: string | null;
}

export type AnnouncementRecipientStatus =
  | "queued"
  | "enqueue_failed"
  | "sending"
  | "retrying"
  | "delivery_unknown"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "skipped";

export interface AnnouncementRecipient {
  id: string;
  sendId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: AnnouncementRecipientStatus;
  skippedReason?: string;
  sentAt?: string;
  failureReason?: string;
  failureCategory?: "notify_team_only";
  effectiveDeliveryMode: GovNotifyDeliveryMode;
}

export type AnnouncementRecipientStatusFilter =
  | "ALL"
  | "IN_PROGRESS"
  | "PASSED"
  | "NOT_ON_TEAM"
  | "FAILED"
  | "SKIPPED";

export type AnnouncementRecipientInitial = "ALL" | "OTHER" | string;

export interface AnnouncementRecipientPage {
  recipients: AnnouncementRecipient[];
  totalCount: number;
  filteredCount: number;
  initialCounts: Record<string, number>;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function getAnnouncementSendHistory(
  sectionId: string
): Promise<AnnouncementSend[]> {
  const callable = httpsCallable<{ sectionId: string }, { sends: AnnouncementSend[] }>(
    functions,
    "getAnnouncementSendHistory"
  );
  const result = await callable({ sectionId });
  return result.data.sends;
}

export async function getAnnouncementSendRecipients(
  sendId: string,
  sectionId: string,
  options: {
    search?: string;
    statusFilter?: AnnouncementRecipientStatusFilter;
    initial?: AnnouncementRecipientInitial;
    page?: number;
  } = {},
): Promise<AnnouncementRecipientPage> {
  const callable = httpsCallable<
    {
      sendId: string;
      sectionId: string;
      search?: string;
      statusFilter?: AnnouncementRecipientStatusFilter;
      initial?: AnnouncementRecipientInitial;
      page?: number;
    },
    AnnouncementRecipientPage
  >(functions, "getAnnouncementSendRecipients");
  const result = await callable({ sendId, sectionId, ...options });
  return result.data;
}
