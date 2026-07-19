import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export type TemplateSyncStatus = "in_sync" | "drift" | "not_configured" | "fetch_error";

export interface TemplateSyncResult {
  templateKey: string;
  templateUuid?: string;
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

// ============================================================================
// Announcements
// ============================================================================

export interface AnnouncementTemplate {
  id: string;
  name: string;
  updatedAt: string;
  requiredPersonalisation: string[];
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
  queuedCount: number;
  failedToEnqueueCount: number;
  skippedCount: number;
  resumed: boolean;
}

export async function sendSectionAnnouncement(
  sectionId: string,
  templateUuid: string,
  requestId: string,
  templateName?: string
): Promise<SendAnnouncementResult> {
  const callable = httpsCallable<
    { sectionId: string; templateUuid: string; requestId: string; templateName?: string },
    SendAnnouncementResult
  >(functions, "sendSectionAnnouncement");
  const result = await callable({ sectionId, templateUuid, requestId, templateName });
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
  sectionId: string
): Promise<AnnouncementRecipient[]> {
  const callable = httpsCallable<
    { sendId: string; sectionId: string },
    { recipients: AnnouncementRecipient[] }
  >(functions, "getAnnouncementSendRecipients");
  const result = await callable({ sendId, sectionId });
  return result.data.recipients;
}
